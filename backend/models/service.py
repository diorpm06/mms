from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str | None] = mapped_column(String(100), default="Umumiy", nullable=True)
    price: Mapped[int] = mapped_column(Integer)
    cabinet: Mapped[str | None] = mapped_column(String(100), default="1-Xona", nullable=True)
    requires_queue: Mapped[bool] = mapped_column(Boolean, default=True)
    queue_prefix: Mapped[str | None] = mapped_column(String(5), default="A", nullable=True)
    referrer_commission_percent: Mapped[int] = mapped_column(Integer, default=0)  # % of actual paid amount
    referrer_commission_sum: Mapped[int] = mapped_column(Integer, default=0)  # Fixed sum in so'm
    referrer_doctor_split_percent: Mapped[int] = mapped_column(Integer, default=50)  # % deducted from Doctor
    referrer_clinic_split_percent: Mapped[int] = mapped_column(Integer, default=50)  # % deducted from Clinic
    referrer_doctor_split_sum: Mapped[int] = mapped_column(Integer, default=0)  # Fixed sum in so'm deducted from Doctor
    referrer_clinic_split_sum: Mapped[int] = mapped_column(Integer, default=0)  # Fixed sum in so'm deducted from Clinic
    allow_custom_price: Mapped[bool] = mapped_column(Boolean, default=False)  # Admin can enter custom price
    template_key: Mapped[str | None] = mapped_column(String(50), nullable=True)  # frontend reportTemplates.js key
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
