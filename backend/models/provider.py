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
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    services = relationship("Service", secondary="provider_services", lazy="selectin")
