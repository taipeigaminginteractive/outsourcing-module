from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, EmailStr, field_validator

from app.db.enums import UserRole, UserStatus

# 用戶基礎 schema
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="用戶名")
    email: EmailStr = Field(..., description="電子郵件")
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        if not v.isalnum():
            raise ValueError('用戶名只能包含字母和數字')
        return v

class AuthRegisterRequest(UserBase):
    # 繼承 UserBase - username和 email
    # 註冊信箱時不要求密碼
    pass

class UserCreateDTO(UserBase):
    # 繼承 UserBase - username和 email
    password: Optional[str] = Field(None, description="密碼(可選，信箱註冊時不需要)")
    
    @classmethod
    def from_request(cls, request: 'AuthRegisterRequest') -> 'UserCreateDTO':
        """從 AuthRegisterRequest 創建 UserCreateDTO"""
        return cls(
            username=request.username,
            email=request.email,
            password=None  # 註冊時不設置密碼
        )

class OAuthAccountResponse(BaseModel):
    id: int = Field(..., description="OAuth 帳號ID")
    provider: str = Field(..., description="OAuth 提供商")
    provider_email: Optional[str] = Field(None, description="提供商郵箱")
    display_name: Optional[str] = Field(None, description="顯示名稱")
    avatar_url: Optional[str] = Field(None, description="頭像URL")
    last_used_at: Optional[datetime] = Field(None, description="最後使用時間")
    created_at: datetime = Field(..., description="創建時間")
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class UserResponse(UserBase):
    # 繼承 UserBase - username和 email
    id: int = Field(..., description="用戶ID")
    is_superuser: bool = Field(..., description="是否為超級用戶")
    is_verified: bool = Field(False, description="是否已驗證郵箱")
    role: UserRole = Field(UserRole.USER, description="用戶角色")
    status: UserStatus = Field(UserStatus.ACTIVE, description="用戶狀態")
    created_at: datetime = Field(..., description="創建時間")
    updated_at: datetime = Field(..., description="更新時間")
    last_login: Optional[datetime] = Field(None, description="最後登入時間")
    oauth_accounts: Optional[list[OAuthAccountResponse]] = Field(None, description="OAuth 帳號列表")
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

