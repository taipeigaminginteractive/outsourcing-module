from pathlib import Path
from typing import List, Optional

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
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    
    FACEBOOK_CLIENT_ID: Optional[str] = None
    FACEBOOK_CLIENT_SECRET: Optional[str] = None
    
    LINE_CLIENT_ID: Optional[str] = None
    LINE_CLIENT_SECRET: Optional[str] = None
    OAUTH_PROVIDERS: dict = {
        "google": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
            "token_url": "https://oauth2.googleapis.com/token",
            "user_info_url": "https://www.googleapis.com/oauth2/v3/userinfo",
            "scope": "openid email profile" # scope 是 OAuth 授權的範圍
        },
        "facebook": {
            "client_id": FACEBOOK_CLIENT_ID,
            "client_secret": FACEBOOK_CLIENT_SECRET,
            "auth_url": "https://www.facebook.com/v18.0/dialog/oauth",
            "token_url": "https://graph.facebook.com/v18.0/oauth/access_token",
            "user_info_url": "https://graph.facebook.com/v18.0/me",
            "scope": "email"
        },
        "line": {
            "client_id": LINE_CLIENT_ID,
            "client_secret": LINE_CLIENT_SECRET,
            "auth_url": "https://access.line.me/oauth2/v2.1/authorize",
            "token_url": "https://api.line.me/oauth2/v2.1/token",
            "user_info_url": "https://api.line.me/v2/profile",
            "scope": "profile openid email"
        }
    }


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