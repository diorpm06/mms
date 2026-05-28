import io
from datetime import date

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

GOLD = "D4AF37"


def _format_money(n: int) -> str:
    return f"{n:,}".replace(",", " ") + " so'm"


def export_excel(report: dict, title: str = "Marjona Med Service") -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Hisobot"

    header_fill = PatternFill(start_color=GOLD, end_color=GOLD, fill_type="solid")
    bold = Font(bold=True, size=12)
    ws["A1"] = title
    ws["A1"].font = Font(bold=True, size=16)
    ws.merge_cells("A1:B1")

    rows = [
        ("Davr", f"{report.get('period_start', '')} — {report.get('period_end', '')}"),
        ("Mijozlar soni", report.get("patients_count", 0)),
        ("Jami daromad", _format_money(report.get("total_income", 0))),
        ("Naqt", _format_money(report.get("cash", 0))),
        ("Karta", _format_money(report.get("card", 0))),
        ("Yo'naltiruvchi hissi", _format_money(report.get("referrer_share", 0))),
        ("Xizmat ko'rsatuvchi hissi", _format_money(report.get("provider_share", 0))),
        ("Markaz ulushi", _format_money(report.get("center_share", 0))),
        ("Harajatlar", _format_money(report.get("expenses", 0))),
        ("Sof foyda", _format_money(report.get("net_profit", 0))),
        ("Joriy balans", _format_money(report.get("current_balance", 0))),
    ]

    start_row = 3
    for i, (label, value) in enumerate(rows):
        r = start_row + i
        ws.cell(row=r, column=1, value=label).font = bold if i == len(rows) - 1 else None
        cell = ws.cell(row=r, column=2, value=value)
        if i == len(rows) - 1:
            cell.font = bold
        ws.cell(row=r, column=1).fill = header_fill if i == 0 else PatternFill()

    for col in ("A", "B"):
        ws.column_dimensions[col].width = 28

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def export_pdf(report: dict, title: str = "Marjona Med Service — Hisobot") -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=2 * cm, leftMargin=2 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Heading1"], fontSize=16, spaceAfter=12)
    elements = [Paragraph(title, title_style), Spacer(1, 12)]

    data = [
        ["Ko'rsatkich", "Qiymat"],
        ["Davr", f"{report.get('period_start', '')} — {report.get('period_end', '')}"],
        ["Mijozlar", str(report.get("patients_count", 0))],
        ["Jami daromad", _format_money(report.get("total_income", 0))],
        ["Naqt", _format_money(report.get("cash", 0))],
        ["Karta", _format_money(report.get("card", 0))],
        ["Yo'naltiruvchi", _format_money(report.get("referrer_share", 0))],
        ["Xizmat ko'rsatuvchi", _format_money(report.get("provider_share", 0))],
        ["Markaz", _format_money(report.get("center_share", 0))],
        ["Harajatlar", _format_money(report.get("expenses", 0))],
        ["Sof foyda", _format_money(report.get("net_profit", 0))],
        ["Balans", _format_money(report.get("current_balance", 0))],
    ]

    table = Table(data, colWidths=[8 * cm, 8 * cm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{GOLD}")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ]
        )
    )
    elements.append(table)
    doc.build(elements)
    return buf.getvalue()
