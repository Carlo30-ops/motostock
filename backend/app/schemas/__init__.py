"""Pydantic schemas for MotoStock API."""

from .auth import (
    Token,
    RefreshTokenRequest,
    TokenData,
    UserCreate,
    UserUpdate,
    PasswordChange,
    UserOut,
    PinLogin,
)
from .product import (
    ProductCreate,
    ProductUpdate,
    ProductOut,
    ProductInternalOut,
    StockAdjustment,
)
from .combo import (
    ComboItemIn,
    ComboItemOut,
    ComboCreate,
    ComboOut,
)
from .client import (
    ClientCreate,
    ClientUpdate,
    ClientOut,
)
from .credit import (
    CreditAdjust,
    CreditLedgerOut,
)
from .sale import (
    SaleItemIn,
    SaleItemOut,
    SaleCreate,
    SaleOut,
)
from .order import (
    PurchaseOrderItemIn,
    PurchaseOrderItemOut,
    PurchaseOrderCreate,
    PurchaseOrderOut,
    PurchaseOrderReceiptItem,
    PurchaseOrderReceipt,
    PurchaseOrderStatusUpdate,
)
from .report import (
    SalesReportRow,
    SalesReport,
    InventoryReportRow,
    InventoryReport,
)
from .audit import (
    InventoryMovementOut,
)
from .billing import (
    DianParty,
    DianInvoiceLine,
    DianInvoiceCreate,
    DianInvoiceOut,
    CompanyConfigUpsert,
    CompanyConfigOut,
    InvoiceCreate,
    InvoiceOut,
    InvoiceStatusOut,
)
from .sync import (
    SyncOperation,
    SyncConflict,
    SyncBatchIn,
    SyncReportOut,
)
from .supplier import (
    SupplierCreate,
    SupplierUpdate,
    SupplierOut,
)
from .workshop import (
    ServiceTemplateOut,
    VehicleCreate,
    VehicleUpdate,
    VehicleOut,
    WorkOrderCreate,
    WorkOrderStatusUpdate,
    WorkOrderOut,
)
