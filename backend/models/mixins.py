from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column


class CancelMixin:
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class TimestampMixin:
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=True
    )
