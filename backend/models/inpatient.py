from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base
from models.mixins import CancelMixin


class Inpatient(CancelMixin, Base):
    __tablename__ = "inpatients"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(20))
    room_number: Mapped[str] = mapped_column(String(20))
    bed_number: Mapped[str] = mapped_column(String(20))
    doctor_id: Mapped[int] = mapped_column(ForeignKey("providers.id"))
    referrer_id: Mapped[int | None] = mapped_column(ForeignKey("referrers.id"), nullable=True)
    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    admitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    discharged_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    daily_rate: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="yotmoqda")  # yotmoqda | chiqdi
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    doctor = relationship("Provider", foreign_keys=[doctor_id])
    referrer = relationship("Referrer")
    payments = relationship("InpatientPayment", back_populates="inpatient")


class InpatientPayment(CancelMixin, Base):
    __tablename__ = "inpatient_payments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    inpatient_id: Mapped[int] = mapped_column(ForeignKey("inpatients.id"))
    amount: Mapped[int] = mapped_column(Integer)
    payment_type: Mapped[str] = mapped_column(String(10))
    days_count: Mapped[int] = mapped_column(Integer)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    inpatient = relationship("Inpatient", back_populates="payments")
