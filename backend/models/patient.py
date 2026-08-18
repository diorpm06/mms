from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String
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
    referrer_id: Mapped[int | None] = mapped_column(ForeignKey("referrers.id"), nullable=True, index=True)
    provider_id: Mapped[int | None] = mapped_column(ForeignKey("providers.id"), nullable=True, index=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), index=True)
    payment_amount: Mapped[int] = mapped_column(Integer)
    payment_type: Mapped[str] = mapped_column(String(10))
    cash_amount: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    card_amount: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    # Aralash to'lovda Click/Payme va QR qismlari kartadan alohida yozilishi kerak —
    # ilgari hammasi card_amount ga qo'shilib ketardi va hisobotda "Karta" bo'lib chiqardi.
    click_amount: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    qr_amount: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    ticket_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    queue_status: Mapped[str] = mapped_column(String(20), default="kutmoqda")
    cabinet: Mapped[str | None] = mapped_column(String(100), nullable=True)
    discount_amount: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    discount_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    diagnosis: Mapped[str | None] = mapped_column(String(500), nullable=True)
    complaints: Mapped[str | None] = mapped_column(String(500), nullable=True)
    prescription: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    is_paper_entry: Mapped[bool] = mapped_column(Boolean, default=False)
    # Oldindan to'langan kursning navbatdagi tashrifi (2-, 3-kun). To'lov
    # birinchi kuni olingan, shuning uchun bu yozuvda summa 0 bo'ladi va
    # tushum hisobotiga qo'shilmaydi. Qaysi to'lovdan kelgani saqlanadi.
    prepaid_from_id: Mapped[int | None] = mapped_column(
        ForeignKey("patient_services.id"), nullable=True, index=True
    )

    referrer = relationship("Referrer", foreign_keys=[referrer_id])
    provider = relationship("Provider")
    service = relationship("Service")
    creator = relationship("User", foreign_keys=[created_by])
    # Bemor olgan barcha xizmatlar (service_id faqat asosiysini saqlaydi).
    #
    # foreign_keys ANIQ ko'rsatilgan: prepaid_from_id qo'shilgach ikki jadval
    # o'rtasida ikkita tashqi kalit yo'li paydo bo'ldi va SQLAlchemy qaysi
    # biri bo'yicha bog'lashni bilmay qoldi.
    services_detail = relationship(
        "PatientService",
        foreign_keys="PatientService.patient_id",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
