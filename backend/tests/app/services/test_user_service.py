"""
user_service.py 的完整測試套件

測試覆蓋範圍：
1. create_user - 創建用戶
2. get_user_by_username - 根據用戶名獲取用戶
3. get_user_by_email - 根據郵箱獲取用戶
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.core.errors import UserAlreadyExistsError
from app.db.models import User
from app.schemas.user_schema import UserCreateDTO
from app.services import user_service
from app.utils.pwd_utils import verify_password
from pydantic import ValidationError
from tests.factories import create_test_user
from tortoise.exceptions import IntegrityError


class TestCreateUser:
    """測試: create_user() - 創建用戶"""

    # ================================================
    # Happy Path
    # ================================================
    @pytest.mark.asyncio
    async def test_create_user_without_password_success(self, db):
        """
        成功創建用戶（無密碼）- 信箱註冊場景
        
        測試描述：
            - 使用真實資料庫創建用戶
            - 不提供密碼（信箱註冊流程）
            - 驗證用戶正確存入資料庫
        
        外部資源：
            - 資料庫連線（SQLite 測試資料庫）
        """
        user_data = UserCreateDTO(
            username="newuser",
            email="newuser@example.com",
            password=None
        )
        
        user = await user_service.create_user(user_data)
        
        # 驗證返回的用戶對象
        assert user.username == "newuser"
        assert user.email == "newuser@example.com"
        assert user.hashed_password is None  # 無密碼
        assert user.is_verified is False  # 註冊時未驗證
        assert user.id is not None
        
        # 驗證資料庫
        db_user = await User.get_or_none(username="newuser")
        assert db_user is not None
        assert db_user.email == "newuser@example.com"
        assert db_user.hashed_password is None

    @pytest.mark.asyncio
    async def test_create_user_with_password_success(self, db):
        """
        成功創建用戶（有密碼）
        
        測試描述：
            - 使用真實資料庫創建用戶
            - 提供密碼（符合驗證規則：至少8位、含大小寫字母和數字）
            - 驗證密碼已被 hash
        
        外部資源：
            - 資料庫連線
        """
        user_data = UserCreateDTO(
            username="userpass",
            email="userpass@example.com",
            password="TestPass123"
        )
        
        user = await user_service.create_user(user_data)
        
        # 驗證密碼已被 hash
        assert user.hashed_password is not None
        assert user.hashed_password != "TestPass123"  # 不是明文
        assert user.hashed_password.startswith("$2b$")  # bcrypt hash
        
        # 驗證資料庫
        db_user = await User.get_or_none(username="userpass")
        assert db_user is not None
        assert db_user.hashed_password is not None
        # 驗證密碼可以正確驗證
        assert verify_password("TestPass123", db_user.hashed_password)

    # ================================================
    # Edge Cases
    # ================================================
    @pytest.mark.asyncio
    async def test_create_user_duplicate_username(self, db):
        """
        用戶名已存在，拋出 UserAlreadyExistsError
        
        測試描述：
            - 先創建一個用戶
            - 嘗試用相同 username 創建新用戶
            - 應該拋出 UserAlreadyExistsError，field='username'
        
        外部資源：
            - 資料庫連線
        """
        # 先創建一個用戶
        await create_test_user(
            username="existinguser",
            email="existing@example.com",
            password="Pass123Abc"
        )
        
        # 嘗試用相同 username 創建新用戶
        user_data = UserCreateDTO(
            username="existinguser",
            email="newemail@example.com",
            password=None
        )
        
        with pytest.raises(UserAlreadyExistsError) as exc_info:
            await user_service.create_user(user_data)
        
        # 驗證錯誤訊息
        error = exc_info.value
        assert error.code == "AUTH.USER.DUPLICATE_CREDENTIAL"
        assert error.status_code == 409
        assert error.detail["field"] == "username"

    @pytest.mark.asyncio
    async def test_create_user_duplicate_email(self, db):
        """
        郵箱已存在，拋出 UserAlreadyExistsError
        
        測試描述：
            - 先創建一個用戶
            - 嘗試用相同 email 創建新用戶
            - 應該拋出 UserAlreadyExistsError，field='email'
        
        外部資源：
            - 資料庫連線
        """
        # 先創建一個用戶
        await create_test_user(
            username="user1",
            email="duplicate@example.com",
            password="Pass123Abc"
        )
        
        # 嘗試用相同 email 創建新用戶
        user_data = UserCreateDTO(
            username="user2",
            email="duplicate@example.com",
            password=None
        )
        
        with pytest.raises(UserAlreadyExistsError) as exc_info:
            await user_service.create_user(user_data)
        
        # 驗證錯誤訊息
        error = exc_info.value
        assert error.code == "AUTH.USER.DUPLICATE_CREDENTIAL"
        assert error.status_code == 409
        assert error.detail["field"] == "email"

    @pytest.mark.asyncio
    async def test_create_user_integrity_error_unknown_conflict(self, db):
        """
        IntegrityError 但無法找到衝突用戶（邊界情況）
        
        測試描述：
            - Mock User.create 拋出 IntegrityError
            - Mock User.filter 返回 None（無法找到衝突用戶）
            - 應該拋出 UserAlreadyExistsError，field='credential'
        
        Mock:
            - User.create (拋出 IntegrityError)
            - User.filter (返回 None)
        
        Note:
            - 這是理論上不應該發生的情況，但程式碼有處理此邊界情況
        """
        user_data = UserCreateDTO(
            username="testuser",
            email="test@example.com",
            password=None
        )
        
        with patch("app.services.user_service.User.create") as mock_create, \
             patch("app.services.user_service.User.filter") as mock_filter:
            
            # Mock IntegrityError
            mock_create.side_effect = IntegrityError("UNIQUE constraint failed")
            
            # Mock 無法找到衝突用戶
            mock_filter_instance = MagicMock()
            mock_filter_instance.first = AsyncMock(return_value=None)
            mock_filter.return_value = mock_filter_instance
            
            with pytest.raises(UserAlreadyExistsError) as exc_info:
                await user_service.create_user(user_data)
            
            # 驗證錯誤訊息（使用默認的 'credential'）
            error = exc_info.value
            assert error.code == "AUTH.USER.DUPLICATE_CREDENTIAL"
            assert error.status_code == 409
            assert error.detail["field"] == "credential"

    @pytest.mark.asyncio
    async def test_create_user_password_too_short(self, db):
        """
        密碼太短（少於8位）
        
        測試描述：
            - 提供少於8位的密碼
            - Pydantic 驗證器應該拒絕
        
        外部資源：
            - 無（在創建 DTO 時就會失敗）
        """
        with pytest.raises(ValidationError) as exc_info:
            user_data = UserCreateDTO(
                username="shortpass",
                email="shortpass@example.com",
                password="Pass12"  # 只有6位
            )
        
        assert "密碼長度至少8位" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_create_user_password_invalid_format(self, db):
        """
        密碼格式不符合要求
        
        測試描述：
            - 測試各種不符合格式的密碼（缺少大寫、小寫或數字）
            - Pydantic 驗證器應該拒絕
        
        外部資源：
            - 無（在創建 DTO 時就會失敗）
        """
        # 測試缺少大寫字母
        with pytest.raises(ValidationError) as exc_info:
            UserCreateDTO(
                username="test1",
                email="test1@example.com",
                password="password123"
            )
        assert "密碼必須包含至少一個大寫字母" in str(exc_info.value)
        
        # 測試缺少小寫字母
        with pytest.raises(ValidationError) as exc_info:
            UserCreateDTO(
                username="test2",
                email="test2@example.com",
                password="PASSWORD123"
            )
        assert "密碼必須包含至少一個小寫字母" in str(exc_info.value)
        
        # 測試缺少數字
        with pytest.raises(ValidationError) as exc_info:
            UserCreateDTO(
                username="test3",
                email="test3@example.com",
                password="PasswordOnly"
            )
        assert "密碼必須包含至少一個數字" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_create_user_password_too_long(self, db):
        """
        密碼太長（超過72位）
        
        測試描述：
            - 提供超過72位的密碼
            - Pydantic 驗證器應該拒絕
            - bcrypt 限制為72字元，所以我們也限制在72位
        
        外部資源：
            - 無（在創建 DTO 時就會失敗）
        """
        # 構造一個超過72位且符合其他規則的密碼
        long_password = "A1" + "a" * 71  # 73位
        
        with pytest.raises(ValidationError) as exc_info:
            user_data = UserCreateDTO(
                username="toolongpass",
                email="toolongpass@example.com",
                password=long_password
            )
        
        assert "密碼長度不得超過72位" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_create_user_with_unicode_username(self, db):
        """
        Unicode 字元用戶名應被拒絕
        
        測試描述：
            - 嘗試創建包含 Unicode 字元（中文）的用戶名
            - Pydantic 驗證器應該拒絕
            - 只允許 ASCII 字母和數字
        
        外部資源：
            - 無（在創建 DTO 時就會失敗）
        """
        with pytest.raises(ValidationError) as exc_info:
            user_data = UserCreateDTO(
                username="user測試",
                email="unicode@example.com",
                password=None
            )
        
        assert "用戶名只能包含英文字母和數字" in str(exc_info.value)


class TestGetUserByUsername:
    """測試: get_user_by_username() - 根據用戶名獲取用戶"""

    # ================================================
    # Happy Path
    # ================================================
    @pytest.mark.asyncio
    async def test_get_user_by_username_success(self, db):
        """
        成功獲取用戶
        
        測試描述：
            - 先創建一個用戶
            - 根據 username 獲取用戶
            - 應該返回該用戶對象
        
        外部資源：
            - 資料庫連線
        """
        # 先創建用戶
        created_user = await create_test_user(
            username="getuser",
            email="getuser@example.com",
            password="Pass123Abc"
        )
        
        # 獲取用戶
        user = await user_service.get_user_by_username("getuser")
        
        # 驗證
        assert user is not None
        assert user.id == created_user.id
        assert user.username == "getuser"
        assert user.email == "getuser@example.com"

    # ================================================
    # Edge Cases
    # ================================================
    @pytest.mark.asyncio
    async def test_get_user_by_username_not_found(self, db):
        """
        用戶不存在，返回 None
        
        測試描述：
            - 嘗試獲取不存在的用戶
            - 應該返回 None（不拋出異常）
        
        外部資源：
            - 資料庫連線
        """
        user = await user_service.get_user_by_username("nonexistent")
        
        assert user is None

    @pytest.mark.asyncio
    async def test_get_user_by_username_case_sensitive(self, db):
        """
        用戶名大小寫敏感測試
        
        測試描述：
            - 創建用戶名為小寫的用戶
            - 用大寫查詢
            - 應該返回 None（區分大小寫）
        
        外部資源：
            - 資料庫連線
        """
        # 創建小寫用戶名
        await create_test_user(
            username="lowercase",
            email="lower@example.com",
            password="Pass123Abc"
        )
        
        # 用大寫查詢
        user = await user_service.get_user_by_username("LOWERCASE")
        
        # 應該找不到（資料庫區分大小寫）
        assert user is None

    @pytest.mark.asyncio
    async def test_get_user_by_username_empty_string(self, db):
        """
        用戶名為空字串
        
        測試描述：
            - 用空字串查詢用戶
            - 應該返回 None
        
        外部資源：
            - 資料庫連線
        """
        user = await user_service.get_user_by_username("")
        
        assert user is None


class TestGetUserByEmail:
    """測試: get_user_by_email() - 根據郵箱獲取用戶"""

    # ================================================
    # Happy Path
    # ================================================
    @pytest.mark.asyncio
    async def test_get_user_by_email_success(self, db):
        """
        成功獲取用戶
        
        測試描述：
            - 先創建一個用戶
            - 根據 email 獲取用戶
            - 應該返回該用戶對象
        
        外部資源：
            - 資料庫連線
        """
        # 先創建用戶
        created_user = await create_test_user(
            username="emailuser",
            email="emailuser@example.com",
            password="Pass123Abc"
        )
        
        # 獲取用戶
        user = await user_service.get_user_by_email("emailuser@example.com")
        
        # 驗證
        assert user is not None
        assert user.id == created_user.id
        assert user.username == "emailuser"
        assert user.email == "emailuser@example.com"

    # ================================================
    # Edge Cases
    # ================================================
    @pytest.mark.asyncio
    async def test_get_user_by_email_not_found(self, db):
        """
        用戶不存在，返回 None
        
        測試描述：
            - 嘗試獲取不存在的用戶
            - 應該返回 None（不拋出異常）
        
        外部資源：
            - 資料庫連線
        """
        user = await user_service.get_user_by_email("nonexistent@example.com")
        
        assert user is None

    @pytest.mark.asyncio
    async def test_get_user_by_email_case_insensitive(self, db):
        """
        郵箱不區分大小寫測試
        
        測試描述：
            - 創建小寫郵箱的用戶
            - 用大寫查詢
            - 應該能找到用戶（郵箱不區分大小寫）
        
        外部資源：
            - 資料庫連線
        
        Note:
            - 郵箱標準不區分大小寫
            - 系統已統一轉為小寫處理
        """
        # 創建小寫郵箱（schema 會自動轉為小寫）
        created_user = await create_test_user(
            username="emailcase",
            email="emailcase@example.com",
            password="Pass123Abc"
        )
        
        # 用大寫查詢，應該能找到
        user = await user_service.get_user_by_email("EMAILCASE@EXAMPLE.COM")
        
        assert user is not None
        assert user.id == created_user.id
        assert user.email == "emailcase@example.com"  # 存儲為小寫

    @pytest.mark.asyncio
    async def test_get_user_by_email_with_special_chars(self, db):
        """
        郵箱包含特殊字元（加號、點號等）
        
        測試描述：
            - 創建包含特殊字元的郵箱
            - 成功獲取用戶
        
        外部資源：
            - 資料庫連線
        
        Note:
            - 確保系統能正確處理 Gmail 風格別名等特殊格式
        """
        await create_test_user(
            username="specialuser",
            email="user.name+tag@example.com",
            password="Pass123Abc"
        )
        
        user = await user_service.get_user_by_email("user.name+tag@example.com")
        
        assert user is not None
        assert user.email == "user.name+tag@example.com"

    @pytest.mark.asyncio
    async def test_get_user_by_email_empty_string(self, db):
        """
        郵箱為空字串
        
        測試描述：
            - 用空字串查詢用戶
            - 應該返回 None
        
        外部資源：
            - 資料庫連線
        """
        user = await user_service.get_user_by_email("")
        
        assert user is None

