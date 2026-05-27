from __future__ import annotations
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator

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
    branch_id: int
    offline_id: Optional[str] = None
    client_id: Optional[int]
    date: date
    subtotal: float
    discount_pct: float
    total: float
    payment_method: str
    items: list[SaleItemOut]
    created_at: datetime
