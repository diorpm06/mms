from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base
from models.mixins import CancelMixin


class ProviderAdvance(CancelMixin, Base):
    """Advance (prepayment) given to a provider (doctor) or referrer."""

    __tablename__ = "provider_advances"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    recipient_type: Mapped[str] = mapped_column(String(20))    # provider | referrer
    recipient_id: Mapped[int] = mapped_column(Integer, index=True)
    amount: Mapped[int] = mapped_column(Integer)               # total advance given
    remaining: Mapped[int] = mapped_column(Integer)            # still to be deducted
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_settled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Bekor qilinganda shu harajat yozuvi ham (kassaga tegmasdan)
    # bekor deb belgilanadi — Harajatlar hisobotida ikkinchi marta
    # chiqmasin uchun.
    expense_id: Mapped[int | None] = mapped_column(ForeignKey("expenses.id"), nullable=True)
