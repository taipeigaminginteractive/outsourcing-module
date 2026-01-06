"""
Pytest 配置文件 - 全局測試配置和 fixtures
用於跳過初始化過程 (如 RAGManager 等) 和 做 mock 操作 (如 Redis 等)
此外也能在test檔中做環境變數覆蓋

"""
import pytest
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from tortoise import Tortoise


# 設置測試環境（必須在導入main之前） 
import os
os.environ["ENV"] = "testing"

from main import app
from settings import settings


# 配置測試資料庫（使用 SQLite 內存資料庫）
TEST_DATABASE_URL = settings.TEST_DATABASE_URL

# ================================================
# Database 資料庫
# ================================================

@pytest.fixture(scope="function")
async def db():
    """初始化測試資料庫(tortoise ORM 專用)"""
    await Tortoise.init(
        db_url=TEST_DATABASE_URL,
        modules={"models": ["app.db.models"]},
    )
    await Tortoise.generate_schemas()
    yield
    # 清理連線；若要徹底清庫，視需求 drop
    await Tortoise.close_connections()


# ================================================
# 模擬 Client 客戶端
# ================================================

@pytest.fixture
async def client(db) -> AsyncGenerator:
    """創建異步測試客戶端"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

