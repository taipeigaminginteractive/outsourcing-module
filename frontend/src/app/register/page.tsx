"use client";

// ============================================
// Import 順序規範（TypeScript/React/Next.js）: register/page.tsx示範
// ============================================
// 1. React 相關（React 核心庫）
//    例如：react, react-dom
//
// 2. Next.js 相關（Next.js 框架模組）
//    例如：next/navigation, next/link, next/image
//
// 3. 第三方庫（透過 npm/yarn 安裝的套件）
//    例如：react-icons, zustand, axios
//
// 4. 內部模組（專案內部的模組，使用 @/ 別名）
//    例如：@/api/*, @/stores/*, @/lib/*, @/constants
//
// NOTICE：
// - 每個分組之間用空行分隔
// - 同一分組內按字母順序排列（alphabetical order）
// - 同一模組的多個 import 可以合併在同一行
// - 內部模組使用 @/ 別名（對應 tsconfig.json 的 paths 設定）
// ============================================

/** 
 * RegisterPage
 * 包含：
 * - header 標題區塊
 * - errorMessage 錯誤訊息區塊
 * - emailRegisterForm 郵箱註冊表單
 * - oauthRegisterButtons 第三方登入按鈕區塊
 * - termsOfService 服務條款
 * - switchToLogin 登入連結
 */

import React, { useState } from "react";

import { useRouter } from "next/navigation";
import Link from "next/link";

import { FaFacebook, FaGoogle, FaLine } from "react-icons/fa";

import { authApi } from "@/api/authApi";
import { useUserStore } from "@/stores/UserStore";

