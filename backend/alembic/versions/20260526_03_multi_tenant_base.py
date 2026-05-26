"""multi_tenant_base

Revision ID: 20260526_03
Revises: 20260526_02
Create Date: 2026-05-26 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid

# revision identifiers, used by Alembic.
revision: str = '20260526_03'
down_revision: Union[str, None] = '20260526_02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create organizations table
    op.create_table(
        'organizations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('slug', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('plan_tier', sa.String(length=20), nullable=False, server_default='basic'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_organizations_id'), 'organizations', ['id'], unique=False)
    op.create_index(op.f('ix_organizations_slug'), 'organizations', ['slug'], unique=True)
    op.create_index(op.f('ix_organizations_uuid'), 'organizations', ['uuid'], unique=True)

    # 2. Seed default organization
    default_org_uuid = str(uuid.uuid4())
    op.execute(
        f"INSERT INTO organizations (uuid, name, slug, is_active, plan_tier, created_at, updated_at) "
        f"VALUES ('{default_org_uuid}', 'MotoStock Main', 'motostock-main', true, 'basic', now(), now())"
    )
    
    # Get ID of the new organization (assumed 1 if empty, but safer to use subquery)
    org_id_subquery = "(SELECT id FROM organizations WHERE slug = 'motostock-main' LIMIT 1)"

    # 3. Add organization_id to all relevant tables
    tables_to_isolate = [
        'users', 'branches', 'products', 'clients', 'suppliers', 
        'sales', 'purchase_orders', 'work_orders', 'vehicles', 'inventory_movements'
    ]

    for table in tables_to_isolate:
        op.add_column(table, sa.Column('organization_id', sa.Integer(), nullable=True))
        op.create_foreign_key(f'fk_{table}_organization', table, 'organizations', ['organization_id'], ['id'])
        # Backfill existing data
        op.execute(f"UPDATE {table} SET organization_id = {org_id_subquery} WHERE organization_id IS NULL")
        # Optimization: indices for isolation
        op.create_index(f'ix_{table}_organization_id', table, ['organization_id'], unique=False)

    # 4. Special cases: Some tables might already have critical unique constraints 
    # that now need to be compound (unique per organization). 
    # e.g., product code, user email, branch name.
    # Note: For Phase 1 we keep them as is and will refactor constraints in Phase 2.


def downgrade() -> None:
    tables_to_isolate = [
        'inventory_movements', 'vehicles', 'work_orders', 'purchase_orders', 
        'sales', 'suppliers', 'clients', 'products', 'branches', 'users'
    ]

    for table in tables_to_isolate:
        op.drop_index(f'ix_{table}_organization_id', table_name=table)
        op.drop_constraint(f'fk_{table}_organization', table, type_='foreignkey')
        op.drop_column(table, 'organization_id')

    op.drop_index(op.f('ix_organizations_uuid'), table_name='organizations')
    op.drop_index(op.f('ix_organizations_slug'), table_name='organizations')
    op.drop_index(op.f('ix_organizations_id'), table_name='organizations')
    op.drop_table('organizations')
