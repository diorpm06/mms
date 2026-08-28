import secrets
import string
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth_utils import get_current_user, require_admin_or_ceo, require_ceo
from database import get_db
from models.referrer import Referrer
from models.user import User
from schemas import ReferrerCreate, ReferrerOut, ReferrerUpdate
from services.finance import payout_recipient_balance

router = APIRouter(prefix="/api/referrers", tags=["referrers"])


class PayoutBody(BaseModel):
    source: str | None = None


def _sodda_ism(nom: str | None) -> str:
    """Ismni taqqoslash uchun soddalashtiradi: katta-kichik harf va ortiqcha
    bo'shliqlar hisobga olinmaydi. "Qazbek travmatolog" va "Qazbek Travmatolog"
    bir xil deb qaraladi."""
    return " ".join((nom or "").split()).casefold()


def _bir_xil_ismli(db: Session, nom: str, bundan_tashqari: int | None = None):
    """Shu ismdagi faol yo'naltiruvchini qaytaradi (bo'lmasa None)."""
    kalit = _sodda_ism(nom)
    if not kalit:
        return None
    for r in db.query(Referrer).filter(Referrer.is_active == True).all():  # noqa: E712
        if r.id != bundan_tashqari and _sodda_ism(r.full_name) == kalit:
            return r
    return None


