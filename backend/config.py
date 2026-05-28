from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/marjona_med"
    SECRET_KEY: str = "change-me-in-production"
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

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
