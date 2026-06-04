from __future__ import annotations
from datetime import date, datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict

class OwnerDashboardSummary(BaseModel):
    today_sales_count: int
    today_total_amount: float
    today_estimated_gross_profit: float
    today_expenses: float
    
    yesterday_total_amount: float
    variation_percentage: float
    
    low_stock_products: List[dict]
    manual_adjustments_count: int
    cancelled_sales_count: int
    
    top_cashiers: List[dict] = []
    suspicious_discounts_count: int = 0
    total_gross_profit_month: float = 0.0

from app.schemas.sale import SaleOut

class SaleAuditOut(SaleOut):
    cashier_id: Optional[int] = None
    cashier_username: Optional[str] = None


class InventoryMovementAuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    product_name: Optional[str] = None
    branch_id: int
    branch_name: Optional[str] = None
    user_id: int
    username: Optional[str] = None
    movement_type: str
    quantity: int
    previous_stock: int
    new_stock: int
    unit_cost: float
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    created_at: datetime

class AnomalyAlert(BaseModel):
    type: str  # "high_discount", "large_adjustment", "below_cost", "multiple_cancellations"
    severity: str # "low", "medium", "high"
    description: str
    resource_id: Optional[str] = None
    user_id: Optional[int] = None
    username: Optional[str] = None
    timestamp: datetime
    data: dict = {}

class FinancialAuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    username: Optional[str] = None
    branch_id: int
    event_type: str
    resource: str
    resource_id: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

class ProfitabilityReportRow(BaseModel):
    product_id: int
    product_name: str
    quantity_sold: int
    total_revenue: float
    total_cost: float
    net_profit: float

class ProfitabilityReport(BaseModel):
    period: str
    date_from: date
    date_to: date
    rows: List[ProfitabilityReportRow]
