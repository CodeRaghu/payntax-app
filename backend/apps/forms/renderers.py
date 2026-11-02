"""PDF output (REQ-FRM-003). SummaryPdfRenderer draws a clearly labelled line summary. Filling the official
IRS f1040.pdf (AcroForm fields) is a drop-in renderer with the same render() signature."""

from io import BytesIO
from typing import Protocol

from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

from apps.core.crypto import mask_ssn


class FormRenderer(Protocol):
    def render(self, tax_return, lines) -> bytes: ...


class SummaryPdfRenderer:
    def render(self, tax_return, lines) -> bytes:
        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=LETTER)
        width, height = LETTER
        client = tax_return.client
        y = height - 60
        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawString(50, y, f"Form 1040 summary - tax year {tax_return.tax_year}")
        pdf.setFont("Helvetica", 9)
        pdf.drawString(50, y - 16, "DRAFT for CPA review. Not the official IRS form. Not for filing.")
        y -= 50
        pdf.setFont("Helvetica", 11)
        pdf.drawString(50, y, f"Taxpayer: {client.first_name} {client.last_name}")
        pdf.drawString(320, y, f"SSN: {mask_ssn(client.ssn)}")
        pdf.drawString(50, y - 16, f"Filing status: {client.get_filing_status_display()}")
        y -= 46
        section = None
        for item in lines:
            if item.spec.section != section:
                section = item.spec.section
                pdf.setFont("Helvetica-Bold", 11)
                pdf.drawString(50, y, section)
                y -= 18
            pdf.setFont("Helvetica", 10)
            pdf.drawString(60, y, item.spec.line)
            pdf.drawString(100, y, item.spec.label[:60])
            text = "-" if item.value is None else f"{item.value:,.2f}"
            pdf.drawRightString(width - 60, y, text)
            if item.source == "cpa":
                pdf.drawString(width - 55, y, "*")
            y -= 16
        pdf.setFont("Helvetica", 8)
        pdf.drawString(50, 40, "* entered or changed by the preparer")
        pdf.showPage()
        pdf.save()
        return buffer.getvalue()
