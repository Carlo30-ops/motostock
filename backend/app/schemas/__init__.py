"""Pydantic schemas for MotoStock API."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from pydantic import BaseModel, ConfigDict, computed_field, field_validator

# ─── Auth ─────────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    refresh_token: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenData(BaseModel):
    username: Optional[str] = None


class UserCreate(BaseModel):
    username: str
    email: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    role: str
    is_active: bool


class PinLogin(BaseModel):
    pin: str


# ─── Product ──────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    code: str
    name: str
    category: str
    brand: str
    barcode: Optional[str] = None
    supplier: Optional[str] = None
    stock: int = 0
    sale_price: float
    cost_price: float
    reorder_threshold: int = 10


class ProductUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    barcode: Optional[str] = None
    supplier: Optional[str] = None
    stock: Optional[int] = None
    sale_price: Optional[float] = None
    cost_price: Optional[float] = None
    reorder_threshold: Optional[int] = None


class ProductOut(ProductCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


# ─── Combo ────────────────────────────────────────────────────────────────────

class ComboItemIn(BaseModel):
    product_id: int
    quantity: int = 1


class ComboItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    quantity: int


class ComboCreate(BaseModel):
    name: str
    price: float
    items: list[ComboItemIn]


class ComboOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    price: float
    items: list[ComboItemOut]
    created_at: datetime


# ─── Client ───────────────────────────────────────────────────────────────────

class ClientCreate(BaseModel):
    document_id: Optional[str] = None
    name: str
    email: Optional[str] = None
    phone: str
    motorcycle_model: str
    last_service_date: Optional[date] = None
    oil_change_interval_km: int = 6000
    current_km: int = 0
    credit_limit: float = 500000.0
    credit_balance: float = 0.0

    @field_validator("credit_limit")
    @classmethod
    def validate_credit_limit(cls, value: float) -> float:
        if value < 0:
            raise ValueError("credit_limit must be greater than or equal to 0")
        return value

    @field_validator("credit_balance")
    @classmethod
    def validate_credit_balance(cls, value: float) -> float:
        if value < 0:
            raise ValueError("credit_balance must be greater than or equal to 0")
        return value


class ClientUpdate(BaseModel):
    document_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    motorcycle_model: Optional[str] = None
    last_service_date: Optional[date] = None
    oil_change_interval_km: Optional[int] = None
    current_km: Optional[int] = None
    credit_limit: Optional[float] = None
    credit_balance: Optional[float] = None

    @field_validator("credit_limit", "credit_balance")
    @classmethod
    def validate_credit_values(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value < 0:
            raise ValueError("credit values must be greater than or equal to 0")
        return value


class ClientOut(ClientCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def next_service_km(self) -> int:
        return self.current_km + self.oil_change_interval_km

    @computed_field
    @property
    def next_oil_change_date(self) -> Optional[date]:
        if not self.last_service_date:
            return None
        estimated_days_for_interval = max(1, self.oil_change_interval_km // 50)
        return self.last_service_date + timedelta(days=estimated_days_for_interval)


# ─── Credit Ledger ────────────────────────────────────────────────────────────

class CreditAdjust(BaseModel):
    amount: float           # positive = add, negative = deduct
    description: str = ""


class CreditLedgerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    client_id: int
    amount: float
    description: str
    created_at: datetime


# ─── Sale ─────────────────────────────────────────────────────────────────────

class SaleItemIn(BaseModel):
    product_id: int
    quantity: int
    unit_price: float


class SaleItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    quantity: int
    unit_price: float


class SaleCreate(BaseModel):
    offline_id: Optional[str] = None
    client_id: Optional[int] = None
    date: date
    items: list[SaleItemIn]
    discount_pct: float = 0.0
    payment_method: str
    expected_total: Optional[float] = None

    @field_validator("discount_pct")
    @classmethod
    def validate_discount_pct(cls, value: float) -> float:
        if value < 0 or value > 100:
            raise ValueError("discount_pct must be between 0 and 100")
        return value


class SaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    offline_id: Optional[str] = None
    client_id: Optional[int]
    date: date
    subtotal: float
    discount_pct: float
    total: float
    payment_method: str
    items: list[SaleItemOut]
    created_at: datetime


# ─── Purchase Order ───────────────────────────────────────────────────────────

class PurchaseOrderItemIn(BaseModel):
    product_id: int
    quantity: int
    unit_cost: float


class PurchaseOrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    quantity: int
    unit_cost: float


class PurchaseOrderCreate(BaseModel):
    supplier: str
    supplier_id: Optional[int] = None
    date: date
    items: list[PurchaseOrderItemIn]
    notes: str = ""


class PurchaseOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    supplier: str
    supplier_id: Optional[int] = None
    status: str
    date: date
    total: float
    notes: str
    items: list[PurchaseOrderItemOut]
    created_at: datetime


class PurchaseOrderStatusUpdate(BaseModel):
    status: str   # "sent" | "received"


# ─── Reports ──────────────────────────────────────────────────────────────────

class SalesReportRow(BaseModel):
    product_id: int
    product_name: str
    category: str
    quantity_sold: int
    revenue: float
    cost: float
    profit: float


class SalesReport(BaseModel):
    date_from: date
    date_to: date
    total_revenue: float
    total_cost: float
    total_profit: float
    total_transactions: int
    average_ticket: float
    rows: list[SalesReportRow]


class InventoryReportRow(BaseModel):
    product_id: int
    product_name: str
    category: str
    brand: str
    stock: int
    cost_price: float
    stock_value: float
    status: str


class InventoryReport(BaseModel):
    total_products: int
    total_units: int
    total_stock_value: float
    rows: list[InventoryReportRow]


# ─── Billing / DIAN (scaffold) ────────────────────────────────────────────────

class DianParty(BaseModel):
    document_id: str
    name: str
    email: Optional[str] = None


class DianInvoiceLine(BaseModel):
    product_code: str
    description: str
    quantity: float
    unit_price: float
    tax_rate: float = 19.0


class DianInvoiceCreate(BaseModel):
    client: DianParty
    issue_date: date
    lines: list[DianInvoiceLine]
    currency: str = "COP"
    notes: str = ""


class DianInvoiceOut(BaseModel):
    invoice_number: str
    status: str
    subtotal: float
    tax_total: float
    total: float
    cufe: Optional[str] = None
    raw_xml: Optional[str] = None
    message: str = ""


class CompanyConfigUpsert(BaseModel):
    nit: str
    company_name: str
    address: str
    dian_resolution: str
    resolution_number: Optional[str] = None
    invoice_prefix: str = "FV"
    cert_path: Optional[str] = None
    cert_password: Optional[str] = None
    provider: str = "siigo"


class CompanyConfigOut(CompanyConfigUpsert):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


class InvoiceCreate(BaseModel):
    sale_id: Optional[int] = None
    customer_document: str
    customer_name: str
    customer_email: Optional[str] = None
    issue_date: date
    lines: list[DianInvoiceLine]
    notes: str = ""


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sale_id: Optional[int]
    external_id: Optional[str]
    invoice_number: str
    invoice_prefix: Optional[str]
    resolution_number: Optional[str]
    cufe: Optional[str]
    qr_code: Optional[str]
    dian_status: str
    dian_response_xml: Optional[str]
    subtotal: float
    tax_total: float
    total: float
    created_at: datetime
    updated_at: datetime


class InvoiceStatusOut(BaseModel):
    id: int
    invoice_number: str
    dian_status: str
    cufe: Optional[str] = None
    message: str = ""


# ─── Offline Sync ─────────────────────────────────────────────────────────────

class SyncOperation(BaseModel):
    resource: str  # products | clients | sales | orders
    action: str  # create | update
    record_id: Optional[int] = None
    timestamp: datetime
    payload: dict


class SyncConflict(BaseModel):
    resource: str
    record_id: Optional[int] = None
    reason: str
    operation_timestamp: datetime


class SyncBatchIn(BaseModel):
    operations: list[SyncOperation]


class SyncReportOut(BaseModel):
    success_count: int
    failed_count: int
    conflict_count: int
    conflicts: list[SyncConflict]


# ─── Supplier ─────────────────────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    name: str
    contact_name: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    rating: int = 3
    is_active: bool = True


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    rating: Optional[int] = None
    is_active: Optional[bool] = None


class SupplierOut(SupplierCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


# ─── Workshop ─────────────────────────────────────────────────────────────────

class ServiceTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str
    estimated_price: float
    estimated_hours: float
    is_active: bool
    created_at: datetime


class VehicleCreate(BaseModel):
    client_id: int
    brand: str
    model: str
    year: int
    plate: str


class VehicleUpdate(BaseModel):
    client_id: Optional[int] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    plate: Optional[str] = None


class VehicleOut(VehicleCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class WorkOrderCreate(BaseModel):
    vehicle_id: int
    scheduled_date: date
    service_ids: list[int] = []
    notes: str = ""


class WorkOrderStatusUpdate(BaseModel):
    status: str


class WorkOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    vehicle_id: int
    status: str
    scheduled_date: date
    notes: str
    service_ids: list[int] = []
    created_at: datetime
    updated_at: datetime
