# ============================================
# Import 順序規範(遵循 PEP 8 / isort): auth.py示範
# ============================================
# 1. 標準庫(Python 內建模組)
#    例如：typing, datetime, os, sys
#
# 2. 第三方庫(透過 pip 安裝的套件)
#    例如：fastapi, pydantic, tortoise-orm
#
# 3. 本地應用(專案內部的模組)
#    例如：app.config, app.schemas, app.services
#
# NOTICE：
# - 每個分組之間用空行分隔
# - 同一分組內按字母順序排列(alphabetical order)
# - 同一模組的多個 import 可以合併在同一行
# ============================================

import secrets
from urllib.parse import urlencode

from app.core import errors, token_auth_logic
from app.core.logging import get_logger
from app.schemas import user_schema
from app.services import user_service
from app.utils import mailer
from fastapi import APIRouter, HTTPException, status
from settings import settings

logger = get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# settings 的設定值
OAUTH_PROVIDERS = settings.OAUTH_PROVIDERS
BACKEND_URL = settings.BACKEND_URL
FRONTEND_URL = settings.FRONTEND_URL

# 設定 JWT token 過期時間
EMAIL_VERIFICATION_EXPIRE_MINUTES = settings.EMAIL_VERIFICATION_EXPIRE_MINUTES # 24 小時 (信箱驗證)

#===============================================
# 註冊路由
#===============================================

@router.post("/register", response_model=user_schema.UserResponse)
async def register(user_data: user_schema.AuthRegisterRequest):
    """註冊信箱(先驗證郵箱，驗證成功後再設置密碼)
    
    Raises:
        HTTPException:
            - 422: Pydantic validation error (FastAPI自動驗證，沒有message和code，完整detail 為 ValidationItem[])
            - 409: User already exists (AUTH.USER.DUPLICATE_CREDENTIAL)

    Note:
        - 若 email 已存在但用戶尚未完成註冊（未驗證或已驗證但未設置密碼），
        會重新發送驗證信並回傳該用戶資訊（不會拋出 409）
    """
    try:
        create_dto = user_schema.UserCreateDTO.from_request(user_data)
                
        # 存入DB時 檢驗帳號是否已存在
        user = await user_service.create_user(create_dto) 
        
        # 註冊後自動發送驗證信
        verification_token, _ = token_auth_logic.create_token(
            user.username,
            "email_verification",
            EMAIL_VERIFICATION_EXPIRE_MINUTES
        )
        
        # 發送驗證信（失敗時會自動拋出 EmailSendError）
        await mailer.send_verification_email(
            to_email=user.email,
            username=user.username,
            verification_token=verification_token
        )
        
        logger.info(
            "用戶註冊成功並已發送驗證信",
            extra={"user_id": user.id, "username": user.username}
        )
        
        return user_schema.UserResponse.model_validate(user)
    except errors.EmailSendError as e:
        # 郵件發送失敗，轉換為 HTTP 異常
        raise errors.app_error_to_http_exception(e)
    except errors.UserAlreadyExistsError as e:
        # @errorhandler：
        # 從已被註冊的帳戶中 挑出未完成註冊流程的用戶 -> 重新發送驗證信
        # 其他已完全註冊的用戶 -> 返回結構性錯誤

        field = e.detail.get("field", "")
        
        logger.warning(
            "用戶已存在錯誤",
            extra={
                "error_code": e.code,
                "conflict_field": field,
                "username": user_data.username,
                "email": user_data.email,
            },
        )
        
        # 只有郵箱衝突時才檢查是否可以重新發送驗證信
        if field == "email":
            existing_user = await user_service.get_user_by_email(user_data.email)

            if existing_user:
                # 用戶已存在但未完成註冊流程(未驗證或已驗證但未設置密碼)
                if not existing_user.is_verified or (existing_user.is_verified and not existing_user.hashed_password):

                    
                    verification_token, _ = token_auth_logic.create_token(
                        existing_user.username,
                        "email_verification",
                        EMAIL_VERIFICATION_EXPIRE_MINUTES
                    )
                    
                    # 發送驗證信（失敗時會自動拋出 EmailSendError）
                    await mailer.send_verification_email(
                        to_email=existing_user.email,
                        username=existing_user.username,
                        verification_token=verification_token
                    )

                    logger.info(
                        "重新發送驗證信給未完成註冊的用戶",
                        extra={
                            "user_id": existing_user.id,
                            "username": existing_user.username,
                            "is_verified": existing_user.is_verified,
                            "has_password": bool(existing_user.hashed_password),
                        }
                    )
                    
                    # 返回用戶信息(但不透露這是已存在的用戶，保持安全性)
                    return user_schema.UserResponse.model_validate(existing_user)
        
        # 用戶名已存在，或郵箱已存在且用戶已完全註冊，返回結構化錯誤
        raise errors.app_error_to_http_exception(e)

