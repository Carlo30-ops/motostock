from fastapi import APIRouter, Depends, HTTPException, status

from app import schemas
from app.services.auth import require_minimum_role

router = APIRouter(dependencies=[Depends(require_minimum_role("cashier"))])


@router.post("/dian/invoices/preview", response_model=schemas.DianInvoiceOut)
def preview_dian_invoice(payload: schemas.DianInvoiceCreate):
    subtotal = sum(line.quantity * line.unit_price for line in payload.lines)
    tax_total = sum((line.quantity * line.unit_price) * (line.tax_rate / 100) for line in payload.lines)
    total = subtotal + tax_total

    return schemas.DianInvoiceOut(
        invoice_number="PREVIEW-LOCAL",
        status="preview",
        subtotal=subtotal,
        tax_total=tax_total,
        total=total,
        message="Previsualizacion local generada. Integracion DIAN pendiente de proveedor tecnologico.",
    )


@router.post("/dian/invoices/submit", response_model=schemas.DianInvoiceOut)
def submit_dian_invoice(payload: schemas.DianInvoiceCreate):
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            "Integracion DIAN no configurada. "
            "Configure proveedor tecnologico, firma digital y flujo UBL para habilitar envio."
        ),
    )
