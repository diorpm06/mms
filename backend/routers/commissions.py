"""
Yo'naltiruvchi komissiyasini boshqarish.

Ilgari qaysi bo'limga qancha berilishi kodda yozib qo'yilgan edi — yangi bo'lim
qo'shilsa yoki tarif o'zgarsa dasturchi kerak bo'lardi. Endi hammasi rahbar
panelidan sozlanadi.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth_utils import require_admin_or_ceo, require_ceo
from database import get_db
from models.referrer import Referrer
from models.referrer_commission import ReferrerCommission
from models.service import Service
from models.service_category import ServiceCategory
from models.user import User
from services.finance import invalidate_commission_cache, main_category

router = APIRouter(prefix="/api/commissions", tags=["commissions"])

REJIMLAR = ("none", "percent", "sum")


class BolimTarifi(BaseModel):
    mode: str = Field(pattern="^(none|percent|sum)$")
    value: int = Field(ge=0)


class IstisnoBody(BaseModel):
    referrer_id: int
    category: str
    mode: str = Field(pattern="^(none|percent|sum)$")
    value: int = Field(ge=0)


def _tekshir(mode: str, value: int) -> None:
    if mode == "percent" and value > 100:
        raise HTTPException(status_code=400, detail="Foiz 100 dan oshmasligi kerak")
    if mode != "none" and value <= 0:
        raise HTTPException(status_code=400, detail="Qiymat 0 dan katta bo'lishi kerak")


@router.get("")
def komissiya_holati(db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    """Barcha bo'lim tariflari, istisnolar va chiqarilgan xizmatlar."""
    xizmatlar = db.query(Service).filter(Service.is_active == True).all()

    sanoq: dict[str, int] = {}
    for s in xizmatlar:
        sanoq[main_category(s.category)] = sanoq.get(main_category(s.category), 0) + 1

    bolimlar = []
    for c in db.query(ServiceCategory).order_by(ServiceCategory.name).all():
        bolimlar.append({
            "id": c.id,
            "name": c.name,
            "mode": c.commission_mode or "none",
            "value": int(c.commission_value or 0),
            "service_count": sanoq.get(c.name, 0),
        })

    istisnolar = []
    for rc in db.query(ReferrerCommission).all():
        r = db.query(Referrer).filter(Referrer.id == rc.referrer_id).first()
        istisnolar.append({
            "id": rc.id,
            "referrer_id": rc.referrer_id,
            "referrer_name": r.full_name if r else f"#{rc.referrer_id}",
            "category": rc.category,
            "mode": rc.mode,
            "value": int(rc.value or 0),
        })
    istisnolar.sort(key=lambda x: (x["referrer_name"], x["category"]))

    chiqarilgan = [
        {"id": s.id, "name": s.name, "category": s.category}
        for s in xizmatlar if s.no_referrer_commission
    ]
    return {"departments": bolimlar, "exceptions": istisnolar, "excluded_services": chiqarilgan}


@router.put("/department/{category_id}")
def bolim_tarifini_saqlash(
    category_id: int,
    body: BolimTarifi,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    c = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Bo'lim topilmadi")
    _tekshir(body.mode, body.value)

    c.commission_mode = body.mode
    c.commission_value = body.value if body.mode != "none" else 0
    db.commit()
    invalidate_commission_cache()

    tarif = (f"{body.value}%" if body.mode == "percent"
             else f"{body.value:,} so'm" if body.mode == "sum" else "berilmaydi")
    return {"message": f"\"{c.name}\" bo'limi: yo'naltiruvchiga {tarif}"}


@router.post("/exception")
def istisno_qoshish(
    body: IstisnoBody,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    r = db.query(Referrer).filter(Referrer.id == body.referrer_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Yo'naltiruvchi topilmadi")
    kat = (body.category or "").strip()
    if not db.query(ServiceCategory).filter(ServiceCategory.name == kat).first():
        raise HTTPException(status_code=404, detail=f"\"{kat}\" bo'limi topilmadi")
    _tekshir(body.mode, body.value)

    mavjud = (
        db.query(ReferrerCommission)
        .filter(ReferrerCommission.referrer_id == body.referrer_id, ReferrerCommission.category == kat)
        .first()
    )
    if mavjud:
        mavjud.mode = body.mode
        mavjud.value = body.value
    else:
        db.add(ReferrerCommission(
            referrer_id=body.referrer_id, category=kat, mode=body.mode, value=body.value
        ))
    db.commit()
    invalidate_commission_cache()

    tarif = (f"{body.value}%" if body.mode == "percent"
             else f"{body.value:,} so'm" if body.mode == "sum" else "berilmaydi")
    return {"message": f"{r.full_name} — {kat}: {tarif}"}


@router.delete("/exception/{exception_id}")
def istisno_ochirish(
    exception_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    rc = db.query(ReferrerCommission).filter(ReferrerCommission.id == exception_id).first()
    if not rc:
        raise HTTPException(status_code=404, detail="Istisno topilmadi")
    db.delete(rc)
    db.commit()
    invalidate_commission_cache()
    return {"message": "Istisno olib tashlandi — endi bo'lim tarifi qo'llanadi"}


@router.put("/service/{service_id}/exclude")
def xizmatni_chiqarish(
    service_id: int,
    excluded: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    """Ayrim xizmatga bo'lim tarifidan qat'i nazar komissiya bermaslik."""
    s = db.query(Service).filter(Service.id == service_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Xizmat topilmadi")
    s.no_referrer_commission = bool(excluded)
    db.commit()
    invalidate_commission_cache()
    holat = "komissiyadan chiqarildi" if excluded else "komissiyaga qaytarildi"
    return {"message": f"\"{s.name}\" {holat}"}


@router.get("/preview")
def tekshirib_korish(
    referrer_id: int,
    service_id: int,
    amount: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    """Sozlamani saqlashdan oldin "shu bemorda qancha chiqadi" deb ko'rish uchun."""
    from services.finance import _split_amounts

    s = db.query(Service).filter(Service.id == service_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Xizmat topilmadi")
    total = amount or int(s.price or 0)
    _, _, ref_amt, prov_amt, center_amt = _split_amounts(total, referrer_id, None, db, service_id=service_id)
    return {
        "service": s.name,
        "category": s.category,
        "total": total,
        "referrer_amount": ref_amt,
        "provider_amount": prov_amt,
        "center_amount": center_amt,
    }
