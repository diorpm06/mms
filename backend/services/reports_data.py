import json
from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.advance import Advance
from models.balance import Balance
from models.duty_log import DutyLog
from models.expense import Expense
from models.inpatient import Inpatient, InpatientPayment
from models.patient import Patient
from models.payout import Payout
from models.provider import Provider
from models.referrer import Referrer
from models.salary_log import SalaryLog
from models.service import Service
from models.transaction import Transaction


def _extract_department_name(s_name: str, s_cat: str, s_cab: str) -> str:
    combined = f"{s_cat or ''} {s_name or ''} {s_cab or ''}".lower()

    if "uzi" in combined or "узи" in combined:
        return "UZI"
    if any(k in combined for k in ["laborat", "labar", "tahlil", "gormon", "ifa", "ekspress", "biokimy", "revmat", "parazit", "elektrolit", "siydik", "torch", "gepatit", "qon"]):
        return "Laboratoriya"
    if "fizioter" in combined:
        return "Fizioterapiya"
    if "ineks" in combined or "ukol" in combined or "sistem" in combined:
        return "Ineksiya"
    if "fototer" in combined:
        return "Fototerapiya"
    if "massaj" in combined:
        return "Massaj"
    if "ozon" in combined:
        return "Ozonoterapiya"
    if "konsult" in combined or "shifokor" in combined:
        return "Konsultatsiya"

    raw = (s_cat or "").strip() or (s_name or "").strip()
    if ":" in raw:
        dept = raw.split(":")[0].strip()
    else:
        dept = raw

    return dept or "Boshqa xizmatlar"


def _infer_service_category(name: str, category: str, cabinet: str) -> str:
    return _extract_department_name(name, category, cabinet)




def _day_range(d: date):
    start = datetime.combine(d, datetime.min.time())
    end = datetime.combine(d, datetime.max.time())
    return start, end


def _period_range(start: date, end: date):
    return (
        datetime.combine(start, datetime.min.time()),
        datetime.combine(end, datetime.max.time()),
    )


def _active_tx_filter(q):
    return q.filter(Transaction.is_cancelled == False)


def last_activity_date(db: Session) -> date | None:
    """Oxirgi to'lov bo'lgan kun."""
    last_dt = (
        _active_tx_filter(db.query(func.max(Transaction.created_at)))
        .scalar()
    )
    if not last_dt:
        return None
    if isinstance(last_dt, datetime):
        return last_dt.date()
    return last_dt


