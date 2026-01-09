"""
auth.py 路由的完整測試套件

測試覆蓋範圍：
1. POST /auth/register - 用戶註冊
2. POST /auth/get-email-verification-token - 獲取驗證 token
3. GET /auth/oauth/{provider}/url - 獲取 OAuth 授權 URL
"""
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.db.enums import UserRole, UserStatus
from app.db.models import User
from httpx import AsyncClient
from tests.factories import create_test_user


class TestRegisterEndpoint:
    """測試: POST /auth/register """
   
   # ================================================
   # Happy Path
   # ================================================
    @pytest.mark.asyncio
    async def test_register_success(self, client: AsyncClient, db):
        """
        成功註冊新用戶
        
        測試描述：
            - 使用真實資料庫創建用戶
            - 驗證用戶是否正確存入資料庫
        
        外部資源：
            - 資料庫連線（SQLite 測試資料庫）
        
        Note:
            - 需要 mock mailer.send_verification_email 避免實際發送郵件
        """
        with patch("app.api.routes.auth.mailer.send_verification_email") as mock_email:
            mock_email.return_value = None
            
            # 發送請求
            response = await client.post(
                "/auth/register",
                json={"username": "integuser", "email": "integ@example.com"}
            )
            
            # 驗證響應
            assert response.status_code == 200
            data = response.json()
            assert data["username"] == "integuser"
            assert data["email"] == "integ@example.com"
            assert data["is_verified"] is False
            
            # 驗證資料庫
            user = await User.get_or_none(username="integuser")
            assert user is not None
            assert user.email == "integ@example.com"
            assert user.is_verified is False
            assert user.hashed_password is None  # 註冊時不設置密碼
    

    @pytest.mark.asyncio
    async def test_register_resend_verification_for_unverified_user(self, client: AsyncClient, db):
        """
        Email 已存在但用戶未驗證，重新發送驗證信
        
        測試描述：
            - 用戶已註冊但未驗證
            - 嘗試用相同 email 再次註冊
            - 應該重新發送驗證信並返回用戶資訊
        """
        # 創建未驗證用戶
        await create_test_user(
            username="unverified",
            email="unverified@example.com",
            is_verified=False,
            password=None
        )
        
        with patch("app.api.routes.auth.mailer.send_verification_email") as mock_email:
            mock_email.return_value = None
            
            # 嘗試用相同 email 註冊
            response = await client.post(
                "/auth/register",
                json={"username": "newuser", "email": "unverified@example.com"}
            )
            
            # 應該成功並重新發送驗證信
            assert response.status_code == 200
            data = response.json()
            assert data["email"] == "unverified@example.com"
            assert mock_email.call_count == 1
    
    @pytest.mark.asyncio
    async def test_register_resend_verification_for_verified_no_password_user(
        self, client: AsyncClient, db
    ):
        """
        Email 已存在，用戶已驗證但未設置密碼，重新發送驗證信
        
        測試描述：
            - 用戶已驗證但未設置密碼（未完成註冊流程）
            - 嘗試用相同 email 再次註冊
            - 應該重新發送驗證信
        """
        # 創建已驗證但未設置密碼的用戶
        await create_test_user(
            username="verifiednopass",
            email="verified_no_pass@example.com",
            is_verified=True,
            password=None  # 未設置密碼
        )
        
        with patch("app.api.routes.auth.mailer.send_verification_email") as mock_email:
            mock_email.return_value = None
            
            response = await client.post(
                "/auth/register",
                json={"username": "newuser2", "email": "verified_no_pass@example.com"}
            )
            
            assert response.status_code == 200
            assert mock_email.call_count == 1
    
    # ================================================
    # Edge Cases
    # ================================================
    @pytest.mark.asyncio
    async def test_register_duplicate_username(self, client: AsyncClient, db):
        """
        用戶名已存在，返回 409 錯誤
        
        測試描述：
            - 嘗試註冊已存在的用戶名
            - 應該返回 409 衝突錯誤
        """
        # 創建已存在的用戶
        await create_test_user(
            username="existinguser",
            email="existing@example.com",
            is_verified=True,
            password="HashPass123"
        )
        
        with patch("app.api.routes.auth.mailer.send_verification_email"):
            response = await client.post(
                "/auth/register",
                json={"username": "existinguser", "email": "newemail@example.com"}
            )
            
            assert response.status_code == 409
            data = response.json()
            assert "code" in data["detail"]
            assert data["detail"]["code"] == "AUTH.USER.DUPLICATE_CREDENTIAL"
    
    @pytest.mark.asyncio
    async def test_register_duplicate_email_fully_registered(self, client: AsyncClient, db):
        """
        Email 已存在且用戶已完全註冊，返回 409 錯誤
        
        測試描述：
            - Email 已存在且用戶已驗證並設置密碼
            - 應該返回 409 衝突錯誤
        """
        # 創建完全註冊的用戶
        await create_test_user(
            username="fullyregistered",
            email="fully@example.com",
            is_verified=True,
            password="TestPass123"
        )
        
        with patch("app.api.routes.auth.mailer.send_verification_email"):
            response = await client.post(
                "/auth/register",
                json={"username": "newuser", "email": "fully@example.com"}
            )
            
            assert response.status_code == 409
            data = response.json()
            assert "code" in data["detail"]
            assert data["detail"]["code"] == "AUTH.USER.DUPLICATE_CREDENTIAL"
    
    @pytest.mark.asyncio
    async def test_register_invalid_username_too_short(self, client: AsyncClient):
        """
        用戶名太短（小於 3 個字元），返回 422 驗證錯誤
        """
        response = await client.post(
            "/auth/register",
            json={"username": "ab", "email": "test@example.com"}
        )
        
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
    
    @pytest.mark.asyncio
    async def test_register_invalid_username_too_long(self, client: AsyncClient):
        """
        用戶名太長（超過 50 個字元），返回 422 驗證錯誤
        """
        long_username = "a" * 51
        response = await client.post(
            "/auth/register",
            json={"username": long_username, "email": "test@example.com"}
        )
        
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_register_invalid_username_special_chars(self, client: AsyncClient):
        """
        用戶名包含特殊字符，返回 422 驗證錯誤
        
        測試描述：
            - 用戶名只能包含英文字母和數字
        """
        response = await client.post(
            "/auth/register",
            json={"username": "user@name", "email": "test@example.com"}
        )
        
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_register_invalid_username_unicode(self, client: AsyncClient):
        """
        用戶名包含 Unicode 字元，返回 422 驗證錯誤
        
        測試描述：
            - 用戶名不允許 Unicode 字元（如中文、日文等）
            - 只允許 ASCII 英文字母和數字
        """
        response = await client.post(
            "/auth/register",
            json={"username": "用戶測試", "email": "test@example.com"}
        )
        
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_register_invalid_email_format(self, client: AsyncClient):
        """
        Email 格式無效，返回 422 驗證錯誤 (EmailStr 驗證)
        """
        response = await client.post(
            "/auth/register",
            json={"username": "testuser", "email": "invalid-email"}
        )
        
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_register_missing_username(self, client: AsyncClient):
        """
        缺少必填欄位 username，返回 422 驗證錯誤
        """
        response = await client.post(
            "/auth/register",
            json={"email": "test@example.com"}
        )
        
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_register_missing_email(self, client: AsyncClient):
        """
        缺少必填欄位 email，返回 422 驗證錯誤
        """
        response = await client.post(
            "/auth/register",
            json={"username": "testuser"}
        )
        
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_register_mailer_failure(self, client: AsyncClient, db):
        """
        郵件發送失敗時的處理
        
        測試描述：
            - Mock mailer 拋出 EmailSendError（發送失敗）
            - 應該返回 503 錯誤並提示用戶稍後重試
        
        Mock:
            - mailer.send_verification_email (拋出 EmailSendError)
        
        外部資源：
            - 資料庫連線（真實創建用戶）
        """
        from app.core.errors import EmailSendError
        
        with patch("app.api.routes.auth.mailer.send_verification_email") as mock_email:
            # Mock 郵件發送失敗（拋出異常）
            mock_email.side_effect = EmailSendError("verification")
            
            # 發送請求
            response = await client.post(
                "/auth/register",
                json={"username": "testuser", "email": "test@example.com"}
            )
            
            # 應該返回 503 Service Unavailable
            assert response.status_code == 503
            data = response.json()
            assert "code" in data["detail"]
            assert data["detail"]["code"] == "EMAIL.SEND.FAILED"
            assert data["detail"]["message"] == "Failed to send email, please try again later"
            assert data["detail"]["email_type"] == "verification"
            
            # 驗證用戶已經創建在資料庫中（下次可以重試）
            user = await User.get_or_none(username="testuser")
            assert user is not None
            assert user.email == "test@example.com"
            assert user.is_verified is False
    
    @pytest.mark.asyncio
    async def test_register_resend_mailer_failure(self, client: AsyncClient, db):
        """
        重發驗證信時郵件發送失敗
        
        測試描述：
            - 用戶已存在但未驗證
            - 嘗試用相同 email 再次註冊（應該重發驗證信）
            - Mock 郵件發送失敗
            - 應該返回 503 錯誤
        
        Mock:
            - mailer.send_verification_email (拋出 EmailSendError)
        
        外部資源：
            - 資料庫連線
        """
        from app.core.errors import EmailSendError

        # 創建未驗證用戶
        await create_test_user(
            username="unverified",
            email="unverified@example.com",
            is_verified=False,
            password=None
        )
        
        with patch("app.api.routes.auth.mailer.send_verification_email") as mock_email:
            # Mock 郵件發送失敗（拋出異常）
            mock_email.side_effect = EmailSendError("verification")
            
            # 嘗試用相同 email 註冊
            response = await client.post(
                "/auth/register",
                json={"username": "newuser", "email": "unverified@example.com"}
            )
            
            # 應該返回 503 Service Unavailable
            assert response.status_code == 503
            data = response.json()
            assert data["detail"]["code"] == "EMAIL.SEND.FAILED"


