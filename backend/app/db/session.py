"""
Database engine/session setup.

Reads DATABASE_URL from settings (the Supabase Postgres connection string).
Uses SQLAlchemy's async engine with the asyncpg driver.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

# Supabase gives you a "postgresql://" URL - SQLAlchemy's async engine
# needs the "+asyncpg" driver marker.
_raw_url = settings.database_url
_async_url = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(_async_url, pool_pre_ping=True, echo=False)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields a DB session, closes it after the request."""
    async with AsyncSessionLocal() as session:
        yield session
