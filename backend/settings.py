from typing import Optional, List
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    # JWT 
    SECRET_KEY: str = "your-secret-key-from-env"
    ALGORITHM: str = "HS256"
    
    # Email Verification
    EMAIL_VERIFICATION_EXPIRE_MINUTES: int = 1440  # 24 小時
    
    # Logging
    LOG_LEVEL: str = "INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    LOG_TO_FILE: bool = True
    LOG_TO_CONSOLE: bool = True

settings = Settings()