def get_report(db: Session, start: date, end: date) -> dict:
    s, e = _period_range(start, end)

    txs = _active_tx_filter(
        db.query(Transaction).filter(Transaction.created_at >= s, Transaction.created_at <= e)
    ).all()

    patients_q = db.query(Patient).filter(
        Patient.created_at >= s, Patient.created_at <= e, Patient.is_cancelled == False
    )
    all_patients = patients_q.all()
    patients_count = len(all_patients)

    phones_seen = set()
    new_count = 0
    repeat_count = 0
    for p in sorted(all_patients, key=lambda x: x.created_at):
        if p.phone in phones_seen:
            repeat_count += 1
        else:
            phones_seen.add(p.phone)
            new_count += 1

    if txs:
        total_income = sum(t.total_amount for t in txs)
        cash = sum(
            (t.cash_amount if t.cash_amount else (t.total_amount if t.payment_type in ("cash", "naqd") else 0))
            for t in txs
        )
        card = sum(
            (t.card_amount if t.card_amount else (t.total_amount if t.payment_type in ("card", "karta", "click", "qr") else 0))
            for t in txs
        )
        referrer_share = sum(t.referrer_amount for t in txs)
        provider_share = sum(t.provider_amount for t in txs)
        center_share = sum(t.center_amount for t in txs)
    else:
        total_income = sum((p.payment_amount or 0) for p in all_patients)
        cash = sum(
            (p.payment_amount or 0) if (p.payment_type or "").lower() in ("cash", "naqd") else 0
            for p in all_patients
        )
        card = sum(
            (p.payment_amount or 0) if (p.payment_type or "").lower() in ("card", "karta", "click", "qr") else 0
            for p in all_patients
        )
        referrer_share = sum((getattr(p, "referrer_amount", 0) or 0) for p in all_patients)
        provider_share = sum((getattr(p, "provider_amount", 0) or 0) for p in all_patients)
        center_share = total_income - referrer_share - provider_share

    expenses = (
        db.query(Expense)
        .filter(Expense.created_at >= s, Expense.created_at <= e, Expense.is_cancelled == False)
        .all()
    )
    expense_total = sum(x.amount for x in expenses)

    advance_total = (
        db.query(func.coalesce(func.sum(Payout.amount), 0))
        .filter(
            Payout.recipient_type == "advance",
            Payout.created_at >= s,
            Payout.created_at <= e,
        )
        .scalar()
    )

    salary_total = (
        db.query(func.coalesce(func.sum(Payout.amount), 0))
        .filter(
            Payout.recipient_type.in_(["provider", "employee"]),
            Payout.created_at >= s,
            Payout.created_at <= e,
        )
        .scalar()
    )

    net_profit = center_share - expense_total - salary_total

    active_inpatients = (
        db.query(Inpatient)
        .filter(Inpatient.status == "yotibdi", Inpatient.is_cancelled == False)
        .count()
    )
    discharged_today = (
        db.query(Inpatient)
        .filter(
            Inpatient.discharged_at >= s,
            Inpatient.discharged_at <= e,
            Inpatient.status == "chiqdi",
            Inpatient.is_cancelled == False,
        )
        .count()
    )
    inpatient_income = (
        db.query(func.coalesce(func.sum(InpatientPayment.amount), 0))
        .filter(
            InpatientPayment.created_at >= s,
            InpatientPayment.created_at <= e,
            InpatientPayment.is_cancelled == False,
        )
        .scalar()
    )

    services_breakdown = (
        db.query(
            Service.name,
            Service.category,
            Service.cabinet,
            func.count(Patient.id).label("cnt"),
            func.sum(Patient.payment_amount).label("total"),
        )
        .join(Patient, Patient.service_id == Service.id)
        .filter(
            Patient.created_at >= s,
            Patient.created_at <= e,
            Patient.is_cancelled == False,
        )
        .group_by(Service.id, Service.name, Service.category, Service.cabinet)
        .order_by(func.sum(Patient.payment_amount).desc())
        .all()
    )

    dept_map = {}
    for r in services_breakdown:
        s_name = r[0] or ""
        s_cat = r[1] or ""
        s_cab = r[2] or ""
        cnt = r[3] or 0
        tot = int(r[4] or 0)

        dept = _extract_department_name(s_name, s_cat, s_cab)
        if dept not in dept_map:
            dept_map[dept] = {"name": dept, "count": 0, "total": 0}
        dept_map[dept]["count"] += cnt
        dept_map[dept]["total"] += tot

    formatted_services = list(dept_map.values())
    formatted_services.sort(key=lambda x: x["total"], reverse=True)


    referrers_breakdown = (
        db.query(
            Referrer.full_name,
            func.count(func.distinct(Transaction.patient_id)).label("cnt"),
            func.sum(Transaction.referrer_amount).label("total"),
        )
        .join(Transaction, Transaction.referrer_id == Referrer.id)
        .filter(
            Transaction.created_at >= s,
            Transaction.created_at <= e,
            Transaction.is_cancelled == False,
        )
        .group_by(Referrer.id, Referrer.full_name)
        .order_by(func.sum(Transaction.referrer_amount).desc())
        .limit(10)
        .all()
    )

    duty_date = end if start == end else date.today()

    from models.employee import Employee
    from sqlalchemy.orm import joinedload

    duty_today = (
        db.query(DutyLog)
        .options(joinedload(DutyLog.employee))
        .filter(DutyLog.duty_date == duty_date)
        .all()
    )

    duty_list = [
        {"name": d.employee.full_name if d.employee else "?", "shift": d.shift}
        for d in duty_today
    ]

    bal = db.query(Balance).first()
    current_balance = bal.current_balance if bal else 0

    daily_totals_rows = (
        db.query(
            func.date(Transaction.created_at).label("day"),
            func.sum(Transaction.total_amount).label("total"),
        )
        .filter(
            Transaction.created_at >= s,
            Transaction.created_at <= e,
            Transaction.is_cancelled == False,
        )
        .group_by(func.date(Transaction.created_at))
        .all()
    )
    daily_totals_map = {}
    for row in daily_totals_rows:
        day_val = row.day
        if isinstance(day_val, str):
            day_val = datetime.fromisoformat(day_val).date()
        daily_totals_map[day_val] = int(row.total or 0)

    chart = []
    d = start
    while d <= end:
        chart.append({"date": d.strftime("%d.%m"), "income": daily_totals_map.get(d, 0), "expenses": 0})
        d += timedelta(days=1)

    payment_chart = [
        {"name": "Naqt", "value": int(cash)},
        {"name": "Karta", "value": int(card)},
    ]
    finance_chart = [
        {"name": "Jami tushgan", "value": int(total_income)},
        {"name": "Yo'naltiruvchi", "value": int(referrer_share)},
        {"name": "Xizmat ko'rsatuvchi", "value": int(provider_share)},
        {"name": "Klinika ulushi", "value": int(center_share)},
        {"name": "Harajatlar", "value": int(expense_total)},
        {"name": "Maoshlar", "value": int(salary_total)},
        {"name": "Klinikada qolgan", "value": int(net_profit)},
    ]

    from models.audit_log import AuditLog
    from models.inventory import InventoryItem

    inv_map = {item.name: item for item in db.query(InventoryItem).all()}

    mat_logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.action_type == "CONSUME_MATERIAL",
            AuditLog.created_at >= s,
            AuditLog.created_at <= e,
        )
        .all()
    )

    mat_summary = {}
    for l in mat_logs:
        if isinstance(l.new_data, str):
            try:
                nd = json.loads(l.new_data) if l.new_data else {}
            except (json.JSONDecodeError, TypeError):
                nd = {}
        else:
            nd = l.new_data or {}
        item_name = nd.get("item_name") or "Noma'lum Material"
        consumed_amt = int(nd.get("consumed") or 0)
        charged_amt = int(nd.get("charged") or 0)

        item_obj = inv_map.get(item_name)
        cost_p = getattr(item_obj, "cost_price", 0) if item_obj else int(nd.get("cost_price") or 0)
        unit_p = getattr(item_obj, "unit_price", 0) if item_obj else (charged_amt // consumed_amt if consumed_amt > 0 else 0)

        if item_name not in mat_summary:
            mat_summary[item_name] = {
                "name": item_name,
                "quantity_used": 0,
                "unit_price": unit_p,
                "cost_price": cost_p,
                "total_income": 0,
                "total_cost": 0,
                "profit": 0,
            }
        mat_summary[item_name]["quantity_used"] += consumed_amt
        mat_summary[item_name]["total_income"] += charged_amt
        mat_summary[item_name]["total_cost"] += consumed_amt * cost_p

    mat_patients = (
        db.query(Patient)
        .filter(
            Patient.created_at >= s,
            Patient.created_at <= e,
            Patient.is_cancelled == False,
            Patient.diagnosis != None,
        )
        .all()
    )
    for p in mat_patients:
        diag = (p.diagnosis or "").strip()
        mat_name = None
        if diag.startswith("Sarflangan Material (") and diag.endswith(")"):
            mat_name = diag[21:-1].strip()
        elif diag.startswith("Material: "):
            mat_name = diag[10:].strip()
        elif p.queue_status == "yakunlandi" and p.service and (p.service.name == diag or not p.service_id):
            mat_name = diag

        if mat_name:
            item_obj = inv_map.get(mat_name)
            cost_p = getattr(item_obj, "cost_price", 0) if item_obj else 0
            unit_p = getattr(item_obj, "unit_price", 0) if item_obj else int(p.payment_amount or 0)

            if mat_name not in mat_summary:
                mat_summary[mat_name] = {
                    "name": mat_name,
                    "quantity_used": 1,
                    "unit_price": unit_p,
                    "cost_price": cost_p,
                    "total_income": int(p.payment_amount or 0),
                    "total_cost": cost_p,
                    "profit": int(p.payment_amount or 0) - cost_p,
                }

    for k, v in mat_summary.items():
        v["profit"] = v["total_income"] - v["total_cost"]

    materials_used_breakdown = list(mat_summary.values())
    materials_used_breakdown.sort(key=lambda x: x["profit"], reverse=True)
    total_material_income = sum(m["total_income"] for m in materials_used_breakdown)
    total_material_cost = sum(m["total_cost"] for m in materials_used_breakdown)
    total_material_profit = sum(m["profit"] for m in materials_used_breakdown)
    total_material_quantity = sum(m["quantity_used"] for m in materials_used_breakdown)

    return {
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "patients_count": patients_count,
        "new_patients": new_count,
        "repeat_patients": repeat_count,
        "total_income": int(total_income),
        "cash": int(cash),
        "card": int(card),
        "referrer_share": int(referrer_share),
        "provider_share": int(provider_share),
        "center_share": int(center_share),
        "expenses": int(expense_total),
        "expenses_list": [
            {
                "id": ex.id,
                "category": ex.category or "Boshqa",
                "description": (ex.description.split("] ", 1)[1] if "] " in ex.description else ex.description),
                "amount": int(ex.amount),
                "created_at": ex.created_at.isoformat() if ex.created_at else None,
            }
            for ex in expenses
        ],
        "advances": int(advance_total),
        "salaries": int(salary_total),
        "net_profit": int(net_profit),
        "current_balance": int(current_balance),
        "active_inpatients": active_inpatients,
        "discharged_today": discharged_today,
        "inpatient_income": int(inpatient_income or 0),
        "services_breakdown": formatted_services,
        "referrers_breakdown": [
            {"name": r[0], "count": r[1], "total": int(r[2] or 0)} for r in referrers_breakdown
        ],
        "materials_used_breakdown": materials_used_breakdown,
        "total_material_income": int(total_material_income),
        "total_material_cost": int(total_material_cost),
        "total_material_profit": int(total_material_profit),
        "total_material_quantity": int(total_material_quantity),
        "duty_today": duty_list,
        "income_chart": chart,
        "payment_chart": payment_chart,
        "finance_chart": finance_chart,
    }


def admin_daily_report(db: Session, d: date) -> dict:
    """Admin uchun — foizlar, sof foyda va ichki taqsimot yo'q."""
    full = get_report(db, d, d)
    out = {
        "patients_count": full["patients_count"],
        "new_patients": full["new_patients"],
        "repeat_patients": full["repeat_patients"],
        "total_income": full["total_income"],
        "cash": full["cash"],
        "card": full["card"],
        "expenses": full["expenses"],
        "services_breakdown": full["services_breakdown"],
        "payment_chart": full["payment_chart"],
        "report_date": d.isoformat(),
    }
    if out["patients_count"] == 0 and out["total_income"] == 0:
        last = last_activity_date(db)
        if last and last != d:
            out["suggested_date"] = last.isoformat()
    return out


def daily_report(db: Session, d: date) -> dict:
    return get_report(db, d, d)


def dashboard_summary(db: Session, d: date) -> dict:
    """
    Faqat CEO dashboard uchun yengil xulosa — to'liq get_report() o'rniga
    (~15 so'rov o'rniga 3 ta). get_report() har doim daily/weekly/monthly/
    ten-day hisobot sahifalari uchun to'liq holicha qoladi.
    """
    s, e = _day_range(d)
    total_income = (
        db.query(func.coalesce(func.sum(Transaction.total_amount), 0))
        .filter(
            Transaction.created_at >= s,
            Transaction.created_at <= e,
            Transaction.is_cancelled == False,
        )
        .scalar()
    )
    patients_count = (
        db.query(func.count(Patient.id))
        .filter(
            Patient.created_at >= s,
            Patient.created_at <= e,
            Patient.is_cancelled == False,
        )
        .scalar()
    )
    bal = db.query(Balance).first()
    current_balance = bal.current_balance if bal else 0
    return {
        "total_income": int(total_income or 0),
        "patients_count": int(patients_count or 0),
        "current_balance": int(current_balance),
    }


def weekly_report(db: Session, d: date) -> dict:
    start = d - timedelta(days=d.weekday())
    end = start + timedelta(days=6)
    return get_report(db, start, end)


def monthly_report(db: Session, year: int, month: int) -> dict:
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)
    return get_report(db, start, end)


