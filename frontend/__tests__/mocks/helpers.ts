// --------------------------------------------
// Mock Helpers
// 僅放置多個測項 都會使用到的通用 Helper functions
// --------------------------------------------

import { vi } from "vitest";

/**
 * 創建一個 deferred promise
 * 用於測試需要手動控制 Promise 解決時機的情境
 * 
 * @example
 * const { promise, resolve } = createDeferred<string>();
 * // 在 mock 中使用
 * server.use(
 *   http.get('/api', async () => {
 *     await promise;
 *     return HttpResponse.json({ data: 'test' });
 *   })
 * );
 * // 稍後手動觸發
 * resolve('done');
 * 
 * @returns 包含 promise、resolve、reject 的物件
 */
export function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Mock window.location.href
 * 用於測試需要重定向的情境 可查看URL變化
 * @returns mockLocationHref - 可用於驗證重定向是否被呼叫的 mock 函數
 */
export function mockWindowLocationHref() {
  const mockLocationHref = vi.fn();
  
  Object.defineProperty(window, "location", {
    value: {
      _href: "",
      get href() {
        return this._href;
      },
      set href(url: string) {
        this._href = url;
        mockLocationHref(url);
      },
    },
    writable: true,
  });

  return mockLocationHref;
}