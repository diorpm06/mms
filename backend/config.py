from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # DATABASE_URL ni Vercel dashboard'da yoki .env da ko'rsating
    # Supabase: postgresql://postgres.xxx:password@aws-xxx.pooler.supabase.com:6543/postgres
    DATABASE_URL: str = "sqlite:///./marjona_med.db"  # local fallback (dev uchun)
    SECRET_KEY: str = "marjona_med_service_crm_secret_key_2026_x89f"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    BOT_TOKEN: str = ""
    CEO_CHAT_ID: str = ""
    TELEGRAM_CHAT_ID: str = ""
    TELEGRAM_CHAT_IDS: str = ""
    TELEGRAM_TOPIC_REGISTRATION: str = ""
    TELEGRAM_TOPIC_INPATIENTS: str = ""
    TELEGRAM_TOPIC_FINANCE: str = ""
    TELEGRAM_TOPIC_REPORTS: str = ""
    TELEGRAM_TOPIC_CANCELLATIONS: str = ""
    TELEGRAM_TOPIC_SYSTEM: str = ""
    GOOGLE_SHEETS_CREDENTIALS: str = "credentials.json"
    SPREADSHEET_ID: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
    SHEETS_WEBHOOK_SECRET: str = ""
    PRINT_AGENT_TOKEN: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}

    @field_validator(
        "DATABASE_URL", "SECRET_KEY", "FRONTEND_URL", "SHEETS_WEBHOOK_SECRET", "PRINT_AGENT_TOKEN",
        mode="before",
    )
    @classmethod
    def _strip_whitespace(cls, v):
        # Dashboard'ga qiymat joylashtirilganda tasodifan qo'shilib qolgan
        # bo'sh joy/qator belgilarini kesib tashlaydi (masalan trailing \n).
        return v.strip() if isinstance(v, str) else v


settings = Settings()
