from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class ServiceCategory(Base):
    """
    Xizmat bo'limi (kategoriyasi) va uning yo'naltiruvchi komissiyasi.

    Bo'lim nomi Service.category ustunida matn sifatida saqlanadi, shuning uchun
    ichida hali xizmat yo'q bo'lim hech qayerda ko'rinmasdi. Ilgari bunday bo'sh
    bo'limlar brauzerning localStorage'iga yozilardi — natijada bo'lim faqat
    o'sha qurilmada ko'rinib, boshqa qurilmada umuman chiqmasdi.

    Komissiya qoidasi ham shu yerda: ilgari qaysi bo'limga qancha berilishi
    kodda yozib qo'yilgan edi (Laboratoriya 22%, Uzi 15 000 va h.k.), shuning
    uchun yangi bo'lim qo'shilsa kodni o'zgartirish kerak bo'lardi.
    """

    __tablename__ = "service_categories"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)

    # "none" — komissiya berilmaydi | "percent" — to'lovdan foiz | "sum" — qat'iy summa
    commission_mode: Mapped[str] = mapped_column(String(10), default="none")
    commission_value: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
