from datetime import datetime

from sqlalchemy import DateTime, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class SavedReport(Base):
    """Stores generated reports (daily, ten_day) as PDF + JSON in the database."""

    __tablename__ = "saved_reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    report_type: Mapped[str] = mapped_column(String(20))  # daily | ten_day
    period_start: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD
    period_end: Mapped[str] = mapped_column(String(10))    # YYYY-MM-DD
    title: Mapped[str] = mapped_column(String(255))
    pdf_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    json_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
