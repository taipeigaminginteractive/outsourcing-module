from typing import Optional, List
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    # JWT 
    SECRET_KEY: str = "your-secret-key-from-env"
    ALGORITHM: str = "HS256"
    
    # Email 
    EMAIL_VERIFICATION_EXPIRE_MINUTES: int = 1440  # 24 小時
    
    # Logging
    LOG_LEVEL: str = "INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    LOG_TO_FILE: bool = True
    LOG_TO_CONSOLE: bool = True

    # FastAPI
    API_PORT: int = 8000
    API_HOST: str = "0.0.0.0"
    API_RELOAD: bool = True
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    
    # 環境變數
    ENV: str = "development"

    # Database
    DATABASE_URL: str = "postgres://user:password@localhost/dbname"
    DATABASE_POOL_SIZE: int = 10    
    TEST_DATABASE_URL: str = "sqlite://:memory:"
    
    # Log file paths
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