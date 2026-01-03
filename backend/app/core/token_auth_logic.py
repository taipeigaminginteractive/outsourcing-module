from datetime import datetime, timedelta, UTC
import uuid
import jwt
from settings import settings

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM

# 創建 JWT token 在 routes/auth.py 中使用
def create_token(sub: str, token_type: str, minutes: int):
    """創建 JWT token"""
    now = datetime.now(UTC)
    jti = str(uuid.uuid4())
    payload = {
        "sub": sub,
        "type": token_type,  # 用於區分 token 類型 access/refresh
        "jti": jti,  # 用於撤銷/旋轉
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=minutes)).timestamp()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM), jti