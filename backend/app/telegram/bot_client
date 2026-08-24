"""
Minimal Telegram Bot API client.

We don't use a full bot framework (aiogram/python-telegram-bot) for the
MVP — the bot only needs to reply to /start with a button that opens the
Mini App, so a couple of direct HTTP calls to the Bot API are simpler and
easier to reason about than pulling in a whole framework.
"""

import httpx

from app.core.config import get_settings

TELEGRAM_API_BASE = "https://api.telegram.org"


class TelegramApiError(Exception):
    """Raised when a call to the Telegram Bot API itself fails."""


async def send_message_with_webapp_button(
    chat_id: int,
    text: str,
    button_text: str,
    webapp_url: str,
) -> None:
    """Sends a text message with a single inline button that opens the
    Mini App at `webapp_url` inside Telegram's webview."""
    settings = get_settings()
    url = f"{TELEGRAM_API_BASE}/bot{settings.telegram_bot_token}/sendMessage"

    payload = {
        "chat_id": chat_id,
        "text": text,
        "reply_markup": {
            "inline_keyboard": [[{"text": button_text, "web_app": {"url": webapp_url}}]]
        },
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, json=payload)

    if resp.status_code != 200:
        # Never let a failed Telegram call raise an unhandled 500 back
        # through the webhook — Telegram would just retry the same
        # update forever. Log-and-swallow is the right shape here.
        raise TelegramApiError(f"sendMessage failed: {resp.status_code} {resp.text}")


async def register_webhook(webhook_url: str, secret_token: str) -> dict:
    """Registers our webhook URL with Telegram. Call this once after
    deploying (see README for the exact curl command) — not on every
    server start, to avoid hammering Telegram's API on every restart."""
    settings = get_settings()
    url = f"{TELEGRAM_API_BASE}/bot{settings.telegram_bot_token}/setWebhook"

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            url,
            json={
                "url": webhook_url,
                "secret_token": secret_token,
                "allowed_updates": ["message"],
            },
        )
    return resp.json()
