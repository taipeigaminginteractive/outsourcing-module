import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  authApi,
  AuthRegisterRequest,
} from "@/api/authApi";
import { IS_PRODUCTION } from "@/constants";


interface UserState {

  // @ui 註冊進行中的 loading 狀態（用於輸入欄位和按鈕 disabled）
  isRegistering: boolean;  
  // @ui 註冊失敗的錯誤訊息（用於錯誤訊息顯示區塊）
  registerError: string | null;

  // @remote 封裝 authApi.register
  register: (userData: AuthRegisterRequest) => Promise<void>;

  // @remote 封裝 authApi.redirectToOAuthLogin
  redirectToOAuthLogin: (
    provider: "google" | "facebook" | "line",
    errorType?: "login" | "register"
  ) => Promise<void>;

  // @ui 清除 store層 錯誤訊息
  clearError: () => void;

}


export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      isRegistering: false,
      registerError: null,

      register: async (userData: AuthRegisterRequest) => {
        set({ isRegistering: true, registerError: null });
        try {
          await authApi.register(userData);
          
          // 註冊成功，但不自動登入（不設置user狀態）
          // 後續流程：驗證郵箱 → 設置密碼 → 才能登入
          set({
            isRegistering: false,
            registerError: null,
          });

          console.log("註冊成功，請檢查您的信箱以完成驗證");
        } catch (error) {
          console.error("註冊失敗:", error);
          const errorMessage =
            error instanceof Error ? error.message : "註冊失敗";
          set({
            isRegistering: false,
            registerError: errorMessage,
          });
          throw error;
        }
      },

      redirectToOAuthLogin: async (
        provider: "google" | "facebook" | "line"
      ): Promise<void> => {
        try {
          set({ registerError: null });

          await authApi.redirectToOAuthLogin(provider);
        } catch (error) {
          console.error(`${provider} OAuth 重定向失敗:`, error);

          const errorMessage =
            error instanceof Error
              ? error.message
              : `${provider} 註冊失敗，請稍後再試`;
          
          set({ registerError: errorMessage });

          throw error;
        }
      },

      clearError: () => {
        set({
          registerError: null,
        });
      },
    }),
    {
      name: "user-storage",
      // 只持久化必要的狀態（註冊未登入不需要持久化狀態）
      partialize: () => ({}),
    }
  )
);

// for testing
declare global {
  interface Window {
    __USER_STORE__?: typeof useUserStore;
  }
}

if (typeof window !== "undefined" && !IS_PRODUCTION) {
  window.__USER_STORE__ = useUserStore;
}
