from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    # 2FA
    two_factor_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    two_factor_secret: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    # Google OAuth / Gmail integration
    google_access_token: Mapped[str | None] = mapped_column(
        String(2048),
        nullable=True
    )

    google_refresh_token: Mapped[str | None] = mapped_column(
        String(2048),
        nullable=True
    )

    google_token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    google_account_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    # Password-view PIN (stored only as a bcrypt hash)
    password_view_pin_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    # Password reset
    reset_token_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True
    )

    reset_token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
