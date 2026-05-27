from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

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


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    branch_id: int
    code: str
    name: str
    category: str
    brand: str
    barcode: Optional[str] = None
    supplier: Optional[str] = None
    stock: int
    sale_price: float
    reorder_threshold: int
    created_at: datetime
    updated_at: datetime


class ProductInternalOut(ProductOut):
    cost_price: float


class StockAdjustment(BaseModel):
    quantity: int
    reason: str
