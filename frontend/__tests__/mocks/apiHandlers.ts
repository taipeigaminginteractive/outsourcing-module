// --------------------------------------------
// Mock API Handlers
// - 僅放置多個測項 都會使用到的通用 API mock handlers
// - 特定測試專用的 mock 應該使用 server.use() 在測試內覆寫
// --------------------------------------------

import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/constants";

export const apiHandlers = [
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
]
