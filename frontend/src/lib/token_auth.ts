// Token 相關介面
export interface Token {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Token 管理輔助函數
// access_token 存到內存中（不持久化）
// refresh_token 由後端通過 http-only cookie 管理，前端無法訪問 (沒有JS操作)
let accessToken: string | null = null;

export const tokenManager = {
  setToken: (token: string) => {
    accessToken = token;
  },

  getToken: (): string | null => {
    return accessToken;
  },

  removeToken: () => {
    accessToken = null;
  },

  isAuthenticated: (): boolean => {
    return !!accessToken;
  },

  removeAllTokens: () => {
    accessToken = null;
    // refresh_token 由後端 cookie 管理，前端無法清除
  },
};

// ----------------------------------------------------
// 輔助函數 給 XXXApi.ts 使用
// ----------------------------------------------------
export const getAuthHeaders = () => {
  const token = tokenManager.getToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};
