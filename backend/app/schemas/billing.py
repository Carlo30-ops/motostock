from __future__ import annotations
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class DianParty(BaseModel):
    document_id: str
    name: str
    email: Optional[str] = None


class DianInvoiceLine(BaseModel):
    product_code: str
    description: str
    quantity: float
    unit_price: float
    tax_rate: float = 19.0


class DianInvoiceCreate(BaseModel):
    client: DianParty
    issue_date: date
    lines: list[DianInvoiceLine]
    currency: str = "COP"
    notes: str = ""


class DianInvoiceOut(BaseModel):
    invoice_number: str
    status: str
    subtotal: float
    tax_total: float
    total: float
    cufe: Optional[str] = None
    raw_xml: Optional[str] = None
    message: str = ""


class CompanyConfigUpsert(BaseModel):
    nit: str
    company_name: str
    address: str
    dian_resolution: str
    resolution_number: Optional[str] = None
    invoice_prefix: str = "FV"
    cert_path: Optional[str] = None
    cert_password: Optional[str] = None
    provider: str = "siigo"


class CompanyConfigOut(CompanyConfigUpsert):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


class InvoiceCreate(BaseModel):
    sale_id: Optional[int] = None
    customer_document: str
    customer_name: str
    customer_email: Optional[str] = None
    issue_date: date
    lines: list[DianInvoiceLine]
    notes: str = ""


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sale_id: Optional[int]
    external_id: Optional[str]
    invoice_number: str
    invoice_prefix: Optional[str]
    resolution_number: Optional[str]
    cufe: Optional[str]
    qr_code: Optional[str]
    dian_status: str
    dian_response_xml: Optional[str]
    subtotal: float
    tax_total: float
    total: float
    created_at: datetime
    updated_at: datetime


class InvoiceStatusOut(BaseModel):
    id: int
    invoice_number: str
    dian_status: str
    cufe: Optional[str] = None
    message: str = ""
