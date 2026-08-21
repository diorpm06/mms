from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class ProviderService(Base):
    __tablename__ = "provider_services"

    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), primary_key=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), primary_key=True)


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    specialization: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(20))
    percentage: Mapped[int] = mapped_column(Integer)
    fixed_salary: Mapped[int] = mapped_column(Integer, default=0, nullable=True)
    balance: Mapped[int] = mapped_column(Integer, default=0)
    # Statsionar xizmat ko'rsatuvchi — bemor yotgan har bir kun uchun qat'iy haq
    # oladi (foiz emas). Faqat shu belgi qo'yilganlar statsionarda tanlanadi.
    is_inpatient_provider: Mapped[bool] = mapped_column(Boolean, default=False, nullable=True)
    inpatient_daily_rate: Mapped[int] = mapped_column(Integer, default=50000, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Ayni shifokorning YO'NALTIRUVCHI sifatidagi yozuvi.
    #
    # Bir odam ham xizmat ko'rsatishi, ham bemor yo'naltirishi mumkin —
    # masalan "Dr.Ozoda" (shifokor) va "Ozoda Medsestra" (yo'naltiruvchi)
    # bitta odam. Ikki yozuv turli oqimlarda ishlatilgani uchun birlashtirib
    # yuborilmaydi, faqat bog'lanadi. Shu bog'lanish tufayli shifokor
    # profilida yo'naltirishdan tushgan puli ham alohida ko'rsatiladi.
    referrer_id: Mapped[int | None] = mapped_column(
        ForeignKey("referrers.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    services = relationship("Service", secondary="provider_services", lazy="selectin")