class TestGetEmailVerificationToken:
    """測試: POST /auth/get-email-verification-token"""
    
    # ================================================
    # Happy Path
    # ================================================
    @pytest.mark.asyncio
    async def test_get_token_success_for_unverified_user(
        self, client: AsyncClient, db
    ):
        """
        成功獲取未驗證用戶的 token
        
        外部資源：
            - 資料庫連線
        """
        # 創建未驗證用戶
        user = await create_test_user(
            username="unverifieduser",
            email="unverified_token@example.com",
            is_verified=False,
            password=None
        )
        
        response = await client.post(
            "/auth/get-email-verification-token",
            json={"email": "unverified_token@example.com"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["message"] == "驗證 token 已生成"
    

    @pytest.mark.asyncio
    async def test_get_token_for_verified_no_password_user(
        self, client: AsyncClient, db
    ):
        """
        已驗證但未設置密碼的用戶可以獲取 token
        
        測試描述：
            - 用戶已驗證但未設置密碼（未完成註冊流程）
            - 允許重新獲取驗證 token
        """
        await create_test_user(
            username="verifiednopasstoken",
            email="verified_no_pass_token@example.com",
            is_verified=True,
            password=None
        )
        
        response = await client.post(
            "/auth/get-email-verification-token",
            json={"email": "verified_no_pass_token@example.com"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "token" in data

    
    # ================================================
    # Edge Cases
    # ================================================
    @pytest.mark.asyncio
    async def test_get_token_user_not_found(self, client: AsyncClient, db):
        """
        用戶不存在，返回 404 錯誤
        
        外部資源：
            - 資料庫連線
        """
        response = await client.post(
            "/auth/get-email-verification-token",
            json={"email": "nonexistent@example.com"}
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "code" in data["detail"]
    
    @pytest.mark.asyncio
    async def test_get_token_already_verified_with_password(
        self, client: AsyncClient, db
    ):
        """
        用戶已驗證且已設置密碼，返回 400 錯誤
        
        測試描述：
            - 用戶已完成註冊流程
            - 不應該再獲取驗證 token
        """
        await create_test_user(
            username="fullyregisteredtoken",
            email="fully_registered_token@example.com",
            is_verified=True,
            password="TestPass123"
        )
        
        response = await client.post(
            "/auth/get-email-verification-token",
            json={"email": "fully_registered_token@example.com"}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "code" in data["detail"]
        assert data["detail"]["code"] == "AUTH.USER.ALREADY_VERIFIED"
    
    @pytest.mark.asyncio
    async def test_get_token_invalid_email_format(self, client: AsyncClient):
        """
        Email 格式無效，返回 422 驗證錯誤
        """
        response = await client.post(
            "/auth/get-email-verification-token",
            json={"email": "invalid-email"}
        )
        
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_get_token_missing_email(self, client: AsyncClient):
        """
        缺少必填欄位 email，返回 422 驗證錯誤
        """
        response = await client.post(
            "/auth/get-email-verification-token",
            json={}
        )
        
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_get_token_empty_email(self, client: AsyncClient):
        """
        Email 為空字串，返回 422 驗證錯誤
        """
        response = await client.post(
            "/auth/get-email-verification-token",
            json={"email": ""}
        )
        
        assert response.status_code == 422


class TestOAuthGetUrl:
    """測試: GET /auth/oauth/{provider}/url"""
    
    # ================================================
    # Happy Path
    # ================================================
    @pytest.mark.asyncio
    async def test_get_oauth_url_google_success(self, client: AsyncClient):
        """
        成功獲取 Google OAuth URL
        
        測試描述：
            - 請求 Google OAuth URL
            - 應該返回包含所有必要參數的 URL
        
        Note:
            - 需要在 settings 中配置 OAUTH_PROVIDERS
        """
        response = await client.get(
            "/auth/oauth/google/url",
            params={"redirect_uri": "http://localhost:3000/auth/callback"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "auth_url" in data
        assert "google" in data["auth_url"].lower() or "accounts.google.com" in data["auth_url"]
        assert "client_id" in data["auth_url"]
        assert "redirect_uri" in data["auth_url"]
    
    @pytest.mark.asyncio
    async def test_get_oauth_url_without_redirect_uri(self, client: AsyncClient):
        """
        不提供 redirect_uri，使用默認值
        
        測試描述：
            - 不傳遞 redirect_uri 參數
            - 應該使用後端的默認回調 URL
        """
        response = await client.get("/auth/oauth/google/url")
        
        assert response.status_code == 200
        data = response.json()
        assert "auth_url" in data
        # 應該包含後端的回調 URL
        assert "redirect_uri" in data["auth_url"]
    
    @pytest.mark.asyncio
    async def test_get_oauth_url_facebook_success(self, client: AsyncClient):
        """
        成功獲取 Facebook OAuth URL
        
        測試描述：
            - 請求 Facebook OAuth URL
            - 應該返回包含所有必要參數的 URL
        
        Note:
            - 測試環境已配置 OAuth 環境變數
        """
        response = await client.get(
            "/auth/oauth/facebook/url",
            params={"redirect_uri": "http://localhost:3000/auth/callback"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "auth_url" in data
        assert "facebook" in data["auth_url"].lower() or "www.facebook.com" in data["auth_url"]
        assert "client_id" in data["auth_url"]
        assert "redirect_uri" in data["auth_url"]
    
    @pytest.mark.asyncio
    async def test_get_oauth_url_line_success(self, client: AsyncClient):
        """
        成功獲取 LINE OAuth URL
        
        測試描述：
            - 請求 LINE OAuth URL
            - 應該返回包含所有必要參數的 URL
        
        Note:
            - 測試環境已配置 OAuth 環境變數
        """
        response = await client.get(
            "/auth/oauth/line/url",
            params={"redirect_uri": "http://localhost:3000/auth/callback"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "auth_url" in data
        assert "line" in data["auth_url"].lower() or "access.line.me" in data["auth_url"]
        assert "client_id" in data["auth_url"]
        assert "redirect_uri" in data["auth_url"]
    
    # ================================================
    # Edge Cases
    # ================================================
    @pytest.mark.asyncio
    async def test_get_oauth_url_unsupported_provider(self, client: AsyncClient):
        """
        不支援的 OAuth 提供商，返回 400 錯誤
        
        測試描述：
            - 請求不支援的 provider（如 twitter）
            - 應該返回 400 錯誤
        """
        response = await client.get(
            "/auth/oauth/twitter/url",
            params={"redirect_uri": "http://localhost:3000/auth/callback"}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "code" in data["detail"]
        assert data["detail"]["code"] == "AUTH.OAUTH.PROVIDER_NOT_SUPPORTED"
    
    @pytest.mark.asyncio
    async def test_get_oauth_url_provider_not_configured(self, client: AsyncClient):
        """
        OAuth 提供商未配置，返回 503 錯誤
        
        測試描述：
            - Mock OAUTH_PROVIDERS，設置 client_id 為 None
            - 應該返回 503 未配置錯誤
        """
        with patch("app.api.routes.auth.OAUTH_PROVIDERS") as mock_providers:
            mock_providers.__contains__ = lambda self, key: key == "google"
            mock_providers.__getitem__ = lambda self, key: {
                "client_id": None,  # 未配置
                "client_secret": None,
                "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
                "token_url": "https://oauth2.googleapis.com/token",
                "scope": "openid email profile"
            }
            
            response = await client.get(
                "/auth/oauth/google/url",
                params={"redirect_uri": "http://localhost:3000/auth/callback"}
            )
            
            assert response.status_code == 503
            data = response.json()
            assert "code" in data["detail"]
            assert data["detail"]["code"] == "AUTH.OAUTH.NOT_CONFIGURED"

    @pytest.mark.asyncio
    async def test_get_oauth_url_case_sensitivity(self, client: AsyncClient):
        """
        Provider 大小寫敏感性測試
        
        測試描述：
            - OAUTH_PROVIDERS 的 keys 是小寫，因此大寫不匹配
            - 應該返回 400 錯誤
        """
        response = await client.get(
            "/auth/oauth/GOOGLE/url",
            params={"redirect_uri": "http://localhost:3000/auth/callback"}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["code"] == "AUTH.OAUTH.PROVIDER_NOT_SUPPORTED"

