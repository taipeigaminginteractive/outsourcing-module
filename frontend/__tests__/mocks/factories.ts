// --------------------------------------------
// Mock Data Factories
// 僅放置多個測項 都會使用到的通用資料 Factory functions
// Factory functions 的輸出內容以 實際被使用的 interface 為主
// --------------------------------------------

import type { UserResponse } from "@/api/authApi";

/**
 * 創建 UserResponse 測試資料
 * @param overrides - 覆蓋預設值的欄位
 * @returns UserResponse 對象
 */
export function createMockUserResponse(
  overrides?: Partial<UserResponse>
): UserResponse {
  return {
    id: 1,
    username: "testuser",
    email: "test@example.com",
    role: "user",
    status: "active",
    is_active: true,
    is_superuser: false,
    is_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * 創建測試用 token
 * @param prefix - Token 前綴（預設: 'test-token'）
 * @returns 生成的 token 字串
 * 
 * @example
 * const token = createTestToken('verify');
 */
export function createTestToken(prefix: string = "test-token"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