def yearly_report(db: Session, year: int) -> dict:
    return get_report(db, date(year, 1, 1), date(year, 12, 31))


def top_referrers(db: Session, limit: int = 10):
    return (
        db.query(
            Referrer.id,
            Referrer.full_name,
            func.count(func.distinct(Transaction.patient_id)).label("count"),
            func.sum(Transaction.referrer_amount).label("total"),
        )
        .join(Transaction, Transaction.referrer_id == Referrer.id)
        .filter(Transaction.is_cancelled == False)
        .group_by(Referrer.id, Referrer.full_name)
        .order_by(func.sum(Transaction.referrer_amount).desc())
        .limit(limit)
        .all()
    )


def top_services(db: Session, limit: int = 10):
    return (
        db.query(
            Service.name,
            func.count(Patient.id).label("count"),
            func.sum(Patient.payment_amount).label("total"),
        )
        .join(Patient, Patient.service_id == Service.id)
        .filter(Patient.is_cancelled == False)
        .group_by(Service.id, Service.name)
        .order_by(func.sum(Patient.payment_amount).desc())
        .limit(limit)
        .all()
    )


def income_last_n_days(db: Session, days: int = 7):
    today = date.today()
    start = today - timedelta(days=days - 1)
    s, e = _period_range(start, today)

    rows = (
        db.query(
            func.date(Transaction.created_at).label("day"),
            func.sum(Transaction.total_amount).label("total"),
        )
        .filter(
            Transaction.created_at >= s,
            Transaction.created_at <= e,
            Transaction.is_cancelled == False,
        )
        .group_by(func.date(Transaction.created_at))
        .all()
    )
    totals_map = {}
    for row in rows:
        day_val = row.day
        if isinstance(day_val, str):
            day_val = datetime.fromisoformat(day_val).date()
        totals_map[day_val] = int(row.total or 0)

    result = []
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        result.append({"date": d.strftime("%d.%m"), "income": totals_map.get(d, 0)})
    return result


