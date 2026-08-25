from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

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
