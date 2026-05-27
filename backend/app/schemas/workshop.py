from __future__ import annotations
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

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
    branch_id: int
    created_at: datetime


class WorkOrderCreate(BaseModel):
    vehicle_id: int
    mechanic_id: Optional[int] = None
    scheduled_date: date
    service_ids: list[int] = []
    notes: str = ""


class WorkOrderStatusUpdate(BaseModel):
    status: str


class WorkOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    branch_id: int
    vehicle_id: int
    mechanic_id: Optional[int] = None
    status: str
    scheduled_date: date
    notes: str
    service_ids: list[int] = []
    created_at: datetime
    updated_at: datetime
