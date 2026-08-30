from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth_utils import require_admin_or_ceo, require_ceo
from database import get_db
from models.service import Service
from models.service_category import ServiceCategory
from models.user import User
from schemas import ServiceCreate, ServiceOut, ServiceUpdate
from services.finance import invalidate_commission_cache

router = APIRouter(prefix="/api/services", tags=["services"])


@router.get("", response_model=list[ServiceOut])
def list_services(db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    return db.query(Service).filter(Service.is_active == True).order_by(Service.name).all()


@router.get("/all", response_model=list[ServiceOut])
def list_all_services(db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    return db.query(Service).order_by(Service.name).all()


@router.post("", response_model=ServiceOut)
def create_service(data: ServiceCreate, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    s = Service(**data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def _main_cat(raw: str | None) -> str:
    """'Laboratoriya: GORMONLAR' -> 'Laboratoriya'"""
    v = (raw or "Umumiy").strip()
    return v.split(":")[0].strip() if ":" in v else v


@router.get("/categories")
def list_categories(db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    """
    Barcha bo'limlar: xizmatlardan kelib chiqadiganlari + hali xizmati yo'q
    bo'sh bo'limlar. Bo'sh bo'limlar ilgari faqat brauzer localStorage'ida
    saqlanardi va boshqa qurilmada ko'rinmasdi.
    """
    xizmatdan = {_main_cat(s.category) for s in db.query(Service).filter(Service.is_active == True).all()}
    bosh = {c.name for c in db.query(ServiceCategory).all()}
    return sorted(xizmatdan | bosh, key=lambda x: x.lower())


@router.post("/categories")
def create_category(data: dict, db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    nom = (data.get("name") or "").strip()
    if not nom:
        raise HTTPException(status_code=400, detail="Bo'lim nomini kiriting")
    if ":" in nom:
        raise HTTPException(status_code=400, detail="Bo'lim nomida ':' belgisi bo'lmasligi kerak")

    mavjud = {_main_cat(x.category).lower() for x in db.query(Service).all()}
    mavjud |= {c.name.lower() for c in db.query(ServiceCategory).all()}
    if nom.lower() in mavjud:
        raise HTTPException(status_code=400, detail=f"\"{nom}\" bo'limi allaqachon mavjud")

    db.add(ServiceCategory(name=nom))
    db.commit()
    invalidate_commission_cache()
    return {"message": f"\"{nom}\" bo'limi qo'shildi", "name": nom}


@router.delete("/categories")
def remove_empty_category(name: str = "", db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    """Faqat bo'sh bo'limni ro'yxatdan olib tashlaydi (xizmatlarga tegmaydi)."""
    nom = (name or "").strip()
    c = db.query(ServiceCategory).filter(ServiceCategory.name == nom).first()
    if c:
        db.delete(c)
        db.commit()
        invalidate_commission_cache()
    return {"message": f"\"{nom}\" bo'limi ro'yxatdan olib tashlandi"}


@router.put("/category-rename")
def rename_category(
    data: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo)
):
    old_name = data.get("old_name")
    new_name = data.get("new_name")
    prefix_letter = data.get("prefix_letter")
    if not old_name or not new_name:
        raise HTTPException(status_code=400, detail="Eski va yangi nom kiritilishi shart")

    clean_prefix = (prefix_letter or "").strip().upper()[:3]
    if old_name == "Umumiy":
        services = db.query(Service).filter(
            (Service.category == "Umumiy") | (Service.category == None) | (Service.category == "")
        ).all()
    else:
        # Ichki bo'limlar ham ko'chishi kerak: "Laboratoriya: GORMONLAR" ->
        # "Yangi nom: GORMONLAR". Ilgari faqat aniq mos kelgani o'zgarardi va
        # ichki bo'limlar eski nom ostida osilib qolardi.
        services = [x for x in db.query(Service).all() if _main_cat(x.category) == old_name]

    for s in services:
        eski = (s.category or "").strip()
        if ":" in eski and old_name != "Umumiy":
            s.category = f"{new_name}: {eski.split(':', 1)[1].strip()}"
        else:
            s.category = new_name
        if clean_prefix:
            s.queue_prefix = clean_prefix

    # Bo'sh bo'limlar ro'yxatida ham nomini yangilaymiz
    c = db.query(ServiceCategory).filter(ServiceCategory.name == old_name).first()
    if c:
        if db.query(ServiceCategory).filter(ServiceCategory.name == new_name).first():
            db.delete(c)
        else:
            c.name = new_name
    db.commit()
    invalidate_commission_cache()
    return {"message": f"{len(services)} ta xizmat bo'limi va prefiksi o'zgartirildi"}


@router.delete("/category-delete")
def delete_category(
    category_name: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo)
):
    cat = (category_name or "").strip()
    if not cat:
        raise HTTPException(status_code=400, detail="Bo'lim nomi kiritilishi shart")

    if cat == "Umumiy":
        services = db.query(Service).filter(
            (Service.category == "Umumiy") | (Service.category == None) | (Service.category == "")
        ).all()
    else:
        services = [x for x in db.query(Service).all() if _main_cat(x.category) == cat]

    for s in services:
        db.delete(s)
    c = db.query(ServiceCategory).filter(ServiceCategory.name == cat).first()
    if c:
        db.delete(c)
    db.commit()
    invalidate_commission_cache()
    return {"message": f"{len(services)} ta xizmat bo'limi bilan birga o'chirildi"}


@router.put("/{service_id}", response_model=ServiceOut)
def update_service(
    service_id: int, data: ServiceUpdate, db: Session = Depends(get_db), _: User = Depends(require_ceo)
):
    s = db.query(Service).filter(Service.id == service_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Xizmat topilmadi")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{service_id}")
# Tahrirlash rahbarga tegishli edi, o'chirish esa adminga ochiq qolgandi —
# o'chirish tahrirlashdan xavfliroq, shuning uchun u ham rahbarga.
def delete_service(service_id: int, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    s = db.query(Service).filter(Service.id == service_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Xizmat topilmadi")
    db.delete(s)
    db.commit()
    return {"message": "Xizmat o'chirildi"}
