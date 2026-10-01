import io
from datetime import date, datetime

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

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
        ("Karta", _format_money(report.get("card", 0) + report.get("qr", 0))),
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


def export_pdf(report: dict, title: str = "MARJONA MED SERVIS KLINIKASI — KUNLIK HISOBOT") -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=1.0 * cm,
        leftMargin=1.0 * cm,
        topMargin=1.0 * cm,
        bottomMargin=1.0 * cm,
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        spaceAfter=6,
        alignment=1,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0f172a"),
    )
    subtitle_style = ParagraphStyle(
        "SubTitle",
        parent=styles["Normal"],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#334155"),
        alignment=1,
        spaceAfter=14,
        fontName="Helvetica-Bold",
    )
    section_style = ParagraphStyle(
        "SectionHead",
        parent=styles["Heading2"],
        fontSize=12,
        leading=15,
        spaceBefore=12,
        spaceAfter=6,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )

    p_start = report.get("period_start", "")
    p_end = report.get("period_end", "")
    date_label = f"{p_start}" if p_start == p_end else f"{p_start} — {p_end}"

    elements = [
        Paragraph("MARJONA MED SERVIS KLINIKASI", title_style),
        Paragraph(f"HISOBOT — {date_label}", subtitle_style),
        Spacer(1, 4),
    ]

    # Bo'lim raqamlari o'zgaruvchan: bo'sh bo'lim umuman chiqmaydi,
    # shuning uchun raqamlar sakrab ketmasligi kerak.
    _bolim = {"n": 0}

    def bolim(nom: str) -> Paragraph:
        _bolim["n"] += 1
        return Paragraph("%d. %s" % (_bolim["n"], nom), section_style)

    # Section: Services & Inpatients
    elements.append(bolim("FAOLIYAT VA STATSIONAR (XIZMATLAR & YOTIB DAVOLANISH)"))

    svcs = report.get("services_detail") or report.get("services_breakdown") or []
    svc_data = [["№", "Xizmat / Bo'lim nomi", "Soni", "Summa (so'm)"]]

    idx = 1
    total_svc_count = 0
    total_svc_sum = 0

    for s in svcs:
        if isinstance(s, dict):
            cnt = s.get("count", 0)
            tot = s.get("total_paid") or s.get("total") or 0
            if cnt > 0 or tot > 0:
                svc_data.append([
                    str(idx),
                    str(s.get("name", "")),
                    str(cnt),
                    _format_money(int(tot)),
                ])
                idx += 1
                total_svc_count += cnt
                total_svc_sum += int(tot)

    if len(svc_data) == 1:
        svc_data.append(["—", "Aktiv xizmatlar mavjud emas", "0", "0 so'm"])

    # Subtotal line for services
    svc_data.append(["", "JAMI XIZMATLAR", str(total_svc_count), _format_money(int(total_svc_sum))])

    # Statsionar row (always displayed as requested: shows active inpatient count, and payment sum if paid)
    inp_count = report.get("active_inpatients", 0) or report.get("discharged_today", 0)
    inp_income = int(report.get("inpatient_income", 0))

    svc_data.append([
        str(idx),
        "Statsionar (Hozirda yotganlar)",
        str(inp_count),
        _format_money(inp_income),
    ])

    # Grand Total row (Count = Services Count, Sum = Services Sum + Inpatient Payment)
    grand_count = total_svc_count
    grand_sum = total_svc_sum + inp_income

    svc_data.append(["", "JAMI TUSHUM", str(grand_count), _format_money(grand_sum)])

    t_svc = Table(svc_data, colWidths=[1.2 * cm, 9.8 * cm, 2.5 * cm, 5.5 * cm])
    t_svc.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10.5),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("ALIGN", (2, 0), (2, -1), "CENTER"),
                ("ALIGN", (3, 0), (3, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("BACKGROUND", (0, -2), (-1, -2), colors.HexColor("#e2e8f0")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#cbd5e1")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    elements.append(t_svc)

    # Section 2: Navbatchilik (qog'oz jurnalidan kiritilgan tushum)
    #
    # Ish vaqtidan tashqari qabul qilingan bemorlar. Yuqoridagi umumiy
    # summaga allaqachon kirgan, lekin "qaysi xizmatdan qancha tushgan"
    # alohida ko'rinishi kerak — shu bo'lim aynan shuning uchun.
    paper_dept = report.get("paper_entry_departments") or []
    paper_svc = report.get("paper_entry_services") or []
    paper_count = int(report.get("paper_entry_count") or 0)
    paper_total = int(report.get("paper_entry_total") or 0)

    if paper_count > 0:
        elements.append(Spacer(1, 10))
        elements.append(bolim("NAVBATCHILIK (QOG'OZ JURNALIDAN KIRITILGAN)"))

        # Faqat BO'LIM darajasi: "Ineksiya — 7 ta, 140 000".
        # Har bir xizmatni alohida yozish hisobotni cho'zib yuborardi.
        p_data = [["№", "Bo'lim nomi", "Soni", "Summa (so'm)"]]
        for n, d in enumerate(paper_dept, start=1):
            p_data.append([
                str(n), d.get("department", ""),
                str(d.get("count", 0)), _format_money(int(d.get("total") or 0)),
            ])
        p_data.append(["", "JAMI NAVBATCHILIK", str(paper_count),
                       _format_money(paper_total)])

        t_paper = Table(p_data, colWidths=[1.2 * cm, 10.3 * cm, 2.5 * cm, 5.0 * cm])
        t_paper.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10.5),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (2, 0), (2, -1), "CENTER"),
            ("ALIGN", (3, 0), (3, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f8fafc")]),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#fef3c7")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        elements.append(t_paper)

    # Section 3: Expenses (Xarajatlar)
    elements.append(Spacer(1, 10))
    elements.append(bolim("XARAJATLAR"))

    exp_list = report.get("expenses_list") or []
    exp_data = [["№", "Vaqt", "Xarajat maqsadi va sababi", "Summa (so'm)"]]
    exp_idx = 1
    total_exp_sum = report.get("expenses", 0)

    if isinstance(exp_list, list) and len(exp_list) > 0:
        for ex in exp_list:
            if isinstance(ex, dict):
                amt = ex.get("amount", 0)
                if amt > 0:
                    cat = (ex.get("category") or "Boshqa").strip()
                    desc = (ex.get("description", "") or "").strip()
                    if desc == "-":
                        desc = ""
                    # "Boshqa" hamma yozuvda takrorlanadi va ma'no bermaydi —
                    # sabab bo'lsa faqat o'shani yozamiz.
                    if not desc:
                        detail = cat
                    elif cat and cat.lower() != "boshqa" and desc != cat:
                        detail = f"{cat} — {desc}"
                    else:
                        detail = desc

                    vaqt = ""
                    iso = ex.get("created_at") or ""
                    if "T" in iso:
                        vaqt = iso.split("T", 1)[1][:5]

                    exp_data.append([
                        str(exp_idx), vaqt, detail, _format_money(int(amt)),
                    ])
                    exp_idx += 1
    else:
        if total_exp_sum > 0:
            exp_data.append(["1", "", "Klinika umumiy xarajatlari",
                             _format_money(int(total_exp_sum))])
        else:
            exp_data.append(["—", "", "Xarajatlar mavjud emas", "0 so'm"])

    exp_data.append(["", "", "JAMI XARAJATLAR", _format_money(int(total_exp_sum))])

    t_exp = Table(exp_data, colWidths=[1.2 * cm, 2.0 * cm, 10.3 * cm, 5.5 * cm])
    t_exp.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10.5),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("ALIGN", (1, 0), (1, -1), "CENTER"),
                ("ALIGN", (3, 0), (3, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f8fafc")]),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f1f5f9")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    elements.append(t_exp)

    # Section: Consumed Materials Summary
    #
    # Material ishlatilmagan bo'lsa bu bo'lim UMUMAN chiqmaydi — bo'sh
    # "materiallar mavjud emas" jadvali hisobotni cho'zib, ikkinchi
    # sahifaga surib yuborardi.
    mats_list = report.get("materials_used_breakdown") or []
    mats_bor = isinstance(mats_list, list) and len(mats_list) > 0

    if mats_bor:
        material = [Spacer(1, 10),
                    bolim("ISHLATILGAN MATERIALLAR VA TUSHUM")]

        mat_data = [["№", "Material Nomi", "Ishlatilgan Miqdor",
                     "Tushum / Ishlab Topilgan Pul"]]
        mat_idx = 1
        total_mat_income = report.get("total_material_income", 0)
        for m in mats_list:
            if isinstance(m, dict):
                mat_data.append([
                    str(mat_idx),
                    str(m.get("name", "")),
                    f"{m.get('quantity_used', 0)} dona",
                    _format_money(int(m.get("total_income", 0))),
                ])
                mat_idx += 1
        mat_data.append([
            "", "JAMI MATERIAL TUSHUMI",
            f"{report.get('total_material_quantity', 0)} dona",
            _format_money(int(total_mat_income)),
        ])

        t_mat = Table(mat_data, colWidths=[1.2 * cm, 8.8 * cm, 3.5 * cm, 5.5 * cm])
        t_mat.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10.5),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (2, 0), (2, -1), "CENTER"),
            ("ALIGN", (3, 0), (3, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f8fafc")]),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f1f5f9")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        material.append(t_mat)
        elements.append(KeepTogether(material))

    # "Shifokorlar KPI ulushlari" jadvali bu yerdan olib tashlandi — u
    # `get_report()`ning `providers_breakdown`iga asoslangan edi, bu esa
    # statsionar (yotgan bemor) orqali kelgan daromadni umuman hisobga
    # olmaydi va shu sababli 10-kunlik "asosiy" hisobotdagi (ten_day_report/
    # all_staff_payout, allaqachon tekshirilgan va to'g'irlangan) raqamlar
    # bilan mos kelmasligi mumkin edi. Shifokorlar ulushi endi FAQAT o'sha
    # asosiy hisobotda (export_all_staff_pdf) ko'rsatiladi.

    # Section 5: Summary & Cash Balance
    # Yakuniy hisob va imzolar BIRGA turishi kerak — ilgari "NAQD" qatori
    # va imzolar ikkinchi sahifaga yolg'iz tushib qolardi.
    yakun = [Spacer(1, 10), bolim("KASSA YAKUNIY HISOBI")]

    tot_income = int(report.get("total_income", 0))
    tot_exp = int(report.get("expenses", 0))
    net_sum = tot_income - tot_exp

    cash_amt = int(report.get("cash", 0))
    # QR endi hisoblashda karta'dan ajratilgan, lekin chop etishda
    # avvalgidek birga ko'rsatiladi (faqat ekrandagi Kunlik Hisobot
    # kartochkalarida alohida chiqadi).
    card_amt = int(report.get("card", 0)) + int(report.get("qr", 0))
    click_amt = int(report.get("click", 0))
    if cash_amt == 0 and tot_income > 0:
        cash_amt = max(0, tot_income - card_amt - click_amt)
    net_cash = max(0, cash_amt - tot_exp)

    summary_box_data = [
        ["JAMI TUSHUM:", _format_money(tot_income)],
        ["JAMI XARAJAT:", f"-{_format_money(tot_exp)}"],
        ["QOLGAN SUMMA (SOF QOLDIQ):", _format_money(net_sum)],
        [f"QR / Terminal: {_format_money(card_amt)}         Click / Payme: {_format_money(click_amt)}", ""],
        ["NAQD:", _format_money(net_cash)],
    ]

    t_box = Table(summary_box_data, colWidths=[10 * cm, 9 * cm])
    t_box.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 11),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("SPAN", (0, 3), (1, 3)),
                ("ALIGN", (0, 3), (1, 3), "LEFT"),
                ("TEXTCOLOR", (0, 1), (1, 1), colors.HexColor("#dc2626")),
                ("TEXTCOLOR", (0, 2), (1, 2), colors.HexColor("#0284c7")),
                ("TEXTCOLOR", (0, 4), (1, 4), colors.HexColor("#16a34a")),
                ("FONTSIZE", (0, 4), (1, 4), 16),
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#cbd5e1")),
                ("LINEBELOW", (0, 1), (-1, 1), 1, colors.HexColor("#0f172a")),
                ("LINEBELOW", (0, 2), (-1, 2), 0.5, colors.HexColor("#cbd5e1")),
                ("LINEBELOW", (0, 3), (-1, 3), 1, colors.HexColor("#16a34a")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 1.5, colors.HexColor("#0f172a")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    yakun.append(t_box)

    # Signatures
    yakun.append(Spacer(1, 16))
    sig_data = [["Administrator Imzosi: ___________________", "Rahbar Imzosi: ___________________"]]
    t_sig = Table(sig_data, colWidths=[9.5 * cm, 9.5 * cm])
    t_sig.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 11.5),
                ("ALIGN", (0, 0), (0, 0), "LEFT"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ]
        )
    )
    yakun.append(t_sig)
    elements.append(KeepTogether(yakun))

    doc.build(elements)
    return buf.getvalue()


