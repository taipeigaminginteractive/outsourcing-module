

// ----------------------------------------------------
// 匹配後端 user API 相關 schemas
// ----------------------------------------------------

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  role: "user" | "admin" | "moderator";
  status: "active" | "inactive" | "suspended";
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
  oauth_accounts?: OAuthAccountResponse[];
}


export interface OAuthAccountResponse {
  id: number;
  provider: string;
  provider_email?: string;
  display_name?: string;
  avatar_url?: string;
  last_used_at?: string;
  created_at: string;
}

// ----------------------------------------------------
// 用戶資料管理 API - 專注於用戶資料管理功能
// ----------------------------------------------------
export const userApi = {
  // 註冊流程不需要用戶 API
};
