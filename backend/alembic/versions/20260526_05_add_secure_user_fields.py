"""add secure user fields

Revision ID: 20260526_05
Revises: 20260526_04
Create Date: 2026-06-01 17:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260526_05'
down_revision: Union[str, None] = '20260526_04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new fields to users table
    op.add_column('users', sa.Column('_pin_code_encrypted', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('_recovery_email_encrypted', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('_phone_number_encrypted', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('_personal_notes_encrypted', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('_emergency_contact_encrypted', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('_encrypted_fields_marker', sa.String(length=10), server_default='ENCRYPTED', nullable=True))


def downgrade() -> None:
    op.drop_column('users', '_encrypted_fields_marker')
    op.drop_column('users', '_emergency_contact_encrypted')
    op.drop_column('users', '_personal_notes_encrypted')
    op.drop_column('users', '_phone_number_encrypted')
    op.drop_column('users', '_recovery_email_encrypted')
    op.drop_column('users', '_pin_code_encrypted')
