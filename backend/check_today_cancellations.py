
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date, datetime
from database import SessionLocal
from models.patient import Patient
from models.patient_service import PatientService
from models.service import Service
from models.audit_log import AuditLog
from models.user import User

db = SessionLocal()

today = date.today()
today_start = datetime.combine(today, datetime.min.time())

print(f"=== TODAY'S CANCELLATIONS INSPECTION ({today.isoformat()}) ===")

# 1. Cancelled Patients today
cancelled_patients = (
    db.query(Patient)
    .filter(
        Patient.is_cancelled == True,
        (Patient.cancelled_at >= today_start) | (Patient.created_at >= today_start)
    )
    .all()
)

print(f"\n📌 Bugun bekor qilingan bemorlar / tashriflar soni: {len(cancelled_patients)} ta")

for p in cancelled_patients:
    user = db.query(User).filter(User.id == p.cancelled_by).first() if p.cancelled_by else None
    user_name = (getattr(user, 'full_name', None) or getattr(user, 'username', 'Noma-lum')) if user else 'Noma-lum'
    
    ps_rows = db.query(PatientService).filter(PatientService.patient_id == p.id).all()
    services_list = []
    for ps in ps_rows:
        svc = db.query(Service).filter(Service.id == ps.service_id).first()
        svc_name = svc.name if svc else f"ID:{ps.service_id}"
        services_list.append(f"{svc_name} ({ps.total_price:,} so'm)")
    
    svcs_str = ", ".join(services_list) if services_list else "Xizmat biriktirilmagan"
    cancel_time = p.cancelled_at.strftime("%H:%M") if p.cancelled_at else (p.created_at.strftime("%H:%M") if p.created_at else "—")
    
    print(f"  • [{cancel_time}] {p.first_name} {p.last_name} ({p.phone or 'Tel yo-q'})")
    print(f"    - Xizmatlar: {svcs_str}")
    print(f"    - Qaytgan summa: {p.payment_amount:,} so'm ({p.payment_type})")
    print(f"    - Bekor qilish sababi: {p.cancel_reason or 'Sabab kiritilmagan'}")
    print(f"    - Bekor qilgan xodim: {user_name}")
    print()

# 2. Audit log cancellations today
audit_cancels = (
    db.query(AuditLog)
    .filter(
        AuditLog.created_at >= today_start,
        AuditLog.action_type.in_(["PATIENT_CANCEL", "SERVICE_CANCEL", "COURSE_VISIT_UNDO"])
    )
    .all()
)

print(f"\n📌 Bugungi bekor qilish audit loglari soni: {len(audit_cancels)} ta")
for a in audit_cancels:
    u = db.query(User).filter(User.id == a.user_id).first()
    u_name = (getattr(u, 'full_name', None) or getattr(u, 'username', 'Noma-lum')) if u else 'Noma-lum'
    print(f"  • [{a.created_at.strftime('%H:%M')}] Amall turi: {a.action_type} | Bajaruvchi: {u_name}")
    print(f"    - Ma'lumot: {a.new_data}")
    print()
