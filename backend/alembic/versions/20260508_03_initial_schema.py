"""initial schema

Revision ID: 20260508_03
Revises: 20260508_02
Create Date: 2026-05-08 14:00:00.000000

Esta migraci├│n crea todas las tablas iniciales del sistema,
reemplazando el uso del seed.sql para mantener consistencia.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260508_03"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums idempotentes (evita DuplicateObject al crear tablas)
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE payment_method_enum AS ENUM ('cash', 'card', 'credit', 'nequi');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE order_status_enum AS ENUM ('pending', 'sent', 'received');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    payment_method_enum = postgresql.ENUM(
        "cash", "card", "credit", "nequi", name="payment_method_enum", create_type=False
    )
    order_status_enum = postgresql.ENUM(
        "pending", "sent", "received", name="order_status_enum", create_type=False
    )
    
    # Tabla users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=100), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("pin_code", sa.String(length=10), nullable=True),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="cashier"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("pin_code")
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=False)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)
    op.create_index(op.f("ix_users_pin_code"), "users", ["pin_code"], unique=False)

    # Tabla products
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("brand", sa.String(length=100), nullable=False),
        sa.Column("barcode", sa.String(length=50), nullable=True),
        sa.Column("supplier", sa.String(length=150), nullable=True),
        sa.Column("stock", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sale_price", sa.Float(), nullable=False),
        sa.Column("cost_price", sa.Float(), nullable=False),
        sa.Column("reorder_threshold", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
        sa.UniqueConstraint("barcode")
    )
    op.create_index(op.f("ix_products_id"), "products", ["id"], unique=False)

    # Tabla clients
    op.create_table(
        "clients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.String(length=50), nullable=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=100), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=False),
        sa.Column("motorcycle_model", sa.String(length=150), nullable=False),
        sa.Column("last_service_date", sa.Date(), nullable=True),
        sa.Column("oil_change_interval_km", sa.Integer(), nullable=False, server_default="6000"),
        sa.Column("current_km", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("credit_balance", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_id")
    )
    op.create_index(op.f("ix_clients_id"), "clients", ["id"], unique=False)
    op.create_index(op.f("ix_clients_document_id"), "clients", ["document_id"], unique=False)

    # Tabla combos
    op.create_table(
        "combos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(op.f("ix_combos_id"), "combos", ["id"], unique=False)

    # Tabla combo_items
    op.create_table(
        "combo_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("combo_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["combo_id"], ["combos.id"], ),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(op.f("ix_combo_items_id"), "combo_items", ["id"], unique=False)

    # Tabla sales
    op.create_table(
        "sales",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("subtotal", sa.Float(), nullable=False),
        sa.Column("discount_pct", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("total", sa.Float(), nullable=False),
        sa.Column("payment_method", payment_method_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(op.f("ix_sales_id"), "sales", ["id"], unique=False)

    # Tabla sale_items
    op.create_table(
        "sale_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sale_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ),
        sa.ForeignKeyConstraint(["sale_id"], ["sales.id"], ),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(op.f("ix_sale_items_id"), "sale_items", ["id"], unique=False)

    # Tabla purchase_orders
    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("supplier", sa.String(length=150), nullable=False),
        sa.Column("status", order_status_enum, nullable=False, server_default="pending"),
        sa.Column("order_date", sa.Date(), nullable=False),
        sa.Column("expected_date", sa.Date(), nullable=True),
        sa.Column("received_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(op.f("ix_purchase_orders_id"), "purchase_orders", ["id"], unique=False)

    # Tabla purchase_order_items
    op.create_table(
        "purchase_order_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_cost", sa.Float(), nullable=False),
        sa.Column("received_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["order_id"], ["purchase_orders.id"], ),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(op.f("ix_purchase_order_items_id"), "purchase_order_items", ["id"], unique=False)

    # Tabla credit_ledger
    op.create_table(
        "credit_ledger",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(op.f("ix_credit_ledger_id"), "credit_ledger", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_credit_ledger_id"), table_name="credit_ledger")
    op.drop_table("credit_ledger")
    op.drop_index(op.f("ix_purchase_order_items_id"), table_name="purchase_order_items")
    op.drop_table("purchase_order_items")
    op.drop_index(op.f("ix_purchase_orders_id"), table_name="purchase_orders")
    op.drop_table("purchase_orders")
    op.drop_index(op.f("ix_sale_items_id"), table_name="sale_items")
    op.drop_table("sale_items")
    op.drop_index(op.f("ix_sales_id"), table_name="sales")
    op.drop_table("sales")
    op.drop_index(op.f("ix_combo_items_id"), table_name="combo_items")
    op.drop_table("combo_items")
    op.drop_index(op.f("ix_combos_id"), table_name="combos")
    op.drop_table("combos")
    op.drop_index(op.f("ix_clients_document_id"), table_name="clients")
    op.drop_index(op.f("ix_clients_id"), table_name="clients")
    op.drop_table("clients")
    op.drop_index(op.f("ix_products_id"), table_name="products")
    op.drop_table("products")
    op.drop_index(op.f("ix_users_pin_code"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_table("users")
    order_status_enum.drop(op.get_bind(), checkfirst=True)
    payment_method_enum.drop(op.get_bind(), checkfirst=True)
