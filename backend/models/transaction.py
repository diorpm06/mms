from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base
from models.mixins import CancelMixin


class Transaction(CancelMixin, Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int | None] = mapped_column(ForeignKey("patients.id"), nullable=True)
    total_amount: Mapped[int] = mapped_column(Integer)
    referrer_id: Mapped[int | None] = mapped_column(ForeignKey("referrers.id"), nullable=True)
    referrer_amount: Mapped[int] = mapped_column(Integer, default=0)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"))
    provider_amount: Mapped[int] = mapped_column(Integer)
    center_amount: Mapped[int] = mapped_column(Integer)
    payment_type: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient")
    referrer = relationship("Referrer")
    provider = relationship("Provider")