export default function RegisterPage() {
  // Next.js Hooks
  const router = useRouter();

  // Store Hooks
  const {
    isRegistering,
    registerError,
    clearError,
    redirectToOAuthLogin,
    register,
  } = useUserStore();

  // @state [RegisterPage]:emailRegisterForm 表單資料
  const [formData, setFormData] = useState({
    username: "",
    email: "",
  });

  // @state [RegisterPage]:errorMessage 表單錯誤訊息
  const [formError, setFormError] = useState<string | null>(null);

  // @value [RegisterPage]:errorMessage 錯誤訊息顯示 (使用 UserStore registerError 或 formError state)
  const errorMessage = registerError || formError; 

  // @effect [RegisterPage]:errorMessage 清除錯誤（當組件掛載時）
  React.useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // @action [RegisterPage]:emailRegisterForm 驗證單個欄位（用於 onBlur）
  const validateField = (field: "username" | "email"): boolean => {
    if (field === "username") {
      const trimmedUsername = formData.username.trim();
      if (!trimmedUsername) {
        setFormError("請輸入使用者名稱");
        return false;
      }
      if (trimmedUsername.length < 3) {
        setFormError("使用者名稱至少需要 3 個字符");
        return false;
      }
      if (trimmedUsername.length > 50) {
        setFormError("使用者名稱不能超過 50 個字符");
        return false;
      }
      if (!/^[a-zA-Z0-9]+$/.test(trimmedUsername)) {
        setFormError("使用者名稱只能包含字母和數字");
        return false;
      }
    } else if (field === "email") {
      const trimmedEmail = formData.email.trim();
      if (!trimmedEmail) {
        setFormError("請輸入電子信箱");
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setFormError("請輸入有效的電子信箱地址");
        return false;
      }
    }
    // 驗證通過後，清除錯誤訊息（避免顯示過時的錯誤）
    setFormError(null);
    return true;
  };

  // @action [RegisterPage]:emailRegisterForm 表單驗證（用於 onSubmit 與後端驗證規則一致）
  const validateForm = (): boolean => {
    const trimmedUsername = formData.username.trim();
    const trimmedEmail = formData.email.trim();

    if (!trimmedUsername) {
      setFormError("請輸入使用者名稱");
      return false;
    }

    // 檢查使用者名稱長度（3-50 字符）
    if (trimmedUsername.length < 3) {
      setFormError("使用者名稱至少需要 3 個字符");
      return false;
    }
    if (trimmedUsername.length > 50) {
      setFormError("使用者名稱不能超過 50 個字符");
      return false;
    }

    // 檢查使用者名稱是否只包含字母和數字
    if (!/^[a-zA-Z0-9]+$/.test(trimmedUsername)) {
      setFormError("使用者名稱只能包含英文字母和數字");
      return false;
    }

    if (!trimmedEmail) {
      setFormError("請輸入電子信箱");
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError("請輸入有效的電子信箱地址");
      return false;
    }

    return true;
  };

  // @action [RegisterPage]:emailRegisterForm 郵箱註冊處理函數
  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm()) {
      return;
    }

    try {
      const email = formData.email.trim();
      // [UserStore]:register 
      await register({
        username: formData.username.trim(),
        email: email,
      });

      // 註冊成功後，獲取 email verification token（避免 email 暴露在 URL）
      const { token } = await authApi.getEmailVerificationToken(email);
      // 註冊資料發送後，跳轉到郵箱驗證頁面（使用 token）
      router.push(`/register/verify-email?token=${encodeURIComponent(token)}`);
    } catch (error) {
      // [UserStore]:registerError -> errorMessage顯示
      console.error("註冊失敗:", error);
      
    }
  };

  // @action [RegisterPage]:oauthRegisterButtons 第三方登入處理函數
  const handleOAuthRegister = async (
    provider: "google" | "facebook" | "line"
  ) => {
    try {
      // [UserStore]:redirectToOAuthLogin (導向 OAuth 授權頁面)
      await redirectToOAuthLogin(provider, "register");
    } catch (error) {
      // [UserStore]:registerError -> errorMessage顯示
      console.error(`${provider} 註冊失敗:`, error);
    }
  };

  return (
    <>
      {/* @ui [RegisterPage]:header 標題區塊 */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">註冊</h2>
        <p className="text-gray-600">選擇您偏好的註冊方式</p>
      </div>

      {/* @ui [RegisterPage]:errorMessage 錯誤訊息區塊 - 使用 errorMessage state */}
      {errorMessage && (
        <div
          className="p-4 bg-red-50 border border-red-200 rounded-md"
          data-testid="register-error-message"
        >
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      )}

      {/* @ui [RegisterPage]:emailRegisterForm 郵箱註冊表單 - 使用 handleEmailRegister, validateForm, validateField */}
      <form onSubmit={handleEmailRegister} className="space-y-6" noValidate>
          <div className="bg-white C3-lg shadow-md p-6 space-y-4">
            {/* 使用者名稱輸入欄位 - 使用 formData.username, validateField("username") */}
            <div>
              <label
                htmlFor="register-username"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                使用者名稱
              </label>
              <input
                id="register-username"
                type="text"
                value={formData.username}
                onChange={(e) => {
                  setFormData({ ...formData, username: e.target.value });
                  // 如果之前有錯誤且用戶正在修正，清除錯誤訊息
                  if (formError) {
                    setFormError(null);
                  }
                }}
                onBlur={() => {
                  if (formData.username.trim()) {
                    validateField("username");
                  }
                }}
                disabled={isRegistering}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-green-logo disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="請輸入使用者名稱"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                長度 3-50 個字符，只能包含英文字母和數字
              </p>
            </div>

            {/* 電子信箱輸入欄位 - 使用 formData.email, validateField("email") */}
            <div>
              <label
                htmlFor="register-email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                電子信箱
              </label>
              <input
                id="register-email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (formError) {
                    setFormError(null);
                  }
                }}
                onBlur={() => {
                  if (formData.email.trim()) {
                    validateField("email");
                  }
                }}
                disabled={isRegistering}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-green-logo disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="請輸入電子信箱"
                required
              />
            </div>

            {/* 註冊表單 提示訊息 */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-600">
                註冊後請至信箱點擊驗證連結並設定密碼，即可啟用帳號。
              </p>
            </div>

            {/* 註冊表單 註冊按鈕 - 觸發 handleEmailRegister */}
            <button
              type="submit"
              disabled={isRegistering}
              data-testid="register-submit-button"
              className="w-full px-4 py-3 bg-theme-green-logo text-white rounded-md hover:bg-theme-green-logo-light focus:outline-none focus:ring-2 focus:ring-theme-green-logo disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isRegistering ? "註冊中..." : "使用 電子信箱 註冊"}
            </button>
          </div>
        </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-gray-50 text-gray-500">或</span>
        </div>
      </div>

      {/* @ui [RegisterPage]:oauthRegisterButtons 第三方登入按鈕區塊 - 使用 handleOAuthRegister */}
      <div className="bg-white rounded-lg shadow-md p-6 space-y-3">
        {/* Google 註冊按鈕 */}
        <button
          onClick={() => handleOAuthRegister("google")}
          disabled={isRegistering}
          data-testid="register-google-button"
          className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-theme-green-logo disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <div className="w-5 h-5 flex items-center justify-center mr-3">
            <FaGoogle className="text-red-500" size={20} />
          </div>
          <span className="text-gray-700 font-medium w-40 text-left">
            &nbsp;{isRegistering ? "註冊中..." : "使用 Google 註冊"}
          </span>
        </button>

        {/* Facebook 註冊按鈕 */}
        <button
          onClick={() => handleOAuthRegister("facebook")}
          disabled={isRegistering}
          data-testid="register-facebook-button"
          className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-theme-green-logo disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <div className="w-5 h-5 flex items-center justify-center mr-3">
            <FaFacebook className="text-blue-500" size={20} />
          </div>
          <span className="text-gray-700 font-medium w-40 text-left">
            &nbsp;{isRegistering ? "註冊中..." : "使用 Facebook 註冊"}
          </span>
        </button>

        {/* Line 註冊按鈕 */}
        <button
          onClick={() => handleOAuthRegister("line")}
          disabled={isRegistering}
          data-testid="register-line-button"
          className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-theme-green-logo disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <div className="w-5 h-5 flex items-center justify-center mr-3">
            <FaLine className="text-green-500" size={20} />
          </div>
          <span className="text-gray-700 font-medium w-40 text-left">
            &nbsp;{isRegistering ? "註冊中..." : "使用 Line 註冊"}
          </span>
        </button>
      </div>

      {/* @ui [RegisterPage]:termsOfService 服務條款 */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600 text-center">
          註冊即表示您同意我們的
          <Link
            href="/terms#terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline mx-1"
          >
            服務條款
          </Link>
          和
          <Link
            href="/terms#privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline mx-1"
          >
            隱私政策
          </Link>
        </p>
      </div>

      {/* @ui [RegisterPage]:switchToLogin */}
      <div className="text-center">
        <p className="text-sm text-gray-600">
          已經有帳號？
          <Link
            href="/login"
            className="text-blue-600 hover:text-blue-800 font-medium ml-1"
          >
            立即登入
          </Link>
        </p>
      </div>
    </>
  );
}

