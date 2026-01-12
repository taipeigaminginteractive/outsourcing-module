# Platform 前後端管理 Makefile
# 作者: Platform Team
# 版本: 2.0.0

.PHONY: help build up down logs shell test clean status restart \
	dev-services-up dev-services-down \
	test-services-up test-services-down mailhog-open \
	backend-up backend-down backend-logs backend-shell backend-restart backend-status \
	backend-test backend-test-unit backend-test-integ backend-test-cov backend-test-watch backend-test-auth \
	backend-lint backend-format backend-lint-fix \
	frontend-dev frontend-build frontend-start frontend-lint \
	frontend-test frontend-test-run frontend-test-ui frontend-test-cov \
	frontend-test-e2e frontend-test-e2e-ui frontend-test-e2e-debug frontend-install \
	ci-services-up ci-services-down ci-wait-db \
	ci-backend-setup ci-backend-lint ci-backend-test \
	ci-frontend-setup ci-frontend-lint ci-frontend-test ci-frontend-test-e2e \
	ci-test-all

# 默認目標
.DEFAULT_GOAL := help

# 顏色定義
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m

# 項目配置
PROJECT_NAME := platform
COMPOSE_FILE := infra/docker-compose.yml
COMPOSE_DEV_FILE := infra/docker-compose.dev.yml

