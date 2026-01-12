#!/bin/bash

# Platform 後端服務啟動腳本
# 作者: Platform Team
# 版本: 1.0.0
# 透過 Makefile 執行

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日誌函數
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 檢查 Docker 是否運行
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker 未運行，請先啟動 Docker Desktop"
        exit 1
    fi
    log_success "Docker 運行正常"
}

# 檢查 Docker Compose 是否安裝
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安裝，請先安裝 Docker Compose"
        exit 1
    fi
    log_success "Docker Compose 可用"
}

# 創建必要的目錄
create_directories() {
    log_info "創建必要的目錄..."
    mkdir -p logs
    mkdir -p uploads
    mkdir -p ssl
    log_success "目錄創建完成"
}

# 檢查環境變數文件
check_env_file() {
    if [ ! -f .env ]; then
        log_warning ".env 文件不存在，創建默認配置..."
        cat > .env << EOF
# 數據庫配置
DATABASE_URL=postgresql://platform_user:platform_password@postgres:5432/platform_db

# Redis 配置
REDIS_URL=redis://:redis_password@redis:6379

# Celery 配置
CELERY_BROKER_URL=redis://:redis_password@redis:6379/1
CELERY_RESULT_BACKEND=redis://:redis_password@redis:6379/1
CELERY_TIMEZONE=Asia/Taipei

# 應用程式配置
ENV=production
API_HOST=0.0.0.0
API_PORT=8000
API_RELOAD=false

# JWT 配置
SECRET_KEY=your-super-secret-jwt-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_MINUTES=43200

# CORS 配置
CORS_ORIGINS=["http://localhost:3000", "http://frontend:3000"]

# 內部 token
INTERNAL_TOKEN=your-internal-token-change-in-production

# 時區
TZ=Asia/Taipei
EOF
        log_success ".env 文件創建完成"
    else
        log_success ".env 文件已存在"
    fi
}

# 啟動開發環境
start_dev() {
    log_info "🚀 啟動開發環境..."
    docker-compose -f infra/docker-compose.dev.yml up --build
}

# 啟動生產環境
start_prod() {
    log_info "�� 啟動生產環境..."
    docker-compose -f infra/docker-compose.yml up --build -d
    
    # 等待服務啟動
    log_info "等待服務啟動..."
    sleep 10
    
    # 檢查服務狀態
    check_services
}

# 檢查服務狀態
check_services() {
    log_info "檢查服務狀態..."
    
    # 檢查 API 服務
    if curl -f http://localhost:8000/ > /dev/null 2>&1; then
        log_success "API 服務運行正常 (http://localhost:8000)"
    else
        log_warning "API 服務可能還在啟動中..."
    fi
    
    # 檢查 Celery Flower
    if curl -f http://localhost:5555/ > /dev/null 2>&1; then
        log_success "Celery Flower 運行正常 (http://localhost:5555)"
    else
        log_warning "Celery Flower 可能還在啟動中..."
    fi
    
    # 顯示服務狀態
    docker-compose -f infra/docker-compose.yml ps
}

# 顯示幫助信息
show_help() {
    echo "Platform 後端服務啟動腳本"
    echo ""
    echo "使用方法:"
    echo "  $0 dev   - 啟動開發環境 (前台運行)"
    echo "  $0 prod  - 啟動生產環境 (後台運行)"
    echo "  $0 help  - 顯示此幫助信息"
    echo ""
    echo "服務端口:"
    echo "  API:        http://localhost:8000"
    echo "  PostgreSQL: localhost:5432"
    echo "  Redis:      localhost:6379"
    echo "  Flower:     http://localhost:5555"
    echo ""
    echo "常用命令:"
    echo "  docker-compose -f infra/docker-compose.yml ps     - 查看服務狀態"
    echo "  docker-compose -f infra/docker-compose.yml logs   - 查看日誌"
    echo "  docker-compose -f infra/docker-compose.yml down   - 停止服務"
}

# 主函數
main() {
    echo "=========================================="
    echo "    Platform 後端服務啟動腳本"
    echo "=========================================="
    
    # 檢查前置條件
    check_docker
    check_docker_compose
    create_directories
    check_env_file
    
    # 根據參數執行相應操作
    case "${1:-help}" in
        "dev")
            start_dev
            ;;
        "prod")
            start_prod
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "未知參數: $1"
            show_help
            exit 1
            ;;
    esac
}

# 執行主函數
main "$@"