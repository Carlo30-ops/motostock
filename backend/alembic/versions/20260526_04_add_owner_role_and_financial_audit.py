"""add owner role and financial audit

Revision ID: 20260526_04
Revises: 20260526_03
Create Date: 2026-05-26 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260526_04'
down_revision: Union[str, None] = '20260526_03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create financial_audit_logs table
    op.create_table(
        'financial_audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('branch_id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=True),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('resource', sa.String(length=50), nullable=False),
        sa.Column('resource_id', sa.String(length=50), nullable=True),
        sa.Column('old_value', sa.Text(), nullable=True),
        sa.Column('new_value', sa.Text(), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_financial_audit_logs_branch_id'), 'financial_audit_logs', ['branch_id'], unique=False)
    op.create_index(op.f('ix_financial_audit_logs_event_type'), 'financial_audit_logs', ['event_type'], unique=False)
    op.create_index(op.f('ix_financial_audit_logs_id'), 'financial_audit_logs', ['id'], unique=False)
    op.create_index(op.f('ix_financial_audit_logs_organization_id'), 'financial_audit_logs', ['organization_id'], unique=False)
    op.create_index(op.f('ix_financial_audit_logs_user_id'), 'financial_audit_logs', ['user_id'], unique=False)
    op.create_index(op.f('ix_financial_audit_logs_created_at'), 'financial_audit_logs', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_financial_audit_logs_user_id'), table_name='financial_audit_logs')
    op.drop_index(op.f('ix_financial_audit_logs_organization_id'), table_name='financial_audit_logs')
    op.drop_index(op.f('ix_financial_audit_logs_id'), table_name='financial_audit_logs')
    op.drop_index(op.f('ix_financial_audit_logs_event_type'), table_name='financial_audit_logs')
    op.drop_index(op.f('ix_financial_audit_logs_branch_id'), table_name='financial_audit_logs')
    op.drop_index(op.f('ix_financial_audit_logs_created_at'), table_name='financial_audit_logs')
    op.drop_table('financial_audit_logs')
