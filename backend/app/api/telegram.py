"""
Telegram webhook.

Telegram calls this endpoint every time a user sends the bot a message.
For the MVP the only thing we handle is /start -> reply with a button
that opens the Mini App. Everything else (photos, other text, etc.) is
ignored — the real interface lives in the Mini App, not in chat, per the
project spec.
"""

import logging

from fastapi import APIRouter, Header, HTTPException, Request

from app.core.config import get_settings
from app.telegram.bot_client import TelegramApiError, send_message_with_webapp_button

logger = logging.getLogger("vireli.telegram")

router = APIRouter()


@router.post("/telegram/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str = Header(default=""),
):
    settings = get_settings()

    # Reject anything that doesn't carry the secret we registered with
    # setWebhook — otherwise anyone who finds this URL could send us
    # fake "updates". This is the only header/auth Telegram gives us on
    # webhook calls, so we require it.
    if not settings.telegram_webhook_secret or x_telegram_bot_api_secret_token != settings.telegram_webhook_secret:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    update = await request.json()
    message = update.get("message")

    # Not every update is a text message (could be an edited message,
    # a reaction, etc. depending on allowed_updates) — ignore anything
    # we don't explicitly handle instead of erroring.
    if not message:
        return {"ok": True}

    chat_id = message.get("chat", {}).get("id")
    text = (message.get("text") or "").strip()

    if chat_id and text == "/start":
        if not settings.telegram_webapp_url:
            logger.warning("TELEGRAM_WEBAPP_URL is not configured; cannot send Mini App button")
            return {"ok": True}

        try:
            await send_message_with_webapp_button(
                chat_id=chat_id,
                text="Vireli — AI Content Studio.\n\nЗагружай фото и превращай его в контент за секунды.",
                button_text="Открыть Vireli",
                webapp_url=settings.telegram_webapp_url,
            )
        except TelegramApiError:
            # Log and swallow (see bot_client.py) — Telegram must still
            # get a 200 back or it will keep retrying this same update.
            logger.exception("Failed to send /start reply for chat_id=%s", chat_id)

    # Any other message/command is intentionally ignored for the MVP —
    # the app's UI lives in the Mini App, not in chat.
    return {"ok": True}
