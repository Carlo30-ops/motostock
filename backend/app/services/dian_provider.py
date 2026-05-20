from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

import httpx

from app import models, schemas
from app.config import settings


@dataclass
class ProviderInvoiceResult:
    external_id: str | None
    invoice_number: str
    dian_status: str
    cufe: str | None
    qr_code: str | None
    response_xml: str | None
    raw_payload: dict[str, Any]


class DianProvider(Protocol):
    def submit_invoice(self, payload: schemas.InvoiceCreate, config: models.CompanyConfig) -> ProviderInvoiceResult:
        ...

    def get_status(self, invoice: models.Invoice, config: models.CompanyConfig) -> ProviderInvoiceResult:
        ...


class MockDianProvider:
    def submit_invoice(self, payload: schemas.InvoiceCreate, config: models.CompanyConfig) -> ProviderInvoiceResult:
        now = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        invoice_number = f"{config.invoice_prefix}{now}"
        fake_cufe = f"CUFE-{invoice_number}"
        return ProviderInvoiceResult(
            external_id=f"mock-{invoice_number}",
            invoice_number=invoice_number,
            dian_status=models.DianStatus.accepted.value,
            cufe=fake_cufe,
            qr_code=f"https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey={fake_cufe}",
            response_xml="<mockResponse><status>accepted</status></mockResponse>",
            raw_payload={"provider": "mock", "accepted": True},
        )

    def get_status(self, invoice: models.Invoice, config: models.CompanyConfig) -> ProviderInvoiceResult:
        return ProviderInvoiceResult(
            external_id=invoice.external_id,
            invoice_number=invoice.invoice_number,
            dian_status=invoice.dian_status.value if hasattr(invoice.dian_status, "value") else str(invoice.dian_status),
            cufe=invoice.cufe,
            qr_code=invoice.qr_code,
            response_xml=invoice.dian_response_xml,
            raw_payload={"provider": "mock", "status_lookup": True},
        )


class SiigoDianProvider:
    def _headers(self) -> dict[str, str]:
        if not settings.SIIGO_API_TOKEN:
            raise ValueError("SIIGO_API_TOKEN no configurado")
        return {
            "Authorization": f"Bearer {settings.SIIGO_API_TOKEN}",
            "Content-Type": "application/json",
            "Partner-Id": "motostock",
        }

    def _build_siigo_payload(self, payload: schemas.InvoiceCreate, config: models.CompanyConfig) -> dict[str, Any]:
        return {
            "document": {"id": 1},
            "number": None,
            "date": payload.issue_date.isoformat(),
            "customer": {
                "person_type": "Person",
                "id_type": "13",
                "identification": payload.customer_document,
                "name": [payload.customer_name],
                "email": payload.customer_email,
            },
            "seller": 1,
            "stamp": {"send": True},
            "observations": payload.notes,
            "items": [
                {
                    "code": line.product_code,
                    "description": line.description,
                    "quantity": line.quantity,
                    "price": line.unit_price,
                    "taxes": [{"id": 13156}] if line.tax_rate > 0 else [],
                }
                for line in payload.lines
            ],
        }

    def submit_invoice(self, payload: schemas.InvoiceCreate, config: models.CompanyConfig) -> ProviderInvoiceResult:
        body = self._build_siigo_payload(payload, config)
        url = f"{settings.SIIGO_API_BASE_URL.rstrip('/')}/v1/invoices"
        with httpx.Client(timeout=30) as client:
            response = client.post(url, headers=self._headers(), json=body)
            response.raise_for_status()
            data = response.json()

        invoice_number = str(data.get("name") or data.get("number") or f"{config.invoice_prefix}-PENDING")
        return ProviderInvoiceResult(
            external_id=str(data.get("id")) if data.get("id") is not None else None,
            invoice_number=invoice_number,
            dian_status=models.DianStatus.pending.value,
            cufe=data.get("cufe"),
            qr_code=data.get("qr"),
            response_xml=None,
            raw_payload=data,
        )

    def get_status(self, invoice: models.Invoice, config: models.CompanyConfig) -> ProviderInvoiceResult:
        if not invoice.external_id:
            raise ValueError("Factura sin external_id para consultar estado en Siigo")
        url = f"{settings.SIIGO_API_BASE_URL.rstrip('/')}/v1/invoices/{invoice.external_id}"
        with httpx.Client(timeout=30) as client:
            response = client.get(url, headers=self._headers())
            response.raise_for_status()
            data = response.json()

        status_raw = str(data.get("dian_status") or data.get("status") or "pending").lower()
        if status_raw not in {models.DianStatus.pending.value, models.DianStatus.accepted.value, models.DianStatus.rejected.value}:
            status_raw = models.DianStatus.pending.value
        return ProviderInvoiceResult(
            external_id=invoice.external_id,
            invoice_number=str(data.get("name") or invoice.invoice_number),
            dian_status=status_raw,
            cufe=data.get("cufe") or invoice.cufe,
            qr_code=data.get("qr") or invoice.qr_code,
            response_xml=invoice.dian_response_xml,
            raw_payload=data,
        )


def get_dian_provider(provider_name: str | None = None) -> DianProvider:
    selected = (provider_name or settings.DIAN_PROVIDER or "mock").lower()
    if selected == "siigo":
        return SiigoDianProvider()
    return MockDianProvider()


def serialize_payload(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=True, default=str)
