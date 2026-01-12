#!/bin/bash

# Platform 後端服務停止腳本
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

# 停止開發環境
stop_dev() {
    log_info "🛑 停止開發環境..."
    docker-compose -f infra/docker-compose.dev.yml down
    log_success "開發環境已停止"
}

# 停止生產環境
stop_prod() {
    log_info "🛑 停止生產環境..."
    docker-compose -f infra/docker-compose.yml down
    log_success "生產環境已停止"
}

# 強制停止所有服務
force_stop() {
    log_warning "⚠️  強制停止所有 Platform 相關容器..."
    
    # 停止所有相關容器
    docker ps -q --filter "name=platform_" | xargs -r docker stop
    
    # 刪除所有相關容器
    docker ps -aq --filter "name=platform_" | xargs -r docker rm
    
    # 停止所有相關網絡
    docker network ls -q --filter "name=platform_" | xargs -r docker network rm
    
    log_success "所有 Platform 相關容器已強制停止"
}

# 清理所有資源
clean_all() {
    log_warning "�� 清理所有 Docker 資源..."
    
    # 停止並刪除所有相關容器
    docker-compose -f infra/docker-compose.yml down -v
    docker-compose -f infra/docker-compose.dev.yml down -v
    
    # 清理未使用的資源
    docker system prune -f
    
    # 清理未使用的卷
    docker volume prune -f
    
    log_success "所有資源已清理"
}

# 顯示服務狀態
show_status() {
    log_info "�� 當前服務狀態:"
    echo ""
    
    # 顯示運行中的容器
    echo "運行中的容器:"
    docker ps --filter "name=platform_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    
    # 顯示所有相關容器
    echo "所有相關容器:"
    docker ps -a --filter "name=platform_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    
    # 顯示相關網絡
    echo "相關網絡:"
    docker network ls --filter "name=platform_"
    echo ""
    
    # 顯示相關卷
    echo "相關卷:"
    docker volume ls --filter "name=platform_"
}

# 顯示幫助信息
show_help() {
    echo "Platform 後端服務停止腳本"
    echo ""
    echo "使用方法:"
    echo "  $0 dev      - 停止開發環境"
    echo "  $0 prod     - 停止生產環境"
    echo "  $0 force    - 強制停止所有相關容器"
    echo "  $0 clean    - 清理所有 Docker 資源"
    echo "  $0 status   - 顯示服務狀態"
    echo "  $0 help     - 顯示此幫助信息"
    echo ""
    echo "注意事項:"
    echo "  - 使用 'force' 選項會強制停止所有相關容器"
    echo "  - 使用 'clean' 選項會刪除所有相關數據卷"
    echo "  - 建議在停止服務前先查看 'status' 狀態"
}

# 主函數
main() {
    echo "=========================================="
    echo "    Platform 後端服務停止腳本"
    echo "=========================================="
    
    # 根據參數執行相應操作
    case "${1:-help}" in
        "dev")
            stop_dev
            ;;
        "prod")
            stop_prod
            ;;
        "force")
            force_stop
            ;;
        "clean")
            clean_all
            ;;
        "status")
            show_status
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