/**
 * E2E 測試: 註冊頁面 (Register Page)
 * 測試範圍: frontend/src/app/register/page.tsx
 * 
 * 測試涵蓋：
 * 1. Happy Path - Email 註冊流程
 * 2. Happy Path - OAuth 註冊流程
 * 3. Edge Cases - 表單驗證錯誤
 * 4. Edge Cases - API 錯誤處理
 * 5. Edge Cases - UI 互動行為
 */

import { test, expect, type Page, type Route } from '@playwright/test';
import { API_BASE_URL } from '@/constants';
import {
  testResponsiveDisplay,
  mockApiError,
  mockApiDelay,
  assertErrorMessage,
  assertButtonState,
} from 'tests@/e2e/e2e.helpers';
import { createMockUserResponse } from 'tests@/mocks/factories';


// ============================================
// 頁面 測試常數
// ============================================
const REGISTER_URL = '/register';

// 測試用戶資料
const VALID_USER = {
  username: 'testuser123',
  email: 'test@example.com',
};

const VERIFICATION_TOKEN = 'test-verification-token-12345';

// ============================================
// 頁面 Helper Functions
// ============================================

/**
 * 填寫註冊表單
 */
async function fillRegistrationForm(
  page: Page,
  username: string,
  email: string
) {
  await page.fill('#register-username', username);
  await page.fill('#register-email', email);
}

/**
 * 設定成功的註冊 API mock
 */
async function mockSuccessfulRegister(page: Page, username: string, email: string) {
  await page.route(`${API_BASE_URL}/auth/register`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        createMockUserResponse({
          username,
          email,
          status: 'inactive',
          is_active: false,
          is_verified: false,
        })
      ),
    });
  });
}

/**
 * 設定成功的 verification token API mock
 */
async function mockSuccessfulVerificationToken(page: Page) {
  await page.route(
    `${API_BASE_URL}/auth/get-email-verification-token`,
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: VERIFICATION_TOKEN,
          message: '驗證 token 已生成',
        }),
      });
    }
  );
}

/**
 * 設定成功的 OAuth URL API mock
 */
async function mockOAuthUrl(
  page: Page,
  provider: 'google' | 'facebook' | 'line',
  authUrl?: string
) {
  const defaultUrls = {
    google: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test',
    facebook: 'https://www.facebook.com/v12.0/dialog/oauth?client_id=test',
    line: 'https://access.line.me/oauth2/v2.1/authorize?client_id=test',
  };

  const url = authUrl || defaultUrls[provider];

  await page.route(
    `${API_BASE_URL}/auth/oauth/${provider}/url*`,
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ auth_url: url }),
      });
    }
  );
}

/**
 * 設定 OAuth URL API mock 拋出錯誤
 */
async function mockOAuthUrlError(
  page: Page,
  provider: 'google' | 'facebook' | 'line',
  statusCode: number,
  errorMessage: string
) {
  await page.route(
    `${API_BASE_URL}/auth/oauth/${provider}/url*`,
    async (route: Route) => {
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({ detail: errorMessage }),
      });
    }
  );
}


// ============================================
// Happy Path
// ============================================

test.describe('Happy Path - 註冊流程', () => {
  test('應該能夠成功使用 Email 註冊並重定向到驗證頁面', async ({ page }) => {
    // 前置條件: Mock API 成功回應
    await mockSuccessfulRegister(page, VALID_USER.username, VALID_USER.email);
    await mockSuccessfulVerificationToken(page);

    // Step 1: 訪問註冊頁面
    await page.goto(REGISTER_URL);

    // Step 2: 驗證頁面標題
    await expect(page.getByRole('heading', { name: '註冊' })).toBeVisible();

    // Step 3: 填寫註冊表單
    await fillRegistrationForm(page, VALID_USER.username, VALID_USER.email);

    // Step 4: 點擊註冊按鈕
    const submitButton = page.getByTestId('register-submit-button');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Step 5: 驗證按鈕顯示 loading 狀態
    await expect(submitButton).toHaveText('註冊中...');
    await expect(submitButton).toBeDisabled();

    // Step 6: 等待 API 調用完成並驗證重定向
    await page.waitForURL(/\/register\/verify-email\?token=.+/);
    
    // Step 7: 驗證 URL 包含 token
    const url = new URL(page.url());
    expect(url.searchParams.get('token')).toBe(VERIFICATION_TOKEN);

    // === 行動裝置顯示測試 ===
    await page.goto(REGISTER_URL);
    await testResponsiveDisplay(page, page.getByRole('heading', { name: '註冊' }));
  });

  test('應該能夠使用 OAuth 註冊並重定向到授權頁面', async ({ page }) => {
    // 前置條件: Mock OAuth URL API (只測試一個 provider 代表)
    await mockOAuthUrl(page, 'google');

    await page.goto(REGISTER_URL);

    // 監聽頁面導航
    const navigationPromise = page.waitForEvent('framenavigated');

    // Step 1: 點擊 OAuth 註冊按鈕
    const googleButton = page.getByTestId('register-google-button');
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toBeEnabled();
    await googleButton.click();

    // Step 2: 驗證重定向到 OAuth 授權頁面
    await navigationPromise;
    await page.waitForTimeout(500);
    
    const currentUrl = page.url();
    expect(currentUrl).toContain('accounts.google.com');
    
    // === 行動裝置顯示測試 ===
    await page.goto(REGISTER_URL);
    await mockOAuthUrl(page, 'google');
    await testResponsiveDisplay(page, googleButton);
  });
});

