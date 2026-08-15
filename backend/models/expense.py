from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base
from models.mixins import CancelMixin, TimestampMixin


class Expense(CancelMixin, TimestampMixin, Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    description: Mapped[str] = mapped_column(String(500))
    amount: Mapped[int] = mapped_column(Integer)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)

    creator = relationship("User", foreign_keys=[created_by])
