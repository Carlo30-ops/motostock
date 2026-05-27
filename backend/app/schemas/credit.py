from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class CreditAdjust(BaseModel):
    amount: float
    description: str = ""


class CreditLedgerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    client_id: int
    amount: float
    description: str
    created_at: datetime
