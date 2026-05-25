"""add client credit limit

Revision ID: 20260525_01
Revises: 20260521_01
Create Date: 2026-05-25 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260525_01"
down_revision = "20260521_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column(
            "credit_limit",
            sa.Float(),
            nullable=False,
            server_default="500000",
        ),
    )
    op.alter_column("clients", "credit_limit", server_default=None)


def downgrade() -> None:
    op.drop_column("clients", "credit_limit")
