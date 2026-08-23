import io
import os
import re
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


# ─── Word'dan eksport qilingan HTML tozalash ────────────────────────────────
# Shablonlar asl Word fayllaridan olingan: qo'shtirnoqsiz atributlar
# (border=1, width=709, valign=top) va yopilmagan <img>/<br> kabi teglar bor.
# Bular oddiy XML uchun yaroqsiz — ET.fromstring HAR DOIM xato berardi va
# natijada PDF hech qachon jadval/qalin matn bilan chiqmasdi, faqat yassi
# matn bo'lib qolardi. Shu funksiyalar shablon HTML'ini XML o'qiy oladigan
# holga keltiradi.
_ATTR_UNQUOTED = re.compile(r'(<[a-zA-Z][^<>]*?)\s([a-zA-Z:_-][a-zA-Z0-9:_-]*)=([^\s"\'>]+)')
_VOID_TAGS = ("br", "hr", "input", "meta", "link")


def _tirnoqsiz_atributlarni_tuzat(html: str) -> str:
    oldingi = None
    while oldingi != html:
        oldingi = html
        html = _ATTR_UNQUOTED.sub(r'\1 \2="\3"', html)
    return html


def _boshqotirma_teglarni_yop(html: str) -> str:
    for teg in _VOID_TAGS:
        html = re.sub(rf'<{teg}\b([^<>]*?)(?<!/)>', rf'<{teg}\1 />', html, flags=re.IGNORECASE)
    return html


def _rasmlarni_olib_tashla(html: str) -> str:
    # Shablon logotipi/fotosurati PDF matn oqimini buzadi — kerak emas
    return re.sub(r'<img\b[^<>]*?/?>', '', html, flags=re.IGNORECASE)


def _shablon_html_tozala(html: str) -> str:
    html = (html or '').replace('&nbsp;', ' ')
    html = _rasmlarni_olib_tashla(html)
    html = _boshqotirma_teglarni_yop(html)
    html = _tirnoqsiz_atributlarni_tuzat(html)
    return html


def _elementlarni_yig(elem, doc_width, elements, normal_style):
    """p/hr/table ni flowable qilib qo'shadi; div/span kabi konteynerlarga tushadi."""
    for child in elem:
        tag = child.tag
        if tag == "p":
            markup = _markup(child).strip()
            style_attr = child.get("style") or ""
            align = 1 if "center" in style_attr else 0
            p_style = ParagraphStyle("p", parent=normal_style, alignment=align)
            elements.append(Paragraph(markup or "&nbsp;", p_style))
            elements.append(Spacer(1, 3))
        elif tag == "hr":
            elements.append(HRFlowable(width="100%", color=colors.HexColor("#999999"), thickness=0.5))
            elements.append(Spacer(1, 6))
        elif tag == "table":
            data = []
            for tr in child.findall(".//tr"):
                row = [Paragraph(_markup(td).strip() or "&nbsp;", normal_style) for td in tr.findall("td")]
                if row:
                    data.append(row)
            if data:
                ncols = max(len(r) for r in data)
                for r in data:
                    while len(r) < ncols:
                        r.append(Paragraph("", normal_style))
                colw = doc_width / ncols
                t = Table(data, colWidths=[colw] * ncols)
                t.setStyle(TableStyle([
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#999999")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]))
                elements.append(t)
                elements.append(Spacer(1, 6))
        else:
            # div, span, body va hokazo — o'zi flowable emas, ichiga tushamiz
            _elementlarni_yig(child, doc_width, elements, normal_style)


def generate_report_pdf(
    template_label: str,
    content_html: str,
    patient_name: str,
    doctor_name: str,
    created_at_str: str,
    ticket_number: str | None = None,
    birth_date: str | None = None,
) -> bytes:
    _ensure_fonts()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=1.5 * cm, leftMargin=1.5 * cm, topMargin=1.2 * cm, bottomMargin=1.2 * cm,
    )

    normal_style = ParagraphStyle("normal", fontName="DejaVuSans", fontSize=11, leading=15)
    header_style = ParagraphStyle("header", fontName="DejaVuSans-Bold", fontSize=13, leading=17)
    subheader_style = ParagraphStyle("subheader", fontName="DejaVuSans", fontSize=10, leading=14, textColor=colors.HexColor("#444444"))

    elements = []

    # ── BEMOR SARLAVHASI — doktor tahrirlagan matndan MUSTAQIL, shuning
    # uchun matn ichidagi F.I.Sh maydoni o'chirilgan yoki noto'g'ri
    # to'ldirilgan bo'lsa ham, qaysi bemorga tegishli ekani doim aniq. ──
    elements.append(Paragraph(template_label or "Tekshiruv Natijasi", header_style))
    tafsilotlar = [f"<b>Bemor:</b> {patient_name or '—'}"]
    if ticket_number:
        tafsilotlar.append(f"<b>Talon:</b> {ticket_number}")
    if birth_date:
        tafsilotlar.append(f"<b>Tug'ilgan yili:</b> {birth_date}")
    elements.append(Paragraph("&nbsp;&nbsp;|&nbsp;&nbsp;".join(tafsilotlar), subheader_style))
    elements.append(HRFlowable(width="100%", color=colors.HexColor("#c9a24b"), thickness=1))
    elements.append(Spacer(1, 10))

    tozalangan = _shablon_html_tozala(content_html)
    try:
        root = ET.fromstring(f"<root>{tozalangan}</root>")
        _elementlarni_yig(root, doc.width, elements, normal_style)
    except ET.ParseError:
        # Tozalashdan keyin ham o'qib bo'lmasa — hech bo'lmasa yassi
        # matn sifatida chiqaramiz, bemor sarlavhasi baribir yuqorida turadi
        plain = re.sub("<[^>]+>", " ", content_html)
        elements.append(Paragraph(plain, normal_style))

    elements.append(Spacer(1, 16))
    footer_style = ParagraphStyle("footer", fontName="DejaVuSans", fontSize=9, textColor=colors.grey)
    elements.append(Paragraph(f"Shifokor: {doctor_name or '—'} &nbsp;&nbsp;|&nbsp;&nbsp; Sana: {created_at_str or ''}", footer_style))

    doc.build(elements)
    return buf.getvalue()
