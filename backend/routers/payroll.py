from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models.patient import Patient
from models.provider import Provider
from models.employee import Employee
from models.advance import Advance
from models.user import User
from auth_utils import require_ceo

router = APIRouter(prefix="/api/payroll", tags=["payroll"])


@router.get("")
def get_monthly_payroll(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    today = date.today()
    y = year or today.year
    m = month or today.month

    # Date range bounds
    start_dt = datetime(y, m, 1, 0, 0, 0)
    if m == 12:
        end_dt = datetime(y + 1, 1, 1, 0, 0, 0)
    else:
        end_dt = datetime(y, m + 1, 1, 0, 0, 0)

    # 1. Doctors / Providers Payroll calculation
    providers = db.query(Provider).all()
    provider_rows = []
    total_provider_payout = 0
    total_provider_advances = 0

    for p in providers:
        # Get active patients for this provider in this month
        patients = (
            db.query(Patient)
            .filter(
                Patient.provider_id == p.id,
                Patient.created_at >= start_dt,
                Patient.created_at < end_dt,
                Patient.is_cancelled == False,
            )
            .all()
        )

        total_patients = len(patients)
        total_income = sum(pt.payment_amount for pt in patients)
        
        # Calculate doctor share (fixed base salary + percentage of revenue)
        base_fixed = getattr(p, 'fixed_salary', 0) or 0
        doctor_share = base_fixed

        from services.finance import calculate_financial_split
        from models.service import Service

        for pt in patients:
            price = pt.payment_amount
            raw_doc_pct = getattr(p, 'percentage', 0) or 0

            svc = db.query(Service).filter(Service.id == pt.service_id).first() if pt.service_id else None
            ref_comm_sum = svc.referrer_commission_sum if svc else 0
            ref_comm_pct = (svc.referrer_commission_percent if (svc and svc.referrer_commission_percent) else 0) if pt.referrer_id else 0
            ref_doc_split_pct = svc.referrer_doctor_split_percent if svc else None
            ref_doc_split_sum = svc.referrer_doctor_split_sum if svc else 0

            _, prov_amt, _ = calculate_financial_split(
                total=price,
                provider_percentage=raw_doc_pct,
                referrer_percentage=ref_comm_pct,
                referrer_commission_sum=ref_comm_sum,
                ref_doc_split_pct=ref_doc_split_pct if pt.referrer_id else None,
                ref_doc_split_sum=ref_doc_split_sum if pt.referrer_id else 0,
            )
            doctor_share += prov_amt

        # Advances for doctor (matching name if employee entry exists)
        advances = 0
        emp = db.query(Employee).filter(Employee.full_name == p.full_name).first()
        if emp:
            adv_sum = (
                db.query(func.coalesce(func.sum(Advance.amount), 0))
                .filter(
                    Advance.employee_id == emp.id,
                    Advance.created_at >= start_dt,
                    Advance.created_at < end_dt,
                    Advance.is_cancelled == False,
                )
                .scalar()
            )
            advances = int(adv_sum or 0)

        net_salary = max(0, doctor_share - advances)
        total_provider_payout += net_salary
        total_provider_advances += advances

        provider_rows.append({
            "id": p.id,
            "name": p.full_name,
            "role": "Shifokor",
            "cabinet": getattr(p, 'specialization', 'Shifokor'),
            "percent": getattr(p, 'percentage', 0) or 0,
            "fixed_salary": base_fixed,
            "patients_count": total_patients,
            "total_income": total_income,
            "doctor_share": doctor_share,
            "advances": advances,
            "net_salary": net_salary,
        })

    # 2. General Staff Employees Payroll calculation
    employees = db.query(Employee).filter(Employee.is_active == True).all()
    employee_rows = []
    total_employee_payout = 0

    for e in employees:
        # Check if already covered as provider
        if any(pr["name"] == e.full_name for pr in provider_rows):
            continue

        base_salary = e.monthly_salary or 0
        adv_sum = (
            db.query(func.coalesce(func.sum(Advance.amount), 0))
            .filter(
                Advance.employee_id == e.id,
                Advance.created_at >= start_dt,
                Advance.created_at < end_dt,
                Advance.is_cancelled == False,
            )
            .scalar()
        )
        advances = int(adv_sum or 0)
        net_salary = max(0, base_salary - advances)
        total_employee_payout += net_salary

        employee_rows.append({
            "id": e.id,
            "name": e.full_name,
            "role": e.position or "Xodim",
            "cabinet": "—",
            "percent": 0,
            "patients_count": 0,
            "total_income": 0,
            "doctor_share": base_salary,
            "advances": advances,
            "net_salary": net_salary,
        })

    return {
        "year": y,
        "month": m,
        "total_payroll": total_provider_payout + total_employee_payout,
        "total_advances": total_provider_advances,
        "doctors": provider_rows,
        "staff": employee_rows,
    }
