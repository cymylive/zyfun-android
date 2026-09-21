/**
 * /v1/system/* 本地路由
 *
 * 桌面版依赖 FFmpeg / CDP / Python 二进制；移动端全部降级。
 */
import { route, ok, fail } from '../local-router';

export function registerSystemRoutes() {
  route('GET', '/v1/system/health', async () => ok({ status: 'ok', platform: 'android', mode: 'mobile' }));

  route('GET', '/v1/system/ip', async () => {
    try {
      const resp = await fetch('https://api.ipify.org?format=json');
      const data = await resp.json();
      return ok(data);
    } catch {
      return ok({ ip: '' });
    }
  });

  // 通用 HTTP 请求代理（采集源需要跨域时用）
  route('POST', '/v1/system/req', async ({ body }) => {
    try {
      const { url, method = 'GET', headers = {}, data, timeout = 10000 } = body ?? {};
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      const resp = await fetch(url, {
        method,
        headers,
        body: method.toUpperCase() === 'GET' ? undefined : data,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const text = await resp.text();
      return ok({ status: resp.status, headers: Object.fromEntries(resp.headers), data: text });
    } catch (e: any) {
      return fail(e.message);
    }
  });

  // m3u8 去广告：移动端用纯 JS 处理
  route('GET', '/v1/system/m3u8/adremove', async ({ params }) => {
    return ok({ url: params.url ?? '' });
  });

  // FFmpeg 相关全部不可用
  route('POST', '/v1/system/ffmpeg/info', async () => fail('mobile: ffmpeg not supported', -1, 501));
  route('POST', '/v1/system/ffmpeg/screenshot', async () => fail('mobile: ffmpeg not supported', -1, 501));

  // CDP 抓包：移动端用 WebView 的 network 拦截替代（后续实现）
  route('POST', '/v1/system/cdp/sniffer/media', async () => fail('mobile: cdp not supported', -1, 501));

  // 二进制管理
  route('GET', '/v1/system/binary/list', async () => ok([]));
  route('POST', '/v1/system/binary/install', async () => fail('mobile: binary install not supported', -1, 501));
}
