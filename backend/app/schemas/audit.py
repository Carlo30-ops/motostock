from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class InventoryMovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    branch_id: int
    user_id: int
    movement_type: str
    quantity: int
    previous_stock: int
    new_stock: int
    previous_cost: float
    new_cost: float
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    created_at: datetime
