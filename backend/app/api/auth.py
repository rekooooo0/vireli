"""
Real Telegram auth endpoint (Stage 4).

Replaces the temporary /api/auth/telegram/verify-test from Stage 1: this
one actually creates/loads the user row (see api/deps.get_current_user)
instead of just checking the signature.
"""

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.db.models import User

router = APIRouter()


@router.post("/auth/telegram")
async def auth_telegram(user: User = Depends(get_current_user)):
    return {
        "verified": True,
        "telegram_id": user.telegram_id,
        "username": user.username,
        "credits_balance": user.credits_balance,
    }
