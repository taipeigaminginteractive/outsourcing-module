"""
測試資料工廠
提供各種模型的工廠函數，用於快速創建測試資料
"""
from datetime import datetime
from typing import Optional

from app.db.enums import UserRole, UserStatus
from app.db.models import User
from app.utils.pwd_utils import get_password_hash

# ================================================
# User Related Factories
# ================================================

async def create_test_user(
    username: Optional[str] = None,
    email: Optional[str] = None,
    password: Optional[str] = "TestPass123",
    status: Optional[UserStatus] = None,
    role: UserRole = UserRole.USER,
    is_active: Optional[bool] = None,
    is_superuser: bool = False,
    is_verified: bool = False,
    is_upgraded: bool = False,
    **kwargs
) -> User:
    """
    創建測試用戶 替代 user_service.create_user 函數
    
    Note:
        默認密碼 "TestPass123" 符合驗證規則：
        - 至少8位
        - 包含大寫字母 (T, P)
        - 包含小寫字母 (est, ass)
        - 包含數字 (123)
    """
    if username is None:
        username = f"testuser_{datetime.now().timestamp()}"
    if email is None:
        email = f"test_{datetime.now().timestamp()}@example.com"
    
    resolved_status = status
    if resolved_status is None:
        if is_active is None:
            resolved_status = UserStatus.ACTIVE
        else:
            resolved_status = UserStatus.ACTIVE if is_active else UserStatus.INACTIVE

    hashed_password = get_password_hash(password) if password else None

    return await User.create(
        username=username,
        email=email,
        hashed_password=hashed_password,
        status=resolved_status,
        role=role,
        is_superuser=is_superuser,
        is_verified=is_verified,
        is_upgraded=is_upgraded,
        **kwargs
    )
