from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import InvalidInitDataError, verify_telegram_init_data
from app.db.session import get_db

router = APIRouter()


@router.get("/health")
def health_check():
    """Basic liveness check. Render/UptimeRobot can ping this."""
    return {"status": "ok"}


@router.get("/health/db")
async def health_check_db(db: AsyncSession = Depends(get_db)):
    """
    Stage 2 diagnostic endpoint: confirms the backend can actually reach
    Supabase Postgres. Safe to keep long-term as an infra health check.
    """
    try:
        await db.execute(text("select 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unreachable: {exc}") from exc
    return {"status": "ok", "database": "connected"}


@router.get("/auth/telegram/verify-test")
def verify_test(x_telegram_init_data: str = Header(default="")):
    """
    Temporary diagnostic endpoint for Stage 1 only.

    Lets us confirm that Telegram initData verification works end-to-end
    before the real /api/auth/telegram endpoint (with DB user creation)
    is built in a later stage. Safe to remove once that endpoint exists.
    """
    try:
        user = verify_telegram_init_data(x_telegram_init_data)
    except InvalidInitDataError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    return {
        "verified": True,
        "telegram_id": user.id,
        "username": user.username,
    }