def ten_day_report(db: Session, start: date, end: date) -> dict:
    """10 kunlik hisobot: foizlar, 50/50 taqsimot, avans qoplash, va to'lovlar."""
    from models.provider import Provider
    from models.provider_advance import ProviderAdvance
    from models.referrer import Referrer

    s, e = _period_range(start, end)
    base_report = get_report(db, start, end)

    # 1. Detailed Service Breakdown with Commissions
    from sqlalchemy.orm import joinedload

    patients = (
        db.query(Patient)
        .options(joinedload(Patient.service))
        .filter(
            Patient.created_at >= s,
            Patient.created_at <= e,
            Patient.is_cancelled == False,
        )
        .all()
    )

    svc_map = {}
    for p in patients:
        svc = p.service
        svc_name = svc.name if svc else "Noma'lum"
        svc_id = svc.id if svc else 0
        paid = p.payment_amount or 0
        if svc and getattr(svc, "referrer_commission_sum", 0) and svc.referrer_commission_sum > 0:
            ref_comm = svc.referrer_commission_sum
            ref_pct = 0
        else:
            ref_pct = svc.referrer_commission_percent if (svc and svc.referrer_commission_percent) else 0
            ref_comm = int((paid * ref_pct) / 100)

        # Configurable split in SO'M or PERCENT of referrer commission between doctor and clinic
        doc_ref_sum = getattr(svc, "referrer_doctor_split_sum", 0) if svc else 0
        if doc_ref_sum and doc_ref_sum > 0:
            doc_ref_deduction = doc_ref_sum
        else:
            doc_split_pct = getattr(svc, "referrer_doctor_split_percent", 50) if svc else 50
            if doc_split_pct is None:
                doc_split_pct = 50
            doc_ref_deduction = int((ref_comm * doc_split_pct) / 100)

        prov_pct = p.provider.percentage if p.provider else 50
        base_prov_share = int((paid * prov_pct) / 100)
        prov_share = max(0, base_prov_share - doc_ref_deduction)
        clinic_share = max(0, paid - ref_comm - prov_share)

        if svc_id not in svc_map:
            svc_map[svc_id] = {
                "id": svc_id,
                "name": svc_name,
                "category": svc.category if svc else "Umumiy",
                "count": 0,
                "total_paid": 0,
                "referrer_pct": ref_pct,
                "total_ref_commission": 0,
                "total_prov_share": 0,
                "total_clinic_share": 0,
            }
        svc_map[svc_id]["count"] += 1
        svc_map[svc_id]["total_paid"] += paid
        svc_map[svc_id]["total_ref_commission"] += ref_comm
        svc_map[svc_id]["total_prov_share"] += prov_share
        svc_map[svc_id]["total_clinic_share"] += clinic_share

    services_detail = list(svc_map.values())
    services_detail.sort(key=lambda x: x["total_paid"], reverse=True)

    # 2. Referrers 10-day Payout calculation
    ref_map = {}
    referrers = db.query(Referrer).filter(Referrer.is_active == True).all()
    for r in referrers:
        raw_ref_patients = [p for p in patients if p.referrer_id == r.id]
        if not raw_ref_patients:
            continue

        ref_patients = []
        for p in raw_ref_patients:
            svc = p.service
            dept_name = _extract_department_name(svc.name if svc else "", svc.category if svc else "", svc.cabinet if svc else "") if svc else "Boshqa xizmatlar"
            if not any(ex in dept_name for ex in ["Massaj", "Ineksiya"]):
                ref_patients.append(p)

        if not ref_patients:
            continue

        patient_count = len(set(getattr(p, "patient_id", None) or p.id for p in ref_patients))
        gross_total = sum(p.payment_amount or 0 for p in ref_patients)
        total_comm = 0
        patient_details = []
        for p in sorted(ref_patients, key=lambda x: x.created_at, reverse=True):
            svc = p.service
            dept_name = _extract_department_name(svc.name if svc else "", svc.category if svc else "", svc.cabinet if svc else "") if svc else "Boshqa xizmatlar"

            paid = p.payment_amount or 0
            if svc and getattr(svc, "referrer_commission_sum", 0) and svc.referrer_commission_sum > 0:
                ref_fee = svc.referrer_commission_sum
                rate_label = f"{svc.referrer_commission_sum:,}".replace(",", " ") + " so'm"
            elif svc and getattr(svc, "referrer_commission_percent", None) is not None:
                pct = svc.referrer_commission_percent or 0
                ref_fee = int((paid * pct) / 100)
                rate_label = f"{pct}%"
            else:
                pct = r.percentage or 0
                ref_fee = int((paid * pct) / 100)
                rate_label = f"{pct}%"

            total_comm += ref_fee
            patient_details.append({
                "patient_id": p.id,
                "patient_name": f"{p.first_name or ''} {p.last_name or ''}".strip() or "Noma'lum bemor",
                "date": p.created_at.strftime("%d.%m.%Y %H:%M") if p.created_at else "",
                "service_name": svc.name if svc else "Noma'lum xizmat",
                "department_name": dept_name,
                "payment_amount": paid,
                "rate_label": rate_label,
                "referrer_fee": ref_fee,
            })

        # Check Advances for Referrer
        advances = (
            db.query(ProviderAdvance)
            .filter(
                ProviderAdvance.recipient_type == "referrer",
                ProviderAdvance.recipient_id == r.id,
                ProviderAdvance.is_settled == False,
            )
            .all()
        )
        total_advance_remaining = sum(a.remaining for a in advances)

        advance_deducted = min(total_comm, total_advance_remaining)
        net_payable = max(0, total_comm - advance_deducted)

        daily_svc_map = {}
        daily_dept_map = {}
        dept_map_r = {}
        for p in ref_patients:
            d_str = p.created_at.strftime("%d.%m.%Y") if p.created_at else ""
            svc = p.service
            s_name = svc.name if svc else "Noma'lum xizmat"
            d_name = _extract_department_name(svc.name if svc else "", svc.category if svc else "", svc.cabinet if svc else "") if svc else "Boshqa xizmatlar"
            if any(ex in d_name for ex in ["Massaj", "Ineksiya"]):
                continue
            paid = p.payment_amount or 0
            if svc and getattr(svc, "referrer_commission_sum", 0) and svc.referrer_commission_sum > 0:
                ref_fee = svc.referrer_commission_sum
                rate_label = f"{svc.referrer_commission_sum:,}".replace(",", " ") + " so'm"
            elif svc and getattr(svc, "referrer_commission_percent", None) is not None:
                pct = svc.referrer_commission_percent or 0
                ref_fee = int((paid * pct) / 100)
                rate_label = f"{pct}%"
            else:
                pct = r.percentage or 0
                ref_fee = int((paid * pct) / 100)
                rate_label = f"{pct}%"

            s_key = (d_str, s_name)
            if s_key not in daily_svc_map:
                daily_svc_map[s_key] = {
                    "date": d_str,
                    "service_name": s_name,
                    "service_count": 0,
                    "gross_total": 0,
                    "rate_label": rate_label,
                    "earned_fee": 0,
                }
            daily_svc_map[s_key]["service_count"] += 1
            daily_svc_map[s_key]["gross_total"] += paid
            daily_svc_map[s_key]["earned_fee"] += ref_fee

            p_id = getattr(p, "patient_id", None) or p.id
            key = (d_str, d_name)
            if key not in daily_dept_map:
                daily_dept_map[key] = {
                    "date": d_str,
                    "department_name": d_name,
                    "patient_ids": set(),
                    "service_count": 0,
                    "gross_total": 0,
                    "rate_label": rate_label,
                    "earned_fee": 0,
                }
            daily_dept_map[key]["patient_ids"].add(p_id)
            daily_dept_map[key]["service_count"] += 1
            daily_dept_map[key]["gross_total"] += paid
            daily_dept_map[key]["earned_fee"] += ref_fee
            if daily_dept_map[key]["rate_label"] in ["0%", "", None] and rate_label not in ["0%", "", None]:
                daily_dept_map[key]["rate_label"] = rate_label

            if d_name not in dept_map_r:
                dept_map_r[d_name] = {
                    "department_name": d_name,
                    "patient_ids": set(),
                    "service_count": 0,
                    "gross_total": 0,
                    "rate_label": rate_label,
                    "earned_fee": 0,
                }
            dept_map_r[d_name]["patient_ids"].add(p_id)
            dept_map_r[d_name]["service_count"] += 1
            dept_map_r[d_name]["gross_total"] += paid
            dept_map_r[d_name]["earned_fee"] += ref_fee
            if dept_map_r[d_name]["rate_label"] in ["0%", "", None] and rate_label not in ["0%", "", None]:
                dept_map_r[d_name]["rate_label"] = rate_label

        daily_services = list(daily_svc_map.values())
        daily_services.sort(key=lambda x: (x["date"], x["service_name"]), reverse=True)

        daily_departments = []
        for (d_str, d_name), d_info in daily_dept_map.items():
            daily_departments.append({
                "date": d_str,
                "department_name": d_name,
                "patient_count": len(d_info["patient_ids"]),
                "service_count": d_info["service_count"],
                "gross_total": d_info["gross_total"],
                "rate_label": d_info["rate_label"],
                "earned_fee": d_info["earned_fee"],
            })
        daily_departments.sort(key=lambda x: (x["date"], x["department_name"]), reverse=True)

        dept_details = []
        for d_name, d_info in dept_map_r.items():
            dept_details.append({
                "department_name": d_name,
                "patient_count": len(d_info["patient_ids"]),
                "service_count": d_info["service_count"],
                "gross_total": d_info["gross_total"],
                "rate_label": d_info["rate_label"],
                "earned_fee": d_info["earned_fee"],
            })
        dept_details.sort(key=lambda x: x["gross_total"], reverse=True)

        ref_map[r.id] = {
            "referrer_id": r.id,
            "name": r.full_name,
            "phone": r.phone,
            "patient_count": patient_count,
            "gross_total": gross_total,
            "earned_commission": total_comm,
            "advance_remaining": total_advance_remaining,
            "advance_deducted": advance_deducted,
            "net_payable": net_payable,
            "patients": patient_details,
            "departments": dept_details,
            "daily_departments": daily_departments,
            "daily_services": daily_services,
        }

    referrers_payout = list(ref_map.values())
    referrers_payout.sort(key=lambda x: x["earned_commission"], reverse=True)

    # 3. Providers (Doctors) 10-day Payout calculation
    prov_map = {}
    providers = db.query(Provider).filter(Provider.is_active == True).all()
    for pr in providers:
        pr_patients = [p for p in patients if p.provider_id == pr.id]
        if not pr_patients:
            continue
        patient_count = len(pr_patients)
        gross_total = sum(p.payment_amount for p in pr_patients)
        total_prov_share = 0
        from services.finance import calculate_financial_split
        for p in pr_patients:
            paid = p.payment_amount or 0
            svc = p.service
            ref_comm_sum = svc.referrer_commission_sum if svc else 0
            ref_comm_pct = (svc.referrer_commission_percent if (svc and svc.referrer_commission_percent) else 0) if p.referrer_id else 0
            ref_doc_split_pct = svc.referrer_doctor_split_percent if svc else None
            ref_doc_split_sum = svc.referrer_doctor_split_sum if svc else 0

            _, prov_amt, _ = calculate_financial_split(
                total=paid,
                provider_percentage=pr.percentage or 0,
                referrer_percentage=ref_comm_pct,
                referrer_commission_sum=ref_comm_sum,
                ref_doc_split_pct=ref_doc_split_pct if p.referrer_id else None,
                ref_doc_split_sum=ref_doc_split_sum if p.referrer_id else 0,
            )
            total_prov_share += prov_amt

        # Check Advances for Provider
        advances = (
            db.query(ProviderAdvance)
            .filter(
                ProviderAdvance.recipient_type == "provider",
                ProviderAdvance.recipient_id == pr.id,
                ProviderAdvance.is_settled == False,
            )
            .all()
        )
        total_advance_remaining = sum(a.remaining for a in advances)

        advance_deducted = min(total_prov_share, total_advance_remaining)
        net_payable = max(0, total_prov_share - advance_deducted)

        prov_map[pr.id] = {
            "provider_id": pr.id,
            "name": pr.full_name,
            "specialization": pr.specialization,
            "patient_count": patient_count,
            "gross_total": gross_total,
            "earned_share": total_prov_share,
            "advance_remaining": total_advance_remaining,
            "advance_deducted": advance_deducted,
            "net_payable": net_payable,
        }

    providers_payout = list(prov_map.values())
    providers_payout.sort(key=lambda x: x["earned_share"], reverse=True)

    base_report["services_detail"] = services_detail
    base_report["referrers_payout"] = referrers_payout
    base_report["providers_payout"] = providers_payout
    base_report["total_ref_payout"] = sum(r["net_payable"] for r in referrers_payout)
    base_report["total_prov_payout"] = sum(p["net_payable"] for p in providers_payout)

    return base_report


