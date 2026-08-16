from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class ReferrerCommission(Base):
    """
    Ayrim yo'naltiruvchi uchun bo'lim tarifidan ISTISNO.

    Odatda bo'lim tarifi (ServiceCategory.commission_mode/value) hammaga
    birdek qo'llanadi. Agar biror yo'naltiruvchi bilan boshqacha kelishilgan
    bo'lsa — masalan laboratoriyadan 22% emas 25% — shu yerga bitta qator
    qo'shiladi va faqat o'sha odamga o'sha bo'limda shu tarif ishlaydi.

    Ilgari bu qiymatlar Referrer jadvalidagi qat'iy ustunlarda edi
    (lab_percent, fizio_percent, uzi_sum, ozon_sum), ya'ni faqat oldindan
    kodda belgilangan 4 ta bo'lim uchun ishlardi.
    """

    __tablename__ = "referrer_commissions"
    __table_args__ = (UniqueConstraint("referrer_id", "category", name="uq_referrer_category"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    referrer_id: Mapped[int] = mapped_column(ForeignKey("referrers.id"), index=True)
    category: Mapped[str] = mapped_column(String(120), index=True)

    mode: Mapped[str] = mapped_column(String(10), default="none")   # none | percent | sum
    value: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
