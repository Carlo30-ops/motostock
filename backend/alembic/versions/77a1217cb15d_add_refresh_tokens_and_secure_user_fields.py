"""add refresh tokens and secure user fields

Revision ID: 77a1217cb15d
Revises: f59810d75dca
Create Date: 2026-05-29 14:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '77a1217cb15d'
down_revision: Union[str, None] = 'f59810d75dca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create refresh_tokens table
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_refresh_tokens_id'), 'refresh_tokens', ['id'], unique=False)
    op.create_index(op.f('ix_refresh_tokens_token'), 'refresh_tokens', ['token'], unique=True)
    op.create_index(op.f('ix_refresh_tokens_user_id'), 'refresh_tokens', ['user_id'], unique=False)

    # 2. Add new fields to users table
    # Note: pin_code already existed as a String(10) in previous schema, but SecureUser uses _pin_code_encrypted (Text).
    # We should add the new encrypted fields.
    op.add_column('users', sa.Column('_pin_code_encrypted', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('_recovery_email_encrypted', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('_phone_number_encrypted', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('_personal_notes_encrypted', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('_emergency_contact_encrypted', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('_encrypted_fields_marker', sa.String(length=10), server_default='ENCRYPTED', nullable=True))


def downgrade() -> None:
    # 1. Drop users columns
    op.drop_column('users', '_encrypted_fields_marker')
    op.drop_column('users', '_emergency_contact_encrypted')
    op.drop_column('users', '_personal_notes_encrypted')
    op.drop_column('users', '_phone_number_encrypted')
    op.drop_column('users', '_recovery_email_encrypted')
    op.drop_column('users', '_pin_code_encrypted')

    # 2. Drop refresh_tokens table
    op.drop_index(op.f('ix_refresh_tokens_user_id'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_token'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_id'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')
