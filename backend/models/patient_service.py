from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class PatientService(Base):
    """
    Bemor bir tashrifda olgan HAR BIR xizmat.

    Ilgari patients.service_id da faqat bitta (asosiy) xizmat saqlanardi.
    Bemor 5 ta xizmat olsa, tizim ularni bo'limlar bo'yicha guruhlab bir
    nechta patients yozuvi yaratardi va har birida faqat guruhning birinchi
    xizmati qolardi — qolganlarining nomi butunlay yo'qolardi. Natijada
    "Bugungi bemorlar"da 5 ta xizmat o'rniga 2 tasi ko'rinardi va xizmatlar
    bo'yicha statistika ham noto'g'ri chiqardi.
    """

    __tablename__ = "patient_services"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[int] = mapped_column(Integer, default=0)
    total_price: Mapped[int] = mapped_column(Integer, default=0)

    # Bemor bir necha kunlik xizmatni OLDINDAN to'lashi mumkin (masalan 3 ta
    # elektroforez). Shunda quantity=3, is_course=True bo'ladi va bemor uch
    # marta keladi.
    #
    # used_count — nechta seans ISHLATILGANI. Yangi yozuvda 0: ro'yxatga
    # olishning o'zi kunni yemaydi, birinchi kun uchun ham "Keldi" bosiladi.
    # Ilgari bu yerda default=1 turgan edi va har bir kurs bir kunni
    # yo'qotardi: 4 kunga to'lagan bemor bir marta kelib "1 kun qoldi"
    # holatiga tushib qolardi.
    used_count: Mapped[int] = mapped_column(Integer, default=0, nullable=True)

    # Kurs jadvali: shu xizmat kursning QAYSI kunlarida beriladi.
    # Masalan "1,3,5" — bemor 1-, 3- va 5-tashrifida shu muolajani oladi.
    #
    # Bo'sh (NULL) bo'lsa — eski tartib: kuni qolguncha HAR tashrifda
    # beriladi. Shuning uchun eski yozuvlar o'z holicha ishlayveradi.
    course_days: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_course: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    service = relationship("Service")

