from settings import settings
from app.core.logging import setup_logging

# 初始化日誌系統(fallback to default values)
setup_logging(
    log_level=getattr(settings, 'LOG_LEVEL', 'INFO'),
    log_to_file=getattr(settings, 'LOG_TO_FILE', True),
    log_to_console=getattr(settings, 'LOG_TO_CONSOLE', True),
)
