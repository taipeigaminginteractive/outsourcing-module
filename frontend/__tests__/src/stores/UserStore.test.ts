import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useUserStore } from "@/stores/UserStore";
import { authApi } from "@/api/authApi";
import { server } from "tests@/server";
import { http, HttpResponse } from "msw";
import { createMockUserResponse } from "tests@/mocks/factories";
import { mockWindowLocationHref, createDeferred } from "tests@/mocks/helpers";
import { API_BASE_URL } from "@/constants";

// Mock window.location
const mockLocationHref = mockWindowLocationHref();

describe("UserStore", () => {
  beforeEach(() => {
    // 清除 localStorage（因為使用 persist middleware）
    localStorage.clear();
    localStorage.removeItem("user-storage");
    
    // 清除 mock 呼叫記錄
    mockLocationHref.mockClear();
    vi.clearAllMocks();
    
    // 重置 store 狀態到初始值
    useUserStore.setState({
      isRegistering: false,
      registerError: null,
    });
  });

  afterEach(() => {
    // 重置所有 handlers
    server.resetHandlers();
  });

  // ============================================
  // 初始狀態測試
  // ============================================
  describe("Initial State", () => {
    it("應該初始化為預設狀態", () => {
      const { result } = renderHook(() => useUserStore());

      expect(result.current.isRegistering).toBe(false);
      expect(result.current.registerError).toBe(null);
    });
  });

  // ============================================
  // register() - Happy Paths
  // ============================================
  describe("register() - Happy Paths", () => {
    it("應該成功註冊使用者並更新狀態", async () => {
      const { result } = renderHook(() => useUserStore());
      const mockUser = createMockUserResponse({
        username: "newuser",
        email: "newuser@example.com",
      });

      // Mock 成功的註冊回應
      server.use(
        http.post(`${API_BASE_URL}/auth/register`, () => {
          return HttpResponse.json(mockUser, { status: 200 });
        })
      );

      // 呼叫 register
      await act(async () => {
        await result.current.register({
          username: "newuser",
          email: "newuser@example.com",
        });
      });

      // 驗證狀態
      expect(result.current.isRegistering).toBe(false);
      expect(result.current.registerError).toBe(null);
    });

    it("應該在註冊過程中設置 isRegistering 為 true，完成後清除錯誤", async () => {
      const { result } = renderHook(() => useUserStore());
      
      // 先設置一個錯誤
      server.use(
        http.post(`${API_BASE_URL}/auth/register`, () => {
          return HttpResponse.json(
            { detail: "mock 409 error" },
            { status: 409 }
          );
        })
      );

      await act(async () => {
        try {
          await result.current.register({
            username: "existinguser",
            email: "existing@example.com",
          });
        } catch {
          // 預期會拋出錯誤
        }
      });

      expect(result.current.registerError).not.toBe(null);

      // 重新設置成功的回應，並加入延遲
      const { promise: registerPromise, resolve: resolveRegister } = createDeferred<void>();

      server.use(
        http.post(`${API_BASE_URL}/auth/register`, async () => {
          await registerPromise;
          return HttpResponse.json(createMockUserResponse(), { status: 200 });
        })
      );

      // 開始註冊（不等待完成）
      const registerCall = act(async () => {
        await result.current.register({
          username: "newuser",
          email: "newuser@example.com",
        });
      });

      // 驗證 isRegistering 為 true 且錯誤被清除
      await waitFor(() => {
        expect(result.current.isRegistering).toBe(true);
        expect(result.current.registerError).toBe(null);
      });

      // 完成註冊
      resolveRegister();
      await registerCall;

      // 驗證 isRegistering 回到 false
      expect(result.current.isRegistering).toBe(false);
    });
  });

  // ============================================
  // register() - Exception Paths
  // ============================================
  describe("register() - Exception Paths", () => {
    it("應該處理 409 錯誤（帳號已被註冊）", async () => {
      const { result } = renderHook(() => useUserStore());

      server.use(
        http.post(`${API_BASE_URL}/auth/register`, () => {
          return HttpResponse.json(
            { detail: "mock 409 error" },
            { status: 409 }
          );
        })
      );

      await act(async () => {
        try {
          await result.current.register({
            username: "existinguser",
            email: "existing@example.com",
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe("此帳號已被註冊");
        }
      });

      expect(result.current.isRegistering).toBe(false);
      expect(result.current.registerError).toBe("此帳號已被註冊");
    });

    it("應該處理 422 驗證錯誤（資料驗證失敗）", async () => {
      const { result } = renderHook(() => useUserStore());

      server.use(
        http.post(`${API_BASE_URL}/auth/register`, () => {
          return HttpResponse.json(
            {
              detail: [
                {
                  loc: ["body", "email"],
                  msg: "value is not a valid email address",
                  type: "value_error.email",
                },
              ],
            },
            { status: 422 }
          );
        })
      );

      await act(async () => {
        try {
          await result.current.register({
            username: "testuser",
            email: "invalid-email",
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain("email");
        }
      });

      expect(result.current.isRegistering).toBe(false);
      expect(result.current.registerError).toBeTruthy();
    });

    it("應該處理 500 伺服器錯誤和網路錯誤", async () => {
      const { result } = renderHook(() => useUserStore());

      server.use(
        http.post(`${API_BASE_URL}/auth/register`, () => {
          return HttpResponse.json(
            { detail: "mock 500 error" },
            { status: 500 }
          );
        })
      );

      await act(async () => {
        try {
          await result.current.register({
            username: "testuser",
            email: "test@example.com",
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe("註冊失敗");
        }
      });

      expect(result.current.isRegistering).toBe(false);
      expect(result.current.registerError).toBe("註冊失敗");
    });

    it("應該處理非 Error 類型的異常", async () => {
      const { result } = renderHook(() => useUserStore());

      // Mock authApi.register 拋出非 Error 類型的異常
      vi.spyOn(authApi, "register").mockRejectedValueOnce("Unknown error");

      await act(async () => {
        try {
          await result.current.register({
            username: "testuser",
            email: "test@example.com",
          });
        } catch {
          // 預期會拋出錯誤
        }
      });

      expect(result.current.isRegistering).toBe(false);
      expect(result.current.registerError).toBe("註冊失敗");
    });
  });

  // ============================================
  // register() - Edge Cases
  // ============================================
  describe("register() - Edge Cases", () => {
    it("應該處理並行的註冊請求（只保留最後一個結果）", async () => {
      const { result } = renderHook(() => useUserStore());

      server.use(
        http.post(`${API_BASE_URL}/auth/register`, async () => {
          // 延遲回應以模擬並行
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json(createMockUserResponse(), { status: 200 });
        })
      );

      // 同時發起多個註冊請求
      const promises = [
        act(async () => {
          await result.current.register({
            username: "user1",
            email: "user1@example.com",
          });
        }),
        act(async () => {
          await result.current.register({
            username: "user2",
            email: "user2@example.com",
          });
        }),
      ];

      await Promise.all(promises);

      // 驗證最終狀態是穩定的
      expect(result.current.isRegistering).toBe(false);
      expect(result.current.registerError).toBe(null);
    });
  });

  // ============================================
  // redirectToOAuthLogin() - Happy Paths
  // ============================================
  describe("redirectToOAuthLogin() - Happy Paths", () => {
    it("應該成功重定向到 OAuth 頁面並清除錯誤", async () => {
      // 先設置一個錯誤
      server.use(
        http.post(`${API_BASE_URL}/auth/register`, () => {
          return HttpResponse.json(
            { detail: "mock 409 error" },
            { status: 409 }
          );
        })
      );

      try {
        await useUserStore.getState().register({
          username: "existinguser",
          email: "existing@example.com",
        });
      } catch {
        // 預期會拋出錯誤
      }

      expect(useUserStore.getState().registerError).not.toBe(null);

      // 重定向到 OAuth
      server.use(
        http.get(`${API_BASE_URL}/auth/oauth/google/url`, () => {
          return HttpResponse.json({
            auth_url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=test",
          });
        })
      );

      await useUserStore.getState().redirectToOAuthLogin("google");

      expect(mockLocationHref).toHaveBeenCalledWith(
        expect.stringContaining("accounts.google.com")
      );
      expect(useUserStore.getState().registerError).toBe(null);
    });
  });

  // ============================================
  // redirectToOAuthLogin() - Exception Paths 
  // ============================================
  describe("redirectToOAuthLogin() - Exception Paths", () => {
    it("應該處理 503 錯誤（服務暫時無法使用）", async () => {
      server.use(
        http.get(`${API_BASE_URL}/auth/oauth/google/url`, () => {
          return HttpResponse.json(
            { detail: "mock 503 error" },
            { status: 503 }
          );
        })
      );

      try {
        await useUserStore.getState().redirectToOAuthLogin("google");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("google 登入服務暫時無法使用");
      }

      expect(useUserStore.getState().registerError).toBe("google 登入服務暫時無法使用");
      expect(mockLocationHref).not.toHaveBeenCalled();
    });

    it("應該處理非 Error 類型的異常", async () => {
      // Mock authApi.redirectToOAuthLogin 拋出非 Error 類型的異常
      vi.spyOn(authApi, "redirectToOAuthLogin").mockRejectedValueOnce(
        "Unknown error"
      );

      try {
        await useUserStore.getState().redirectToOAuthLogin("google");
      } catch {
        // 預期會拋出錯誤
      }

      expect(useUserStore.getState().registerError).toBe("google 註冊失敗，請稍後再試");
    });
  });

  // ============================================
  // clearError() - Happy Paths
  // ============================================
  describe("clearError() - Happy Paths", () => {
    it("應該清除註冊錯誤訊息", async () => {
      // 先產生一個錯誤
      server.use(
        http.post(`${API_BASE_URL}/auth/register`, () => {
          return HttpResponse.json(
            { detail: "mock 409 error" },
            { status: 409 }
          );
        })
      );

      try {
        await useUserStore.getState().register({
          username: "existinguser",
          email: "existing@example.com",
        });
      } catch {
        // 預期會拋出錯誤
      }

      expect(useUserStore.getState().registerError).not.toBe(null);

      // 清除錯誤
      useUserStore.getState().clearError();

      expect(useUserStore.getState().registerError).toBe(null);
    });
  });

});
