from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class InpatientProviderAccrual(Base):
    """Statsionar xizmat ko'rsatuvchiga har bir yotgan kun uchun yozilgan haq.

    Har bir bemor-kun juftligi uchun aynan bitta qator bo'ladi (UniqueConstraint),
    shu sababli hisoblash necha marta qayta ishga tushsa ham summa ikkilanmaydi.
    Summa yozilgan paytdagi stavkadan olinadi — keyin stavka o'zgartirilsa
    o'tgan kunlar qayta hisoblanmaydi.
    """

    __tablename__ = "inpatient_provider_accruals"
    __table_args__ = (
        UniqueConstraint("inpatient_id", "accrual_date", name="uq_inp_accrual_day"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    inpatient_id: Mapped[int] = mapped_column(ForeignKey("inpatients.id"), index=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), index=True)
    accrual_date: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    provider = relationship("Provider")
    inpatient = relationship("Inpatient")
