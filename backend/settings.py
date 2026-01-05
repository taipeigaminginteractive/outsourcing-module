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

    # Log file paths
    # 預設放在 backend/logs/ 下；可透過環境變數覆寫
    LOG_DIR: Path = BASE_DIR / "logs"
    LOG_FILE: Path = BASE_DIR / "logs" / "app.log"
    ERROR_LOG_FILE: Path = BASE_DIR / "logs" / "error.log"

    # OAuth Providers
    OAUTH_PROVIDERS: List[str] = ["google", "facebook", "line"]

    # Backend and Frontend URLs
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore"  # 允許忽略未定義的環境變數
    }

settings = Settings()