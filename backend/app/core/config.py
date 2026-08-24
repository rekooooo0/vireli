"""
Central application configuration.

All secrets and environment-specific values are read from environment
variables (see .env.example at the repo root). Never hardcode secrets here.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Telegram ---
    telegram_bot_token: str = ""
    # The deployed Mini App URL (GitHub Pages), e.g. https://user.github.io/vireli/
    # Sent to users as the "Open App" button target on /start.
    telegram_webapp_url: str = ""
    # Random secret registered with Telegram's setWebhook (secret_token param).
    # Telegram echoes it back on every webhook call as the
    # X-Telegram-Bot-Api-Secret-Token header, so we can reject requests that
    # don't have it instead of trusting anyone who finds our webhook URL.
    telegram_webhook_secret: str = ""

    # --- Supabase ---
    supabase_url: str = ""
    supabase_service_key: str = ""
    database_url: str = ""

    # --- AI providers ---
    openrouter_api_key: str = ""
    huggingface_api_token: str = ""
    sber_auth_key: str = ""

    # --- App ---
    environment: str = "development"
    frontend_origin: str = "http://localhost:5173"

    # How old (in seconds) a Telegram initData payload is allowed to be
    # before we reject it as expired. Protects against replay attacks.
    telegram_init_data_max_age_seconds: int = 3600


@lru_cache
def get_settings() -> Settings:
    """
    Cached settings instance. Import this function (not Settings directly)
    everywhere in the app, so environment variables are read once.
    """
    return Settings()