def export_referrers_pdf(report: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=0.8 * cm,
        leftMargin=0.8 * cm,
        topMargin=0.8 * cm,
        bottomMargin=0.8 * cm,
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "RefDocTitle",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        spaceAfter=3,
        alignment=1,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0f172a"),
    )
    subtitle_style = ParagraphStyle(
        "RefSubTitle",
        parent=styles["Normal"],
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#334155"),
        alignment=1,
        spaceAfter=12,
        fontName="Helvetica-Bold",
    )
    section_head_style = ParagraphStyle(
        "RefSecHead",
        parent=styles["Heading2"],
        fontSize=12,
        leading=15,
        spaceBefore=14,
        spaceAfter=6,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    ref_head_style = ParagraphStyle(
        "RefHead",
        parent=styles["Heading3"],
        fontSize=11,
        leading=14,
        spaceBefore=8,
        spaceAfter=4,
        textColor=colors.HexColor("#1e293b"),
        fontName="Helvetica-Bold",
    )
    # Jadval sarlavhalari uchun: ustun tor bo'lsa, oddiy matn qatorlar
    # o'rtasiga "yugurib" ketardi (masalan "Belgilangan" va "Hisoblangan
    # Ulush" bir-biriga qoplanib ketardi). Paragraph o'z ustuni ichida
    # so'z bo'yicha 2 qatorga bo'linib yozadi, hech qayerga chiqib
    # ketmaydi.
    th_style = ParagraphStyle(
        "RefTableHeader",
        parent=styles["Normal"],
        fontSize=7.3,
        leading=8.6,
        alignment=1,
        textColor=colors.white,
        fontName="Helvetica-Bold",
    )

    def _th(text: str):
        return Paragraph(text, th_style)

    # Ism ustuni ham tor — uzun ism+telefon (masalan uzun test yozuvlari)
    # oddiy satr sifatida chiqsa, keyingi ustunga "yugurib" kirib, raqamlar
    # bilan qoplanib qolardi (xuddi _th'siz sarlavha kabi). Paragraph shu
    # yerda ham so'z bo'yicha o'z ustuni ichida qatorga bo'linadi.
    td_name_style = ParagraphStyle(
        "RefTableName",
        parent=styles["Normal"],
        fontSize=9,
        leading=11,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0f172a"),
    )

    def _td_name(text: str):
        return Paragraph(text, td_name_style)

    p_start = report.get("period_start", "")
    p_end = report.get("period_end", "")
    date_label = f"{p_start}" if p_start == p_end else f"{p_start} — {p_end}"

    # Ikki rolda ishlaydiganlar (Provider.referrer_id orqali ham shifokor,
    # ham yo'naltiruvchi bo'lgan xodimlar) — bu hisobotda ILGARI umuman
    # ko'rinmasdi (ten_day_report()ning consolidated_payout maydoni faqat
    # ekranda ko'rinardi, PDF'ga ulanmagan edi). Endi shu ro'yxatning
    # o'zida ("Shifokor + Yo'naltiruvchi" deb belgilanib) qo'shiladi —
    # ko'rsatiladigan Ishlangan Ulush/Avans/Sof To'lanadigan raqamlari
    # ENDI ikkala roldagi ulush YIG'INDISI (faqat yo'naltirish ulushi emas).
    consolidated_map = {
        c["referrer_id"]: c for c in (report.get("consolidated_payout") or []) if c.get("referrer_id")
    }
    ref_list = []
    for r in report.get("referrers_payout") or []:
        c = consolidated_map.get(r.get("referrer_id"))
        if c:
            r = {
                **r,
                "name": f"{r.get('name', '')} (Shifokor + Yo'naltiruvchi)",
                "earned_commission": c["total_earned"],
                "advance_deducted": c["advance_deducted"],
                "advance_remaining": c["advance_remaining"],
                "net_payable": c["net_payable"],
                "is_dual_role": True,
                "provider_earned": c["provider_earned"],
                "referrer_earned": c["referrer_earned"],
            }
        ref_list.append(r)

    tot_patients = sum(r.get("patient_count", 0) for r in ref_list)
    tot_gross = sum(r.get("gross_total", 0) for r in ref_list)
    tot_earned = sum(r.get("earned_commission", 0) for r in ref_list)
    tot_advance = sum(r.get("advance_deducted", 0) for r in ref_list)
    tot_net = sum(r.get("net_payable", 0) for r in ref_list)

    elements = [
        Paragraph("MARJONA MED SERVICE", title_style),
        Paragraph("BARCHA YO'NALTIRUVCHILARNING UMUMIY HISOB-KITOB HISOBOTI", subtitle_style),
        Paragraph(f"Davr: {date_label}", subtitle_style),
        Spacer(1, 6),
    ]

    # ---------------- GRAND SUMMARY BOX AT THE VERY TOP OF PAGE 1 ----------------
    summary_box_data = [
        ["Umumiy Yo'naltiruvchilar Soni:", f"{len(ref_list)} nafar"],
        ["Jami Yuborilgan Xizmatlar Soni:", f"{tot_patients} nafar"],
        ["Klinikaga Tushgan Jami Tushum:", _format_money(tot_gross)],
        ["Yo'naltiruvchilarga Hisoblangan Jami Ulush:", _format_money(tot_earned)],
        ["Ushlangan Avanslar Summasi:", f"-{_format_money(tot_advance)}" if tot_advance > 0 else "-0 so'm"],
        ["SOF TO'LANADIGAN UMUMIY SUMMA:", _format_money(tot_net)],
    ]
    t_summary = Table(summary_box_data, colWidths=[11 * cm, 8.4 * cm])
    t_summary.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("TEXTCOLOR", (0, 5), (1, 5), colors.HexColor("#16a34a")),
                ("FONTSIZE", (0, 5), (1, 5), 11.5),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 1.5, colors.HexColor("#0f172a")),
                ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#cbd5e1")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(t_summary)
    elements.append(Spacer(1, 10))

    # ---------------- SECTION 1: GENERAL OVERALL SUMMARY TABLE ----------------
    elements.append(Paragraph("1-QISM: BARCHA YO'NALTIRUVCHILAR BO'YICHA UMUMIY QISQACHA JADVAL", section_head_style))

    summary_table_data = [[
        _th("#"), _th("Yo'naltiruvchi F.I.Sh"), _th("Bemorlar Soni"), _th("Jami Tushum"),
        _th("Ishlangan Ulush"), _th("Avans Ushlanma"), _th("Sof To'lanadigan"),
    ]]

    for i, r in enumerate(ref_list, 1):
        p_cnt = r.get("patient_count", 0)
        gross = r.get("gross_total", 0)
        earned = r.get("earned_commission", 0)
        adv = r.get("advance_deducted", 0)
        net = r.get("net_payable", 0)

        r_name = r.get("name", "Noma'lum")
        r_phone = r.get("phone", "")
        name_str = f"{r_name} ({r_phone})" if r_phone else r_name

        summary_table_data.append([
            str(i),
            _td_name(name_str),
            f"{p_cnt} nafar",
            _format_money(gross),
            _format_money(earned),
            _format_money(adv) if adv > 0 else "0",
            _format_money(net),
        ])

    summary_table_data.append([
        "JAMI",
        "JAMI UMUMIY SUMMA:",
        f"{tot_patients} nafar",
        _format_money(tot_gross),
        _format_money(tot_earned),
        f"-{_format_money(tot_advance)}" if tot_advance > 0 else "0 so'm",
        _format_money(tot_net),
    ])

    t_sec1 = Table(summary_table_data, colWidths=[0.8 * cm, 5.0 * cm, 2.5 * cm, 3.0 * cm, 2.8 * cm, 2.5 * cm, 2.8 * cm])
    t_sec1.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("ALIGN", (2, 0), (2, -1), "CENTER"),
                ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f8fafc")]),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(t_sec1)
    elements.append(Spacer(1, 18))

    # Page 1 Signatures Block
    sig_data = [["Bosh Shifokor / Direktor Imzosi: ___________________", "Bosh Hisobchi Imzosi: ___________________"]]
    t_sig = Table(sig_data, colWidths=[9.7 * cm, 9.7 * cm])
    t_sig.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10.5),
                ("ALIGN", (0, 0), (0, 0), "LEFT"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ]
        )
    )
    elements.append(t_sig)
    elements.append(Spacer(1, 2.0 * cm))

    # ---------------- SECTION 2: DETAILED SERVICES BREAKDOWN PER REFERRER (GROUPED BY DEPARTMENT) ----------------
    if not ref_list:
        elements.append(Paragraph("2-QISM: HAR BIR YO'NALTIRUVCHI BO'YICHA BATAFSIL XIZMATLAR VAZIYATI", section_head_style))
        elements.append(Paragraph("Yo'naltiruvchilar bo'yicha ko'rsatkichlar mavjud emas", ref_head_style))
    else:
        for idx_r, r in enumerate(ref_list, 1):
            ref_elements = []
            r_name = r.get("name", "Noma'lum")
            r_phone = r.get("phone", "")
            r_daily_depts = r.get("daily_departments") or []
            r_depts = r.get("departments") or []
            r_patients = r.get("patients") or []

            ref_elements.append(Paragraph(f"Davr: {date_label}", subtitle_style))
            header_text = f"{r_name}" + (f" ({r_phone})" if r_phone else "")
            ref_elements.append(Paragraph(header_text, section_head_style))

            table_data = [[
                _th("№"), _th("Sana"), _th("Bo'lim nomi"), _th("Bemorlar soni"), _th("Xizmatlar soni"),
                _th("Belgilangan Ulush"), _th("Hisoblangan Ulush (so'm)"),
            ]]

            r_gross = 0
            r_fees = 0
            r_svc_cnt = 0
            r_pat_cnt = r.get("patient_count") or len(r_patients)

            if r_daily_depts:
                idx = 0
                for d in r_daily_depts:
                    p_cnt = d.get("patient_count", 1)
                    cnt = d.get("service_count", 0)
                    gross = d.get("gross_total", 0)
                    fee = d.get("earned_fee", 0)
                    d_name = d.get("department_name", "Bo'lim")
                    r_svc_cnt += cnt
                    r_gross += gross
                    r_fees += fee
                    # 0 so'm hisoblangan qatorlar (masalan 0% ulushli
                    # xizmatlar) PDF'da alohida qator sifatida ko'rsatilmaydi
                    # — jamiga baribir hisoblanadi (yuqorida).
                    if fee <= 0:
                        continue
                    idx += 1
                    table_data.append([
                        str(idx),
                        d.get("date", ""),
                        d_name,
                        f"{p_cnt} nafar",
                        f"{cnt} ta",
                        d.get("rate_label", "10%"),
                        _format_money(fee),
                    ])
            elif r_depts:
                idx = 0
                for d in r_depts:
                    p_cnt = d.get("patient_count", 1)
                    cnt = d.get("service_count", 0)
                    gross = d.get("gross_total", 0)
                    fee = d.get("earned_fee", 0)
                    d_name = d.get("department_name", "Bo'lim")
                    r_svc_cnt += cnt
                    r_gross += gross
                    r_fees += fee
                    if fee <= 0:
                        continue
                    idx += 1
                    table_data.append([
                        str(idx),
                        date_label,
                        d_name,
                        f"{p_cnt} nafar",
                        f"{cnt} ta",
                        d.get("rate_label", "10%"),
                        _format_money(fee),
                    ])
            else:
                idx = 0
                for p in r_patients:
                    paid = p.get("payment_amount", 0)
                    fee = p.get("referrer_fee", 0)
                    d_name = p.get("department_name", "Bo'lim")
                    r_svc_cnt += 1
                    r_gross += paid
                    r_fees += fee
                    if fee <= 0:
                        continue
                    idx += 1
                    table_data.append([
                        str(idx),
                        p.get("date", "").split(" ")[0] if p.get("date") else "",
                        d_name,
                        "1 nafar",
                        "1 ta",
                        p.get("rate_label", "10%"),
                        _format_money(fee),
                    ])

            # Subtotal row for this referrer. Ism bu yerda TAKRORLANMAYDI —
            # sahifa boshidagi sarlavhada allaqachon bor; ikki rolli xodimlar
            # uchun ism "(Shifokor + Yo'naltiruvchi)" bilan uzun bo'lib
            # ketganida bu tor ustunda chapga "yugurib" chiqib, jadval
            # chegarasiga qoplanib qolardi.
            table_data.append([
                "",
                "JAMI:",
                "",
                f"{r_pat_cnt} nafar bemor",
                f"{r_svc_cnt} ta xizmat",
                "",
                _format_money(r_fees),
            ])

            t_ref = Table(table_data, colWidths=[0.8 * cm, 2.7 * cm, 5.5 * cm, 2.5 * cm, 2.5 * cm, 2.5 * cm, 3.0 * cm])
            t_ref.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                        ("ALIGN", (0, 0), (0, -1), "CENTER"),
                        ("ALIGN", (1, 0), (1, -1), "CENTER"),
                        ("ALIGN", (3, 0), (4, -1), "CENTER"),
                        ("ALIGN", (5, 0), (5, -1), "CENTER"),
                        ("ALIGN", (6, 0), (6, -1), "RIGHT"),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f8fafc")]),
                        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e2e8f0")),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]
                )
            )
            ref_elements.append(t_ref)
            ref_elements.append(Spacer(1, 8))

            # Referrer Individual Advance/Net Summary
            r_advance_deducted = r.get("advance_deducted", 0)
            r_advance_remaining = r.get("advance_remaining", 0)
            r_net_payable = r.get("net_payable", 0)
            ref_summary_rows = []
            if r.get("is_dual_role"):
                # Jadvaldagi "Hisoblangan Ulush" faqat YO'NALTIRISH ulushi —
                # bu kishi ayni paytda shifokor sifatida ham ishlagani uchun
                # pastdagi "Beriladigan Summa" jadvaldagidan KATTA chiqadi.
                # Bu farq "sirli" ko'rinmasligi uchun ikkalasi ham alohida
                # ko'rsatiladi.
                ref_summary_rows.append(["Yo'naltirish ulushi (yuqoridagi jadval):", _format_money(r.get("referrer_earned", 0))])
                ref_summary_rows.append(["+ Shifokorlik ulushi (KPI, ushbu davr):", _format_money(r.get("provider_earned", 0))])
                ref_summary_rows.append(["= Ishlagan puli (ikkala rol):", _format_money(r.get("earned_commission", 0))])
            else:
                ref_summary_rows.append(["Ishlagan puli:", _format_money(r.get("earned_commission", r_fees))])
            r_advance_total = r_advance_deducted + r_advance_remaining
            if r_advance_total > 0:
                ref_summary_rows.append(["Jami avans qarzi:", _format_money(r_advance_total)])
            if r_advance_deducted > 0:
                ref_summary_rows.append(["Bu safar ushlangan:", f"-{_format_money(r_advance_deducted)}"])
            if r_advance_remaining > 0:
                ref_summary_rows.append(["Qolgan avans qarzi:", f"-{_format_money(r_advance_remaining)}"])
            ref_summary_rows.append(["BERILADIGAN SUMMA:", _format_money(r_net_payable)])
            t_ref_summary = Table(ref_summary_rows, colWidths=[11 * cm, 8.4 * cm])
            t_ref_summary.setStyle(
                TableStyle(
                    [
                        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                        ("ALIGN", (0, 0), (0, -1), "LEFT"),
                        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                        ("TEXTCOLOR", (0, -1), (1, -1), colors.HexColor("#16a34a")),
                        ("FONTSIZE", (0, -1), (1, -1), 11),
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#0f172a")),
                        ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#cbd5e1")),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]
                )
            )
            ref_elements.append(t_ref_summary)
            ref_elements.append(Spacer(1, 12))

            # Referrer Individual Signatures Block
            sig_data_r = [["Bosh Shifokor / Direktor Imzosi: ___________________", "Bosh Hisobchi Imzosi: ___________________"]]
            t_sig_r = Table(sig_data_r, colWidths=[9.7 * cm, 9.7 * cm])
            t_sig_r.setStyle(
                TableStyle(
                    [
                        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 10),
                        ("ALIGN", (0, 0), (0, 0), "LEFT"),
                        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                    ]
                )
            )
            ref_elements.append(t_sig_r)

            elements.append(KeepTogether(ref_elements))
            elements.append(Spacer(1, 1.8 * cm))

    doc.build(elements)
    return buf.getvalue()


