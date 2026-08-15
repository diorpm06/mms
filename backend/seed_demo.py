"""To'liq demo ma'lumotlar: python seed_demo.py"""
from datetime import date, datetime, timedelta

from database import SessionLocal, Base, engine
from models.service import Service
from models.provider import Provider
from models.referrer import Referrer
from models.employee import Employee
from models.patient import Patient
from models.user import User
from models.duty_log import DutyLog
from models.inpatient import Inpatient
from models.expense import Expense
from models.advance import Advance
from services.finance import get_or_create_balance, process_payment, process_expense, process_advance

Base.metadata.create_all(bind=engine)


def main():
    db = SessionLocal()
    ceo = db.query(User).filter(User.role == "ceo").first()
    admin = db.query(User).filter(User.role == "admin").first()
    creator = admin or ceo
    if not creator:
        print("Avval create_ceo.py va create_admin.py ishga tushiring")
        return

    if db.query(Service).count() == 0:
        services = [
            Service(name="Fototerapiya", price=130000),
            Service(name="Det Massaj", price=30000),
            Service(name="Ineksiya", price=20000),
            Service(name="Konsultatsiya", price=150000),
            Service(name="UZI", price=200000),
        ]
        db.add_all(services)

    if db.query(Provider).count() == 0:
        db.add_all([
            Provider(full_name="Dr. Karimov Alisher", specialization="Terapevt", phone="+998901111111", percentage=30),
            Provider(full_name="Dr. Rahimova Malika", specialization="UZI mutaxassisi", phone="+998902222222", percentage=35),
        ])

    if db.query(Referrer).count() == 0:
        db.add_all([
            Referrer(full_name="Aminov Izzat", phone="+998903333333", percentage=10),
            Referrer(full_name="Sobirov Ikrom", phone="+998904444444", percentage=8),
        ])

    if db.query(Employee).count() == 0:
        db.add_all([
            Employee(full_name="Sobirov Ikrom", position="Hamshira", monthly_salary=2500000),
            Employee(full_name="G'ulomjon Dilnoza", position="Registrator", monthly_salary=3000000),
            Employee(full_name="Ergasheva Nodira", position="Administrator", monthly_salary=2800000),
        ])

    db.flush()

    svc_list = db.query(Service).all()
    prov = db.query(Provider).first()
    ref = db.query(Referrer).first()
    emp = db.query(Employee).first()

    if db.query(Patient).count() < 5:
        demo_patients = [
            ("Olmagul", "Ergashboyev", "+998905551111", 0),
            ("Sardor", "Toshmatov", "+998906662222", 1),
            ("Malika", "Karimova", "+998907773333", 0),
            ("Jasur", "Normatov", "+998908884444", 1),
            ("Dilnoza", "Rahimova", "+998909995555", 0),
            ("Bobur", "Aliyev", "+998901236666", 1),
            ("Nigora", "Usmonova", "+998901237777", 0),
        ]
        for i, (fn, ln, phone, pay_type) in enumerate(demo_patients):
            svc = svc_list[i % len(svc_list)]
            p = Patient(
                first_name=fn,
                last_name=ln,
                birth_date=date(1985 + i, 3, 15),
                phone=phone,
                address=f"Toshkent, {i+1}-mahalla",
                referrer_id=ref.id if i % 2 == 0 else None,
                provider_id=prov.id,
                service_id=svc.id,
                payment_amount=svc.price,
                payment_type="cash" if pay_type == 0 else "card",
                created_by=creator.id,
                created_at=datetime.now() - timedelta(hours=i * 2),
            )
            db.add(p)
            db.flush()
            process_payment(db, p)

    if db.query(DutyLog).count() == 0 and emp:
        db.add(DutyLog(
            employee_id=emp.id, duty_date=date.today(),
            shift="kunduz", note="—", created_by=creator.id,
        ))
        emp2 = db.query(Employee).offset(1).first()
        if emp2:
            db.add(DutyLog(
                employee_id=emp2.id, duty_date=date.today(),
                shift="tun", created_by=creator.id,
            ))

    if db.query(Inpatient).count() == 0:
        prov2 = db.query(Provider).first()
        db.add(Inpatient(
            first_name="Rustam",
            last_name="Qodirov",
            phone="+998909090909",
            room_number="201",
            bed_number="2",
            doctor_id=prov2.id,
            referrer_id=ref.id if ref else None,
            diagnosis="Davolash",
            daily_rate=120000,
            status="yotmoqda",
            created_by=creator.id,
        ))

    if db.query(Advance).count() == 0 and emp:
        bal = get_or_create_balance(db)
        adv_amt = min(500000, max(0, bal.current_balance - 100000))
        if adv_amt > 0:
            process_advance(db, adv_amt, f"Avans: {emp.full_name}")
            db.add(Advance(employee_id=emp.id, amount=adv_amt, note="Oylik avans", created_by=creator.id))

    if db.query(Expense).count() == 0:
        bal = get_or_create_balance(db)
        exp_amt = min(150000, max(0, bal.current_balance - 50000))
        if exp_amt > 0:
            process_expense(db, exp_amt, "Ijara — may")
            db.add(Expense(description="Ijara — may", amount=exp_amt, created_by=creator.id))

    get_or_create_balance(db)
    db.commit()
    print("Demo ma'lumotlar muvaffaqiyatli qo'shildi!")
    print(f"  Mijozlar: {db.query(Patient).count()}")
    print(f"  Xizmatlar: {db.query(Service).count()}")
    print(f"  Xodimlar: {db.query(Employee).count()}")


if __name__ == "__main__":
    main()
