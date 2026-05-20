"""add invoices and company_config

Revision ID: 20260508_01
Revises:
Create Date: 2026-05-08 11:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260508_01"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    dian_status_enum = sa.Enum("pending", "accepted", "rejected", name="dian_status_enum")
    dian_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "company_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nit", sa.String(length=30), nullable=False),
        sa.Column("company_name", sa.String(length=200), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.Column("dian_resolution", sa.String(length=100), nullable=False),
        sa.Column("resolution_number", sa.String(length=100), nullable=True),
        sa.Column("invoice_prefix", sa.String(length=20), nullable=False, server_default="FV"),
        sa.Column("cert_path", sa.String(length=255), nullable=True),
        sa.Column("cert_password", sa.String(length=255), nullable=True),
        sa.Column("provider", sa.String(length=30), nullable=False, server_default="siigo"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_company_config_id"), "company_config", ["id"], unique=False)

    op.create_table(
        "invoices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sale_id", sa.Integer(), nullable=True),
        sa.Column("external_id", sa.String(length=100), nullable=True),
        sa.Column("invoice_number", sa.String(length=80), nullable=False),
        sa.Column("invoice_prefix", sa.String(length=20), nullable=True),
        sa.Column("resolution_number", sa.String(length=100), nullable=True),
        sa.Column("cufe", sa.String(length=120), nullable=True),
        sa.Column("qr_code", sa.Text(), nullable=True),
        sa.Column("dian_status", dian_status_enum, nullable=False, server_default="pending"),
        sa.Column("dian_response_xml", sa.Text(), nullable=True),
        sa.Column("provider_payload", sa.Text(), nullable=True),
        sa.Column("subtotal", sa.Float(), nullable=False),
        sa.Column("tax_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["sale_id"], ["sales.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_invoices_id"), "invoices", ["id"], unique=False)
    op.create_index(op.f("ix_invoices_sale_id"), "invoices", ["sale_id"], unique=False)
    op.create_index(op.f("ix_invoices_external_id"), "invoices", ["external_id"], unique=False)
    op.create_index(op.f("ix_invoices_invoice_number"), "invoices", ["invoice_number"], unique=False)
    op.create_index(op.f("ix_invoices_cufe"), "invoices", ["cufe"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_invoices_cufe"), table_name="invoices")
    op.drop_index(op.f("ix_invoices_invoice_number"), table_name="invoices")
    op.drop_index(op.f("ix_invoices_external_id"), table_name="invoices")
    op.drop_index(op.f("ix_invoices_sale_id"), table_name="invoices")
    op.drop_index(op.f("ix_invoices_id"), table_name="invoices")
    op.drop_table("invoices")

    op.drop_index(op.f("ix_company_config_id"), table_name="company_config")
    op.drop_table("company_config")

    dian_status_enum = sa.Enum("pending", "accepted", "rejected", name="dian_status_enum")
    dian_status_enum.drop(op.get_bind(), checkfirst=True)
