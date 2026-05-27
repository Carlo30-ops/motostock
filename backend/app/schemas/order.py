from __future__ import annotations
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class PurchaseOrderItemIn(BaseModel):
    product_id: int
    quantity: int
    unit_cost: float


class PurchaseOrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    quantity: int
    received_quantity: int
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
    branch_id: int
    supplier: str
    supplier_id: Optional[int] = None
    status: str
    date: date
    total: float
    notes: str
    items: list[PurchaseOrderItemOut]
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class PurchaseOrderReceiptItem(BaseModel):
    product_id: int
    quantity: int


class PurchaseOrderReceipt(BaseModel):
    items: list[PurchaseOrderReceiptItem]


class PurchaseOrderStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None