def referrer_patient_details(db: Session, referrer_id: int, start: date, end: date) -> list:
    """Returns detailed patient list for a specific referrer in date range."""
    from sqlalchemy.orm import joinedload

    s, e = _period_range(start, end)
    patients = (
        db.query(Patient)
        .options(joinedload(Patient.service))
        .filter(
            Patient.referrer_id == referrer_id,
            Patient.created_at >= s,
            Patient.created_at <= e,
            Patient.is_cancelled == False,
        )
        .order_by(Patient.created_at.desc())
        .all()
    )
    result = []
    for p in patients:
        svc = p.service
        paid = p.payment_amount or 0
        ref_comm = 0
        if svc and getattr(svc, "referrer_commission_sum", 0) and svc.referrer_commission_sum > 0:
            ref_comm = svc.referrer_commission_sum
        else:
            ref_pct = svc.referrer_commission_percent if (svc and svc.referrer_commission_percent) else 0
            ref_comm = int((paid * ref_pct) / 100)

        result.append({
            "id": p.id,
            "patient_name": f"{p.first_name} {p.last_name}",
            "created_at": p.created_at.strftime("%d.%m.%Y %H:%M") if p.created_at else "",
            "service_name": svc.name if svc else "Noma'lum",
            "payment_amount": paid,
            "referrer_fee": ref_comm,
        })
    return result


