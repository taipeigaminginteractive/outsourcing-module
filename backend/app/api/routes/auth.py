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

from fastapi import APIRouter, status

from app.core import token_auth_logic
from app.core import errors
from app.core.logging import get_logger
from app.schemas import user_schema
from app.services import user_service
from app.utils import mailer
from settings import settings

logger = get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])
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
            - 409: 當用戶名已存在時
            - 409: 當郵箱已存在且用戶已完全註冊(已驗證且已設置密碼)時
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
        
        # 發送驗證信
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