# 幫助信息
help: ## 顯示此幫助信息
	@echo "$(BLUE)Platform Frontend/Backend Management Commands:$(NC)"
	@echo ""
	@echo "$(GREEN)Development Environment:$(NC)"
	@echo "  make dev-up     - Start development environment (Docker: API/DB/Redis/Celery + Frontend)"
	@echo "  make dev-down   - Stop development environment (synchronously stop frontend and backend)"
	@echo "  make dev-logs   - View development environment logs"
	@echo "  make dev-shell  - Enter development environment container"
	@echo "  make dev-restart - Restart development environment"
	@echo ""
	@echo "$(GREEN)Production Environment:$(NC)"
	@echo "  make prod-up    - Start production environment (Docker: API/DB/Redis/Celery + Frontend)"
	@echo "  make prod-down  - Stop production environment (synchronously stop frontend and backend)"
	@echo "  make prod-logs  - View production environment logs"
	@echo "  make prod-shell - Enter production environment container"
	@echo "  make prod-restart - Restart production environment"
	@echo ""
	@echo "$(GREEN)Development External Resources (PostgreSQL/Redis, etc.):$(NC)"
	@echo "  make dev-services-up   - Start Postgres/Redis (Docker) for local frontend/backend use"
	@echo "  make dev-services-down - Stop Postgres/Redis containers"
	@echo ""
	@echo "$(GREEN)Test Support Resources (MailHog, etc.):$(NC)"
	@echo "  make test-services-up  - Start MailHog and other test support services"
	@echo "  make test-services-down- Stop MailHog and other test support services"
	@echo "  make mailhog-open      - Open MailHog Web UI in browser"
	@echo ""
	@echo "$(GREEN)CI/CD Commands:$(NC)"
	@echo "  make ci-services-up       - Start CI test services (Postgres/Redis)"
	@echo "  make ci-services-down     - Stop CI test services"
	@echo "  make ci-wait-db           - Wait for Postgres to be ready"
	@echo "  make ci-backend-setup     - Setup backend environment"
	@echo "  make ci-backend-lint      - Run backend lint checks"
	@echo "  make ci-backend-test      - Run backend tests"
	@echo "  make ci-frontend-setup    - Setup frontend environment"
	@echo "  make ci-frontend-lint     - Run frontend lint checks"
	@echo "  make ci-frontend-test     - Run frontend unit tests"
	@echo "  make ci-frontend-test-e2e - Run frontend E2E tests"
	@echo "  make ci-test-all          - Run complete CI test pipeline"
	@echo ""
	@echo "$(GREEN)General Commands:$(NC)"
	@echo "  make build      - Build all images"
	@echo "  make status     - View service status"
	@echo "  make test       - Run tests"
	@echo "  make clean      - Clean Docker resources"
	@echo "  make logs       - View all service logs"
	@echo "  make shell      - Enter API container"
	@echo "  make restart    - Restart all services"
	@echo ""
	@echo "$(YELLOW)Monitoring - Database Commands:$(NC)"
	@echo "  make db-shell   - Enter PostgreSQL container"
	@echo "  make db-backup  - Backup database"
	@echo "  make db-restore - Restore database"
	@echo ""
	@echo "$(YELLOW)Monitoring - Other Resources Commands:$(NC)"
	@echo "  make flower     - Open Celery Flower"
	@echo "  make redis-cli  - Enter Redis CLI"
	@echo ""
	@echo "$(GREEN)Backend Commands:$(NC)"
	@echo "  make backend-dev        - Start FastAPI development server (using local environment)"
	@echo "  make backend-worker     - Start Celery Worker (using local environment)"
	@echo "  make backend-up         - Start backend in Detached mode (API/DB/Redis/Celery)"
	@echo "  make backend-down       - Stop backend containers"
	@echo "  make backend-logs       - Track API/Celery logs"
	@echo "  make backend-shell      - Enter backend API container"
	@echo "  make backend-restart    - Restart backend containers"
	@echo "  make backend-status     - View backend container status"
	@echo "  make backend-lint       - Run backend code linting (ruff + black + mypy)"
	@echo "  make backend-format     - Format backend code (ruff format + black)"
	@echo "  make backend-lint-fix   - Auto-fix backend linting issues (ruff fix)"
	@echo "  make backend-test       - Run backend unit tests (using local environment)"
	@echo "  make backend-test-unit  - Run backend unit tests only"
	@echo "  make backend-test-integ - Run backend integration tests only"
	@echo "  make backend-test-cov   - Generate backend test coverage report"
	@echo "  make backend-test-watch - Run backend tests in watch mode"
	@echo "  make backend-test-auth  - Run auth routes tests only"
	@echo ""
	@echo "$(GREEN)Frontend Commands:$(NC)"
	@echo "  make frontend-dev         - Start frontend development server (using local environment)"
	@echo "  make frontend-build       - Build frontend production version"
	@echo "  make frontend-start       - Start frontend production server"
	@echo "  make frontend-lint        - Run frontend code linting"
	@echo "  make frontend-test        - Run frontend unit tests (watch mode)"
	@echo "  make frontend-test-run    - Run frontend unit tests (single run)"
	@echo "  make frontend-test-ui     - Open frontend test UI"
	@echo "  make frontend-test-cov    - Generate frontend test coverage"
	@echo "  make frontend-test-e2e    - Run frontend E2E tests"
	@echo "  make frontend-test-e2e-ui - Open frontend E2E test UI (可選參數: FILES=\"file1.ts\" 或 GREP=\"測試名稱\")"
	@echo "  make frontend-test-e2e-debug - Run specified E2E test in debug mode (requires GREP=\"test name\")"
	@echo "  make frontend-install     - Install frontend dependencies"


# ===========================================
# 開發環境命令
# ===========================================

dev-up: ## 啟動開發環境
	@echo "$(BLUE)🚀 Starting development environment...$(NC)"
	@chmod +x infra/scripts/start.sh
	@./infra/scripts/start.sh dev

dev-down: ## 停止開發環境
	@echo "$(BLUE)🛑 Stopping development environment...$(NC)"
	@chmod +x infra/scripts/stop.sh
	@./infra/scripts/stop.sh dev

dev-logs: ## 查看開發環境日誌
	@echo "$(BLUE)📋 Viewing development environment logs...$(NC)"
	docker-compose -f $(COMPOSE_DEV_FILE) logs -f

dev-shell: ## 進入開發環境容器
	@echo "$(BLUE)🐚 Entering development environment container...$(NC)"
	docker-compose -f $(COMPOSE_DEV_FILE) exec api bash

