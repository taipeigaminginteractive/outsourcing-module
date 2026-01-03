import { API_BASE_URL } from "@/constants";
import { tokenManager } from "@/lib/token_auth";
import {
  handleApiError,
  handleValidationError,
  createApiError,
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
// 身份驗證 API - 專注於註冊相關功能
// ----------------------------------------------------
export const authApi = {
  /*
  * POST /auth/register (AuthRegisterRequest -> UserResponse)
  * 註冊信箱 (不需要密碼)
  * @
  */
  async register(userData: AuthRegisterRequest): Promise<UserResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      await handleValidationError(response);
      // register 實際上是存取用戶資料到資料庫 因此為 422 驗證錯誤
    }

    return response.json();
  },

  // ===========================================
  // OAuth 流程功能
  // ===========================================

  // 獲取 OAuth 授權 URL (後端拼接所有相關參數到 auth_url 後面)
  async getOAuthUrl(
    provider: "google" | "facebook" | "line"
  ): Promise<{ auth_url: string }> {
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
  },

  // OAuth 登入重定向 - getOAuthUrl()成功獲取後 重定向到 OAuth 授權 URL
  async redirectToOAuthLogin(
    provider: "google" | "facebook" | "line"
  ): Promise<void> {
    try {
      // 先獲取 OAuth 授權 URL (外部頁面 由provider提供)
      const data = await this.getOAuthUrl(provider);

      // 重定向到 OAuth 授權頁面
      window.location.href = data.auth_url;
    } catch (error) {
      console.error(`${provider} 登入重定向失敗:`, error);
      throw error;
    }
  },
  // OAuth 登入/註冊 - 在 OAuth callback 頁面時執行 (給予後端授權碼)
  async oauthLogin(
    provider: "google" | "facebook" | "line",
    authCode: string
  ): Promise<OAuthLoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/oauth/${provider}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: authCode,
      }),
      credentials: "include", // 確保接收和發送 cookie
    });

    if (!response.ok) {
      await handleApiError(response, `OAuth ${provider} 登入失敗`);
    }

    const result = await response.json();
    // 自動設置 access_token
    tokenManager.setToken(result.access_token);
    // refresh_token 由後端通過 http-only cookie 管理，前端不需要處理

    return result;
  },

  // ===========================================
  // 郵箱驗證相關功能
  // ===========================================

  // 驗證郵箱 token
  async verifyEmail(
    token: string
  ): Promise<{ message: string; set_password_token?: string }> {
    const formData = new URLSearchParams();
    formData.append("token", token);

    // 設置超時時間（10秒）
    const timeoutMs = 10000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: {
        message?: string;
        set_password_token?: string;
        detail?: string;
      } | null = null;
      try {
        data = await response.json();
      } catch {
        // ignore JSON parse errors
      }

      if (!response.ok) {
        await handleApiError(response, "驗證失敗", data || undefined);
      }

      return {
        message: data?.message || "驗證成功！",
        set_password_token: data?.set_password_token,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // 處理超時錯誤
      if (error instanceof Error && error.name === "AbortError") {
        throw createApiError("請求超時，請檢查網路連線後再試", 0, "請求超時");
      }

      // 重新拋出其他錯誤
      throw error;
    }
  },

  // 重新寄送驗證信
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const response = await fetch(
      `${API_BASE_URL}/auth/resend-verification-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      }
    );

    let data: { message?: string; detail?: string } | null = null;
    try {
      data = await response.json();
    } catch {
      // ignore JSON parse errors
    }

    if (!response.ok) {
      await handleApiError(response, "重新寄送驗證信失敗", data || undefined);
    }

    return { message: data?.message || "驗證信已重新發送" };
  },

  // 獲取郵箱驗證 token（用於註冊後獲取 token，避免 email 暴露在 URL）
  async getEmailVerificationToken(
    email: string
  ): Promise<{ token: string; message: string }> {
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

    let data: {
      token?: string;
      message?: string;
      detail?: string;
    } | null = null;
    try {
      data = await response.json();
    } catch {
      // ignore JSON parse errors
    }

    if (!response.ok) {
      await handleApiError(response, "獲取驗證 token 失敗", data || undefined);
    }

    if (!data?.token) {
      throw new Error("未收到驗證 token");
    }

    return {
      token: data.token,
      message: data.message || "驗證 token 已生成",
    };
  },

  // 通過 token 獲取 email（用於前端顯示，避免 email 暴露在 URL）
  async getEmailByToken(
    token: string
  ): Promise<{ email: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/get-email-by-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    let data: {
      email?: string;
      message?: string;
      detail?: string;
    } | null = null;
    try {
      data = await response.json();
    } catch {
      // ignore JSON parse errors
    }

    if (!response.ok) {
      await handleApiError(response, "獲取 email 失敗", data || undefined);
    }

    if (!data?.email) {
      throw new Error("未收到 email");
    }

    return {
      email: data.email,
      message: data.message || "成功獲取 email",
    };
  },

};
