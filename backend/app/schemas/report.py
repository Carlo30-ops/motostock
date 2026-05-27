from __future__ import annotations
from datetime import date
from pydantic import BaseModel

class SalesReportRow(BaseModel):
    product_id: int
    product_name: str
    category: str
    quantity_sold: int
    revenue: float
    cost: float
    profit: float


class SalesReport(BaseModel):
    date_from: date
    date_to: date
    total_revenue: float
    total_cost: float
    total_profit: float
    total_transactions: int
    average_ticket: float
    rows: list[SalesReportRow]


class InventoryReportRow(BaseModel):
    product_id: int
    product_name: str
    category: str
    brand: str
    stock: int
    cost_price: float
    stock_value: float
    status: str


class InventoryReport(BaseModel):
    total_products: int
    total_units: int
    total_stock_value: float
    rows: list[InventoryReportRow]