dev-restart: ## 重啟開發環境
	@echo "$(BLUE)🔄 Restarting development environment...$(NC)"
	docker-compose -f $(COMPOSE_DEV_FILE) restart

# ===========================================
# 生產環境命令
# ===========================================

prod-up: ## 啟動生產環境
	@echo "$(BLUE)🏭 Starting production environment...$(NC)"
	@chmod +x infra/scripts/start.sh
	@./infra/scripts/start.sh prod

prod-down: ## 停止生產環境
	@echo "$(BLUE)🛑 Stopping production environment...$(NC)"
	@chmod +x infra/scripts/stop.sh
	@./infra/scripts/stop.sh prod

prod-logs: ## 查看生產環境日誌
	@echo "$(BLUE)📋 Viewing production environment logs...$(NC)"
	docker-compose -f $(COMPOSE_FILE) logs -f

prod-shell: ## 進入生產環境容器
	@echo "$(BLUE)🐚 Entering production environment container...$(NC)"
	docker-compose -f $(COMPOSE_FILE) exec api bash

prod-restart: ## 重啟生產環境
	@echo "$(BLUE)🔄 Restarting production environment...$(NC)"
	docker-compose -f $(COMPOSE_FILE) restart

# ===========================================
# 開發外部資源 (PostgreSQL/Redis等)
# ===========================================

dev-services-up: ## 以 Docker 啟動 Postgres/Redis 供本機前後端使用
	@echo "$(BLUE)🔌 Starting development external resources (Postgres/Redis)...$(NC)"
	docker-compose -f $(COMPOSE_DEV_FILE) up -d postgres redis

dev-services-down: ## 停止 Postgres/Redis 容器
	@echo "$(BLUE)🔌 Stopping development external resources (Postgres/Redis)...$(NC)"
	docker-compose -f $(COMPOSE_DEV_FILE) stop postgres redis

# ===========================================
# 測試輔助資源 (MailHog 等)
# ===========================================

test-services-up: ## 啟動測試輔助資源 (MailHog 等)
	@echo "$(BLUE)🔌 Starting test support resources (MailHog)...$(NC)"
	docker-compose -f $(COMPOSE_DEV_FILE) up -d mailhog

test-services-down: ## 停止測試輔助資源 (MailHog 等)
	@echo "$(BLUE)🔌 Stopping test support resources (MailHog)...$(NC)"
	docker-compose -f $(COMPOSE_DEV_FILE) stop mailhog

mailhog-open: ## 在瀏覽器中打開 MailHog Web UI (http://localhost:8025)
	@echo "$(BLUE)📬 Opening MailHog Web UI...$(NC)"
	@open http://localhost:8025 || xdg-open http://localhost:8025 || echo "Please manually open http://localhost:8025"

# ===========================================
# CI/CD 命令
# ===========================================

CI_COMPOSE_FILE := infra/docker-compose.ci.yml

ci-services-up: ## 啟動 CI 測試所需的服務 (Postgres/Redis)
	@echo "$(BLUE)🔌 Starting CI services (Postgres/Redis)...$(NC)"
	docker compose -f $(CI_COMPOSE_FILE) up -d postgres redis

ci-services-down: ## 停止 CI 測試服務
	@echo "$(BLUE)🔌 Stopping CI services...$(NC)"
	docker compose -f $(CI_COMPOSE_FILE) down -v

ci-wait-db: ## 等待 Postgres 資料庫就緒
	@echo "$(BLUE)⏳ Waiting for Postgres to be ready...$(NC)"
	@timeout=60; \
	elapsed=0; \
	until docker exec platform_postgres_dev pg_isready -U platform_user 2>/dev/null || [ $$elapsed -ge $$timeout ]; do \
		echo "Waiting for postgres... ($$elapsed/$$timeout seconds)"; \
		sleep 2; \
		elapsed=$$((elapsed + 2)); \
	done; \
	if [ $$elapsed -ge $$timeout ]; then \
		echo "$(RED)❌ Timeout waiting for Postgres$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)✅ Postgres is ready!$(NC)"

