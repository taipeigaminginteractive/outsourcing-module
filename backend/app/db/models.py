from tortoise import fields, Model
from app.db.enums import UserRole, UserStatus

class User(Model):
    id = fields.IntField(pk=True)
    username = fields.CharField(max_length=50, unique=True)
    email = fields.CharField(max_length=255, unique=True)
    hashed_password = fields.CharField(max_length=255, null=True)

    is_verified = fields.BooleanField(default=False)  # 是否驗證過(信箱、手機等)
    is_superuser = fields.BooleanField(default=False)
    is_upgraded = fields.BooleanField(default=False)  # 是否為升級用戶
    role = fields.CharEnumField(UserRole, default=UserRole.USER, max_length=20)  
    # 用戶角色：user(普通用戶), admin(管理員), moderator(版主用戶)
    status = fields.CharEnumField(UserStatus, default=UserStatus.ACTIVE, max_length=20)  
    # 用戶狀態：active(啟用), inactive(停用), suspended(暫停)

    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)
    
    def __str__(self):
        return f"User(id={self.id}, username='{self.username}')"
    
    class Meta:
        table = "users"


class UserOAuthAccount(Model):
    """OAuth 帳號關聯"""
    id = fields.IntField(pk=True)
    user = fields.ForeignKeyField("models.User", related_name="oauth_accounts")

    provider = fields.CharField(max_length=50)
    provider_user_id = fields.CharField(max_length=255)
    provider_email = fields.CharField(max_length=255, null=True)

    # OAuth 提供商的原始資料(作為備份)
    display_name = fields.CharField(max_length=255, null=True)
    avatar_url = fields.CharField(max_length=500, null=True)
    # 注意：顯示時統一使用 UserProfile 的資料，這裡僅作為 OAuth 原始資料備份

    last_used_at = fields.DatetimeField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "oauth_accounts"
        unique_together = ("provider", "provider_user_id")