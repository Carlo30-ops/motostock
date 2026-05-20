from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services.auth import require_minimum_role
from app.services.dian_provider import get_dian_provider, serialize_payload
from app.services.pdf_invoice import build_invoice_pdf

router = APIRouter()


def _get_or_create_company_config(db: Session) -> models.CompanyConfig:
    config = db.query(models.CompanyConfig).order_by(models.CompanyConfig.id.asc()).first()
    if config:
        return config
    config = models.CompanyConfig(
        nit="",
        company_name="MotoStock",
        address="",
        dian_resolution="",
        invoice_prefix="FV",
        provider="mock",
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.get("/company-config", response_model=schemas.CompanyConfigOut)
def get_company_config(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_minimum_role("admin")),
):
    return _get_or_create_company_config(db)


@router.put("/company-config", response_model=schemas.CompanyConfigOut)
def upsert_company_config(
    payload: schemas.CompanyConfigUpsert,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_minimum_role("admin")),
):
    config = _get_or_create_company_config(db)
    for field, value in payload.model_dump().items():
        setattr(config, field, value)
    db.commit()
    db.refresh(config)
    return config


@router.post("/", response_model=schemas.InvoiceOut, status_code=status.HTTP_201_CREATED)
def create_invoice(
    payload: schemas.InvoiceCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_minimum_role("cashier")),
):
    config = _get_or_create_company_config(db)
    provider = get_dian_provider(config.provider)

    try:
        result = provider.submit_invoice(payload, config)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error enviando factura al proveedor DIAN: {exc}") from exc

    subtotal = sum(line.quantity * line.unit_price for line in payload.lines)
    tax_total = sum((line.quantity * line.unit_price) * (line.tax_rate / 100) for line in payload.lines)
    total = subtotal + tax_total

    invoice = models.Invoice(
        sale_id=payload.sale_id,
        external_id=result.external_id,
        invoice_number=result.invoice_number,
        invoice_prefix=config.invoice_prefix,
        resolution_number=config.resolution_number or config.dian_resolution,
        cufe=result.cufe,
        qr_code=result.qr_code,
        dian_status=models.DianStatus(result.dian_status),
        dian_response_xml=result.response_xml,
        provider_payload=serialize_payload(result.raw_payload),
        subtotal=subtotal,
        tax_total=tax_total,
        total=total,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("/{invoice_id}/status", response_model=schemas.InvoiceStatusOut)
def get_invoice_status(
    invoice_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_minimum_role("cashier")),
):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    config = _get_or_create_company_config(db)
    provider = get_dian_provider(config.provider)
    try:
        status_result = provider.get_status(invoice, config)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error consultando estado DIAN: {exc}") from exc

    invoice.dian_status = models.DianStatus(status_result.dian_status)
    invoice.cufe = status_result.cufe or invoice.cufe
    invoice.qr_code = status_result.qr_code or invoice.qr_code
    invoice.provider_payload = serialize_payload(status_result.raw_payload)
    db.commit()
    db.refresh(invoice)

    return schemas.InvoiceStatusOut(
        id=invoice.id,
        invoice_number=invoice.invoice_number,
        dian_status=invoice.dian_status.value if hasattr(invoice.dian_status, "value") else str(invoice.dian_status),
        cufe=invoice.cufe,
        message="Estado actualizado",
    )


@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_minimum_role("cashier")),
):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    config = db.query(models.CompanyConfig).order_by(models.CompanyConfig.id.asc()).first()
    pdf_bytes = build_invoice_pdf(invoice, config)
    filename = f"{invoice.invoice_number}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
