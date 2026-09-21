/**
 * 同步 HTTP —— drpy 的 req() 是同步 API，浏览器没有原生同步 fetch。
 *
 * 方案: 在 Android WebView 里用同步 XHR（async:false）。
 * 缺点: 会阻塞 UI 线程，但 drpy 源的调用链基本都在"用户点击 → 加载列表"的瞬间完成，
 * 可接受。若后续想彻底解决，需把 drpy2.min 改造成全异步（工作量大，暂不做）。
 */
import JSON5 from 'json5';

interface ReqOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  data?: any;
  timeout?: number;
  withHeaders?: boolean;
  buffer?: number;
  redirect?: any;
  postType?: string;
}

export function syncRequest(
  url: string,
  options: ReqOptions = {},
): { content: string; headers?: Record<string, string>; statusCode?: number } {
  try {
    const xhr = new XMLHttpRequest();
    const method = (options.method || 'GET').toUpperCase();
    xhr.open(method, url, false); // 同步

    const headers = options.headers || {};
    for (const [k, v] of Object.entries(headers)) {
      try {
        xhr.setRequestHeader(k, String(v));
      } catch {
        /* 忽略非法 header */
      }
    }

    let body: any;
    if (options.data) {
      const isForm =
        options.postType === 'form' ||
        Object.keys(headers).some(
          (k) => k.toLowerCase() === 'content-type' && String(headers[k]).includes('application/x-www-form-urlencoded'),
        );
      if (isForm) {
        try {
          xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        } catch {}
        body = new URLSearchParams(options.data).toString();
      } else {
        body = typeof options.data === 'string' ? options.data : JSON.stringify(options.data);
      }
    } else if (options.body !== undefined) {
      body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    xhr.send(body ?? null);

    const respHeaders: Record<string, string> = {};
    xhr.getAllResponseHeaders()
      .trim()
      .split(/[\r\n]+/)
      .filter(Boolean)
      .forEach((line) => {
        const idx = line.indexOf(':');
        if (idx > 0) respHeaders[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      });

    if (options.withHeaders) {
      return {
        statusCode: xhr.status,
        headers: respHeaders,
        content: xhr.responseText,
      };
    }
    return { content: xhr.responseText };
  } catch (e: any) {
    console.error('[sync-request] failed:', url, e?.message);
    return options.withHeaders ? { statusCode: 500, headers: {}, content: '' } : { content: '' };
  }
}

export default syncRequest;
