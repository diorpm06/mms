from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator
import re


PHONE_RE = re.compile(r"^\+998\d{9}$")


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    full_name: str
    # Foydalanuvchi raqami. Ilgari yuborilmasdi va brauzerda doim null
    # bo'lib qolardi — natijada chatda "bu xabarni men yozdimmi" degan
    # tekshiruv hech qachon to'g'ri ishlamasdi: o'z xabaring begona
    # tomonda ko'rinardi va o'zing yozgan xabarga ham ovoz chalinardi.
    user_id: int | None = None


class UserOut(BaseModel):
    id: int
    full_name: str
    role: str
    username: str
    is_active: bool

    class Config:
        from_attributes = True


class ServiceCreate(BaseModel):
    # Bo'sh nom qabul qilinardi — katalogda nomsiz xizmat paydo bo'lardi
    name: str = Field(min_length=1, max_length=200)
    price: int = Field(ge=0, le=100_000_000)
    category: Optional[str] = "Umumiy"
    cabinet: Optional[str] = "1-Xona"
    requires_queue: Optional[bool] = True
    queue_prefix: Optional[str] = "A"
    referrer_commission_percent: Optional[int] = Field(default=0, ge=0, le=100)
    referrer_commission_sum: Optional[int] = Field(default=0, ge=0)
    referrer_doctor_split_percent: Optional[int] = Field(default=0, ge=0, le=100)
    referrer_clinic_split_percent: Optional[int] = Field(default=50, ge=0, le=100)
    referrer_doctor_split_sum: Optional[int] = Field(default=0, ge=0)
    referrer_clinic_split_sum: Optional[int] = Field(default=0, ge=0)
    allow_custom_price: Optional[bool] = False
    template_key: Optional[str] = None


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[int] = Field(default=None, ge=0)
    category: Optional[str] = None
    cabinet: Optional[str] = None
    requires_queue: Optional[bool] = None
    queue_prefix: Optional[str] = None
    referrer_commission_percent: Optional[int] = Field(default=None, ge=0, le=100)
    referrer_commission_sum: Optional[int] = Field(default=None, ge=0)
    referrer_doctor_split_percent: Optional[int] = Field(default=None, ge=0, le=100)
    referrer_clinic_split_percent: Optional[int] = Field(default=None, ge=0, le=100)
    referrer_doctor_split_sum: Optional[int] = Field(default=None, ge=0)
    referrer_clinic_split_sum: Optional[int] = Field(default=None, ge=0)
    allow_custom_price: Optional[bool] = None
    is_active: Optional[bool] = None
    template_key: Optional[str] = None


class ServiceOut(BaseModel):
    id: int
    name: str
    price: int
    category: Optional[str] = "Umumiy"
    cabinet: Optional[str] = "1-Xona"
    requires_queue: Optional[bool] = True
    queue_prefix: Optional[str] = "A"
    referrer_commission_percent: Optional[int] = 0
    referrer_commission_sum: Optional[int] = 0
    referrer_doctor_split_percent: Optional[int] = 0
    referrer_clinic_split_percent: Optional[int] = 50
    referrer_doctor_split_sum: Optional[int] = 0
    referrer_clinic_split_sum: Optional[int] = 0
    allow_custom_price: Optional[bool] = False
    template_key: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ReferrerCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    phone: Optional[str] = ""
    percentage: Optional[int] = Field(default=0, ge=0, le=100)
    lab_percent: Optional[int] = Field(default=22, ge=0, le=100)
    fizio_percent: Optional[int] = Field(default=20, ge=0, le=100)
    uzi_sum: Optional[int] = Field(default=15000, ge=0)
    ozon_sum: Optional[int] = Field(default=10000, ge=0)
    other_sum: Optional[int] = Field(default=10000, ge=0)
    is_confirmed: Optional[bool] = False
    # Bir xil ismli yo'naltiruvchi bo'lsa server rad etadi. Foydalanuvchi
    # "baribir qo'shish" desa, so'rov shu belgi bilan qayta yuboriladi.
    force: Optional[bool] = False

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip() or v.strip() == "+998":
            return ""
        if not PHONE_RE.match(v):
            raise ValueError("Telefon +998XXXXXXXXX formatida bo'lishi kerak")
        return v


class ReferrerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    percentage: Optional[int] = Field(default=None, ge=0, le=100)
    lab_percent: Optional[int] = Field(default=None, ge=0, le=100)
    fizio_percent: Optional[int] = Field(default=None, ge=0, le=100)
    uzi_sum: Optional[int] = Field(default=None, ge=0)
    ozon_sum: Optional[int] = Field(default=None, ge=0)
    other_sum: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None
    is_confirmed: Optional[bool] = None


