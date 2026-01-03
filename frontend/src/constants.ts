/**
 * API 基礎 URL
 * 從環境變數 NEXT_PUBLIC_API_URL 讀取，預設為 http://localhost:8000
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * WebSocket URL
 * 從環境變數 NEXT_PUBLIC_WEBSOCKET_URL 讀取，預設為 ws://localhost:8000/ws
 */
export const WEBSOCKET_URL =
  process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:8000/ws";

/**
 * 是否啟用 Mock 模式
 * 從環境變數 NEXT_PUBLIC_ENABLE_MOCK 讀取，預設為 false
 */
export const ENABLE_MOCK = process.env.NEXT_PUBLIC_ENABLE_MOCK === "true";

/**
 * 是否為開發環境
 * 從環境變數 NODE_ENV 判斷
 */
export const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

/**
 * 是否為生產環境
 * 從環境變數 NODE_ENV 判斷
 */
export const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * 是否為開發模式（開發環境或啟用 Mock）
 */
export const IS_DEV_MODE = IS_DEVELOPMENT || ENABLE_MOCK;
