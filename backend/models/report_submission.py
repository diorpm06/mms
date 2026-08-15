from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class ReportSubmission(Base):
    """Shifokor to'ldirgan UZI/Lab shabloni — adminga chop etish uchun yuboriladi.
    Har bir tashrif (Patient qatori) uchun alohida yozuv, eskisi almashtirilmaydi."""

    __tablename__ = "report_submissions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id"), nullable=True)
    template_key: Mapped[str] = mapped_column(String(50))
    template_label: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(50))  # "Laboratoriya" | "UZI"
    filled_data: Mapped[str] = mapped_column(Text)  # JSON string: {maydon: qiymat}
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    doctor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    doctor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="submitted")  # submitted | printed
    printed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    printed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)

    patient = relationship("Patient")
    service = relationship("Service")