ci-backend-setup: ## CI: 設置後端環境
	@echo "$(BLUE)🔧 Setting up backend environment...$(NC)"
	cd backend && python -m venv .venv
	cd backend && . .venv/bin/activate && pip install -r requirements.txt
	@echo "$(GREEN)✅ Backend setup completed!$(NC)"

ci-backend-lint: ## CI: 執行後端 lint 檢查
	@echo "$(BLUE)🔍 Running backend lint checks...$(NC)"
	cd backend && . .venv/bin/activate && \
	if [ -n "$$(find . -name '*.py' -not -path './.venv/*' -not -path './venv/*')" ]; then \
		echo "Running Ruff check..." && ruff check . && \
		echo "Running Black format check..." && black --check . && \
		echo "Running MyPy type check..." && mypy .; \
	else \
		echo "No Python files found, skipping lint checks"; \
	fi
	@echo "$(GREEN)✅ Backend lint checks passed!$(NC)"

ci-backend-test: ## CI: 執行後端測試
	@echo "$(BLUE)🧪 Running backend tests...$(NC)"
	cd backend && . .venv/bin/activate && pytest
	@echo "$(GREEN)✅ Backend tests passed!$(NC)"

ci-frontend-setup: ## CI: 設置前端環境
	@echo "$(BLUE)🔧 Setting up frontend environment...$(NC)"
	cd frontend && npm ci
	@echo "$(GREEN)✅ Frontend setup completed!$(NC)"

ci-frontend-lint: ## CI: 執行前端 lint 檢查
	@echo "$(BLUE)🔍 Running frontend lint checks...$(NC)"
	cd frontend && npm run lint
	@echo "$(GREEN)✅ Frontend lint checks passed!$(NC)"

ci-frontend-test: ## CI: 執行前端單元測試
	@echo "$(BLUE)🧪 Running frontend unit tests...$(NC)"
	cd frontend && npm run test:run
	@echo "$(GREEN)✅ Frontend unit tests passed!$(NC)"

ci-frontend-test-e2e: ## CI: 執行前端 E2E 測試
	@echo "$(BLUE)🎭 Running frontend E2E tests...$(NC)"
	cd frontend && npx playwright install --with-deps
	cd frontend && npx playwright test
	@echo "$(GREEN)✅ Frontend E2E tests passed!$(NC)"

ci-test-all: ci-services-up ci-wait-db ci-backend-setup ci-backend-lint ci-backend-test ci-frontend-setup ci-frontend-lint ci-frontend-test ci-frontend-test-e2e ci-services-down ## CI: 執行所有測試流程
	@echo "$(GREEN)🎉 All CI tests completed successfully!$(NC)"

# ===========================================
# 通用命令
# ===========================================

build: ## 構建所有映像
	@echo "$(BLUE)🔨 Building all images...$(NC)"
	docker-compose -f $(COMPOSE_FILE) build
	docker-compose -f $(COMPOSE_DEV_FILE) build

status: ## 查看服務狀態
	@echo "$(BLUE)📊 Service Status:$(NC)"
	@echo ""
	@echo "$(GREEN)Production Environment:$(NC)"
	docker-compose -f $(COMPOSE_FILE) ps
	@echo ""
	@echo "$(GREEN)Development Environment:$(NC)"
	docker-compose -f $(COMPOSE_DEV_FILE) ps

logs: ## 查看所有服務日誌
	@echo "$(BLUE)📋 Viewing all service logs...$(NC)"
	docker-compose -f $(COMPOSE_FILE) logs -f

shell: ## 進入 API 容器
	@echo "$(BLUE)🐚 Entering API container...$(NC)"
	docker-compose -f $(COMPOSE_FILE) exec api bash

restart: ## 重啟所有服務
	@echo "$(BLUE)🔄 Restarting all services...$(NC)"
	docker-compose -f $(COMPOSE_FILE) restart

