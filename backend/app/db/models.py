"""
ORM models mirroring backend/sql/schema.sql.

These are used for reading/writing data from Python. The actual tables
are created by running schema.sql directly in Supabase - we are not using
Alembic migrations for the MVP to keep things simple.
"""

import enum
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class GenerationStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class GenerationType(str, enum.Enum):
    enhance = "enhance"
    remove_bg = "remove_bg"
    style = "style"
    caption = "caption"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False, index=True)
    username: Mapped[str | None] = mapped_column(String, nullable=True)
    credits_balance: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    generations: Mapped[list["Generation"]] = relationship(back_populates="user")


class CreditsTransaction(Base):
    __tablename__ = "credits_transactions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Generation(Base):
    __tablename__ = "generations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[GenerationType] = mapped_column(Enum(GenerationType, name="generation_type"), nullable=False)
    status: Mapped[GenerationStatus] = mapped_column(
        Enum(GenerationStatus, name="generation_status"),
        nullable=False,
        default=GenerationStatus.pending,
        index=True,
    )
    input_file_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Storage path for image tools (enhance/remove_bg/style). For `caption`
    # generations there's no output image, so this column holds the raw
    # caption text instead - see api/generations.py::_serialize, which
    # knows to treat it as text vs. a signed-URL path based on gen.type.
    output_file_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    credits_spent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="generations")