@router.get("", response_model=list[ReferrerOut])
def list_referrers(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    q = db.query(Referrer)
    if active_only:
        q = q.filter(Referrer.is_active == True)
    referrers = q.order_by(Referrer.full_name).all()

    # "Bugun" va "Jami ishlagan" ustunlari uchun (balansdan alohida)
    from services.earnings_daily import referrers_summary
    xulosa = referrers_summary(db, referrers)

    # Hali qoplanmagan avans qarzi — balans (ishlab topgani) bilan
    # aralashtirilmaydi, alohida ko'rsatiladi
    from models.provider_advance import ProviderAdvance
    from sqlalchemy import func as _func
    qarzlar = dict(
        db.query(ProviderAdvance.recipient_id, _func.sum(ProviderAdvance.remaining))
        .filter(
            ProviderAdvance.recipient_type == "referrer",
            ProviderAdvance.is_cancelled == False,  # noqa: E712
            ProviderAdvance.is_settled == False,  # noqa: E712
        )
        .group_by(ProviderAdvance.recipient_id)
        .all()
    )

    # Portalga kirish login/parollari — bitta so'rovda hammasini olib,
    # har bir qatorga haqiqiy (taxminiy emas) qiymatni biriktiramiz.
    users_map = {
        u.referrer_id: u
        for u in db.query(User).filter(User.referrer_id.in_([r.id for r in referrers]), User.is_active == True).all()
    }

    res = []
    for r in referrers:
        item = ReferrerOut.model_validate(r)
        x = xulosa.get(r.id) or {}
        item.today_earned = x.get("today", 0)
        item.total_earned = x.get("total_earned", 0)
        item.advance_debt = int(qarzlar.get(r.id) or 0)
        u = users_map.get(r.id)
        item.username = u.username if u else None
        item.plain_password = u.plain_password if u else None
        res.append(item)
    return res


@router.get("/{referrer_id}/earnings-daily")
def referrer_earnings_daily(
    referrer_id: int,
    limit: int = 60,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    """Yo'naltiruvchining ishlagan puli kunma-kun."""
    from services.earnings_daily import referrer_daily
    natija = referrer_daily(db, referrer_id, limit)
    if not natija:
        raise HTTPException(status_code=404, detail="Yo'naltiruvchi topilmadi")
    return natija


@router.get("/{referrer_id}/earnings-daily/{kun}")
def referrer_earnings_day(
    referrer_id: int,
    kun: date,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    """Bir kundagi bemorlar ro'yxati."""
    from services.earnings_daily import referrer_day_patients
    return referrer_day_patients(db, referrer_id, kun)


@router.get("/pending", response_model=list[ReferrerOut])
def pending_referrers(db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    return db.query(Referrer).filter(Referrer.is_active == True, Referrer.is_confirmed == False).all()


@router.post("", response_model=ReferrerOut)
def create_referrer(data: ReferrerCreate, db: Session = Depends(get_db), user: User = Depends(require_admin_or_ceo)):
    d = data.model_dump()
    majburiy = bool(d.pop("force", False))

    # Ilgari hech qanday tekshiruv yo'q edi: bemor qabul qilayotgan xodim
    # ro'yxatdan yo'naltiruvchini topa olmay yangisini qo'shardi va bitta
    # odam ikki qatorga bo'linib ketardi — ishlagan puli ham, hisoboti ham.
    if not majburiy:
        mavjud = _bir_xil_ismli(db, d.get("full_name"))
        if mavjud:
            raise HTTPException(
                status_code=409,
                detail=f"\"{mavjud.full_name}\" nomli yo'naltiruvchi allaqachon bor. "
                       "Ro'yxatdan o'shani tanlang. Bu boshqa odam bo'lsa, "
                       "ismini aniqroq yozing (masalan familiyasi bilan).",
            )

    d["full_name"] = " ".join((d.get("full_name") or "").split())

    # If created by CEO directly in CEO page, consider it confirmed unless specified
    if user.role == "ceo" and "is_confirmed" not in d:
        d["is_confirmed"] = True
    else:
        d["is_confirmed"] = False
    r = Referrer(**d)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.post("/{referrer_id}/confirm", response_model=ReferrerOut)
def confirm_referrer(
    referrer_id: int, data: ReferrerUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)
):
    r = db.query(Referrer).filter(Referrer.id == referrer_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Yo'naltiruvchi topilmadi")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    r.is_confirmed = True
    db.commit()
    db.refresh(r)
    return r


@router.put("/{referrer_id}", response_model=ReferrerOut)
def update_referrer(
    referrer_id: int, data: ReferrerUpdate, db: Session = Depends(get_db), user: User = Depends(require_admin_or_ceo)
):
    r = db.query(Referrer).filter(Referrer.id == referrer_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Yo'naltiruvchi topilmadi")

    yangilanish = data.model_dump(exclude_unset=True)

    # Tahrirlashda ham boshqasining ismiga aylantirib yuborilmasin. Ism
    # o'zgarmayotgan bo'lsa tekshirilmaydi — aks holda "baribir qo'shish" bilan
    # kiritilgan yozuvning stavkasini ham tahrirlab bo'lmay qolardi.
    if yangilanish.get("full_name") and _sodda_ism(yangilanish["full_name"]) != _sodda_ism(r.full_name):
        mavjud = _bir_xil_ismli(db, yangilanish["full_name"], bundan_tashqari=r.id)
        if mavjud:
            raise HTTPException(
                status_code=409,
                detail=f"\"{mavjud.full_name}\" nomli boshqa yo'naltiruvchi allaqachon bor. "
                       "Ismini boshqacharoq yozing.",
            )
        yangilanish["full_name"] = " ".join(yangilanish["full_name"].split())

    for k, v in yangilanish.items():
        setattr(r, k, v)
    # If CEO edits rates, confirm automatically
    if user.role == "ceo" and data.is_confirmed is not False:
        r.is_confirmed = True
    db.commit()
    db.refresh(r)
    return r


@router.delete("/{referrer_id}")
def delete_referrer(referrer_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    r = db.query(Referrer).filter(Referrer.id == referrer_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Yo'naltiruvchi topilmadi")
    r.is_active = False
    db.commit()
    return {"message": "O'chirildi"}


@router.post("/{referrer_id}/payout")
def payout_referrer(
    referrer_id: int,
    body: PayoutBody,
    db: Session = Depends(get_db),
    # Faqat rahbar: bu klinikadan pul chiqishi. Admin panelida bunday tugma
    # yo'q edi, lekin API ochiq turgani uchun so'rov yuborib chiqarish mumkin edi.
    _: User = Depends(require_ceo),
):
    payout = payout_recipient_balance(db, "referrer", referrer_id, source=body.source)
    qoplandi = getattr(payout, "settled_from_advance", 0) or 0
    db.commit()
    msg = f"Qo'lga {payout.amount:,} so'm berildi"
    if qoplandi:
        msg += f" (bu summa {qoplandi:,} so'mlik avansni allaqachon hisobga olgan)"
    return {
        "message": msg,
        "amount": payout.amount,
        "settled_from_advance": qoplandi,
        "source": body.source,
    }


class CredentialsBody(BaseModel):
    username: str
    password: str = Field(min_length=4)


def _build_referrer_profile(db: Session, referrer_id: int, days: int = 10, current_user: User = None):
    from datetime import date, timedelta
    from sqlalchemy import func
    from models.referrer import Referrer
    from models.patient import Patient
    from models.transaction import Transaction
    from models.provider_advance import ProviderAdvance
    from models.payout import Payout

    r = db.query(Referrer).filter(Referrer.id == referrer_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Yo'naltiruvchi topilmadi")

    # User info
    u = db.query(User).filter(User.referrer_id == referrer_id, User.is_active == True).first()
    username = u.username if u else f"doctor{r.id}"
    plain_password = u.plain_password if (u and current_user and current_user.role in ("ceo", "admin")) else None

    cutoff_date = date.today() - timedelta(days=days - 1)

    pats = (
        db.query(Patient, Transaction)
        .outerjoin(Transaction, (Transaction.patient_id == Patient.id) & (Transaction.is_cancelled == False))
        .filter(Patient.referrer_id == referrer_id, Patient.is_cancelled == False)
        .order_by(Patient.created_at.desc())
        .all()
    )

    patient_list = []
    total_gross = 0
    total_earned = 0
    ten_day_earned = 0
    ten_day_patients_count = 0

    daily_map = {}
    for i in range(days):
        d_str = str(date.today() - timedelta(days=i))
        daily_map[d_str] = {"date": d_str, "patient_count": 0, "gross_total": 0, "earned_fee": 0}

    seen_patients = set()

    for p, t in pats:
        p_date = p.created_at.strftime("%Y-%m-%d") if p.created_at else ""
        p_datetime = p.created_at.strftime("%d.%m.%Y %H:%M") if p.created_at else "—"
        p_amt = p.payment_amount or 0
        ref_fee = t.referrer_amount if (t and t.referrer_amount is not None) else 0

        svc_name = p.service.name if p.service else "Xizmat"
        cat_name = p.service.category if p.service else ""
        rate_label = "10%"
        if cat_name and "Laboratoriya" in cat_name:
            rate_label = f"{r.lab_percent}%"
        elif cat_name and "Fizioterapiya" in cat_name:
            rate_label = f"{r.fizio_percent}%"
        elif "UZI" in svc_name.upper():
            rate_label = f"{r.uzi_sum:,} so'm".replace(",", " ")
        elif "OZON" in svc_name.upper():
            rate_label = f"{r.ozon_sum:,} so'm".replace(",", " ")

        total_gross += p_amt
        total_earned += ref_fee

        if p.created_at and p.created_at.date() >= cutoff_date:
            ten_day_earned += ref_fee

        if p.id not in seen_patients:
            seen_patients.add(p.id)
            if p.created_at and p.created_at.date() >= cutoff_date:
                ten_day_patients_count += 1

        if p_date in daily_map:
            daily_map[p_date]["patient_count"] += 1
            daily_map[p_date]["gross_total"] += p_amt
            daily_map[p_date]["earned_fee"] += ref_fee

        patient_list.append({
            "patient_id": p.id,
            "patient_name": f"{p.first_name} {p.last_name}".strip(),
            "date": p_datetime,
            "raw_date": p_date,
            "service_name": svc_name,
            "payment_amount": p_amt,
            "rate_label": rate_label,
            "referrer_fee": ref_fee,
        })

    adv_debt = (
        db.query(func.coalesce(func.sum(ProviderAdvance.remaining), 0))
        .filter(
            ProviderAdvance.recipient_type == "referrer",
            ProviderAdvance.recipient_id == referrer_id,
            ProviderAdvance.is_cancelled == False,
            ProviderAdvance.is_settled == False,
        )
        .scalar() or 0
    )

    initial_adv = (
        db.query(func.coalesce(func.sum(ProviderAdvance.amount), 0))
        .filter(
            ProviderAdvance.recipient_type == "referrer",
            ProviderAdvance.recipient_id == referrer_id,
            ProviderAdvance.is_cancelled == False,
        )
        .scalar() or 0
    )

    daily_stats = list(daily_map.values())
    daily_stats.sort(key=lambda x: x["date"], reverse=True)

    tot_payouts = (
        db.query(func.coalesce(func.sum(Payout.amount), 0))
        .filter(Payout.recipient_type == "referrer", Payout.recipient_id == referrer_id)
        .scalar() or 0
    )
    # r.balance (sync_referrer_balance orqali) 0 dan pastga tushmaydi — lekin
    # bu yerda haqiqiy sof holatni (avans ishlagandan ko'p bo'lsa, minusda)
    # ko'rsatish uchun alohida, cheklovsiz hisoblaymiz.
    calculated_net = total_earned - int(initial_adv or 0) - int(tot_payouts or 0)

    return {
        "referrer": {
            "id": r.id,
            "full_name": r.full_name,
            "phone": r.phone or "",
            "balance": r.balance,
            "is_active": r.is_active,
            "is_confirmed": r.is_confirmed,
            "lab_percent": r.lab_percent,
            "fizio_percent": r.fizio_percent,
            "uzi_sum": r.uzi_sum,
            "ozon_sum": r.ozon_sum,
            "other_sum": r.other_sum,
            "username": username,
            "plain_password": plain_password,
        },
        "summary": {
            "total_patients": len(seen_patients),
            "ten_day_patients": ten_day_patients_count,
            "total_gross": total_gross,
            "total_earned": total_earned,
            "ten_day_earned": ten_day_earned,
            "initial_advance": int(initial_adv or 0),
            "advance_debt": int(adv_debt or 0),
            "net_balance": calculated_net,
            "net_payable": max(0, r.balance),
        },
        "daily_stats": daily_stats,
        "patients": patient_list,
    }


@router.get("/me/profile")
def get_my_referrer_profile(
    days: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != "referrer" or not user.referrer_id:
        raise HTTPException(status_code=403, detail="Faqat yo'naltiruvchilar uchun")
    return _build_referrer_profile(db, user.referrer_id, days=days, current_user=user)


@router.get("/{referrer_id}/profile")
def get_referrer_profile(
    referrer_id: int,
    days: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in ("ceo", "admin") and (user.role != "referrer" or user.referrer_id != referrer_id):
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    return _build_referrer_profile(db, referrer_id, days=days, current_user=user)


def _random_password(length: int = 8) -> str:
    """Taxmin qilib bo'lmaydigan tasodifiy parol — ID asosidagi andoza
    (masalan "mmed5 00") har qanday kishi tomonidan hisoblab topilardi."""
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("/generate-all-credentials")
def generate_all_referrer_credentials(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    from auth_utils import hash_password

    referrers = db.query(Referrer).filter(Referrer.is_active == True).order_by(Referrer.id).all()
    created_count = 0
    updated_count = 0
    res = []

    for r in referrers:
        u = db.query(User).filter(User.referrer_id == r.id, User.is_active == True).first()
        uname = f"doctor{r.id}"
        pwd = _random_password()

        if not u:
            existing_uname = db.query(User).filter(User.username == uname).first()
            if existing_uname:
                uname = f"ref_{r.id}"

            u = User(
                full_name=r.full_name,
                role="referrer",
                username=uname,
                hashed_password=hash_password(pwd),
                plain_password=pwd,
                referrer_id=r.id,
                is_active=True,
            )
            db.add(u)
            created_count += 1
        else:
            if not u.plain_password:
                u.plain_password = pwd
                u.hashed_password = hash_password(pwd)
                updated_count += 1
            uname = u.username
            pwd = u.plain_password

        res.append({
            "referrer_id": r.id,
            "full_name": r.full_name,
            "username": uname,
            "plain_password": pwd,
        })

    db.commit()
    return {
        "message": f"{created_count} ta yangi login yaratildi, {updated_count} ta yangilandi",
        "credentials": res,
    }


@router.post("/{referrer_id}/credentials")
def set_referrer_credentials(
    referrer_id: int,
    body: CredentialsBody,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    from auth_utils import hash_password

    r = db.query(Referrer).filter(Referrer.id == referrer_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Yo'naltiruvchi topilmadi")

    clean_uname = body.username.strip()
    if not clean_uname:
        raise HTTPException(status_code=400, detail="Login kiritilmadi")

    u_exist = db.query(User).filter(User.username == clean_uname, User.referrer_id != referrer_id).first()
    if u_exist:
        raise HTTPException(status_code=400, detail=f"'{clean_uname}' logini boshqa foydalanuvchida bor")

    u = db.query(User).filter(User.referrer_id == referrer_id).first()
    if not u:
        u = User(
            full_name=r.full_name,
            role="referrer",
            username=clean_uname,
            hashed_password=hash_password(body.password),
            plain_password=body.password,
            referrer_id=r.id,
            is_active=True,
        )
        db.add(u)
    else:
        u.username = clean_uname
        u.hashed_password = hash_password(body.password)
        u.plain_password = body.password
        u.is_active = True

    db.commit()
    return {"message": "Login va parol saqlandi", "username": u.username, "plain_password": u.plain_password}