def export_all_staff_pdf(report: dict) -> bytes:
    """Barcha xodimlar (KPI shifokorlar + yo'naltiruvchilar + ikki rolda
    ishlaydiganlar) uchun yagona master PDF — `all_staff_payout`dan.
    Ekrandagi "Chop Etish" (brauzer) bilan bir xil ma'lumotni PDF fayl
    sifatida yuklab olish uchun."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=0.8 * cm,
        leftMargin=0.8 * cm,
        topMargin=0.8 * cm,
        bottomMargin=0.8 * cm,
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "MasterDocTitle", parent=styles["Heading1"], fontSize=18, leading=22, spaceAfter=3,
        alignment=1, fontName="Helvetica-Bold", textColor=colors.HexColor("#0f172a"),
    )
    subtitle_style = ParagraphStyle(
        "MasterSubTitle", parent=styles["Normal"], fontSize=12, leading=15,
        textColor=colors.HexColor("#334155"), alignment=1, spaceAfter=12, fontName="Helvetica-Bold",
    )
    section_head_style = ParagraphStyle(
        "MasterSecHead", parent=styles["Heading2"], fontSize=12, leading=15, spaceBefore=14,
        spaceAfter=6, textColor=colors.HexColor("#0f172a"), fontName="Helvetica-Bold",
    )
    th_style = ParagraphStyle(
        "MasterTableHeader", parent=styles["Normal"], fontSize=7.3, leading=8.6, alignment=1,
        textColor=colors.white, fontName="Helvetica-Bold",
    )

    def _th(text: str):
        return Paragraph(text, th_style)

    td_name_style = ParagraphStyle(
        "MasterTableName", parent=styles["Normal"], fontSize=9, leading=11,
        fontName="Helvetica-Bold", textColor=colors.HexColor("#0f172a"),
    )

    def _td_name(text: str):
        return Paragraph(text, td_name_style)

    p_start = report.get("period_start", "")
    p_end = report.get("period_end", "")
    date_label = f"{p_start}" if p_start == p_end else f"{p_start} — {p_end}"

    staff_list = report.get("all_staff_payout") or []
    tot_earned = sum(r.get("total_earned", 0) for r in staff_list)
    tot_advance = sum(r.get("advance_deducted", 0) for r in staff_list)
    tot_net = sum(r.get("net_payable", 0) for r in staff_list)

    elements = [
        Paragraph("MARJONA MED SERVICE", title_style),
        Paragraph("BARCHA SHIFOKOR VA YO'NALTIRUVCHILARNING YAGONA HISOBOTI", subtitle_style),
        Paragraph(f"Davr: {date_label}", subtitle_style),
        Spacer(1, 6),
    ]

    summary_box_data = [
        ["Umumiy Xodimlar Soni:", f"{len(staff_list)} nafar"],
        ["Barcha Xodimlarga Hisoblangan Jami Ulush:", _format_money(tot_earned)],
        ["Ushlangan Avanslar Summasi:", f"-{_format_money(tot_advance)}" if tot_advance > 0 else "0 so'm"],
        ["BERILADIGAN UMUMIY SUMMA:", _format_money(tot_net)],
    ]
    t_summary = Table(summary_box_data, colWidths=[11 * cm, 8.4 * cm])
    t_summary.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("TEXTCOLOR", (0, 3), (1, 3), colors.HexColor("#16a34a")),
                ("FONTSIZE", (0, 3), (1, 3), 11.5),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 1.5, colors.HexColor("#0f172a")),
                ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#cbd5e1")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(t_summary)
    elements.append(Spacer(1, 10))

    elements.append(Paragraph("1-QISM: BARCHA XODIMLAR BO'YICHA UMUMIY QISQACHA JADVAL", section_head_style))
    summary_table_data = [[
        _th("#"), _th("F.I.Sh & Roli"), _th("Shifokor (KPI)"), _th("Yo'naltiruvchi Ulush"),
        _th("Jami Ishlangan"), _th("Avans (-)"), _th("Beriladigan"),
    ]]
    for i, r in enumerate(staff_list, 1):
        summary_table_data.append([
            str(i),
            _td_name(f"{r.get('name', '')} ({r.get('role', '')})"),
            _format_money(r.get("provider_earned", 0)) if r.get("provider_earned", 0) > 0 else "—",
            _format_money(r.get("referrer_earned", 0)) if r.get("referrer_earned", 0) > 0 else "—",
            _format_money(r.get("total_earned", 0)),
            f"-{_format_money(r.get('advance_deducted', 0))}" if r.get("advance_deducted", 0) > 0 else "0",
            _format_money(r.get("net_payable", 0)),
        ])
    summary_table_data.append([
        "", "JAMI UMUMIY SUMMA:", "", "",
        _format_money(tot_earned),
        f"-{_format_money(tot_advance)}" if tot_advance > 0 else "0",
        _format_money(tot_net),
    ])
    t_sec1 = Table(summary_table_data, colWidths=[0.8 * cm, 5.5 * cm, 2.6 * cm, 2.8 * cm, 2.8 * cm, 2.5 * cm, 2.6 * cm])
    t_sec1.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f8fafc")]),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(t_sec1)
    elements.append(Spacer(1, 18))

    # ---------------- SECTION 2: HAR BIR XODIM UCHUN BATAFSIL SAHIFA ----------------
    if not staff_list:
        elements.append(Paragraph("2-QISM: HAR BIR XODIM BO'YICHA BATAFSIL VAZIYAT", section_head_style))
        elements.append(Paragraph("Xodimlar bo'yicha ko'rsatkichlar mavjud emas", section_head_style))
    else:
        for r in staff_list:
            person_elements = []
            r_name = r.get("name", "Noma'lum")
            r_role = r.get("role", "")

            person_elements.append(Paragraph(f"Davr: {date_label}", subtitle_style))
            # Sof yo'naltiruvchilar uchun rol yorlig'i ortiqcha (ular
            # allaqachon shu ma'noda) — faqat Shifokor va ikki rolli
            # xodimlar uchun ko'rsatiladi.
            header_text = r_name if r_role == "Yo'naltiruvchi" else f"{r_name} ({r_role})"
            person_elements.append(Paragraph(header_text, section_head_style))

            # Group Statsionar lines for individual breakdown table
            raw_breakdown = r.get("breakdown") or []
            grouped_breakdown = []
            inp_lines = [d for d in raw_breakdown if "statsionar" in str(d.get("department_name", "")).lower()]
            other_lines = [d for d in raw_breakdown if "statsionar" not in str(d.get("department_name", "")).lower()]

            if inp_lines:
                # DIQQAT: bu yerda ilgari sana ("21.08-31.08") va stavka
                # ("50 000 so'm/kun") QATTIQ YOZILGAN edi — haqiqiy davr yoki
                # kunlik haq qanday bo'lishidan qat'i nazar doim aynan shu
                # matn chiqardi.
                #
                # Bundan tashqari, statsionar bemorga ko'rsatilgan QO'SHIMCHA
                # xizmatlar (masalan alohida protsedura) ham xuddi shu
                # "Statsionar xizmatlari" nomi bilan qo'shilib kelishi mumkin
                # — bular kunlik qatnashish haqidan (odatda barqaror, bir xil
                # summali) FARQ QILADI. Ikkalasini bitta "X kun / Y so'm/kun"
                # qatoriga qo'shib yuborsak, o'rtacha noto'g'ri (haqiqiy
                # kunlik stavkaga mos kelmaydigan) chiqib qolardi. Shuning
                # uchun eng ko'p uchraydigan summa (kunlik stavka) alohida
                # guruhlanadi, undan farq qiladigan qo'shimcha xizmatlar esa
                # o'z sanasi va haqiqiy summasi bilan alohida qator bo'lib
                # ko'rsatiladi.
                from collections import Counter
                amounts = [d.get("earned_fee", 0) for d in inp_lines]
                amount_counts = Counter(amounts)
                # Eng ko'p takrorlangan summa — bu kunlik qatnashish stavkasi
                # deb qaraladi (ikkitadan kam bo'lsa, guruhlashning ma'nosi
                # yo'q — hammasi alohida ko'rsatiladi).
                stavka, stavka_soni = amount_counts.most_common(1)[0]
                if stavka_soni >= 2:
                    kunlik_lines = [d for d in inp_lines if d.get("earned_fee", 0) == stavka]
                    qoshimcha_lines = [d for d in inp_lines if d.get("earned_fee", 0) != stavka]
                else:
                    kunlik_lines = []
                    qoshimcha_lines = inp_lines

                if kunlik_lines:
                    inp_dates = []
                    for d in kunlik_lines:
                        try:
                            inp_dates.append(datetime.strptime(d.get("date", ""), "%d.%m.%Y"))
                        except (ValueError, TypeError):
                            pass
                    date_range = (
                        f"{min(inp_dates).strftime('%d.%m')}–{max(inp_dates).strftime('%d.%m')}"
                        if inp_dates else "—"
                    )
                    kun_soni = len(kunlik_lines)
                    grouped_breakdown.append({
                        "date": date_range,
                        "department_name": "Statsionar xizmatlari",
                        "source": "Shifokor (KPI)",
                        "patient_count": f"{kun_soni} kun",
                        "rate_label": f"{stavka:,} so'm/kun".replace(",", " "),
                        "earned_fee": stavka * kun_soni,
                    })
                for d in qoshimcha_lines:
                    grouped_breakdown.append({
                        "date": d.get("date", "—"),
                        "department_name": "Statsionar xizmatlari (qo'shimcha)",
                        "source": "Shifokor (KPI)",
                        "patient_count": "1 nafar",
                        "rate_label": "—",
                        "earned_fee": d.get("earned_fee", 0),
                    })
            grouped_breakdown.extend(other_lines)

            table_data = [[
                _th("№"), _th("Sana"), _th("Bo'lim nomi"), _th("Manba"),
                _th("Bemorlar"), _th("Ulush"), _th("Hisoblangan (so'm)"),
            ]]
            b_earned = 0
            idx = 0
            for d in grouped_breakdown:
                fee = d.get("earned_fee", 0)
                b_earned += fee
                if fee <= 0:
                    continue
                idx += 1
                p_cnt = d.get('patient_count', 1)
                p_cnt_str = f"{p_cnt} nafar" if isinstance(p_cnt, int) else str(p_cnt)
                table_data.append([
                    str(idx),
                    d.get("date", ""),
                    d.get("department_name", "Bo'lim"),
                    d.get("source", ""),
                    p_cnt_str,
                    d.get("rate_label", "—"),
                    _format_money(fee),
                ])
            tot_e_val = r.get("total_earned", b_earned)
            net_p_val = r.get("net_payable", 0)

            table_data.append(["", "JAMI:", "", "", "", "", _format_money(tot_e_val)])

            t_person = Table(table_data, colWidths=[0.8 * cm, 2.3 * cm, 4.8 * cm, 2.8 * cm, 2.2 * cm, 2.3 * cm, 3.4 * cm])
            t_person.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                        ("ALIGN", (0, 0), (0, -1), "CENTER"),
                        ("ALIGN", (3, 0), (5, -1), "CENTER"),
                        ("ALIGN", (6, 0), (6, -1), "RIGHT"),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f8fafc")]),
                        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e2e8f0")),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]
                )
            )
            person_elements.append(t_person)
            person_elements.append(Spacer(1, 8))

            adv_ded = r.get("advance_deducted", 0) or 0
            adv_rem = r.get("advance_remaining", 0) or 0

            adv_total = adv_ded + adv_rem
            summary_rows = [["Ishlagan puli:", _format_money(tot_e_val)]]
            if adv_total > 0:
                summary_rows.append(["Jami avans qarzi:", _format_money(adv_total)])
            if adv_ded > 0:
                summary_rows.append(["Bu safar ushlangan:", f"-{_format_money(adv_ded)}"])
            if adv_rem > 0:
                summary_rows.append(["Qolgan avans qarzi:", f"-{_format_money(adv_rem)}"])
            summary_rows.append(["BERILADIGAN SUMMA:", _format_money(net_p_val)])

            t_person_summary = Table(summary_rows, colWidths=[11 * cm, 8.4 * cm])
            t_person_summary.setStyle(
                TableStyle(
                    [
                        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                        ("ALIGN", (0, 0), (0, -1), "LEFT"),
                        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                        ("TEXTCOLOR", (0, 1), (1, 1), colors.HexColor("#dc2626")),
                        ("TEXTCOLOR", (0, -1), (1, -1), colors.HexColor("#16a34a")),
                        ("FONTSIZE", (0, -1), (1, -1), 11),
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#0f172a")),
                        ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#cbd5e1")),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]
                )
            )
            person_elements.append(t_person_summary)
            person_elements.append(Spacer(1, 12))

            sig_data = [["Bosh Shifokor / Direktor Imzosi: ___________________", "Bosh Hisobchi Imzosi: ___________________"]]
            t_sig = Table(sig_data, colWidths=[9.7 * cm, 9.7 * cm])
            t_sig.setStyle(
                TableStyle(
                    [
                        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 10),
                        ("ALIGN", (0, 0), (0, 0), "LEFT"),
                        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                    ]
                )
            )
            person_elements.append(t_sig)

            elements.append(KeepTogether(person_elements))
            elements.append(Spacer(1, 1.8 * cm))

    doc.build(elements)
    return buf.getvalue()


def _xlsx_header_row(ws, row: int, headers: list[str]) -> None:
    fill = PatternFill(start_color=GOLD, end_color=GOLD, fill_type="solid")
    bold_white = Font(bold=True, color="FFFFFF")
    for col, text in enumerate(headers, start=1):
        cell = ws.cell(row=row, column=col, value=text)
        cell.font = bold_white
        cell.fill = fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)


def _xlsx_section_title(ws, row: int, text: str, ncols: int) -> None:
    ws.cell(row=row, column=1, value=text).font = Font(bold=True, size=11, color="0F172A")
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=ncols)
    ws.cell(row=row, column=1).fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")


def _referrer_detail_rows(r: dict, date_label: str) -> tuple[list[dict], int, int, int]:
    """Bitta yo'naltiruvchi uchun batafsil qator ro'yxatini qaytaradi
    (Excel uchun) — `export_referrers_pdf`dagi 3 pog'onali zaxira
    mantiqning (daily_departments -> departments -> patients) aynan o'zi,
    faqat PDF'ga emas, xlsx qator lug'atlariga yoziladi."""
    r_daily_depts = r.get("daily_departments") or []
    r_depts = r.get("departments") or []
    r_patients = r.get("patients") or []
    r_pat_cnt = r.get("patient_count") or len(r_patients)

    rows: list[dict] = []
    r_fees = 0
    r_svc_cnt = 0

    if r_daily_depts:
        for d in r_daily_depts:
            cnt = d.get("service_count", 0)
            fee = d.get("earned_fee", 0)
            r_svc_cnt += cnt
            r_fees += fee
            if fee <= 0:
                continue
            rows.append({
                "date": d.get("date", ""),
                "department_name": d.get("department_name", "Bo'lim"),
                "patient_count_label": f"{d.get('patient_count', 1)} nafar",
                "service_count_label": f"{cnt} ta",
                "rate_label": d.get("rate_label", "10%"),
                "fee": fee,
            })
    elif r_depts:
        for d in r_depts:
            cnt = d.get("service_count", 0)
            fee = d.get("earned_fee", 0)
            r_svc_cnt += cnt
            r_fees += fee
            if fee <= 0:
                continue
            rows.append({
                "date": date_label,
                "department_name": d.get("department_name", "Bo'lim"),
                "patient_count_label": f"{d.get('patient_count', 1)} nafar",
                "service_count_label": f"{cnt} ta",
                "rate_label": d.get("rate_label", "10%"),
                "fee": fee,
            })
    else:
        for p in r_patients:
            fee = p.get("referrer_fee", 0)
            r_svc_cnt += 1
            r_fees += fee
            if fee <= 0:
                continue
            rows.append({
                "date": p.get("date", "").split(" ")[0] if p.get("date") else "",
                "department_name": p.get("department_name", "Bo'lim"),
                "patient_count_label": "1 nafar",
                "service_count_label": "1 ta",
                "rate_label": p.get("rate_label", "10%"),
                "fee": fee,
            })

    return rows, r_pat_cnt, r_svc_cnt, r_fees


def _group_staff_inpatient_breakdown(raw_breakdown: list) -> list[dict]:
    """Bitta xodimning `breakdown` ro'yxatidagi statsionar qatorlarini
    kunlik stavka va undan farq qiladigan qo'shimcha xizmatlarga ajratib
    guruhlaydi (Excel uchun) — `export_all_staff_pdf`dagi xuddi shu
    mantiqning aynan o'zi."""
    from collections import Counter

    grouped: list[dict] = []
    inp_lines = [d for d in raw_breakdown if "statsionar" in str(d.get("department_name", "")).lower()]
    other_lines = [d for d in raw_breakdown if "statsionar" not in str(d.get("department_name", "")).lower()]

    if inp_lines:
        amounts = [d.get("earned_fee", 0) for d in inp_lines]
        stavka, stavka_soni = Counter(amounts).most_common(1)[0]
        if stavka_soni >= 2:
            kunlik_lines = [d for d in inp_lines if d.get("earned_fee", 0) == stavka]
            qoshimcha_lines = [d for d in inp_lines if d.get("earned_fee", 0) != stavka]
        else:
            kunlik_lines = []
            qoshimcha_lines = inp_lines

        if kunlik_lines:
            inp_dates = []
            for d in kunlik_lines:
                try:
                    inp_dates.append(datetime.strptime(d.get("date", ""), "%d.%m.%Y"))
                except (ValueError, TypeError):
                    pass
            date_range = (
                f"{min(inp_dates).strftime('%d.%m')}–{max(inp_dates).strftime('%d.%m')}"
                if inp_dates else "—"
            )
            kun_soni = len(kunlik_lines)
            grouped.append({
                "date": date_range,
                "department_name": "Statsionar xizmatlari",
                "source": "Shifokor (KPI)",
                "patient_count": f"{kun_soni} kun",
                "rate_label": f"{stavka:,} so'm/kun".replace(",", " "),
                "earned_fee": stavka * kun_soni,
            })
        for d in qoshimcha_lines:
            grouped.append({
                "date": d.get("date", "—"),
                "department_name": "Statsionar xizmatlari (qo'shimcha)",
                "source": "Shifokor (KPI)",
                "patient_count": "1 nafar",
                "rate_label": "—",
                "earned_fee": d.get("earned_fee", 0),
            })
    grouped.extend(other_lines)
    return grouped


