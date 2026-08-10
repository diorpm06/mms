from datetime import datetime, date, time
from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base
from models.mixins import TimestampMixin


class Appointment(TimestampMixin, Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(20), index=True)
    appointment_date: Mapped[date] = mapped_column(Date)
    appointment_time: Mapped[str] = mapped_column(String(10)) # e.g. "14:30"
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"))
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"))
    status: Mapped[str] = mapped_column(String(20), default="kutilmoqda") # 'kutilmoqda' | 'kelgan' | 'bekor'
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))

    provider = relationship("Provider")
    service = relationship("Service")
    creator = relationship("User", foreign_keys=[created_by])
