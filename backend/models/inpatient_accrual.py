from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class InpatientProviderAccrual(Base):
    """Statsionar xizmat ko'rsatuvchiga har bir yotgan kun uchun yozilgan haq.

    Har bir bemor-kun-TUR (accrual_type) uchun aynan bitta qator bo'ladi
    (UniqueConstraint), shu sababli hisoblash necha marta qayta ishga
    tushsa ham summa ikkilanmaydi. Bitta bemorda bir xil kunda IKKI xil
    haq bo'lishi mumkin — asosiy shifokorning kunlik haqi ("attendance")
    va massaj uchun biriktirilgan xodimning haqi ("massage") — shuning
    uchun tur ham kalitning bir qismi.
    Summa yozilgan paytdagi stavkadan olinadi — keyin stavka o'zgartirilsa
    o'tgan kunlar qayta hisoblanmaydi.
    """

    __tablename__ = "inpatient_provider_accruals"
    __table_args__ = (
        UniqueConstraint("inpatient_id", "accrual_date", "accrual_type", name="uq_inp_accrual_day"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    inpatient_id: Mapped[int] = mapped_column(ForeignKey("inpatients.id"), index=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), index=True)
    accrual_date: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[int] = mapped_column(Integer)
    # 'attendance' — asosiy shifokorning kunlik haqi (eski, standart qiymat)
    # 'massage'    — massaj uchun biriktirilgan xodimning kunlik haqi
    accrual_type: Mapped[str] = mapped_column(String(20), default="attendance")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    provider = relationship("Provider")
    inpatient = relationship("Inpatient")
