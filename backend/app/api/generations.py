"""
Generations: upload a photo, spend a credit, process it through an AI
provider in the background, and let the frontend poll for the result.

Flow for POST /api/generations:
  1. validate the upload (type/size) and that the user has credits
  2. upload the input image to Supabase Storage
  3. create a `generations` row (status=pending) and debit the credit
     immediately, logging both in the same DB transaction
  4. schedule background processing and return the row right away so the
     frontend can navigate to the Result screen and poll

Background processing (_process_generation) uses its own DB session
(the request's session is closed by the time it runs) and refunds the
credit automatically if the AI provider call fails, so a failed
generation never silently costs the user credit.
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.models import CreditsTransaction, Generation, GenerationStatus, GenerationType, User
from app.db.session import AsyncSessionLocal, get_db
from app.services import ai
from app.storage.client import download_image, get_signed_url, upload_image

logger = logging.getLogger("vireli.generations")

router = APIRouter()

COST_PER_GENERATION = 1
MAX_FILE_MB = 12
ACCEPTED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


async def _serialize(gen: Generation) -> dict:
    """Turns storage paths into short-lived signed URLs for the client."""
    return {
        "id": str(gen.id),
        "type": gen.type.value if hasattr(gen.type, "value") else gen.type,
        "status": gen.status.value if hasattr(gen.status, "value") else gen.status,
        "input_url": get_signed_url(gen.input_file_url) if gen.input_file_url else None,
        "output_url": (
            get_signed_url(gen.output_file_url)
            if gen.output_file_url and gen.type != GenerationType.caption
            else None
        ),
        "output_text": gen.output_file_url if gen.type == GenerationType.caption and gen.status == GenerationStatus.completed else None,
        "credits_spent": gen.credits_spent,
        "error_message": gen.error_message,
        "created_at": gen.created_at.isoformat(),
    }


@router.post("/generations")
async def create_generation(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    type: str = Form(...),
    style: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if type not in GenerationType.__members__:
        raise HTTPException(status_code=400, detail=f"Unknown generation type: {type}")

    if file.content_type not in ACCEPTED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG or WEBP images are supported")

    content = await file.read()
    if len(content) > MAX_FILE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large (max {MAX_FILE_MB} MB)")

    if user.credits_balance < COST_PER_GENERATION:
        raise HTTPException(status_code=402, detail="Not enough credits")

    input_path = upload_image(content, file.filename or "upload.jpg", file.content_type)

    gen = Generation(
        user_id=user.id,
        type=GenerationType(type),
        status=GenerationStatus.pending,
        input_file_url=input_path,
        credits_spent=COST_PER_GENERATION,
    )
    db.add(gen)

    user.credits_balance -= COST_PER_GENERATION
    db.add(
        CreditsTransaction(
            user_id=user.id,
            amount=-COST_PER_GENERATION,
            reason=f"generation:{type}",
        )
    )

    await db.commit()
    await db.refresh(gen)

    background_tasks.add_task(_process_generation, gen.id, style)

    return await _serialize(gen)


@router.get("/generations")
async def list_generations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Generation).where(Generation.user_id == user.id).order_by(Generation.created_at.desc())
    )
    gens = result.scalars().all()
    return [await _serialize(g) for g in gens]


@router.get("/generations/{generation_id}")
async def get_generation(
    generation_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Generation).where(Generation.id == generation_id, Generation.user_id == user.id)
    )
    gen = result.scalar_one_or_none()
    if gen is None:
        raise HTTPException(status_code=404, detail="Generation not found")
    return await _serialize(gen)


async def _process_generation(generation_id: int, style: str | None) -> None:
    """Runs after the response has been sent. Owns its own DB session."""
    settings = get_settings()

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Generation).where(Generation.id == generation_id))
        gen = result.scalar_one_or_none()
        if gen is None:
            logger.warning("Background task: generation %s vanished before processing", generation_id)
            return

        gen.status = GenerationStatus.processing
        await db.commit()

        try:
            input_bytes = download_image(gen.input_file_url)

            if gen.type == GenerationType.remove_bg:
                output_bytes = await ai.process_remove_bg(input_bytes)
                output_path = upload_image(output_bytes, "output.png", "image/png")
            elif gen.type == GenerationType.enhance:
                output_bytes = await ai.process_enhance(input_bytes)
                output_path = upload_image(output_bytes, "output.png", "image/png")
            elif gen.type == GenerationType.style:
                output_bytes = await ai.process_style(input_bytes, style or "clean")
                output_path = upload_image(output_bytes, "output.png", "image/png")
            elif gen.type == GenerationType.caption:
                caption = await ai.process_caption(input_bytes, "image/jpeg")
                output_path = caption  # stored directly, no image to upload
            else:
                raise ai.AIProviderError(f"Unhandled generation type: {gen.type}")

            gen.status = GenerationStatus.completed
            gen.output_file_url = output_path
            await db.commit()

        except Exception as exc:  # noqa: BLE001 - we want to catch and record any provider failure
            logger.exception("Generation %s failed", generation_id)
            gen.status = GenerationStatus.failed
            gen.error_message = str(exc)[:500]
            await db.commit()

            # Refund the credit - a failed generation should never cost the user.
            user_result = await db.execute(select(User).where(User.id == gen.user_id))
            gen_user = user_result.scalar_one_or_none()
            if gen_user is not None:
                gen_user.credits_balance += gen.credits_spent
                db.add(
                    CreditsTransaction(
                        user_id=gen_user.id,
                        amount=gen.credits_spent,
                        reason=f"refund:generation_failed:{generation_id}",
                    )
                )
                await db.commit()
