from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base
from models.mixins import CancelMixin, TimestampMixin


class Patient(CancelMixin, TimestampMixin, Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    birth_date: Mapped[date] = mapped_column(Date)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    address: Mapped[str] = mapped_column(String(500))
    referrer_id: Mapped[int | None] = mapped_column(ForeignKey("referrers.id"), nullable=True)
    provider_id: Mapped[int | None] = mapped_column(ForeignKey("providers.id"), nullable=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"))
    payment_amount: Mapped[int] = mapped_column(Integer)
    payment_type: Mapped[str] = mapped_column(String(10))
    cash_amount: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    card_amount: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    ticket_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    queue_status: Mapped[str] = mapped_column(String(20), default="kutmoqda")
    cabinet: Mapped[str | None] = mapped_column(String(100), nullable=True)
    discount_amount: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    discount_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    diagnosis: Mapped[str | None] = mapped_column(String(500), nullable=True)
    complaints: Mapped[str | None] = mapped_column(String(500), nullable=True)
    prescription: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))

    referrer = relationship("Referrer", foreign_keys=[referrer_id])
    provider = relationship("Provider")
    service = relationship("Service")
    creator = relationship("User", foreign_keys=[created_by])
