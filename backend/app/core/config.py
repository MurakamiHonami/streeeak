from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    COGNITO_CLIENT_ID: str = ""
    ENVIRONMENT: str = "local"
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "ap-northeast-1"
    APP_NAME: str = "Streeeak API"
    ENV: str = "dev"

    # Legacy value kept for compatibility with existing deploy configs.
    DATABASE_URL: str = ""

    SECRET_KEY: str = "change_me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-1.5-flash"
    
    STRIPE_API_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_PRICE_ID: Optional[str] = None

    USERS_TABLE: str = "streeeak-users"
    USER_SETTINGS_TABLE: str = "streeeak-user-settings"
    GOALS_TABLE: str = "streeeak-goals"
    TASKS_TABLE: str = "streeeak-tasks"
    META_TABLE: str = "streeeak-meta"

    S3_BUCKET_NAME: str = "streeeak-frontend-111"
    CDN_DOMAIN: str = "https://streeeak.link"

settings = Settings()
