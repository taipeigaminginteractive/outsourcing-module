/**
 * E2E 測試共用 Helper Functions
 * 
 * 此檔案包含所有 E2E 測試中可共用的工具函數
 */

import { expect, type Page, type Route, type Locator } from '@playwright/test';
import { API_BASE_URL } from '@/constants';

// ============================================
// 常數
// ============================================

/**
 * 響應式測試的裝置尺寸
 */
export const DEVICE_SIZES = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
} as const;

// ============================================
// UI 測試 Helpers
// ============================================

/**
 * 測試響應式顯示（手機/平板）
 * 
 * @param page - Playwright Page 物件
 * @param elementToCheck - 要檢查的元素（Locator）
 * @param options - 選項
 * @param options.includeDesktop - 是否包含桌面尺寸測試（預設: false）
 * @param options.pauseDuration - 每個尺寸的停頓時間（毫秒，預設: 1000）
 * 
 * @example
 * await testResponsiveDisplay(page, page.getByRole('heading', { name: '註冊' }));
 */
export async function testResponsiveDisplay(
  page: Page,
  elementToCheck: Locator,
  options: {
    includeDesktop?: boolean;
    pauseDuration?: number;
  } = {}
) {
  const { includeDesktop = false, pauseDuration = 1000 } = options;

  // 手機尺寸
  await page.setViewportSize(DEVICE_SIZES.mobile);
  await expect(elementToCheck).toBeVisible();
  await page.waitForTimeout(pauseDuration);

  // 平板尺寸
  await page.setViewportSize(DEVICE_SIZES.tablet);
  await expect(elementToCheck).toBeVisible();
  await page.waitForTimeout(pauseDuration);

  // 桌面尺寸（可選）
  if (includeDesktop) {
    await page.setViewportSize(DEVICE_SIZES.desktop);
    await expect(elementToCheck).toBeVisible();
    await page.waitForTimeout(pauseDuration);
  }
}

/**
 * 等待元素出現並返回
 * 
 * @param page - Playwright Page 物件
 * @param selector - 元素選擇器
 * @param options - 等待選項
 * 
 * @example
 * const button = await waitForElement(page, '[data-testid="submit-button"]');
 */
export async function waitForElement(
  page: Page,
  selector: string,
  options?: { timeout?: number }
) {
  return await page.waitForSelector(selector, {
    state: 'visible',
    ...options,
  });
}

// ============================================
// API Mock Helpers - 通用
// ============================================

/**
 * Mock API 錯誤回應（通用）
 * 
 * @param page - Playwright Page 物件
 * @param endpoint - API 端點路徑
 * @param statusCode - HTTP 狀態碼
 * @param errorMessage - 錯誤訊息
 * @param method - HTTP 方法（預設: POST）
 * 
 * @example
 * await mockApiError(page, '/auth/register', 409, '此帳號已被註冊');
 * await mockApiError(page, '/auth/login', 401, '帳號或密碼錯誤', 'POST');
 */
export async function mockApiError(
  page: Page,
  endpoint: string,
  statusCode: number,
  errorMessage: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'POST'
) {
  const routePattern = `${API_BASE_URL}${endpoint}`;

  await page.route(routePattern, async (route: Route) => {
    if (route.request().method() === method) {
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({ detail: errorMessage }),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock API 延遲回應（用於測試 loading 狀態）
 * 
 * @param page - Playwright Page 物件
 * @param endpoint - API 端點路徑
 * @param delay - 延遲時間（毫秒）
 * @param responseData - 回應資料
 * @param method - HTTP 方法（預設: POST）
 * 
 * @example
 * await mockApiDelay(page, '/auth/register', 2000, { id: 1, username: 'test' });
 */
export async function mockApiDelay(
  page: Page,
  endpoint: string,
  delay: number,
  responseData: unknown,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'POST'
) {
  const routePattern = `${API_BASE_URL}${endpoint}`;

  await page.route(routePattern, async (route: Route) => {
    if (route.request().method() === method) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseData),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock API 驗證錯誤回應（422）
 * 
 * @param page - Playwright Page 物件
 * @param endpoint - API 端點路徑
 * @param validationErrors - 驗證錯誤陣列
 * 
 * @example
 * await mockApiValidationError(page, '/auth/register', [
 *   { loc: ['body', 'email'], msg: 'value is not a valid email address', type: 'value_error.email' }
 * ]);
 */
export async function mockApiValidationError(
  page: Page,
  endpoint: string,
  validationErrors: Array<{
    loc: string[];
    msg: string;
    type: string;
  }>
) {
  const routePattern = `${API_BASE_URL}${endpoint}`;

  await page.route(routePattern, async (route: Route) => {
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ detail: validationErrors }),
    });
  });
}

// ============================================
// 斷言 Helpers
// ============================================

/**
 * 驗證錯誤訊息是否顯示
 * 
 * @param page - Playwright Page 物件
 * @param expectedMessage - 預期的錯誤訊息（部分匹配）
 * @param testId - 錯誤訊息元素的 data-testid（預設: 'error-message'）
 * 
 * @example
 * await assertErrorMessage(page, '此帳號已被註冊');
 * await assertErrorMessage(page, '請輸入', 'register-error-message');
 */
export async function assertErrorMessage(
  page: Page,
  expectedMessage: string,
  testId: string = 'error-message'
) {
  const errorElement = page.getByTestId(testId);
  await expect(errorElement).toBeVisible();
  await expect(errorElement).toContainText(expectedMessage);
}

/**
 * 驗證按鈕狀態
 * 
 * @param page - Playwright Page 物件
 * @param buttonTestId - 按鈕的 data-testid
 * @param expectedState - 預期狀態
 * 
 * @example
 * await assertButtonState(page, 'submit-button', { disabled: true, text: '載入中...' });
 */
export async function assertButtonState(
  page: Page,
  buttonTestId: string,
  expectedState: {
    disabled?: boolean;
    enabled?: boolean;
    text?: string;
  }
) {
  const button = page.getByTestId(buttonTestId);

  if (expectedState.disabled !== undefined) {
    if (expectedState.disabled) {
      await expect(button).toBeDisabled();
    } else {
      await expect(button).toBeEnabled();
    }
  }

  if (expectedState.enabled !== undefined) {
    if (expectedState.enabled) {
      await expect(button).toBeEnabled();
    } else {
      await expect(button).toBeDisabled();
    }
  }

  if (expectedState.text !== undefined) {
    await expect(button).toHaveText(expectedState.text);
  }
}

