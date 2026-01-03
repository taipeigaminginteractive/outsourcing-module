from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from settings import settings
from app.api.routes.auth import router as auth_router
from app.core import errors
from app.core.logging import get_logger, log_error, setup_logging

# 初始化日誌系統(fallback to default values)
setup_logging(
    log_level=getattr(settings, "LOG_LEVEL", "INFO"),
    log_to_file=getattr(settings, "LOG_TO_FILE", True),
    log_to_console=getattr(settings, "LOG_TO_CONSOLE", True),
)

logger = get_logger(__name__)

app = FastAPI()
app.include_router(auth_router)

# 未預期錯誤處理 (Exception)
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # 對內統一處理未預期錯誤 (避免每個 route 都重寫一段 except Exception + log_error)
    log_error(
        logger=logger,
        error=exc,
        context={
            "method": request.method,
            "path": request.url.path,
            "query": str(request.url.query),
            "client": getattr(request.client, "host", None) if request.client else None,
        },
    )
    # 對外模糊處理 -> Internal Server Error
    return JSONResponse(
        status_code=500,
        content={"detail": {"message": "Internal server error"}},
    )
