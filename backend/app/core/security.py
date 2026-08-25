"""
Verification of Telegram Mini App `initData`.

Reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

We NEVER trust a telegram_id that the frontend sends as a plain field.
The only trustworthy source of the user's identity is this verified
initData string, which is signed by Telegram using the bot token.
"""

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from urllib.parse import parse_qsl

from app.core.config import get_settings


class InvalidInitDataError(Exception):
    """Raised when initData is missing, malformed, has a bad signature,
    or has expired."""


@dataclass
class TelegramUser:
    id: int
    username: str | None
    first_name: str | None
    last_name: str | None


def _build_secret_key(bot_token: str) -> bytes:
    # secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)
    return hmac.new(
        key=b"WebAppData",
        msg=bot_token.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()


def verify_telegram_init_data(init_data: str) -> TelegramUser:
    """
    Validates the raw `initData` string sent by the Telegram Mini App
    client and returns the verified Telegram user.

    Raises InvalidInitDataError if the signature is invalid, the
    payload is malformed, or it has expired.
    """
    settings = get_settings()

    if not init_data:
        raise InvalidInitDataError("initData is empty")

    if not settings.telegram_bot_token:
        # Fail loudly in any environment - this must always be configured.
        raise InvalidInitDataError("Server misconfiguration: bot token not set")

    try:
        pairs = dict(parse_qsl(init_data, strict_parsing=True))
    except ValueError as exc:
        raise InvalidInitDataError("Malformed initData") from exc

    received_hash = pairs.pop("hash", None)
    if not received_hash:
        raise InvalidInitDataError("Missing hash field")

    # Build the data-check-string: all remaining fields, sorted by key,
    # joined as "key=value" with newline separators.
    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(pairs.items())
    )

    secret_key = _build_secret_key(settings.telegram_bot_token)
    computed_hash = hmac.new(
        key=secret_key,
        msg=data_check_string.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        raise InvalidInitDataError("Signature mismatch")

    auth_date = pairs.get("auth_date")
    if not auth_date or not auth_date.isdigit():
        raise InvalidInitDataError("Missing or invalid auth_date")

    age_seconds = time.time() - int(auth_date)
    if age_seconds > settings.telegram_init_data_max_age_seconds:
        raise InvalidInitDataError("initData has expired")

    user_raw = pairs.get("user")
    if not user_raw:
        raise InvalidInitDataError("Missing user field")

    try:
        user_json = json.loads(user_raw)
    except json.JSONDecodeError as exc:
        raise InvalidInitDataError("Malformed user field") from exc

    if "id" not in user_json:
        raise InvalidInitDataError("user.id missing")

    return TelegramUser(
        id=int(user_json["id"]),
        username=user_json.get("username"),
        first_name=user_json.get("first_name"),
        last_name=user_json.get("last_name"),
    )