test: ## 運行測試
	@echo "$(BLUE)🧪 Running tests...$(NC)"
	docker-compose -f $(COMPOSE_DEV_FILE) exec api python -m pytest

clean: ## 清理 Docker 資源
	@echo "$(YELLOW)🧹 Cleaning Docker resources...$(NC)"
	@chmod +x infra/scripts/stop.sh
	@./infra/scripts/stop.sh clean

update: ## 更新所有映像
	@echo "$(BLUE)🔄 Updating all images...$(NC)"
	docker-compose -f $(COMPOSE_FILE) pull
	docker-compose -f $(COMPOSE_DEV_FILE) pull

prune: ## 清理未使用的 Docker 資源
	@echo "$(YELLOW)🧹 Cleaning unused Docker resources...$(NC)"
	docker system prune -f
	docker volume prune -f

# ===========================================
# 監控-數據庫命令
# ===========================================

db-shell: ## 進入 PostgreSQL 容器
	@echo "$(BLUE)🗄️ Entering PostgreSQL container...$(NC)"
	docker-compose -f $(COMPOSE_FILE) exec postgres psql -U platform_user -d platform_db

db-backup: ## 備份數據庫
	@echo "$(BLUE)💾 Backing up database...$(NC)"
	@mkdir -p backups
	docker-compose -f $(COMPOSE_FILE) exec postgres pg_dump -U platform_user platform_db > backups/platform_db_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✅ Database backup completed: backups/platform_db_$(shell date +%Y%m%d_%H%M%S).sql$(NC)"

db-restore: ## 恢復數據庫 (需要指定 BACKUP_FILE)
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo "$(RED)❌ Please specify backup file: make db-restore BACKUP_FILE=backups/platform_db_20240101_120000.sql$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)📥 Restoring database: $(BACKUP_FILE)...$(NC)"
	docker-compose -f $(COMPOSE_FILE) exec -T postgres psql -U platform_user -d platform_db < $(BACKUP_FILE)
	@echo "$(GREEN)✅ Database restore completed$(NC)"

# ===========================================
# 監控-其他資源命令
# ===========================================

flower: ## 打開 Celery Flower
	@echo "$(BLUE)🌸 Opening Celery Flower...$(NC)"
	@echo "$(GREEN)Flower monitoring interface: http://localhost:5555$(NC)"
	@echo "$(YELLOW)Press Ctrl+C to exit$(NC)"
	@open http://localhost:5555 || xdg-open http://localhost:5555 || echo "Please manually open http://localhost:5555"

redis-cli: ## 進入 Redis CLI
	@echo "$(BLUE)🔴 Entering Redis CLI...$(NC)"
	docker-compose -f $(COMPOSE_FILE) exec redis redis-cli -a redis_password

# ===========================================
# 快速命令
# ===========================================

quick-start: ## 快速啟動開發環境
	@echo "$(BLUE)⚡ Quick starting development environment...$(NC)"
	@make dev-up

quick-stop: ## 快速停止所有服務
	@echo "$(BLUE)⚡ Quick stopping all services...$(NC)"
	@make dev-down
	@make prod-down

# ===========================================
# 開發輔助命令
# ===========================================

migrate: ## 運行數據庫遷移
	@echo "$(BLUE)🗄️ Running database migration...$(NC)"
	docker-compose -f $(COMPOSE_FILE) exec api python -c "from tortoise import Tortoise; import asyncio; asyncio.run(Tortoise.init(db_url='postgresql://platform_user:platform_password@postgres:5432/platform_db')); asyncio.run(Tortoise.generate_schemas())"


# ===========================================
# 後端命令
# ===========================================

backend-dev: ## 啟動 FastAPI 開發伺服器 (使用本機環境)
	@echo "$(BLUE)🚀 Starting FastAPI development server...$(NC)"
	cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000

backend-worker: ## 啟動 Celery Worker (使用本機環境)
	@echo "$(BLUE)🚀 Starting Celery Worker (development mode)...$(NC)"
	cd backend && celery -A app.tasks.celery_app worker --loglevel=debug --concurrency=2