@router.post("/get-email-verification-token", response_model=user_schema.GetEmailVerificationTokenResponse)
async def get_email_verification_token(
    token_data: user_schema.GetEmailVerificationTokenRequest
):
    """獲取郵箱驗證 token（避免 email 暴露在 URL）
    
    Raises:
        HTTPException:
            - 422: Pydantic validation error (FastAPI自動驗證，沒有message和code，完整detail 為 ValidationItem[])
            - 404: User not found (AUTH.USER.NOT_FOUND)
            - 400: Email already verified (AUTH.USER.ALREADY_VERIFIED)
            - 500: Failed to generate verification token (AUTH.TOKEN.GENERATION_FAILED)

    Note:
        - 若用戶已驗證但未設置密碼，允許重新獲取驗證 token
    """
    try:
        email = token_data.email
        
        # 查找用戶
        user = await user_service.get_user_by_email(email)
        if not user:
            # 為了安全，不透露用戶是否存在
            raise errors.app_error_to_http_exception(
                errors.UserNotFoundError()
            )
        
        # 檢查是否已驗證且已設置密碼（如果已驗證但未設置密碼，允許重新獲取驗證token）
        if user.is_verified and user.hashed_password:
            raise errors.app_error_to_http_exception(
                errors.UserAlreadyVerifiedError()
            )
        
        # 生成用於獲取 email 的 token（有效期 30 分鐘）
        email_token, _ = token_auth_logic.create_token(
            user.username,
            "email_verification_token",  # 特殊類型，用於獲取 email
            30  # 30 分鐘有效期
        )
        
        return user_schema.GetEmailVerificationTokenResponse(
            token=email_token,
            message="驗證 token 已生成"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "獲取驗證 token 時發生未預期錯誤",
            extra={"email": email, "error": str(e)},
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "AUTH.TOKEN.GENERATION_FAILED",
                "message": "Failed to generate verification token"
            }
        )


@router.get("/oauth/{provider}/url")
async def get_oauth_url(provider: str, redirect_uri: str = None):
    """獲取 OAuth 授權 URL（第一步：將用戶導向 provider 的 OAuth 授權頁面）
    
    Raises:
        HTTPException:
            - 400: OAuth provider not supported (AUTH.OAUTH.PROVIDER_NOT_SUPPORTED)
            - 503: OAuth service unavailable (AUTH.OAUTH.NOT_CONFIGURED)

    Note:
        - 如果沒有提供 redirect_uri，將使用後端的回調 URL
        - 返回的 auth_url 包含所有必要的 OAuth 參數
    """
    if provider not in OAUTH_PROVIDERS:
        raise errors.app_error_to_http_exception(
            errors.OAuthProviderNotSupportedError(provider)
        )
    
    config = OAUTH_PROVIDERS[provider]
    if not config["client_id"]:
        raise errors.app_error_to_http_exception(
            errors.OAuthNotConfiguredError(provider),
            include_fields=["provider"]
        )
    
    # 如果沒有提供 redirect_uri，使用後端的回調 URL (一般不用)
    if not redirect_uri:
        redirect_uri = f"{BACKEND_URL}/auth/oauth/{provider}/callback"
    
    # redirect_uri 也作為參數 拼接到 auth_url 後面
    # 用途: 在 provider 完成授權後 重定向到 指定的 URL
    params = {
        "client_id": config["client_id"],
        "redirect_uri": redirect_uri,
        "scope": config["scope"],
        "response_type": "code",
        "state": f"{provider}_{secrets.token_hex(16)}"
    }
    
    # 所有參數 都拼接到 auth_url 後面 形成完整的 OAuth 授權 URL
    auth_url = f"{config['auth_url']}?{urlencode(params)}"
    return user_schema.OAuthAuthUrlResponse(auth_url=auth_url)