from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class AppSetting(Base):
    """Butun tizim uchun umumiy sozlamalar (kalit/qiymat).

    NEGA KERAK: Vercel serverless'da har bir nusxa (instance) O'Z
    xotirasiga ega. Modul darajasidagi oddiy o'zgaruvchida saqlangan
    qiymat faqat o'sha nusxada ko'rinadi:

        Admin matn yozadi  -> A nusxasiga tushdi  -> A da yangilandi
        TV ekran so'raydi  -> B nusxasiga tushdi  -> ESKI qiymat

    Natijada TV yuguruvchi satri ekrandan ekranga sakrab turardi va
    nusxa qayta ishga tushishi bilan standart matnga qaytardi.
    Umumiy qiymat hamma nusxaga bir xil ko'rinishi uchun BAZADA
    saqlanishi shart.
    """

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now)
