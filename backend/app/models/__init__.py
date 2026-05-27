"""SQLAlchemy ORM models for MotoStock."""

from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer,
    String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.tenant_mixin import TenantMixin


# ─── Enums ────────────────────────────────────────────────────────────────────

class PaymentMethod(str, enum.Enum):
    cash = "cash"
    card = "card"
    credit = "credit"
    nequi = "nequi"


class PurchaseOrderStatus(str, enum.Enum):
    draft = "draft"
    pending_approval = "pending_approval"
    approved = "approved"
    rejected = "rejected"
    ordered = "ordered"
    partially_received = "partially_received"
    received = "received"
    cancelled = "cancelled"


class MovementType(str, enum.Enum):
    purchase = "purchase"
    sale = "sale"
    adjustment = "adjustment"
    return_supplier = "return_supplier"
    transfer = "transfer"


class WorkOrderStatus(str, enum.Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class DianStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


# ─── Organization (SaaS Tenant) ───────────────────────────────────────────────

class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    plan_tier: Mapped[str] = mapped_column(String(20), default="basic", nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    branches: Mapped[list["Branch"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    users: Mapped[list["User"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    products: Mapped[list["Product"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    clients: Mapped[list["Client"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    suppliers: Mapped[list["Supplier"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    sales: Mapped[list["Sale"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    work_orders: Mapped[list["WorkOrder"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    inventory_movements: Mapped[list["InventoryMovement"]] = relationship(back_populates="organization", cascade="all, delete-orphan")


# ─── Branch ───────────────────────────────────────────────────────────────────

class Branch(Base, TenantMixin):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    organization: Mapped[Optional["Organization"]] = relationship(back_populates="branches")
    users: Mapped[list["User"]] = relationship(back_populates="branch")
    products: Mapped[list["Product"]] = relationship(back_populates="branch")
    sales: Mapped[list["Sale"]] = relationship(back_populates="branch")
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(back_populates="branch")
    vehicles: Mapped[list["Vehicle"]] = relationship(back_populates="branch")
    work_orders: Mapped[list["WorkOrder"]] = relationship(back_populates="branch")
    inventory_movements: Mapped[list["InventoryMovement"]] = relationship(back_populates="branch")


# ─── User (auth) ──────────────────────────────────────────────────────────────

class User(Base, TenantMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    pin_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, index=True)
    role: Mapped[str] = mapped_column(String(20), default="cashier", nullable=False)
    max_discount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    totp_secret: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    totp_backup_codes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    totp_enabled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    organization: Mapped[Optional["Organization"]] = relationship(back_populates="users")
    branch: Mapped["Branch"] = relationship(back_populates="users")


# ─── Product / Inventory ──────────────────────────────────────────────────────

class Product(Base, TenantMixin, SoftDeleteMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    brand: Mapped[str] = mapped_column(String(100), nullable=False)
    barcode: Mapped[Optional[str]] = mapped_column(String(50), index=True, nullable=True)
    supplier: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sale_price: Mapped[float] = mapped_column(Float, nullable=False)
    cost_price: Mapped[float] = mapped_column(Float, nullable=False)
    reorder_threshold: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organization: Mapped[Optional["Organization"]] = relationship(back_populates="products")
    branch: Mapped["Branch"] = relationship(back_populates="products")
    sale_items: Mapped[list["SaleItem"]] = relationship(back_populates="product")
    order_items: Mapped[list["PurchaseOrderItem"]] = relationship(back_populates="product")
    combo_items: Mapped[list["ComboItem"]] = relationship(back_populates="product")
    inventory_movements: Mapped[list["InventoryMovement"]] = relationship(back_populates="product")


# ─── Inventory Audit ──────────────────────────────────────────────────────────

class InventoryMovement(Base, TenantMixin):
    __tablename__ = "inventory_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    movement_type: Mapped[MovementType] = mapped_column(Enum(MovementType), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    previous_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    new_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    
    previous_cost: Mapped[float] = mapped_column(Float, nullable=False)
    new_cost: Mapped[float] = mapped_column(Float, nullable=False)
    unit_cost: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    organization: Mapped[Optional["Organization"]] = relationship(back_populates="inventory_movements")
    product: Mapped["Product"] = relationship(back_populates="inventory_movements")
    branch: Mapped["Branch"] = relationship(back_populates="inventory_movements")
    user: Mapped["User"] = relationship()


# ─── Combo ────────────────────────────────────────────────────────────────────

class Combo(Base, TenantMixin):
    __tablename__ = "combos"

    organization: Mapped[Optional["Organization"]] = relationship()

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["ComboItem"]] = relationship(back_populates="combo", cascade="all, delete-orphan")


class ComboItem(Base):
    __tablename__ = "combo_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    combo_id: Mapped[int] = mapped_column(ForeignKey("combos.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    combo: Mapped["Combo"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship(back_populates="combo_items")


# ─── Client ───────────────────────────────────────────────────────────────────

class Client(Base, TenantMixin):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_id: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[str] = mapped_column(String(30), nullable=False)
    motorcycle_model: Mapped[str] = mapped_column(String(150), nullable=False)
    last_service_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    oil_change_interval_km: Mapped[int] = mapped_column(Integer, default=6000, nullable=False)
    current_km: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    credit_limit: Mapped[float] = mapped_column(Float, default=500000.0, nullable=False)
    credit_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    organization: Mapped[Optional["Organization"]] = relationship(back_populates="clients")
    sales: Mapped[list["Sale"]] = relationship(back_populates="client")
    credit_ledger: Mapped[list["CreditLedger"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    vehicles: Mapped[list["Vehicle"]] = relationship(back_populates="client", cascade="all, delete-orphan")


# ─── Credit Ledger ────────────────────────────────────────────────────────────

class CreditLedger(Base, TenantMixin):
    __tablename__ = "credit_ledger"

    organization: Mapped[Optional["Organization"]] = relationship()

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    client: Mapped["Client"] = relationship(back_populates="credit_ledger")


# ─── Sale ─────────────────────────────────────────────────────────────────────

class Sale(Base, TenantMixin):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False, index=True)
    offline_id: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True, nullable=True)
    client_id: Mapped[Optional[int]] = mapped_column(ForeignKey("clients.id"), nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    subtotal: Mapped[float] = mapped_column(Float, nullable=False)
    discount_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total: Mapped[float] = mapped_column(Float, nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    organization: Mapped[Optional["Organization"]] = relationship(back_populates="sales")
    branch: Mapped["Branch"] = relationship(back_populates="sales")
    client: Mapped[Optional["Client"]] = relationship(back_populates="sales")
    items: Mapped[list["SaleItem"]] = relationship(back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)

    sale: Mapped["Sale"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship(back_populates="sale_items")


# ─── Purchase Order ───────────────────────────────────────────────────────────

class Supplier(Base, TenantMixin):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    contact_name: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(30), nullable=False, default="")
    email: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    address: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    rating: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    organization: Mapped[Optional["Organization"]] = relationship(back_populates="suppliers")


class PurchaseOrder(Base, TenantMixin):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False, index=True)
    supplier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("suppliers.id"), nullable=True)
    supplier: Mapped[str] = mapped_column(String(150), nullable=False)
    status: Mapped[PurchaseOrderStatus] = mapped_column(
        Enum(PurchaseOrderStatus), default=PurchaseOrderStatus.draft, nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    total: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="")
    
    approved_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    organization: Mapped[Optional["Organization"]] = relationship(back_populates="purchase_orders")
    branch: Mapped["Branch"] = relationship(back_populates="purchase_orders")
    items: Mapped[list["PurchaseOrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    approved_by: Mapped[Optional["User"]] = relationship()


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    received_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unit_cost: Mapped[float] = mapped_column(Float, nullable=False)

    order: Mapped["PurchaseOrder"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship(back_populates="order_items")


# ─── Invoicing (DIAN/Siigo) ───────────────────────────────────────────────────

class CompanyConfig(Base, TenantMixin):
    __tablename__ = "company_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nit: Mapped[str] = mapped_column(String(30), nullable=False)
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    dian_resolution: Mapped[str] = mapped_column(String(100), nullable=False)
    resolution_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    invoice_prefix: Mapped[str] = mapped_column(String(20), default="FV", nullable=False)
    cert_path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cert_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    provider: Mapped[str] = mapped_column(String(30), default="siigo", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Invoice(Base, TenantMixin):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sale_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sales.id"), nullable=True, index=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    invoice_number: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    invoice_prefix: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    resolution_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cufe: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    qr_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dian_status: Mapped[DianStatus] = mapped_column(Enum(DianStatus), default=DianStatus.pending, nullable=False)
    dian_response_xml: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    provider_payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    subtotal: Mapped[float] = mapped_column(Float, nullable=False)
    tax_total: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ServiceTemplate(Base, TenantMixin):
    __tablename__ = "service_templates"

    organization: Mapped[Optional["Organization"]] = relationship()

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    estimated_price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    estimated_hours: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Vehicle(Base, TenantMixin):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    brand: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    plate: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    organization: Mapped[Optional["Organization"]] = relationship()
    branch: Mapped["Branch"] = relationship(back_populates="vehicles")
    client: Mapped["Client"] = relationship(back_populates="vehicles")
    work_orders: Mapped[list["WorkOrder"]] = relationship(back_populates="vehicle", cascade="all, delete-orphan")


class WorkOrder(Base, TenantMixin):
    __tablename__ = "work_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False, index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    mechanic_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    status: Mapped[WorkOrderStatus] = mapped_column(
        Enum(WorkOrderStatus), default=WorkOrderStatus.scheduled, nullable=False
    )
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    organization: Mapped[Optional["Organization"]] = relationship(back_populates="work_orders")
    branch: Mapped["Branch"] = relationship(back_populates="work_orders")
    vehicle: Mapped["Vehicle"] = relationship(back_populates="work_orders")
    services: Mapped[list["WorkOrderService"]] = relationship(
        back_populates="work_order", cascade="all, delete-orphan"
    )


class WorkOrderService(Base):
    __tablename__ = "work_order_services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    work_order_id: Mapped[int] = mapped_column(ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False)
    service_template_id: Mapped[int] = mapped_column(ForeignKey("service_templates.id"), nullable=False)

    work_order: Mapped["WorkOrder"] = relationship(back_populates="services")
    service_template: Mapped["ServiceTemplate"] = relationship()


from app.models.refresh_token import RefreshToken  # noqa: E402, F401
import RefreshToken  # noqa: E402, F401
