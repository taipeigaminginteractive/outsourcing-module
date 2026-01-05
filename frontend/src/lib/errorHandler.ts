
// ================================================
// 類型定義
// ================================================

/**
 * 後端回傳 API 錯誤基礎類型
 */
export interface ApiErrorBase extends Error {
  status?: number;
  detail?: string;
}

/**
 * custom ApiRequiresActionError 的 detail 格式
 */
export interface NextActionRequired {
  code: string;
  message: string;
  requiresAction: true;
  data?: Record<string, unknown>;
}

/**
 * custom 前端需要下一步操作的錯誤（去驗證信箱、去補資料等） 
 */
export interface ApiRequiresActionError extends ApiErrorBase {
  // 由detail取出 nextActionRequired 對象
  nextActionRequired: NextActionRequired;
}

/**
 * fastapi ApiValidationError 的 detail 格式
 */
export interface ValidationItem {
  loc: (string | number)[];
  msg: string;
  type: string;
}

/**
 * fastapi 422 資料驗證錯誤
 */
export interface ApiValidationError extends ApiErrorBase {
  status: 422;
  // 由detail取出 issue array
  issues: ValidationItem[];
}

export type ApiError = 
ApiErrorBase | 
ApiRequiresActionError | 
ApiValidationError;

export type ErrorDetail =
  | string
  | Record<string, unknown>
  | unknown[]
  | ValidationItem[]
  | NextActionRequired;

// ================================================
// 工具函數
// ================================================

export function isApiRequiresActionError(err: unknown): err is ApiRequiresActionError {
  if (!(err instanceof Error)) return false;
  if (typeof err !== "object" || err === null) return false;

  const obj = err as unknown as Record<string, unknown>;
  if (typeof obj.nextActionRequired !== "object" || obj.nextActionRequired === null) {
    return false;
  }

  const next = obj.nextActionRequired as Record<string, unknown>;
  return (
    next.requiresAction === true &&
    (next.data === undefined ||
      (typeof next.data === "object" && next.data !== null))
  );
}

export function isApiValidationError(err: unknown): err is ApiValidationError {
  if (!(err instanceof Error)) return false;
  if (typeof err !== "object" || err === null) return false;

  const obj = err as unknown as Record<string, unknown>;
  return obj.status === 422 && Array.isArray(obj.issues);
}

/**
 * 將錯誤 detail 轉換為字串（用於 array/object detail）
 */
function stringifyDetail(detail: unknown): string {
  try {
    return JSON.stringify(detail, null, 2);
  } catch {
    return String(detail);
  }
}

// ================================================
// FastAPI 錯誤處理函數
// ================================================

/**
 * 創建標準化的 API 錯誤
 * 將後端返回的錯誤轉換為 ApiError 對象
 */
export function createApiError(
  message: string,
  status: number,
  detail?: string
): ApiError {
  const error = new Error(message) as ApiErrorBase;
  error.status = status;
  error.detail = detail;
  return error;
}

/**
 * 處理一般 API 錯誤 (detail 為 array/object/string)
 * @param response - Fetch Response 對象
 * @param defaultMessage - 默認錯誤訊息
 */
export async function handleApiError(
  response: Response,
  defaultMessage?: string,
): Promise<never> {
  const defaultMsg = `HTTP error! status: ${response.status}`;
  let message = defaultMessage || defaultMsg;
  let detail: string | undefined;

  // 嘗試從 response 解析錯誤訊息
  try {
    const errorData = (await response.json()) as { detail?: ErrorDetail };
    const errorDetail = errorData.detail;

    if (errorDetail) {
      if (Array.isArray(errorDetail)) {
        // array detail：轉換為可讀字串
        message = "Request failed";
        detail = stringifyDetail(errorDetail);
      } else if (typeof errorDetail === "object") {
        // object detail：提取 message 當作顯示訊息，但 detail 保留完整 JSON 字串（包含 code 等所有欄位）
        const obj = errorDetail as Record<string, unknown>;
        const msg = typeof obj.message === "string" ? obj.message : "";
        message = msg || "Request failed";
        detail = stringifyDetail(errorDetail);
      } else {
        // string detail：單一錯誤訊息（字符串）
        message = errorDetail as string;
        detail = errorDetail as string;
      }
    }
  } catch {
    // 如果無法解析 JSON，使用默認錯誤訊息
  }

  const errorMessage = detail || message || defaultMessage || defaultMsg;
  throw createApiError(errorMessage, response.status, detail);
}

/**
 * 處理 FastAPI 驗證錯誤 422 用於需要資料驗證的請求
 */
