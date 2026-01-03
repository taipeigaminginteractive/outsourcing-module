from enum import Enum


class UserRole(str, Enum):
    """用戶角色列舉"""
    USER = "user" # 普通用戶
    ADMIN = "admin" # 管理員
    MODERATOR = "moderator"  # 版主用戶或公司客服等


class UserStatus(str, Enum):
    """用戶狀態列舉"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"