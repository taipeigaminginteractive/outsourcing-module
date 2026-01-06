"""
Test Helper Functions
"""
from app.core.token_auth_logic import create_token
from tests.factories import create_test_user
from app.db.models import User
from app.db.enums import UserStatus, UserRole

def get_auth_headers(username: str = "testuser") -> dict:
    """
    獲取認證 headers（直接生成 token，不通過 HTTP 請求）

    Args:
        username: 用戶名

    Returns:
        dict: 包含 Authorization header 的字典
    """
    token, _ = create_token(username, "access", 30)
    return {"Authorization": f"Bearer {token}"}


async def create_and_login_user(
    username: str = "testuser",
    email: str = "test@example.com",
    password: str = "testpass123",
    **kwargs
) -> tuple[User, dict]:
    """
    創建用戶並生成認證 headers（不通過 HTTP 請求）

    Args:
        username: 用戶名
        email: 郵箱
        password: 密碼
        **kwargs: 傳遞給 create_user 的其他參數

    Returns:
        tuple: (用戶對象, 認證 headers)
    """
    # 創建用戶
    user = await create_test_user(
        username=username,
        email=email,
        password=password,
        **kwargs
    )

    headers = get_auth_headers(username)

    return user, headers


async def create_and_login_admin_user(
    username: str = "admin",
    email: str = "admin@example.com",
    password: str = "testpass123",
    **kwargs
) -> tuple[User, dict]:
    """
    創建管理員用戶並生成認證 headers（不通過 HTTP 請求）
    """
    user = await create_test_user(
        username=username,
        email=email,
        password=password,
        is_superuser=True,
        status=UserStatus.ACTIVE,
        role=UserRole.ADMIN,
        **kwargs
    )
    return user, get_auth_headers(username)