def top_referrers_analytics(db: Session) -> list:
    """Returns top referrers with patient count and total commission earned."""
    from sqlalchemy.orm import joinedload

    referrers = db.query(Referrer).filter(Referrer.is_active == True).all()
    results = []
    for r in referrers:
        patients = (
            db.query(Patient)
            .options(joinedload(Patient.service))
            .filter(Patient.referrer_id == r.id, Patient.is_cancelled == False)
            .all()
        )
        p_count = len(patients)
        total_comm = 0
        total_paid = 0
        for p in patients:
            paid = p.payment_amount or 0
            total_paid += paid
            svc = p.service
            if svc and getattr(svc, "referrer_commission_sum", 0) and svc.referrer_commission_sum > 0:
                ref_comm = svc.referrer_commission_sum
            else:
                ref_pct = svc.referrer_commission_percent if (svc and svc.referrer_commission_percent) else 0
                ref_comm = int((paid * ref_pct) / 100)
            total_comm += ref_comm

        results.append({
            "id": r.id,
            "full_name": r.full_name,
            "organization": getattr(r, "organization", ""),
            "phone": r.phone,
            "patient_count": p_count,
            "total_paid": total_paid,
            "total_commission": total_comm,
        })

    results.sort(key=lambda x: x["patient_count"], reverse=True)
    return results