backend-up: ## Detached 模式啟動後端 (API/DB/Redis/Celery)
	@echo "$(BLUE)🧱 Starting backend containers (Detached)...$(NC)"
	docker-compose -f $(COMPOSE_DEV_FILE) up -d postgres redis api celery-worker

backend-down: ## 停止後端容器
	@echo "$(BLUE)🧱 Stopping backend containers...$(NC)"
	docker-compose -f $(COMPOSE_DEV_FILE) stop api celery-worker postgres redis

backend-logs: ## 追蹤 API/Celery 日誌
	@echo "$(BLUE)🧱 Tracking backend logs...$(NC)"
	docker-compose -f $(COMPOSE_DEV_FILE) logs -f api celery-worker

backend-shell: ## 進入 API 容器 (開發模式)
	@echo "$(BLUE)🧱 Entering backend API container...$(NC)"
	docker-compose -f $(COMPOSE_DEV_FILE) exec api bash

backend-restart: ## 重啟後端容器
	@echo "$(BLUE)🧱 Restarting backend containers...$(NC)"
	docker-compose -f $(COMPOSE_DEV_FILE) restart api celery-worker

backend-status: ## 查看後端容器狀態
	@echo "$(BLUE)🧱 Backend container status...$(NC)"
	docker-compose -f $(COMPOSE_DEV_FILE) ps postgres redis api celery-worker

backend-lint: ## 執行後端代碼檢查 (ruff + black + mypy)
	@echo "$(BLUE)🔍 Running backend code linting...$(NC)"
	@echo "$(YELLOW)Running Ruff check...$(NC)"
	cd backend && ruff check . || (echo "$(RED)❌ Ruff check failed$(NC)" && exit 1)
	@echo "$(YELLOW)Running Black format check...$(NC)"
	cd backend && black --check . || (echo "$(RED)❌ Black format check failed$(NC)" && exit 1)
	@echo "$(YELLOW)Running MyPy type check...$(NC)"
	cd backend && mypy . || (echo "$(RED)❌ MyPy type check failed$(NC)" && exit 1)
	@echo "$(GREEN)✅ All linting checks passed!$(NC)"

backend-format: ## 自動格式化後端代碼 (ruff format + black)
	@echo "$(BLUE)✨ Formatting backend code...$(NC)"
	@echo "$(YELLOW)Running Ruff format...$(NC)"
	cd backend && ruff format .
	@echo "$(YELLOW)Running Black format...$(NC)"
	cd backend && black .
	@echo "$(GREEN)✅ Code formatting completed!$(NC)"

backend-lint-fix: ## 自動修復後端 linting 問題 (ruff fix)
	@echo "$(BLUE)🔧 Auto-fixing backend linting issues...$(NC)"
	cd backend && ruff check . --fix
	@echo "$(GREEN)✅ Linting fixes applied!$(NC)"

backend-test: ## 運行後端測試 (使用本機環境)
	@echo "$(BLUE)🧪 Running backend tests...$(NC)"
	cd backend && python -m pytest tests/ -v

backend-test-unit: ## 只運行後端 Unit Tests
	@echo "$(BLUE)🧪 Running backend unit tests...$(NC)"
	cd backend && python -m pytest tests/ -v -k "unit"

backend-test-integ: ## 只運行後端 Integration Tests
	@echo "$(BLUE)🧪 Running backend integration tests...$(NC)"
	cd backend && python -m pytest tests/ -v -k "integ"

backend-test-cov: ## 生成後端測試覆蓋率報告
	@echo "$(BLUE)📊 Generating backend test coverage...$(NC)"
	cd backend && python -m pytest tests/ --cov=app --cov-report=html --cov-report=term-missing
	@echo "$(GREEN)✅ Coverage report generated: backend/htmlcov/index.html$(NC)"

