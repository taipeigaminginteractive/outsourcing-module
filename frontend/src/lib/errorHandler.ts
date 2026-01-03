// ================================================
// API 錯誤處理工具
// ================================================

// ================================================
// 類型定義
// ================================================

// FastAPI 驗證錯誤格式
export interface FastAPIValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

// 結構化的錯誤響應（error可回傳結構化資料）
export interface StructuredErrorDetail {
  message: string;
  requiresAction?: boolean;
  data?: Record<string, unknown>;
}

export interface FastAPIErrorResponse {
  detail: string | FastAPIValidationError[] | StructuredErrorDetail;
}

// 擴展的錯誤類型
export interface ApiError extends Error {
  status?: number;
  detail?: string;
  requiresAction?: boolean;
  data?: Record<string, unknown>;
}

// ================================================
// 網絡錯誤檢測
// ================================================

/**
 * 檢測是否為網絡錯誤（fetch失敗、連接超時等後端出現的錯誤）
 *
 * @param error 錯誤對象
 * @returns 是否為網絡錯誤
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

// ================================================
// FastAPI 錯誤處理函數
// ================================================

/**
 * 處理 FastAPI detail 字段（可能是字符串、驗證錯誤數組或結構化對象）
 */
export function parseErrorDetail(
  detail: string | FastAPIValidationError[] | StructuredErrorDetail | undefined
): { message: string; detail?: string; structured?: StructuredErrorDetail } {
  if (!detail) {
    return { message: "", detail: undefined };
  }

  if (Array.isArray(detail)) {
    // FastAPI 422 驗證錯誤格式：多個驗證錯誤
    const errors = detail.map((err: FastAPIValidationError) => {
      const field = err.loc?.slice(1).join(".") || "欄位";
      return `${field}: ${err.msg}`;
    });
    const errorMessage = errors.join("; ");
    return { message: errorMessage, detail: errorMessage };
  } else if (typeof detail === "object" && "message" in detail) {
    // 結構化的錯誤響應
    return {
      message: detail.message,
      detail: detail.message,
      structured: detail as StructuredErrorDetail,
    };
  } else {
    // 單一錯誤訊息（字符串）
    return { message: detail as string, detail: detail as string };
  }
}

/**
 * 從 Response 中提取錯誤訊息
 * @param response - Fetch Response 對象
 * @param preParsedData - 可選的已解析的錯誤數據（避免重複解析）
 */
export async function extractErrorDetail(
  response: Response,
  preParsedData?:
    | FastAPIErrorResponse
    | { detail?: string | StructuredErrorDetail }
): Promise<{
  message: string;
  detail?: string;
  structured?: StructuredErrorDetail;
}> {
  const defaultMessage = `HTTP error! status: ${response.status}`;

  // 如果已經有解析過的數據，直接使用
  if (preParsedData?.detail) {
    const result = parseErrorDetail(preParsedData.detail);
    return {
      message: result.message || defaultMessage,
      detail: result.detail,
      structured: result.structured,
    };
  }

  // 否則嘗試從 response 解析
  try {
    const errorData = (await response.json()) as FastAPIErrorResponse;
    if (errorData.detail) {
      const result = parseErrorDetail(errorData.detail);
      return {
        message: result.message || defaultMessage,
        detail: result.detail,
        structured: result.structured,
      };
    }
  } catch {
    // 如果無法解析 JSON，使用默認錯誤訊息
  }

  return { message: defaultMessage, detail: undefined };
}

/**
 * 創建標準化的 API 錯誤
 * 將後端返回的 結構化data 轉換為 更扁平的 ApiError 對象
 */
export function createApiError(
  message: string,
  status: number,
  detail?: string,
  structured?: StructuredErrorDetail
): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.detail = detail;
  if (structured) {
    error.requiresAction = structured.requiresAction;
    error.data = structured.data;
  }
  return error;
}

/**
 * 處理一般 API 錯誤
 * @param response - Fetch Response 對象
 * @param defaultMessage - 默認錯誤訊息
 * @param preParsedData - 可選的已解析的錯誤數據（避免重複解析）
 */
export async function handleApiError(
  response: Response,
  defaultMessage?: string,
  preParsedData?: FastAPIErrorResponse | { detail?: string }
): Promise<never> {
  const { message, detail } = await extractErrorDetail(response, preParsedData);
  const errorMessage =
    detail ||
    message ||
    defaultMessage ||
    `HTTP error! status: ${response.status}`;

  throw createApiError(errorMessage, response.status, detail);
}

/**
 * 處理 FastAPI 驗證錯誤（422）用於註冊、設置密碼等需驗證的請求
 */
export async function handleValidationError(
  response: Response
): Promise<never> {
  const { message } = await extractErrorDetail(response);
  throw createApiError(message, response.status);
}

/**
 * 處理結構化錯誤響應
 * 如果後端返回了結構化的錯誤響應，直接使用並拋出錯誤
 * 如果沒有結構化錯誤，則拋出普通錯誤
 *
 * @param response - Fetch Response 對象
 * @param defaultMessage - 默認錯誤訊息
 */
export async function handleStructuredError(
  response: Response,
  defaultMessage: string = "操作失敗"
): Promise<never> {
  const { message, detail, structured } = await extractErrorDetail(response);

  // 如果後端返回了結構化的錯誤響應，直接使用
  if (structured) {
    throw createApiError(
      structured.message || message || defaultMessage,
      response.status,
      detail,
      structured
    );
  }

  // 如果沒有結構化錯誤，拋出普通錯誤
  const errorMessage = detail || message || defaultMessage;
  throw createApiError(errorMessage, response.status, detail);
}

/**
 * 將網絡錯誤轉換為友好的 API 錯誤
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
 * 包裝 API 調用，自動處理網絡錯誤 (目前先不用)
 * @param apiCall API 調用函數
 * @returns API 調用的結果
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
