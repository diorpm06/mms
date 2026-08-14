from datetime import datetime
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from database import Base
from models.mixins import TimestampMixin


class InventoryItem(TimestampMixin, Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    category: Mapped[str] = mapped_column(String(100), default="Sarflash materiali") # 'Dori-darmon' | 'Sarflash materiali' | 'Reaktiv'
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    unit: Mapped[str] = mapped_column(String(50), default="dona") # 'dona' | 'flakon' | 'quti' | 'ampula'
    min_quantity: Mapped[int] = mapped_column(Integer, default=10) # Low stock threshold
    unit_price: Mapped[int] = mapped_column(Integer, default=0) # Sotilish narxi (Kassa narxi)
    cost_price: Mapped[int] = mapped_column(Integer, default=0) # Tavar haqiqiy narxi (Tan narxi)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