backend-test-watch: ## 以 watch 模式運行後端測試
	@echo "$(BLUE)👀 Running backend tests in watch mode...$(NC)"
	cd backend && python -m pytest tests/ -v --looponfail

backend-test-auth: ## 運行 auth routes 測試
	@echo "$(BLUE)🔐 Running auth routes tests...$(NC)"
	cd backend && python -m pytest tests/app/api/routes/test_auth.py -v



# ===========================================
# 前端命令
# ===========================================

frontend-dev: ## 啟動前端開發伺服器
	@echo "$(BLUE)🚀 Starting frontend development server...$(NC)"
	cd frontend && npm run dev

frontend-build: ## 構建前端生產版本
	@echo "$(BLUE)🔨 Building frontend production version...$(NC)"
	cd frontend && npm run build

frontend-start: ## 啟動前端生產伺服器
	@echo "$(BLUE)🏭 Starting frontend production server...$(NC)"
	cd frontend && npm run start

frontend-lint: ## 執行前端代碼檢查
	@echo "$(BLUE)🔍 Running frontend code linting...$(NC)"
	cd frontend && npm run lint

frontend-test: ## 運行前端單元測試 (watch 模式)
	@echo "$(BLUE)🧪 Running frontend unit tests (watch mode)...$(NC)"
	cd frontend && npm run test

frontend-test-run: ## 運行前端單元測試 (單次執行)
	@echo "$(BLUE)🧪 Running frontend unit tests (single run)...$(NC)"
	cd frontend && npm run test:run

frontend-test-ui: ## 開啟前端測試 UI
	@echo "$(BLUE)🎨 Opening frontend test UI...$(NC)"
	cd frontend && npm run test:ui

frontend-test-cov: ## 生成前端測試覆蓋率
	@echo "$(BLUE)📊 Generating frontend test coverage...$(NC)"
	cd frontend && npm run test:coverage

frontend-test-e2e: ## 運行前端 E2E 測試
	@echo "$(BLUE)🎭 Running frontend E2E tests...$(NC)"
	cd frontend && npm run test:e2e

frontend-test-e2e-ui: ## 開啟前端 E2E 測試 UI (可選參數: FILES="file1.ts file2.ts" 或 GREP="測試名稱")
	@echo "$(BLUE)🎬 Opening frontend E2E test UI...$(NC)"
	@if [ -n "$(FILES)" ]; then \
		echo "$(YELLOW)Running files: $(FILES)$(NC)"; \
		cd frontend && USE_REAL_API=true npx playwright test --ui --workers=1 $(FILES); \
	elif [ -n "$(GREP)" ]; then \
		echo "$(YELLOW)Filtering tests with GREP=\"$(GREP)\"$(NC)"; \
		cd frontend && USE_REAL_API=true npx playwright test --ui --workers=1 -g "$(GREP)"; \
	else \
		cd frontend && USE_REAL_API=true npx playwright test --ui --workers=1; \
	fi

frontend-test-e2e-debug: ## 以調試模式運行指定的 E2E 測試 (使用 GREP="測試名稱" 和 USE_REAL_API=true)
	@if [ -z "$(GREP)" ]; then \
		echo "$(RED)❌ Please specify test item: make frontend-test-e2e-debug GREP=\"test name\"$(NC)"; \
		echo "$(YELLOW)Example: make frontend-test-e2e-debug GREP=\"login\"$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)🐛 Running E2E test in debug mode (GREP=\"$(GREP)\")...$(NC)"
	@echo "$(YELLOW)Tip: Debug mode will open Playwright Inspector$(NC)"
	@echo "$(YELLOW)Tip: Real backend testing requires USE_REAL_API=true$(NC)"
	cd frontend && USE_REAL_API=true npx playwright test --debug -g "$(GREP)"

frontend-install: ## 安裝前端依賴
	@echo "$(BLUE)📦 Installing frontend dependencies...$(NC)"
	cd frontend && npm install

# 顯示所有可用的目標
list: ## 列出所有可用的目標
	@echo "$(BLUE)Available targets:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)