"""add 2fa fields

Revision ID: 2ce0380292c0
Revises: 1f8501838dc6
Create Date: 2026-08-29
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2ce0380292c0"
down_revision: Union[str, Sequence[str], None] = "1f8501838dc6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "two_factor_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false()
        )
    )

    op.add_column(
        "users",
        sa.Column(
            "two_factor_secret",
            sa.String(length=255),
            nullable=True
        )
    )

    op.alter_column(
        "users",
        "two_factor_enabled",
        server_default=None
    )


def downgrade() -> None:
    op.drop_column(
        "users",
        "two_factor_secret"
    )

    op.drop_column(
        "users",
        "two_factor_enabled"
    )