from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.logging import get_logger, log_error, setup_logging
from settings import settings
from tortoise.contrib.fastapi import register_tortoise


# 初始化日誌系統(fallback to default values)
setup_logging(
    log_level=getattr(settings, "LOG_LEVEL", "INFO"),
    log_to_file=getattr(settings, "LOG_TO_FILE", True),
    log_to_console=getattr(settings, "LOG_TO_CONSOLE", True),
)

logger = get_logger(__name__)

app = FastAPI()

# 設定 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 註冊路由
from app.api.routes.auth import router as auth_router
app.include_router(auth_router)

# 資料庫設定
# register_tortoise 取代 init_db/close_db
register_tortoise(
    app,
    db_url=settings.DATABASE_URL,
    modules={"models": ["app.db.models", "fastapi_admin.models"]},
    generate_schemas=True,
    add_exception_handlers=True,
)

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
