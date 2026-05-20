from io import BytesIO

from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

from app import models


def build_invoice_pdf(invoice: models.Invoice, company: models.CompanyConfig | None) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=LETTER)
    y = 760
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(50, y, "Factura Electronica")
    y -= 24
    pdf.setFont("Helvetica", 10)
    if company:
        pdf.drawString(50, y, f"Empresa: {company.company_name}")
        y -= 16
        pdf.drawString(50, y, f"NIT: {company.nit}")
        y -= 16
        pdf.drawString(50, y, f"Resolucion: {company.dian_resolution}")
        y -= 16

    pdf.drawString(50, y, f"Factura: {invoice.invoice_number}")
    y -= 16
    pdf.drawString(50, y, f"Estado DIAN: {invoice.dian_status.value if hasattr(invoice.dian_status, 'value') else invoice.dian_status}")
    y -= 16
    pdf.drawString(50, y, f"CUFE: {invoice.cufe or 'N/A'}")
    y -= 24
    pdf.drawString(50, y, f"Subtotal: {invoice.subtotal:,.2f}")
    y -= 16
    pdf.drawString(50, y, f"IVA: {invoice.tax_total:,.2f}")
    y -= 16
    pdf.drawString(50, y, f"Total: {invoice.total:,.2f}")
    y -= 24
    if invoice.qr_code:
        pdf.drawString(50, y, f"QR: {invoice.qr_code}")

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer.read()
