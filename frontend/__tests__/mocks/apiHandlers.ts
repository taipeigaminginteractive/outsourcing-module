// --------------------------------------------
// Mock API Handlers
// Define request handlers for mocking API responses.
// --------------------------------------------

import { http, HttpResponse } from "msw";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const apiHandlers = [
  // Mock conversation API - 創建對話
  http.post(`${API_BASE_URL}/conversation/conversations`, () => {
    return HttpResponse.json({
      success: true,
      conversation_id: "test-conversation-id",
      title: "新對話",
    });
  }),

  // Mock conversation API - 獲取所有對話
  http.get(`${API_BASE_URL}/conversation/conversations`, () => {
    return HttpResponse.json([
      {
        id: "test-conversation-id",
        title: "測試對話",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        message_count: 0,
      },
    ]);
  }),

  // Mock conversation API - 獲取單個對話
  http.get(`${API_BASE_URL}/conversation/conversations/:id`, ({ params }) => {
    return HttpResponse.json({
      conversation_id: params.id,
      title: "測試對話",
      messages: [
        {
          role: "user",
          content: "測試訊息",
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }),

  // Mock conversation API - 刪除對話
  http.delete(`${API_BASE_URL}/conversation/conversations/:id`, () => {
    return HttpResponse.json({
      success: true,
      message: "對話已刪除",
    });
  }),

  // Mock conversation API - AI 聊天回應
  http.post(`${API_BASE_URL}/conversation/ai-chat-response`, () => {
    return HttpResponse.json({
      conversation_id: "test-conversation-id",
      response: "這是 AI 的回應",
      model_info: {},
      conversation_title: "測試對話",
    });
  }),

  // Mock conversation API - 獲取可用模型
  http.get(`${API_BASE_URL}/conversation/models`, () => {
    return HttpResponse.json({
      success: true,
      models: [{ id: "model-1", name: "Test Model" }],
    });
  }),

  // Mock conversation API - 獲取提示詞模板
  http.get(`${API_BASE_URL}/conversation/prompt-templates`, () => {
    return HttpResponse.json({
      success: true,
      templates: [{ id: "template-1", name: "Test Template" }],
    });
  }),

  // Mock guide API - 獲取歡迎訊息
  http.get(`${API_BASE_URL}/guide/welcome-message/:chatId`, () => {
    return HttpResponse.json({
      welcome_message: "歡迎來到我們的聊天平台！",
    });
  }),

  // Mock auth API - 登入
  http.post(`${API_BASE_URL}/auth/login`, () => {
    return HttpResponse.json({
      access_token: "test-token",
      token_type: "bearer",
      expires_in: 1800,
    });
  }),

  // Mock auth API - 註冊
  http.post(`${API_BASE_URL}/auth/register`, () => {
    return HttpResponse.json({
      id: "new-user-id",
      username: "newuser",
      email: "newuser@example.com",
    });
  }),

  // Mock auth API - 獲取 OAuth URL
  http.get(`${API_BASE_URL}/auth/oauth/:provider/url`, ({ params }) => {
    const { provider } = params;
    const oauthUrls: Record<string, string> = {
      google: "https://accounts.google.com/o/oauth2/v2/auth?client_id=test",
      facebook: "https://www.facebook.com/v12.0/dialog/oauth?client_id=test",
      line: "https://access.line.me/oauth2/v2.1/authorize?client_id=test",
    };

    return HttpResponse.json({
      auth_url: oauthUrls[provider as string] || "https://example.com/oauth",
    });
  }),

  // Mock auth API - OAuth callback
  http.get(`${API_BASE_URL}/auth/oauth/:provider/callback`, () => {
    return HttpResponse.json({
      access_token: "oauth-test-token",
      token_type: "bearer",
      user: {
        id: "oauth-user-id",
        username: "oauthuser",
        email: "oauth@example.com",
      },
    });
  }),

  // Mock auth API - OAuth callback (POST)
  http.post(`${API_BASE_URL}/auth/oauth/:provider`, () => {
    return HttpResponse.json({
      access_token: "oauth-test-token",
      token_type: "bearer",
      user: {
        id: "oauth-user-id",
        username: "oauthuser",
        email: "oauth@example.com",
      },
    });
  }),

  // Mock auth API - Refresh token
  http.post(`${API_BASE_URL}/auth/refresh`, () => {
    return HttpResponse.json({
      access_token: "refreshed-token",
      token_type: "bearer",
      expires_in: 1800,
    });
  }),

  // Mock auth API - Logout
  http.post(`${API_BASE_URL}/auth/logout`, () => {
    return HttpResponse.json({
      message: "登出成功",
      revoked_tokens: 1,
    });
  }),

  // Mock auth API - Send verification email
  http.post(`${API_BASE_URL}/auth/send-verification-email`, () => {
    return HttpResponse.json({
      message: "驗證信已發送",
    });
  }),

  // Mock auth API - Verify email
  http.post(`${API_BASE_URL}/auth/verify-email`, () => {
    return HttpResponse.json({
      message: "信箱驗證成功",
    });
  }),

  // Mock auth API - Forgot password
  http.post(`${API_BASE_URL}/auth/forgot-password`, () => {
    return HttpResponse.json({
      message: "如果該信箱已註冊，您將收到重設密碼的郵件",
    });
  }),

  // Mock auth API - Reset password
  http.post(`${API_BASE_URL}/auth/reset-password`, () => {
    return HttpResponse.json({
      message: "密碼重設成功",
    });
  }),

  // Mock auth API - Change password
  http.post(`${API_BASE_URL}/auth/change-password`, () => {
    return HttpResponse.json({
      message: "密碼修改成功",
      revoked_tokens: "all",
    });
  }),

  // Mock user API - 獲取用戶資訊
  http.get(`${API_BASE_URL}/user/me`, () => {
    return HttpResponse.json({
      id: "test-user-id",
      username: "testuser",
      email: "test@example.com",
      role: "user",
      is_verified: true,
      is_upgraded: false,
    });
  }),
];
