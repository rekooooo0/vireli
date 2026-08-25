"""
Shared FastAPI dependencies for authenticated endpoints.

Every endpoint that needs to know "which user is calling" depends on
get_current_user, which:
  1. verifies the signed Telegram initData header (never trust a plain
     telegram_id field from the client),
  2. looks the user up by telegram_id,
  3. creates the user (with a signup credit bonus) on first sight.

This is the single place new users get created, so credit-granting logic
only lives here.
"""

import logging

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import InvalidInitDataError, verify_telegram_init_data
from app.db.models import CreditsTransaction, User
from app.db.session import get_db

logger = logging.getLogger("vireli.auth")

SIGNUP_BONUS_CREDITS = 5


async def get_current_user(
    x_telegram_init_data: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        tg_user = verify_telegram_init_data(x_telegram_init_data)
    except InvalidInitDataError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    result = await db.execute(select(User).where(User.telegram_id == tg_user.id))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            telegram_id=tg_user.id,
            username=tg_user.username,
            credits_balance=SIGNUP_BONUS_CREDITS,
        )
        db.add(user)
        await db.flush()  # assigns user.id without ending the transaction

        db.add(
            CreditsTransaction(
                user_id=user.id,
                amount=SIGNUP_BONUS_CREDITS,
                reason="signup_bonus",
            )
        )
        await db.commit()
        await db.refresh(user)
        logger.info("Created new user telegram_id=%s with signup bonus", tg_user.id)
    elif tg_user.username != user.username:
        # Telegram usernames can change - keep ours in sync opportunistically.
        user.username = tg_user.username
        await db.commit()
        await db.refresh(user)

    return user
