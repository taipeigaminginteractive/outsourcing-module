"""
資料庫管理模組 - 集中管理 Tortoise ORM 初始化
"""
from tortoise import Tortoise
from settings import settings


# 資料庫配置
DB_CONFIG = {
    "db_url": settings.DATABASE_URL,
    "modules": {"models": ["app.db.models", "fastapi_admin.models"]},
}

# 僅模型配置（用於 Celery 任務）
DB_MODELS_CONFIG = {
    "db_url": settings.DATABASE_URL,
    "modules": {"models": ["app.db.models"]},
}


async def init_db(generate_schemas: bool = False, add_exception_handlers: bool = False):
    """
    初始化資料庫連接
    
    Args:
        generate_schemas: 是否生成資料庫 schema
        add_exception_handlers: 是否添加異常處理器
    """
    await Tortoise.init(**DB_CONFIG)
    if generate_schemas:
        await Tortoise.generate_schemas()


async def init_db_models_only():
    """
    僅初始化模型（用於 Celery 任務等場景）
    """
    await Tortoise.init(**DB_MODELS_CONFIG)


async def close_db():
    """關閉資料庫連接"""
    await Tortoise.close_connections()

async def get_db():
    """獲取資料庫連接（用於依賴注入）"""
    return Tortoise.get_connection("default")

async def health_check():
    """資料庫健康檢查"""
    try:
        # 嘗試執行一個簡單的查詢來檢查連接
        conn = Tortoise.get_connection("default")
        await conn.execute_query("SELECT 1")
        return True
    except Exception:
        return False
