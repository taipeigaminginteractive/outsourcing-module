from typing import Optional

from tortoise.exceptions import DoesNotExist, IntegrityError
from tortoise.expressions import Q

from app.core.errors import UserAlreadyExistsError
from app.core.logging import get_logger, log_error
from app.db.models import User
from app.schemas import user_schema
from app.utils import pwd_utils

logger = get_logger(__name__)

async def create_user(user_data: user_schema.UserCreateDTO) -> User:
    """創建新用戶(信箱註冊時不設置密碼，需要先驗證郵箱)
    
    Raises:
        UserAlreadyExistsError: 當用戶名或郵箱已存在時
    """
    try:
        # 信箱註冊時不設置密碼，hashed_password 為 None
        hashed_password = None
        if user_data.password:
            hashed_password = pwd_utils.get_password_hash(user_data.password)
        
        user = await User.create(
            username=user_data.username,
            email=user_data.email,
            hashed_password=hashed_password,
            is_verified=False  # 註冊時未驗證
        )
        return user
    except IntegrityError as e:
        # 記錄資料庫完整性錯誤
        log_error(
            logger=logger,
            error=e,
            context={
                "username": user_data.username,
                "email": user_data.email,
                "function": "create_user",
            }
        )
        
        # 檢測用戶名或郵箱是否已存在
        existing_user = await User.filter(
            Q(username=user_data.username) | Q(email=user_data.email)
        ).first()
        
        if existing_user:
            field = "credential"  # 默認值
            if existing_user.username == user_data.username:
                field = "username"
            elif existing_user.email == user_data.email:
                field = "email"
            
            # 記錄用戶已存在錯誤
            error = UserAlreadyExistsError(field)
            log_error(
                logger=logger,
                error=error,
                error_code=error.code,
                status_code=error.status_code,
                detail=error.detail,
                context={
                    "username": user_data.username,
                    "email": user_data.email,
                    "conflict_field": field,
                }
            )
            raise error
        
        # 如果無法確定(理論上不應該發生)，使用通用錯誤碼
        error = UserAlreadyExistsError("credential")
        log_error(
            logger=logger,
            error=error,
            error_code=error.code,
            status_code=error.status_code,
            detail=error.detail,
            context={
                "username": user_data.username,
                "email": user_data.email,
                "note": "無法確定衝突字段",
            }
        )
        raise error


async def get_user_by_username(username: str) -> Optional[User]:
    """根據用戶名獲取用戶"""
    try:
        return await User.get(username=username)
    except DoesNotExist:
        return None

async def get_user_by_email(email: str) -> Optional[User]:
    """根據郵箱獲取用戶"""
    try:
        return await User.get(email=email)
    except DoesNotExist:
        return None