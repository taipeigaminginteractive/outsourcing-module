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

from settings import settings

# logging使用時 確保日誌目錄存在
settings.LOG_DIR.mkdir(exist_ok=True, parents=True)

# LogRecord 的標準欄位(避免把內建欄位也當成 extra 輸出)
_STANDARD_LOGRECORD_ATTRS = set(
    logging.LogRecord(
        name="",
        level=0,
        pathname="",
        lineno=0,
        msg="",
        args=(),
        exc_info=None,
    ).__dict__.keys()
)

class StructuredFormatter(logging.Formatter):
    """結構化日誌格式化器
    
    範例輸出格式:
    
    INFO/ WARNING 基礎格式 包含 extra 欄位:
        [2024-01-01 12:00:00] INFO     app.api.routes.auth:register:51 - 用戶註冊請求 | username=testuser | email=test@example.com
        [2024-01-01 12:00:00] WARNING  app.api.routes.auth:register:70 - 用戶已存在錯誤 | code=AUTH.USER.DUPLICATE_CREDENTIAL | conflict_field=email | email=test@example.com | username=testuser

    ERROR 包含錯誤碼和狀態碼( 使用 detail 欄位):
        [2024-01-01 12:00:00] ERROR    app.core.errors:app_error_to_http_exception:65 - UserAlreadyExistsError: User already exists | code=AUTH.USER.DUPLICATE_CREDENTIAL | status=409 | detail={'field': 'username'}
    """
    
    def format(self, record: logging.LogRecord) -> str:
        # 自行補上 record.asctime，避免被覆蓋而不存在
        record.asctime = self.formatTime(record, self.datefmt)

        # 基礎格式
        log_format = (
            f"[{record.asctime}] "
            f"{record.levelname:8s} "
            f"{record.name}:{record.funcName}:{record.lineno} - "
            f"{record.getMessage()}"
        )
        
        # 添加額外資訊 (for error log)
        if hasattr(record, "error_code"):
            log_format += f" | code={record.error_code}"
        if hasattr(record, "status_code"):
            log_format += f" | status={record.status_code}"
        if hasattr(record, "detail"):
            log_format += f" | detail={record.detail}"

        # 輸出所有自定義 extra 欄位（排除標準 LogRecord 欄位與已特別處理的欄位）
        handled_keys = {"error_code", "status_code", "detail", "asctime"}
        extra_keys = [
            key
            for key in record.__dict__.keys()
            if key not in _STANDARD_LOGRECORD_ATTRS and key not in handled_keys
        ]
        for key in sorted(extra_keys):
            try:
                value = record.__dict__.get(key)
                log_format += f" | {key}={value}"
            except Exception:
                # 避免 __str__ / __repr__ 異常導致 logging 本身失敗
                log_format += f" | {key}=<unprintable>"
        
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
        file_handler = logging.FileHandler(settings.LOG_FILE, encoding="utf-8")
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(StructuredFormatter())
        root_logger.addHandler(file_handler)
        
        # 錯誤日誌文件處理器 - 只記錄 ERROR 及以上級別
        error_file_handler = logging.FileHandler(settings.ERROR_LOG_FILE, encoding="utf-8")
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
    """記錄錯誤日誌 封裝 Logger.error() 方法
    
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
    """記錄 AppError 錯誤日誌 封裝 log_error() 方法
    
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

