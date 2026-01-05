import { API_BASE_URL } from "@/constants";
import {
  handleApiError,
  handleValidationError,
  createApiError,
  withNetworkErrorHandling,
} from "@/lib/errorHandler";

// ----------------------------------------------------
// 匹配後端 auth API 相關 schemas
// ----------------------------------------------------

export interface AuthRegisterRequest {
  username: string;
  email: string;
  // 註冊請求不需要密碼 (信箱驗證成功後再設置密碼)
}

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
}

export interface OAuthLoginResponse {
  user: UserResponse;
  access_token: string;
}

// ----------------------------------------------------
// 身份驗證 auth API
// ----------------------------------------------------
export const authApi = {

  // ===========================================
  // 信箱驗證相關功能
  // ===========================================
  /**
  * POST /auth/register
  * 註冊信箱 (不需要密碼)
  * @throws ApiError:
  * - status 422: 請求欄位驗證失敗（FastAPI validation error）
  * - status 409: username 已存在（AUTH.USER.DUPLICATE_CREDENTIAL）
  * - status 409: email 已存在且該用戶已完成註冊（AUTH.USER.DUPLICATE_CREDENTIAL）
  * 
  * Note:
  * - 若 email 已存在但用戶尚未完成註冊（未驗證或已驗證但未設置密碼），會重新發送驗證信並回傳該用戶資訊（不會拋出 409）
  */
  async register(userData: AuthRegisterRequest): Promise<UserResponse> {
    return withNetworkErrorHandling(async () => {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        if (response.status === 422) {
          await handleValidationError(response);
        } else {
          await handleApiError(response, "註冊失敗");
        }
      }

      return response.json();
    });
  },

  /**
  * POST /auth/get-email-verification-token
  * 獲取郵箱驗證 token（用於註冊後獲取 token，避免 email 暴露在 URL）
  * @throws ApiError:
  * - status 404: 用戶不存在（AUTH.USER.NOT_FOUND）
  * - status 400: 信箱已驗證（AUTH.USER.ALREADY_VERIFIED）
  * - status 500: 獲取驗證 token 失敗（AUTH.TOKEN.GENERATION_FAILED）
  * 
  * Note:
  * - 若用戶已驗證但未設置密碼，允許重新獲取驗證 token
  */
  async getEmailVerificationToken(
      email: string
    ): Promise<{ token: string; message: string }> {
      return withNetworkErrorHandling(async () => {
        const response = await fetch(
          `${API_BASE_URL}/auth/get-email-verification-token`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email }),
          }
        );
  
        if (!response.ok) {
          await handleApiError(response, "獲取驗證 token 失敗");
        }
  
        const data = await response.json();
        if (!data?.token) {
          throw createApiError("未收到驗證 token", response.status);
        }
  
        return {
          token: data.token,
          message: data.message || "驗證 token 已生成",
        };
      });
    },

  // ===========================================
  // OAuth 認證相關功能
  // ===========================================

  /**
  * GET /auth/oauth/{provider}/url
  * 獲取 OAuth 授權 URL（第一步：將用戶導向 provider 的 OAuth 授權頁面）
  * @throws ApiError:
  * - status 400: 不支援的 OAuth 提供商（AUTH.OAUTH.PROVIDER_NOT_SUPPORTED）
  * - status 503: OAuth 未配置（AUTH.OAUTH.NOT_CONFIGURED）
  * 
  * Note:
  * - 後端會拼接所有必要的 OAuth 參數到 auth_url
  * - 返回的 auth_url 包含 client_id、redirect_uri、scope、response_type、state 等參數
  */
  async getOAuthUrl(
    provider: "google" | "facebook" | "line"
  ): Promise<{ auth_url: string }> {
    return withNetworkErrorHandling(async () => {
      const response = await fetch(`${API_BASE_URL}/auth/oauth/${provider}/url`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        await handleApiError(response, `獲取 ${provider} 授權 URL 失敗`);
      }

      return response.json();
    });
  },

  /**
  * OAuth 登入重定向
  * 獲取 OAuth 授權 URL 後重定向到 provider 的授權頁面
  * @throws ApiError:
  * - 繼承自 getOAuthUrl() 的所有錯誤
  * 
  * Note:
  * - 此方法會自動跳轉到 OAuth 授權頁面，不會返回
  * - 用戶在授權頁面完成授權後，會被重定向到 redirect_uri
  */
  async redirectToOAuthLogin(
    provider: "google" | "facebook" | "line"
  ): Promise<void> {
    return withNetworkErrorHandling(async () => {
      // 先獲取 OAuth 授權 URL (外部頁面 由provider提供)
      const data = await this.getOAuthUrl(provider);

      // 重定向到 OAuth 授權頁面
      window.location.href = data.auth_url;
    });
  },

};
