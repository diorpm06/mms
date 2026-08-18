from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base
from models.mixins import CancelMixin


class Transaction(CancelMixin, Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int | None] = mapped_column(ForeignKey("patients.id"), nullable=True, index=True)
    # Statsionar to'lovlarida patient_id bo'sh bo'ladi. Ilgari yotgan bemor bilan
    # bog'lanish umuman yo'q edi — shu sababli bemor bekor qilinganda qaysi
    # to'lovni qaytarishni topib bo'lmasdi va pul kassada qolib ketardi.
    inpatient_id: Mapped[int | None] = mapped_column(ForeignKey("inpatients.id"), nullable=True, index=True)
    total_amount: Mapped[int] = mapped_column(Integer)
    referrer_id: Mapped[int | None] = mapped_column(ForeignKey("referrers.id"), nullable=True, index=True)
    referrer_amount: Mapped[int] = mapped_column(Integer, default=0)
    provider_id: Mapped[int | None] = mapped_column(ForeignKey("providers.id"), nullable=True, index=True)
    provider_amount: Mapped[int] = mapped_column(Integer, default=0)
    center_amount: Mapped[int] = mapped_column(Integer)
    payment_type: Mapped[str] = mapped_column(String(10))
    cash_amount: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    card_amount: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    # Aralash to'lovda Click/Payme va QR qismlari kartadan alohida yozilishi kerak —
    # ilgari hammasi card_amount ga qo'shilib ketardi va hisobotda "Karta" bo'lib chiqardi.
    click_amount: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    qr_amount: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)

    patient = relationship("Patient")
    referrer = relationship("Referrer")
    provider = relationship("Provider")
