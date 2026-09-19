"""add Google OAuth and password-view PIN fields

Revision ID: 8b3e2a1c4d5f
Revises: 2ce0380292c0
Create Date: 2026-09-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8b3e2a1c4d5f"
down_revision: Union[str, Sequence[str], None] = "2ce0380292c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("google_access_token", sa.String(length=2048), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("google_refresh_token", sa.String(length=2048), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("google_token_expires_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("google_account_email", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("password_view_pin_hash", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "password_view_pin_hash")
    op.drop_column("users", "google_account_email")
    op.drop_column("users", "google_token_expires_at")
    op.drop_column("users", "google_refresh_token")
    op.drop_column("users", "google_access_token")