// ============================================
// Edge Cases - 表單驗證錯誤
// ============================================

test.describe('Edge Cases - 表單驗證錯誤', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(REGISTER_URL);
  });

  test('當必填欄位為空時，應該顯示錯誤訊息', async ({ page }) => {
    // 測試 Username 為空的情況（代表所有必填欄位）
    await page.fill('#register-email', VALID_USER.email);

    const submitButton = page.getByTestId('register-submit-button');
    await submitButton.click();

    // 使用共用的斷言 helper
    await assertErrorMessage(page, '請輸入使用者名稱', 'register-error-message');
    await assertButtonState(page, 'register-submit-button', { enabled: true });

    await testResponsiveDisplay(page, page.getByTestId('register-error-message'));
  });

  test('當欄位格式不正確時 (onBlur)，應該顯示錯誤訊息', async ({ page }) => {
    // 測試格式錯誤（代表所有格式驗證）
    const usernameInput = page.locator('#register-username');
    await usernameInput.fill('ab'); // 少於 3 個字符

    // 移開焦點觸發 onBlur 驗證
    await page.locator('#register-email').click();

    // 使用共用的斷言 helper
    await assertErrorMessage(page, '使用者名稱至少需要 3 個字符', 'register-error-message');

    await testResponsiveDisplay(page, page.getByTestId('register-error-message'));
  });
});

// ============================================
// Edge Cases - API 錯誤處理
// ============================================

test.describe('Edge Cases - API 錯誤處理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(REGISTER_URL);
  });

  test('當 API 回傳 4xx 錯誤（如用戶已存在），應該顯示錯誤訊息', async ({ page }) => {
    // 前置條件: Mock API 回傳 409 錯誤（代表所有 4xx 錯誤）
    await mockApiError(page, '/auth/register', 409, '此帳號已被註冊');

    await fillRegistrationForm(page, VALID_USER.username, VALID_USER.email);

    const submitButton = page.getByTestId('register-submit-button');
    await submitButton.click();

    await page.waitForTimeout(500);

    // 使用共用的斷言 helpers
    await assertErrorMessage(page, '此帳號已被註冊', 'register-error-message');
    await assertButtonState(page, 'register-submit-button', {
      enabled: true,
      text: '使用 電子信箱 註冊',
    });

    await testResponsiveDisplay(page, page.getByTestId('register-error-message'));
  });

  test('當 API 回傳 5xx 錯誤，應該顯示錯誤訊息', async ({ page }) => {
    // 前置條件: Mock API 回傳 500 錯誤（代表所有 5xx 錯誤）
    await mockApiError(page, '/auth/register', 500, 'Internal Server Error');

    await fillRegistrationForm(page, VALID_USER.username, VALID_USER.email);

    const submitButton = page.getByTestId('register-submit-button');
    await submitButton.click();

    await page.waitForTimeout(500);

    // 使用共用的斷言 helper
    await assertErrorMessage(page, '註冊失敗', 'register-error-message');

    await testResponsiveDisplay(page, page.getByTestId('register-error-message'));
  });

  test('當 Verification Token API 失敗，應該停留在註冊頁面並顯示錯誤', async ({ page }) => {
    // 前置條件: Mock 註冊成功，但 verification token 失敗
    await mockSuccessfulRegister(page, VALID_USER.username, VALID_USER.email);
    await mockApiError(page, '/auth/get-email-verification-token', 500, '獲取驗證失敗');

    await fillRegistrationForm(page, VALID_USER.username, VALID_USER.email);

    const submitButton = page.getByTestId('register-submit-button');
    await submitButton.click();

    await page.waitForTimeout(1000);

    // 驗證仍然在註冊頁面
    expect(page.url()).toContain(REGISTER_URL);

    // 使用共用的斷言 helper
    await assertErrorMessage(page, '獲取驗證失敗', 'register-error-message');

    await testResponsiveDisplay(page, page.getByTestId('register-error-message'));
  });

  test('當 OAuth API 失敗，應該顯示錯誤訊息', async ({ page }) => {
    // 前置條件: Mock OAuth URL API 回傳 503 錯誤
    await mockOAuthUrlError(page, 'google', 503, 'google 登入服務暫時無法使用');

    const googleButton = page.getByTestId('register-google-button');
    await googleButton.click();

    await page.waitForTimeout(500);

    // 驗證仍然在註冊頁面
    expect(page.url()).toContain(REGISTER_URL);

    // 使用共用的斷言 helper
    await assertErrorMessage(page, '登入服務暫時無法使用', 'register-error-message');

    await testResponsiveDisplay(page, page.getByTestId('register-error-message'));
  });
});

