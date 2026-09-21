/**
 * 把 shim 里抽象的 navigate(name, payload) 映射到 vue-router。
 * 桌面版是多窗口 (WINDOW_PLAYER / WINDOW_BROWSER)，移动端全部变成路由跳转。
 */
import { WINDOW_NAME } from '@shared/config/window';
import type { Router } from 'vue-router';

let router: Router | null = null;

export function attachRouter(r: Router) {
  router = r;
}

export function handleNavigate(name: string, payload?: any) {
  if (!router) {
    console.warn('[navigator] router not ready, drop nav:', name, payload);
    return;
  }

  switch (name) {
    case WINDOW_NAME.MAIN:
      router.push('/film');
      break;

    case WINDOW_NAME.PLAYER:
      // 播放数据通过 pinia player store 传递（同 WebView 内共享）
      router.push({ path: '/player', query: payload?.url ? { url: payload.url, type: payload.external } : {} });
      break;

    case WINDOW_NAME.BROWSER:
      router.push({ path: '/browser', query: { url: payload?.url ?? '' } });
      break;

    case WINDOW_NAME.SEARCH:
      router.push('/film');
      break;

    default:
      console.warn('[navigator] unhandled window:', name);
  }
}