class ReferrerOut(BaseModel):
    id: int
    full_name: str
    phone: str
    percentage: int
    lab_percent: int = 22
    fizio_percent: int = 20
    uzi_sum: int = 15000
    ozon_sum: int = 10000
    other_sum: int = 10000
    balance: int
    is_active: bool
    is_confirmed: bool = True
    # Balansdan alohida: qancha ishlagani (tranzaksiyalardan)
    today_earned: Optional[int] = 0
    total_earned: Optional[int] = 0
    # Hali qoplanmagan avans qarzi — balansdan (ishlab topgani) alohida,
    # aks holda bu ikkisini birlashtirib ko'rsatadigan joy yo'q edi
    advance_debt: Optional[int] = 0
    # Portalga kirish logini/paroli — biriktirilmagan bo'lsa None (frontend
    # buni taxminiy andoza bilan TO'LDIRMASLIGI kerak, aks holda haqiqiy
    # parol bilan mos kelmaydigan noto'g'ri ma'lumot ko'rsatiladi).
    username: Optional[str] = None
    plain_password: Optional[str] = None

    class Config:
        from_attributes = True


class ProviderCreate(BaseModel):
    full_name: str
    specialization: str
    phone: str
    percentage: Optional[int] = Field(default=0, ge=0, le=100)
    fixed_salary: Optional[int] = Field(default=0, ge=0)
    # Statsionar: kunlik qat'iy haq oladigan xizmat ko'rsatuvchi
    is_inpatient_provider: Optional[bool] = False
    inpatient_daily_rate: Optional[int] = Field(default=50000, ge=0, le=100_000_000)
    username: Optional[str] = None
    password: Optional[str] = None
    service_ids: Optional[list[int]] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not PHONE_RE.match(v):
            raise ValueError("Telefon +998XXXXXXXXX formatida bo'lishi kerak")
        return v


class ProviderUpdate(BaseModel):
    full_name: Optional[str] = None
    specialization: Optional[str] = None
    phone: Optional[str] = None
    percentage: Optional[int] = Field(default=None, ge=0, le=100)
    fixed_salary: Optional[int] = Field(default=None, ge=0)
    is_inpatient_provider: Optional[bool] = None
    inpatient_daily_rate: Optional[int] = Field(default=None, ge=0, le=100_000_000)
    is_active: Optional[bool] = None
    username: Optional[str] = None
    password: Optional[str] = None
    service_ids: Optional[list[int]] = None
    # Yo'naltiruvchi yozuviga bog'lash. 0 yoki bo'sh yuborilsa bog'lanish
    # uziladi (shu sababli qiymat "berilganmi" degani muhim).
    referrer_id: Optional[int] = None


class ProviderOut(BaseModel):
    id: int
    full_name: str
    specialization: str
    phone: str
    percentage: int
    fixed_salary: Optional[int] = 0
    balance: int
    is_inpatient_provider: Optional[bool] = False
    inpatient_daily_rate: Optional[int] = 50000
    is_active: bool
    username: Optional[str] = None
    service_ids: Optional[list[int]] = None
    # Tranzaksiyalardan hisoblanadi (balansdan alohida): balans bitta yig'ma
    # raqam, bu ikkalasi esa qancha ishlaganini ko'rsatadi
    today_earned: Optional[int] = 0
    total_earned: Optional[int] = 0
    # Shu shifokorning yo'naltiruvchi sifatidagi yozuvi (bir odam ikki rolda)
    referrer_id: Optional[int] = None
    referrer_name: Optional[str] = None
    # Yo'naltirishdan tushgan puli — shifokorlik KPI sidan ALOHIDA ko'rsatiladi
    referral_today: Optional[int] = 0
    referral_total: Optional[int] = 0
    referral_balance: Optional[int] = 0

    class Config:
        from_attributes = True


class EmployeeCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    position: str = Field(min_length=1, max_length=120)
    monthly_salary: int = Field(gt=0, le=1_000_000_000)


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    position: Optional[str] = None
    monthly_salary: Optional[int] = Field(default=None, gt=0)
    is_active: Optional[bool] = None


class EmployeeOut(BaseModel):
    id: int
    full_name: str
    position: str
    monthly_salary: int
    is_active: bool

    class Config:
        from_attributes = True


class ServiceItem(BaseModel):
    service_id: int
    provider_id: Optional[int] = None
    # Manfiy narx to'lovni 0 ga tushirardi, 10^12 esa bazani "out of range"
    # xatosi bilan yiqitardi. Soni 0 yoki manfiy ham qabul qilinardi.
    price: Optional[int] = Field(default=None, ge=0, le=100_000_000)
    quantity: Optional[int] = Field(default=1, ge=1, le=100)
    is_course: Optional[bool] = False
    # Kurs jadvali: xizmat qaysi kunlarda beriladi, masalan "1,3,5".
    # Bo'sh bo'lsa — kuni qolguncha har tashrifda beriladi.
    course_days: Optional[str] = Field(default=None, max_length=200)


class PatientCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=120)
    last_name: Optional[str] = ""
    birth_date: date
    phone: Optional[str] = ""
    address: str
    referrer_id: Optional[int] = None
    provider_id: Optional[int] = None
    service_id: Optional[int] = None
    services: Optional[list[ServiceItem]] = None
    payment_amount: Optional[int] = None
    payment_type: str  # cash | card | click | qr | split
    # Manfiy summa kassani buzardi (to'lov musbat, naqd manfiy bo'lib qolardi)
    cash_amount: Optional[int] = Field(default=0, ge=0)
    card_amount: Optional[int] = Field(default=0, ge=0)
    # Aralash to'lovda Click/Payme va QR qismlari — kartadan alohida
    click_amount: Optional[int] = Field(default=0, ge=0)
    qr_amount: Optional[int] = Field(default=0, ge=0)
    discount_amount: Optional[int] = Field(default=0, ge=0)
    discount_reason: Optional[str] = None
    # Chegirma qaysi xizmat(lar)dan ayirilsin.
    # Ilgari faqat BITTA xizmat tanlanardi va chegirma o'sha xizmat narxidan
    # oshib ketsa, ortiqcha qismi yo'qolib, bemor ko'proq to'lardi.
    # Endi bir nechta xizmat belgilanadi va chegirma ular orasida ulushga
    # qarab bo'linadi. Eski (bitta) maydon moslik uchun qoldirilgan.
    discount_target_service_id: Optional[int] = None
    discount_target_service_ids: Optional[List[int]] = None
    custom_date: Optional[date] = None
    is_paper_entry: Optional[bool] = False
    confirm_duplicate: Optional[bool] = False

    @field_validator("referrer_id", "provider_id", "service_id", mode="before")
    @classmethod
    def sanitize_id_zero(cls, v):
        if v == 0 or v == "0" or v == "" or v is None:
            return None
        try:
            val = int(v)
            return val if val > 0 else None
        except Exception:
            return None

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v: date) -> date:
        """2099-yil kabi kelajak sanasi qabul qilinardi."""
        from datetime import date as _d
        if v > _d.today():
            raise ValueError("Tug'ilgan sana kelajakda bo'lishi mumkin emas")
        if v.year < 1900:
            raise ValueError("Tug'ilgan sana noto'g'ri")
        return v

    @field_validator("first_name")
    @classmethod
    def validate_first_name(cls, v: str) -> str:
        """Bo'sh ism qabul qilinardi — ro'yxatda nomsiz bemor paydo bo'lardi."""
        if not (v or "").strip():
            raise ValueError("Bemor ismini kiriting")
        return v.strip()

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip() or v.strip() == "+998":
            return ""
        s = v.strip()
        if len(s) > 4 and not PHONE_RE.match(s):
            return s
        return s

    @field_validator("payment_type")
    @classmethod
    def validate_payment(cls, v: str) -> str:
        if v not in ("cash", "card", "click", "qr", "naqd", "karta", "payme", "split", "aralash", "later", "keyinroq", "nasiya", "qarz"):
            raise ValueError("To'lov turi noto'g'ri (cash, card, click, qr, split, later)")
        return v


class ExpenseCreate(BaseModel):
    # Bo'sh izoh qabul qilinardi, 10^12 esa bazani yiqitardi
    description: str = Field(min_length=1, max_length=500)
    amount: int = Field(gt=0, le=1_000_000_000)
    category: Optional[str] = None
    source: Optional[str] = None


class ExpenseOut(BaseModel):
    id: int
    description: str
    amount: int
    created_by: int
    created_at: datetime
    category: Optional[str] = None
    source: Optional[str] = None
    is_cancelled: Optional[bool] = False
    cancelled_at: Optional[datetime] = None
    cancelled_by: Optional[int] = None
    cancel_reason: Optional[str] = None

    class Config:
        from_attributes = True


class BalanceOut(BaseModel):
    current_balance: int
    updated_at: datetime


class BalanceHistoryOut(BaseModel):
    id: int
    amount: int
    entry_type: str
    description: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProviderAdvanceCreate(BaseModel):
    recipient_type: str  # provider | referrer
    recipient_id: int
    amount: int = Field(gt=0)
    note: Optional[str] = None


class ProviderAdvanceOut(BaseModel):
    id: int
    recipient_type: str
    recipient_id: int
    recipient_name: Optional[str] = None
    amount: int
    remaining: int
    note: Optional[str] = None
    is_settled: bool
    created_at: datetime

    class Config:
        from_attributes = True