def export_referrers_excel(report: dict) -> bytes:
    """Yo'naltiruvchilar 10 kunlik hisoboti — Excel (.xlsx) ko'rinishida.

    1-qism: PDF dagi kabi umumiy jamlovchi jadval (bir xodim — bir qator).
    2-qism: har bir yo'naltiruvchi uchun PDF dagi kabi to'liq batafsil
    jadval — har bir xizmat/bo'lim bo'yicha sana, bemorlar/xizmatlar soni,
    ulush va hisoblangan summa."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Yo'naltiruvchilar"
    NCOLS = 8

    date_label = f"{report.get('period_start', '')} — {report.get('period_end', '')}"
    ws["A1"] = "MARJONA MED SERVIS — YO'NALTIRUVCHILAR HISOBOTI"
    ws["A1"].font = Font(bold=True, size=14)
    ws.merge_cells("A1:H1")
    ws["A2"] = f"Davr: {date_label}"
    ws["A2"].font = Font(italic=True, size=10)
    ws.merge_cells("A2:H2")

    headers = ["F.I.Sh", "Telefon", "Bemorlar soni", "Ishlangan komissiya",
               "Avans (-)", "Qolgan qarz", "Sof to'lanadigan", "To'landi"]
    header_row = 4
    _xlsx_header_row(ws, header_row, headers)

    ref_list = report.get("referrers_payout", [])
    r = header_row + 1
    totals = [0, 0, 0, 0, 0]
    for ref in ref_list:
        values = [
            ref.get("name") or "",
            ref.get("phone") or "",
            ref.get("patient_count", 0),
            ref.get("earned_commission", 0),
            ref.get("advance_deducted", 0),
            ref.get("advance_remaining", 0),
            ref.get("remaining_payable", ref.get("net_payable", 0)),
            ref.get("already_paid", 0),
        ]
        for col, v in enumerate(values, start=1):
            ws.cell(row=r, column=col, value=v)
        totals[0] += ref.get("patient_count", 0)
        totals[1] += ref.get("earned_commission", 0)
        totals[2] += ref.get("advance_deducted", 0)
        totals[3] += ref.get("remaining_payable", ref.get("net_payable", 0))
        totals[4] += ref.get("already_paid", 0)
        r += 1

    ws.cell(row=r, column=1, value="JAMI:").font = Font(bold=True)
    ws.cell(row=r, column=3, value=totals[0]).font = Font(bold=True)
    ws.cell(row=r, column=4, value=totals[1]).font = Font(bold=True)
    ws.cell(row=r, column=5, value=totals[2]).font = Font(bold=True)
    ws.cell(row=r, column=7, value=totals[3]).font = Font(bold=True)
    ws.cell(row=r, column=8, value=totals[4]).font = Font(bold=True)
    r += 3

    # ---------------- 2-QISM: HAR BIR YO'NALTIRUVCHI BO'YICHA BATAFSIL ----------------
    _xlsx_section_title(ws, r, "2-QISM: HAR BIR YO'NALTIRUVCHI BO'YICHA BATAFSIL XIZMATLAR VAZIYATI", NCOLS)
    r += 2

    detail_headers = ["№", "Sana", "Bo'lim nomi", "Bemorlar soni", "Xizmatlar soni",
                       "Belgilangan Ulush", "Hisoblangan Ulush (so'm)"]
    for ref in ref_list:
        header_text = ref.get("name", "Noma'lum") + (f" ({ref.get('phone')})" if ref.get("phone") else "")
        ws.cell(row=r, column=1, value=header_text).font = Font(bold=True, size=11, color="0F172A")
        r += 1

        _xlsx_header_row(ws, r, detail_headers)
        r += 1

        rows, r_pat_cnt, r_svc_cnt, r_fees = _referrer_detail_rows(ref, date_label)
        for idx, d in enumerate(rows, 1):
            ws.cell(row=r, column=1, value=idx)
            ws.cell(row=r, column=2, value=d["date"])
            ws.cell(row=r, column=3, value=d["department_name"])
            ws.cell(row=r, column=4, value=d["patient_count_label"])
            ws.cell(row=r, column=5, value=d["service_count_label"])
            ws.cell(row=r, column=6, value=d["rate_label"])
            ws.cell(row=r, column=7, value=d["fee"])
            r += 1

        ws.cell(row=r, column=2, value="JAMI:").font = Font(bold=True)
        ws.cell(row=r, column=4, value=f"{r_pat_cnt} nafar bemor").font = Font(bold=True)
        ws.cell(row=r, column=5, value=f"{r_svc_cnt} ta xizmat").font = Font(bold=True)
        ws.cell(row=r, column=7, value=r_fees).font = Font(bold=True)
        r += 2

        adv_ded = ref.get("advance_deducted", 0) or 0
        adv_rem = ref.get("advance_remaining", 0) or 0
        summary = [("Ishlagan puli:", ref.get("earned_commission", r_fees))]
        if adv_ded + adv_rem > 0:
            summary.append(("Jami avans qarzi:", adv_ded + adv_rem))
        if adv_ded > 0:
            summary.append(("Bu safar ushlangan:", -adv_ded))
        if adv_rem > 0:
            summary.append(("Qolgan avans qarzi:", -adv_rem))
        summary.append(("BERILADIGAN SUMMA:", ref.get("net_payable", 0)))
        for label, val in summary:
            ws.cell(row=r, column=1, value=label).font = Font(bold=True)
            cell = ws.cell(row=r, column=2, value=val)
            cell.font = Font(bold=True, color="16A34A") if label == "BERILADIGAN SUMMA:" else Font(bold=True)
            r += 1
        r += 2

    widths = [26, 16, 22, 14, 14, 16, 18, 14]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[chr(64 + i)].width = w

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def export_all_staff_excel(report: dict) -> bytes:
    """Barcha xodimlar (shifokor + yo'naltiruvchi) 10 kunlik yagona
    hisoboti — Excel (.xlsx) ko'rinishida.

    1-qism: PDF dagi kabi umumiy jamlovchi jadval (bir xodim — bir qator).
    2-qism: har bir xodim uchun PDF dagi kabi to'liq batafsil jadval —
    har bir xizmat/bo'lim bo'yicha sana, bemorlar soni, ulush va
    hisoblangan summa (statsionar kunlik stavka va qo'shimcha xizmatlar
    ham PDF dagi kabi alohida ajratilgan)."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Barcha xodimlar"
    NCOLS = 8

    period = f"{report.get('period_start', '')} — {report.get('period_end', '')}"
    ws["A1"] = "MARJONA MED SERVIS — BARCHA XODIMLAR YAGONA HISOBOTI"
    ws["A1"].font = Font(bold=True, size=14)
    ws.merge_cells("A1:H1")
    ws["A2"] = f"Davr: {period}"
    ws["A2"].font = Font(italic=True, size=10)
    ws.merge_cells("A2:H2")

    headers = ["F.I.Sh", "Roli", "Shifokor ulushi", "Yo'naltiruvchi ulushi",
               "Jami ishlangan", "Avans (-)", "Qolgan qarz", "Sof to'lanadigan"]
    header_row = 4
    _xlsx_header_row(ws, header_row, headers)

    staff_rows = report.get("all_staff_payout", [])
    r = header_row + 1
    totals = [0, 0, 0, 0, 0, 0]
    for x in staff_rows:
        remaining = x.get("remaining_payable", x.get("net_payable", 0))
        values = [
            x.get("name") or "",
            x.get("role") or "",
            x.get("provider_earned", 0),
            x.get("referrer_earned", 0),
            x.get("total_earned", 0),
            x.get("advance_deducted", 0),
            x.get("advance_remaining", 0),
            remaining,
        ]
        for col, v in enumerate(values, start=1):
            ws.cell(row=r, column=col, value=v)
        totals[0] += x.get("provider_earned", 0)
        totals[1] += x.get("referrer_earned", 0)
        totals[2] += x.get("total_earned", 0)
        totals[3] += x.get("advance_deducted", 0)
        totals[4] += x.get("advance_remaining", 0)
        totals[5] += remaining
        r += 1

    ws.cell(row=r, column=1, value="JAMI:").font = Font(bold=True)
    for col, t in enumerate(totals, start=3):
        ws.cell(row=r, column=col, value=t).font = Font(bold=True)
    r += 3

    # ---------------- 2-QISM: HAR BIR XODIM BO'YICHA BATAFSIL ----------------
    _xlsx_section_title(ws, r, "2-QISM: HAR BIR XODIM BO'YICHA BATAFSIL XIZMATLAR VAZIYATI", NCOLS)
    r += 2

    detail_headers = ["№", "Sana", "Bo'lim nomi", "Manba", "Bemorlar", "Ulush", "Hisoblangan (so'm)"]
    for x in staff_rows:
        role = x.get("role") or ""
        header_text = x.get("name", "Noma'lum") if role == "Yo'naltiruvchi" else f"{x.get('name', 'Noma`lum')} ({role})"
        ws.cell(row=r, column=1, value=header_text).font = Font(bold=True, size=11, color="0F172A")
        r += 1

        _xlsx_header_row(ws, r, detail_headers)
        r += 1

        grouped = _group_staff_inpatient_breakdown(x.get("breakdown") or [])
        idx = 0
        b_earned = 0
        for d in grouped:
            fee = d.get("earned_fee", 0)
            b_earned += fee
            if fee <= 0:
                continue
            idx += 1
            p_cnt = d.get("patient_count", 1)
            ws.cell(row=r, column=1, value=idx)
            ws.cell(row=r, column=2, value=d.get("date", ""))
            ws.cell(row=r, column=3, value=d.get("department_name", "Bo'lim"))
            ws.cell(row=r, column=4, value=d.get("source", ""))
            ws.cell(row=r, column=5, value=f"{p_cnt} nafar" if isinstance(p_cnt, int) else str(p_cnt))
            ws.cell(row=r, column=6, value=d.get("rate_label", "—"))
            ws.cell(row=r, column=7, value=fee)
            r += 1

        tot_e_val = x.get("total_earned", b_earned)
        ws.cell(row=r, column=2, value="JAMI:").font = Font(bold=True)
        ws.cell(row=r, column=7, value=tot_e_val).font = Font(bold=True)
        r += 2

        adv_ded = x.get("advance_deducted", 0) or 0
        adv_rem = x.get("advance_remaining", 0) or 0
        summary = [("Ishlagan puli:", tot_e_val)]
        if adv_ded + adv_rem > 0:
            summary.append(("Jami avans qarzi:", adv_ded + adv_rem))
        if adv_ded > 0:
            summary.append(("Bu safar ushlangan:", -adv_ded))
        if adv_rem > 0:
            summary.append(("Qolgan avans qarzi:", -adv_rem))
        summary.append(("SOF TO'LANADIGAN:", x.get("net_payable", 0)))
        for label, val in summary:
            ws.cell(row=r, column=1, value=label).font = Font(bold=True)
            cell = ws.cell(row=r, column=2, value=val)
            cell.font = Font(bold=True, color="16A34A") if label == "SOF TO'LANADIGAN:" else Font(bold=True)
            r += 1
        r += 2

    widths = [26, 24, 18, 14, 14, 16, 18, 14]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[chr(64 + i)].width = w

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


