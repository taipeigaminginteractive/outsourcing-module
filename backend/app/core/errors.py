# ============================================
# 結構化錯誤系統
# ============================================
# 錯誤碼格式：<DOMAIN>.<RESOURCE>.<REASON>
# 例如：AUTH.USER.DUPLICATE_USERNAME
# ============================================

from fastapi import HTTPException

from app.core.logging import get_logger, log_app_error

logger = get_logger(__name__)

class AppError(Exception):
    """基礎業務錯誤類別(所有業務錯誤都應繼承此類別)
    
    Attributes:
        code: 錯誤碼，格式為 <DOMAIN>.<RESOURCE>.<REASON>
        message: 通用英文 key
        status_code: HTTP 狀態碼 (default 400)
        detail: 結構化資訊，包含額外的錯誤詳情
    """
    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int = 400,
        detail: dict | None = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.detail = detail or {}
        super().__init__(message)

def app_error_to_http_exception(
    error: AppError,
    *,
    include_fields: list[str] | None = None,
) -> HTTPException:
    """將 AppError 轉換為 HTTPException 並隱藏部分內部資訊
    
    Args:
        error: AppError 實例
        include_fields: 要包含在響應中的 detail 字段列表
            - None: 不包含任何 detail(默認，避免洩露內部資訊)
            - ["field1", "field2"]: 只包含指定的字段
    
    Returns:
        HTTPException: 包含結構化錯誤資訊的 HTTP 異常
            - detail: 結構化錯誤資訊 包含 code 和 message
            - 根據 include_fields 決定是否包含 detail
    """
    # 記錄錯誤日誌
    log_app_error(
        logger=logger,
        error=error,
        context={
            "include_fields": include_fields,
            "function": "app_error_to_http_exception",
        }
    )
    
    response_detail = {
        "code": error.code,
        "message": error.message
    }
    
    # 指定要包含的字段，添加到 detail
    if include_fields is not None and include_fields:
        filtered_detail = {
            key: value
            for key, value in error.detail.items()
            if key in include_fields
        }
        if filtered_detail:
            response_detail["detail"] = filtered_detail
    
    return HTTPException(
        status_code=error.status_code,
        detail=response_detail
    )


class UserAlreadyExistsError(AppError):
    """用戶User已存在錯誤 ("username" 或 "email" 衝突)
    
    Attributes:
        field: 衝突的字段名稱 ("username" 或 "email")
    
    """
    def __init__(self, field: str = "credential"):
        super().__init__(
            code="AUTH.USER.DUPLICATE_CREDENTIAL",
            message="User already exists",
            status_code=409,  # 409 Conflict
            detail={"field": field},
        )



