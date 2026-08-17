from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base
from models.mixins import CancelMixin


class InpatientTariff(Base):
    """Statsionar Tarif paketlari (masalan: Standart, VIP, 5 Kunlik Kompleks)"""
    __tablename__ = "inpatient_tariffs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150))
    daily_rate: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    included_services = relationship("InpatientTariffService", back_populates="tariff", cascade="all, delete-orphan")


class InpatientTariffService(Base):
    """Tarif ichiga kiritilgan bepul xizmatlar (Service Catalog dan)"""
    __tablename__ = "inpatient_tariff_services"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tariff_id: Mapped[int] = mapped_column(ForeignKey("inpatient_tariffs.id", ondelete="CASCADE"))
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    tariff = relationship("InpatientTariff", back_populates="included_services")
    service = relationship("Service")


class InpatientMaterial(Base):
    """Dori-darmonlar va sarflov materiallari katalogi"""
    __tablename__ = "inpatient_materials"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    unit_name: Mapped[str] = mapped_column(String(50), default="dona")  # dona, flakon, ampula
    unit_price: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class InpatientItem(CancelMixin, Base):
    """Yotgan bemorga biriktirilgan qo'shimcha xizmatlar yoki ishlatilgan materiallar"""
    __tablename__ = "inpatient_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    inpatient_id: Mapped[int] = mapped_column(ForeignKey("inpatients.id", ondelete="CASCADE"))
    item_type: Mapped[str] = mapped_column(String(20))  # 'service' | 'material'
    service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id"), nullable=True)
    material_id: Mapped[int | None] = mapped_column(ForeignKey("inpatient_materials.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[int] = mapped_column(Integer, default=0)
    total_price: Mapped[int] = mapped_column(Integer, default=0)
    is_included_in_tariff: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    inpatient = relationship("Inpatient", back_populates="items")
    service = relationship("Service")
    material = relationship("InpatientMaterial")


class InpatientRoom(Base):
    """Palatalar (Xonalar) katalogi"""
    __tablename__ = "inpatient_rooms"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    room_number: Mapped[str] = mapped_column(String(50), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    beds = relationship("InpatientBed", back_populates="room", cascade="all, delete-orphan")


class InpatientBed(Base):
    """Palata ichidagi koyka / o'rinlar"""
    __tablename__ = "inpatient_beds"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("inpatient_rooms.id", ondelete="CASCADE"))
    bed_number: Mapped[str] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    room = relationship("InpatientRoom", back_populates="beds")
