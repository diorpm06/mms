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
    price: int = Field(gt=0)


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[int] = Field(default=None, gt=0)
    is_active: Optional[bool] = None


class ServiceOut(BaseModel):
    id: int
    name: str
    price: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ReferrerCreate(BaseModel):
    full_name: str
    phone: str
    percentage: int = Field(ge=0, le=100)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
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
    percentage: int = Field(ge=0, le=100)

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
    is_active: Optional[bool] = None


class ProviderOut(BaseModel):
    id: int
    full_name: str
    specialization: str
    phone: str
    percentage: int
    balance: int
    is_active: bool

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


class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    birth_date: date
    phone: str
    address: str
    referrer_id: Optional[int] = None
    provider_id: int
    service_id: int
    payment_amount: int = Field(gt=0)
    payment_type: str  # cash | card

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not PHONE_RE.match(v):
            raise ValueError("Telefon +998XXXXXXXXX formatida bo'lishi kerak")
        return v

    @field_validator("payment_type")
    @classmethod
    def validate_payment(cls, v: str) -> str:
        if v not in ("cash", "card"):
            raise ValueError("To'lov turi cash yoki card bo'lishi kerak")
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
