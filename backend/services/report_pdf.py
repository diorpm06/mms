import io
import os
from xml.etree import ElementTree as ET

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

_FONT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "fonts")
_FONTS_REGISTERED = False


def _ensure_fonts():
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return
    pdfmetrics.registerFont(TTFont("DejaVuSans", os.path.join(_FONT_DIR, "DejaVuSans.ttf")))
    pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", os.path.join(_FONT_DIR, "DejaVuSans-Bold.ttf")))
    pdfmetrics.registerFontFamily(
        "DejaVuSans",
        normal="DejaVuSans",
        bold="DejaVuSans-Bold",
        italic="DejaVuSans",
        boldItalic="DejaVuSans-Bold",
    )
    _FONTS_REGISTERED = True


def _markup(elem) -> str:
    """<strong>/<em> ni reportlab Paragraph tushunadigan <b>/<i> belgilariga aylantiradi."""
    tag = elem.tag
    text = elem.text or ""
    inner = text
    for child in elem:
        inner += _markup(child)
        inner += (child.tail or "")
    if tag == "strong":
        return f"<b>{inner}</b>"
    if tag == "em":
        return f"<i>{inner}</i>"
    return inner


def generate_report_pdf(
    template_label: str,
    content_html: str,
    patient_name: str,
    doctor_name: str,
    created_at_str: str,
) -> bytes:
    _ensure_fonts()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=1.5 * cm, leftMargin=1.5 * cm, topMargin=1.2 * cm, bottomMargin=1.2 * cm,
    )

    normal_style = ParagraphStyle("normal", fontName="DejaVuSans", fontSize=11, leading=15)

    elements = []
    try:
        root = ET.fromstring(f"<root>{content_html}</root>")
    except ET.ParseError:
        # Agar tahlil qilib bo'lmasa, toza matn sifatida chiqaramiz
        import re
        plain = re.sub("<[^>]+>", " ", content_html)
        elements.append(Paragraph(plain, normal_style))
        root = None

    if root is not None:
        for child in root:
            if child.tag == "p":
                markup = _markup(child).strip()
                style_attr = child.get("style") or ""
                align = 1 if "center" in style_attr else 0
                p_style = ParagraphStyle("p", parent=normal_style, alignment=align)
                elements.append(Paragraph(markup or "&nbsp;", p_style))
                elements.append(Spacer(1, 3))
            elif child.tag == "hr":
                elements.append(HRFlowable(width="100%", color=colors.HexColor("#999999"), thickness=0.5))
                elements.append(Spacer(1, 6))
            elif child.tag == "table":
                data = []
                for tr in child.findall("tr"):
                    row = [Paragraph(_markup(td).strip() or "&nbsp;", normal_style) for td in tr.findall("td")]
                    if row:
                        data.append(row)
                if data:
                    ncols = max(len(r) for r in data)
                    for r in data:
                        while len(r) < ncols:
                            r.append(Paragraph("", normal_style))
                    colw = doc.width / ncols
                    t = Table(data, colWidths=[colw] * ncols)
                    t.setStyle(TableStyle([
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#999999")),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]))
                    elements.append(t)
                    elements.append(Spacer(1, 6))

    elements.append(Spacer(1, 16))
    footer_style = ParagraphStyle("footer", fontName="DejaVuSans", fontSize=9, textColor=colors.grey)
    elements.append(Paragraph(f"Shifokor: {doctor_name or '—'} &nbsp;&nbsp;|&nbsp;&nbsp; Sana: {created_at_str or ''}", footer_style))

    doc.build(elements)
    return buf.getvalue()
