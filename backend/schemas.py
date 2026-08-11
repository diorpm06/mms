from datetime import date, datetime
from typing import Optional

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


class UserOut(BaseModel):
    id: int
    full_name: str
    role: str
    username: str
    is_active: bool

    class Config:
        from_attributes = True


class ServiceCreate(BaseModel):
    name: str
    price: int = Field(ge=0)
    category: Optional[str] = "Umumiy"
    cabinet: Optional[str] = "1-Xona"
    requires_queue: Optional[bool] = True
    queue_prefix: Optional[str] = "A"
    referrer_commission_percent: Optional[int] = Field(default=0, ge=0, le=100)
    referrer_commission_sum: Optional[int] = Field(default=0, ge=0)
    referrer_doctor_split_percent: Optional[int] = Field(default=50, ge=0, le=100)
    referrer_clinic_split_percent: Optional[int] = Field(default=50, ge=0, le=100)
    referrer_doctor_split_sum: Optional[int] = Field(default=0, ge=0)
    referrer_clinic_split_sum: Optional[int] = Field(default=0, ge=0)
    allow_custom_price: Optional[bool] = False


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
    referrer_doctor_split_percent: Optional[int] = 50
    referrer_clinic_split_percent: Optional[int] = 50
    referrer_doctor_split_sum: Optional[int] = 0
    referrer_clinic_split_sum: Optional[int] = 0
    allow_custom_price: Optional[bool] = False
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ReferrerCreate(BaseModel):
    full_name: str
    phone: Optional[str] = ""
    percentage: Optional[int] = Field(default=0, ge=0, le=100)

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
    is_active: Optional[bool] = None


class ReferrerOut(BaseModel):
    id: int
    full_name: str
    phone: str
    percentage: int
    balance: int
    is_active: bool

    class Config:
        from_attributes = True


class ProviderCreate(BaseModel):
    full_name: str
    specialization: str
    phone: str
    percentage: Optional[int] = Field(default=0, ge=0, le=100)
    fixed_salary: Optional[int] = Field(default=0, ge=0)
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
    is_active: Optional[bool] = None
    username: Optional[str] = None
    password: Optional[str] = None
    service_ids: Optional[list[int]] = None


class ProviderOut(BaseModel):
    id: int
    full_name: str
    specialization: str
    phone: str
    percentage: int
    fixed_salary: Optional[int] = 0
    balance: int
    is_active: bool
    username: Optional[str] = None
    service_ids: Optional[list[int]] = None

    class Config:
        from_attributes = True


class EmployeeCreate(BaseModel):
    full_name: str
    position: str
    monthly_salary: int = Field(gt=0)


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
    price: Optional[int] = None
    quantity: Optional[int] = 1


class PatientCreate(BaseModel):
    first_name: str
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
    cash_amount: Optional[int] = 0
    card_amount: Optional[int] = 0
    discount_amount: Optional[int] = Field(default=0, ge=0)
    discount_reason: Optional[str] = None
    custom_date: Optional[date] = None

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
    description: str
    amount: int = Field(gt=0)
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