export async function handleValidationError(
  response: Response,
  defaultMessage: string = "請求資料驗證失敗"
): Promise<never> {
  try {
    const errorData = (await response.json()) as { detail?: ErrorDetail };
    const detail = errorData.detail;
    if (detail && Array.isArray(detail)) {
      // 422 驗證錯誤：detail 為 ValidationItem[]
      const issues = detail as ValidationItem[];
      
      const errors = issues.map((item) => {
        const loc = Array.isArray(item.loc) ? item.loc : [];
        const field = loc.slice(1).join(".") || "欄位";
        return `${field}: ${item.msg}`;
      });
      const errorMessage = errors.join("; ");

      // 直接創建 ApiValidationError
      const validationError = new Error(errorMessage) as ApiValidationError;
      validationError.status = 422;
      validationError.detail = errorMessage;
      validationError.issues = issues;
      throw validationError;
    }
  } catch (error) {
    // 如果已經是 ApiValidationError，直接 throw
    if (isApiValidationError(error)) {
      throw error;
    }
  }
  // Fallback：如果解析失敗，拋出一般錯誤
  throw createApiError(
    defaultMessage,
    response.status,
    defaultMessage
  );
}

/**
 * 處理 自定義 需要下一步操作的錯誤（requiresAction === true）
 */
export async function handleRequiresActionError(
  response: Response,
  defaultMessage: string = "操作失敗"
): Promise<never> {
  try {
    const errorData = (await response.json()) as { detail?: ErrorDetail };
    const detail = errorData.detail;
    
    // 檢查 detail 是否為 object 且 requiresAction === true
    if (
      detail &&
      typeof detail === "object" &&
      !Array.isArray(detail) &&
      (detail as Record<string, unknown>).requiresAction === true
    ) {
      const objectDetail = detail as Record<string, unknown>;
      
      // 提取 code 和 message
      const code = typeof objectDetail.code === "string" ? objectDetail.code : "";
      const message = typeof objectDetail.message === "string" ? objectDetail.message : defaultMessage;

      // 直接創建 ApiRequiresActionError
      const actionError = new Error(message) as ApiRequiresActionError;
      actionError.status = response.status;
      actionError.detail = message;
      actionError.nextActionRequired = {
        code,
        message,
        requiresAction: true,
        data:
          typeof objectDetail.data === "object" && objectDetail.data !== null
            ? (objectDetail.data as Record<string, unknown>)
            : {},
      };
      throw actionError;
    }
  } catch (error) {
    // 如果已經是 ApiRequiresActionError，直接 throw
    if (isApiRequiresActionError(error)) {
      throw error;
    }
    // 否則 fallback 到一般錯誤處理
  }

  // Fallback：如果解析失敗或不符合條件，拋出一般錯誤
  throw createApiError(
    defaultMessage,
    response.status,
    defaultMessage
  );
}



// ================================================
// 通用網絡錯誤處理
// ================================================

/**
 * 檢測是否為網絡錯誤（fetch失敗、連接超時等後端出現的錯誤）
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const msg = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  return (
    // TypeError: Chrome、Edge、Safari 在 fetch 失敗時拋出的錯誤類型
    // 例如：TypeError: Failed to fetch
    name === "typeerror" ||
    // NetworkError: Firefox 在網絡請求失敗時拋出的錯誤類型
    // 例如：NetworkError when attempting to fetch resource
    name === "networkerror" ||
    [
      // Chrome/Edge/Safari:當服務器無法連接、DNS 失敗、CORS 錯誤時會出現
      "failed to fetch",
      // Firefox :當網絡請求失敗時會出現
      "network error",
      // Safari :當請求被阻止或超時時會出現
      "network request failed",
      // Safari:當資源無法載入時會出現
      "load failed",
      // fetch API 失敗的訊息 (other browser or polyfill)
      "fetch failed",
    ].some((pattern) => msg.includes(pattern))
  );
}

/**
 * 將網絡錯誤轉換為友好的 API 錯誤
 * status 0 : 通用狀況 網絡問題 (例如: 連接超時、無法連接等)
 * @param error 原始錯誤
 * @returns ApiError 如果為網絡錯誤，否則返回 null
 */
export function convertNetworkError(error: unknown): ApiError | null {
  if (isNetworkError(error)) {
    return createApiError("服務暫時無法使用", 0, "網絡連接失敗");
  }
  return null;
}

/**
 * 包裝 API 調用，自動判定並處理網絡錯誤
 * @param apiCall API 調用函數
 * @returns API 調用的結果
 * @throws ApiError:
 * - status 0: 網絡問題 (例如: 連接超時、無法連接等)
 * - 其他 status: 其他 API 錯誤
 */
export async function withNetworkErrorHandling<T>(
  apiCall: () => Promise<T>
): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    // 處理網絡錯誤
    const networkError = convertNetworkError(error);
    if (networkError) throw networkError;
    throw error;
  }
}
