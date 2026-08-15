from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class SalaryLog(Base):
    __tablename__ = "salary_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    amount: Mapped[int] = mapped_column(Integer)
    month: Mapped[str] = mapped_column(String(7))  # YYYY-MM
    paid_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    employee = relationship("Employee")
