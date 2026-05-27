from __future__ import annotations
from datetime import date, datetime, timedelta
from typing import Optional
from pydantic import BaseModel, ConfigDict, computed_field, field_validator

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
