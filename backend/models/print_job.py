from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class PrintJob(Base):
    """Masofaviy chop etish navbati. Har bir joydagi (klinika, uy va h.k.)
    kichik agent dasturi o'ziga tegishli location_key bo'yicha yozuvlarni
    olib, mahalliy printerga chiqaradi."""

    __tablename__ = "print_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    location_key: Mapped[str] = mapped_column(String(50), index=True)
    printer_type: Mapped[str] = mapped_column(String(20), default="a4")  # a4 | receipt
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | printed | failed
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_by_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    printed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
