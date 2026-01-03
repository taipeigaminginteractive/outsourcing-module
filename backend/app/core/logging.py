# ============================================
# 日誌系統
# ============================================
# 提供結構化日誌記錄功能
# 支援文件和控制台輸出
# ============================================

import logging
import sys
from pathlib import Path
from typing import Optional

# 日誌目錄
LOG_DIR = Path(__file__).resolve().parent.parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

# 日誌文件路徑
LOG_FILE = LOG_DIR / "app.log"
ERROR_LOG_FILE = LOG_DIR / "error.log"


class StructuredFormatter(logging.Formatter):
    """結構化日誌格式化器
    
    範例輸出格式:
    
    INFO 基礎格式:
        [2024-01-01 12:00:00] INFO     app.api.routes.auth:register:51 - 用戶註冊請求: username=testuser, email=test@example.com
    
    (ERROR)包含錯誤碼和狀態碼:
        [2024-01-01 12:00:00] ERROR    app.core.errors:app_error_to_http_exception:65 - UserAlreadyExistsError: User already exists | code=AUTH.USER.DUPLICATE_CREDENTIAL | status=409 | detail={'field': 'username'}
    
    (WARNING)包含上下文資訊:
        [2024-01-01 12:00:00] WARNING  app.api.routes.auth:register:70 - 用戶已存在錯誤: field=email, username=testuser, email=test@example.com | context={'function': 'register', 'error_code': 'AUTH.USER.DUPLICATE_CREDENTIAL', 'conflict_field': 'email'}
    """
    
    def format(self, record: logging.LogRecord) -> str:
        # 基礎格式（使用預設的 asctime）
        log_format = (
            f"[{record.asctime}] "
            f"{record.levelname:8s} "
            f"{record.name}:{record.funcName}:{record.lineno} - "
            f"{record.getMessage()}"
        )
        
        # 添加額外資訊
        if hasattr(record, "error_code"):
            log_format += f" | code={record.error_code}"
        if hasattr(record, "status_code"):
            log_format += f" | status={record.status_code}"
        if hasattr(record, "detail"):
            log_format += f" | detail={record.detail}"
        
        return log_format


def setup_logging(
    log_level: str = "INFO",
    log_to_file: bool = True,
    log_to_console: bool = True,
) -> None:
    """設置日誌系統
    
    Args:
        log_level: 日誌級別 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_to_file: 是否寫入文件
        log_to_console: 是否輸出到控制台
    """
    # 獲取根日誌記錄器
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # 清除現有的處理器
    root_logger.handlers.clear()
    
    # 文件處理器 - 所有日誌
    if log_to_file:
        file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(StructuredFormatter())
        root_logger.addHandler(file_handler)
        
        # 錯誤日誌文件處理器 - 只記錄 ERROR 及以上級別
        error_file_handler = logging.FileHandler(ERROR_LOG_FILE, encoding="utf-8")
        error_file_handler.setLevel(logging.ERROR)
        error_file_handler.setFormatter(StructuredFormatter())
        root_logger.addHandler(error_file_handler)
    
    # 控制台處理器
    if log_to_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(getattr(logging, log_level.upper()))
        console_handler.setFormatter(StructuredFormatter())
        root_logger.addHandler(console_handler)


def get_logger(name: str) -> logging.Logger:
    """獲取日誌記錄器
    
    Args:
        name: 日誌記錄器名稱(通常是 __name__)
    
    Returns:
        logging.Logger: 日誌記錄器實例
    """
    return logging.getLogger(name)


def log_error(
    logger: logging.Logger,
    error: Exception,
    error_code: Optional[str] = None,
    status_code: Optional[int] = None,
    detail: Optional[dict] = None,
    context: Optional[dict] = None,
) -> None:
    """記錄錯誤日誌
    
    Args:
        logger: 日誌記錄器
        error: 異常實例
        error_code: 錯誤碼
        status_code: HTTP 狀態碼
        detail: 錯誤詳情
        context: 額外上下文資訊
    """
    extra = {}
    if error_code:
        extra["error_code"] = error_code
    if status_code:
        extra["status_code"] = status_code
    if detail:
        extra["detail"] = detail
    
    error_msg = f"{type(error).__name__}: {str(error)}"
    if context:
        error_msg += f" | context={context}"
    
    logger.error(error_msg, exc_info=True, extra=extra)


def log_app_error(
    logger: logging.Logger,
    error: "AppError",  # type: ignore
    context: Optional[dict] = None,
) -> None:
    """記錄 AppError 錯誤日誌
    
    Args:
        logger: 日誌記錄器
        error: AppError 實例
        context: 額外上下文資訊
    """
    from app.core.errors import AppError
    
    if isinstance(error, AppError):
        log_error(
            logger=logger,
            error=error,
            error_code=error.code,
            status_code=error.status_code,
            detail=error.detail,
            context=context,
        )
    else:
        log_error(logger=logger, error=error, context=context)

