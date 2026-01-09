import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 測試設定
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './__tests__/e2e',
  
  // 最大失敗數量
  maxFailures: process.env.CI ? 1 : undefined,
  
  // 完整並行執行
  fullyParallel: true,
  
  // 在 CI 中禁止 test.only
  forbidOnly: !!process.env.CI,
  
  // CI 中重試一次
  retries: process.env.CI ? 2 : 0,
  
  // 本地開發時使用較少的 workers
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter
  reporter: process.env.CI ? 'github' : 'html',
  
  // 共用設定
  use: {
    // 基礎 URL
    baseURL: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
    
    // 收集失敗時的追蹤資訊
    trace: 'on-first-retry',
    
    // 截圖設定
    screenshot: 'only-on-failure',
    
    // 視頻設定
    video: 'retain-on-failure',
  },

  // 測試專案設定
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // 行動裝置測試
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // 平板測試
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] },
    },
  ],

  // 本地開發伺服器設定
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

