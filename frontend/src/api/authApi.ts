import { API_BASE_URL, FRONTEND_URL } from "@/constants";
import {
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
  * - status 422: 資料驗證錯誤（FastAPI 自動驗證，詳細錯誤訊息為 ValidationItem[]）
  * - status 409: 此帳號已被註冊
  * - 其他狀態碼: 註冊失敗
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
        } else if (response.status === 409) {
          throw createApiError("此帳號已被註冊", 409);
        } else {
          throw createApiError("註冊失敗", response.status);
        }
      }

      return response.json();
    });
  },

  /**
  * POST /auth/get-email-verification-token
  * 獲取郵箱驗證 token（用於註冊後獲取 token，避免 email 暴露在 URL）
  * @throws ApiError:
  * - status 422: 資料驗證錯誤（FastAPI 自動驗證，詳細錯誤訊息為 ValidationItem[]）
  * - status 404: 找不到此使用者
  * - status 400: 信箱已完成驗證
  * - status 500: 獲取驗證失敗 (Token 生成失敗)
  * - 其他狀態碼: 獲取驗證失敗
  * 
  * Note:
  * - 若用戶已驗證但未設置密碼，允許重新獲取驗證 token
  * - 若後端返回成功但未包含 token，會拋出錯誤「未收到驗證 token」
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
          if (response.status === 422) {
            await handleValidationError(response);
          } else if (response.status === 404) {
            throw createApiError("找不到此使用者", 404);
          } else if (response.status === 400) {
            throw createApiError("信箱已完成驗證", 400);
          } else if (response.status === 500) {
            throw createApiError("獲取驗證失敗", 500);
          } else {
            throw createApiError("獲取驗證失敗", response.status);
          }
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
  * - status 400: 不支援此第三方登入服務
  * - status 503: {provider} 登入服務暫時無法使用
  * - 其他狀態碼: 獲取 {provider} 授權 URL 失敗
  * 
  * Note:
  * - 後端會拼接所有必要的 OAuth 參數到 auth_url
  * - 返回的 auth_url 包含 client_id、redirect_uri、scope、response_type、state 等參數
  */
  async getOAuthUrl(
    provider: "google" | "facebook" | "line"
  ): Promise<{ auth_url: string }> {
    return withNetworkErrorHandling(async () => {
      const redirectUri = `${FRONTEND_URL}/auth/oauth-callback`;
      const url = new URL(`${API_BASE_URL}/auth/oauth/${provider}/url`);
      url.searchParams.set("redirect_uri", redirectUri);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 400) {
          throw createApiError(`不支援此第三方登入服務`, 400);
        } else if (response.status === 503) {
          throw createApiError(`${provider} 登入服務暫時無法使用`, 503);
        } else {
          throw createApiError(`獲取 ${provider} 授權登入頁面網址 失敗`, response.status);
        }
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
  * - 若發生錯誤，不會進行重定向
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