// ============================================
// Edge Cases - UI 互動測試
// ============================================

test.describe('Edge Cases - UI 互動行為', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(REGISTER_URL);
  });

  test('當用戶修正錯誤時，錯誤訊息應該被清除', async ({ page }) => {
    // Step 1: 不填寫 username 並提交
    await page.fill('#register-email', VALID_USER.email);
    const submitButton = page.getByTestId('register-submit-button');
    await submitButton.click();

    // Step 2: 驗證錯誤訊息顯示
    const errorMessage = page.getByTestId('register-error-message');
    await expect(errorMessage).toBeVisible();

    // Step 3: 開始輸入 username
    const usernameInput = page.locator('#register-username');
    await usernameInput.fill('t');

    // Step 4: 驗證錯誤訊息被清除
    await expect(errorMessage).not.toBeVisible();

    // === 行動裝置顯示測試 ===
    await usernameInput.clear();
    await submitButton.click();
    await expect(errorMessage).toBeVisible();
    
    await page.setViewportSize({ width: 375, height: 667 });
    await usernameInput.fill('test');
    await expect(errorMessage).not.toBeVisible();
    await page.waitForTimeout(1000);
  });

  test('loading 狀態時，所有輸入欄位和按鈕都應該被禁用', async ({ page }) => {
    // 前置條件: Mock 一個延遲的 API 回應
    await mockApiDelay(
      page,
      '/auth/register',
      2000,
      createMockUserResponse({
        username: VALID_USER.username,
        email: VALID_USER.email,
      })
    );

    await mockSuccessfulVerificationToken(page);

    // Step 1: 填寫表單並提交
    await fillRegistrationForm(page, VALID_USER.username, VALID_USER.email);
    const submitButton = page.getByTestId('register-submit-button');
    await submitButton.click();

    // Step 2: 驗證 loading 狀態（使用共用的斷言 helper）
    await assertButtonState(page, 'register-submit-button', {
      disabled: true,
      text: '註冊中...',
    });

    // Step 3: 驗證輸入欄位被禁用
    const usernameInput = page.locator('#register-username');
    const emailInput = page.locator('#register-email');
    await expect(usernameInput).toBeDisabled();
    await expect(emailInput).toBeDisabled();

    // Step 4: 驗證 OAuth 按鈕被禁用
    const googleButton = page.getByTestId('register-google-button');
    await expect(googleButton).toBeDisabled();

    // === 行動裝置顯示測試 ===
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(submitButton).toBeDisabled();
    await page.waitForTimeout(1000);

    // 等待請求完成
    await page.waitForURL(/\/register\/verify-email\?token=.+/, { timeout: 5000 });
  });

  test('應該能夠點擊導航連結跳轉到其他頁面', async ({ page }) => {
    // Step 1: 找到"立即登入"連結
    const loginLink = page.getByRole('link', { name: '立即登入' });
    await expect(loginLink).toBeVisible();

    // Step 2: 點擊連結
    await loginLink.click();

    // Step 3: 驗證跳轉到登入頁面
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');

    // === 行動裝置顯示測試 ===
    await page.goto(REGISTER_URL);
    await testResponsiveDisplay(page, loginLink);
  });
});
