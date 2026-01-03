from passlib.context import CryptContext
from fastapi import HTTPException
# ================================================
# 密碼加密工具
# ================================================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    """驗證密碼"""
    if not hashed_password:
        return False
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """生成密碼雜湊"""
    return pwd_context.hash(password)

def validate_password(password: str) -> None:
    """統一的密碼驗證函數
    
    驗證規則：
    - 長度至少 8 個字符
    - 至少包含一個大寫字母
    - 至少包含一個小寫字母
    - 至少包含一個數字
    
    Raises:
        HTTPException: 如果密碼不符合規則
    """
    if len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="密碼長度至少需要 8 個字符"
        )
    
    if not any(c.isupper() for c in password):
        raise HTTPException(
            status_code=400,
            detail="密碼必須包含至少一個大寫字母"
        )
    
    if not any(c.islower() for c in password):
        raise HTTPException(
            status_code=400,
            detail="密碼必須包含至少一個小寫字母"
        )
    
    if not any(c.isdigit() for c in password):
        raise HTTPException(
            status_code=400,
            detail="密碼必須包含至少一個數字"
        )
