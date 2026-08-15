from datetime import datetime
from sqlalchemy import DateTime, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Banner(Base):
    __tablename__ = "banners"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    image_url: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # Rasm baza ichida saqlanadi. Vercel'da disk vaqtinchalik (/tmp har safar
    # server qayta ishga tushganda tozalanadi), shuning uchun faylga yozilgan
    # rasm bir necha daqiqadan keyin yo'qolib, TV ekranda banner ko'rinmasdi.
    image_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
