// ----------------------------------------------------
// 用戶資料管理 API - 專注於用戶資料管理功能
// ----------------------------------------------------

// ============================================
// 用戶相關類型定義
// ============================================

// UserResponse 就是 獲取用戶資料的響應格式 (UserGetResponse)
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

// OAuth 帳號響應格式
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
// 用戶資料管理 API - 註冊流程不需要用戶 API
// ----------------------------------------------------
export const userApi = {
  // 註冊流程不需要用戶 API
};
