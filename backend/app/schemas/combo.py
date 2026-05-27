from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict

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
