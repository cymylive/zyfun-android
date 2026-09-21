/**
 * 本地 REST 路由 —— 移动端的"Fastify"
 *
 * renderer 的所有业务请求 (apiRequest) 都走 /api/v1/*。桌面端它们打到本地
 * Fastify 服务器 (127.0.0.1:9978)；移动端没有 Node，所以这里用 axios 的
 * adapter 机制直接拦截请求，分发给内存/本地实现。
 *
 * 挂载方式: installLocalRouter() 在 main.ts 里调用，会把 apiRequest 实例的
 * defaults.adapter 换成本地路由函数。renderer 层完全无感。
 */
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';
import { apiRequest } from '@/utils/request';

type RouteHandler = (ctx: {
  method: string;
  path: string;
  params: Record<string, any>;
  body: any;
}) => Promise<{ status?: number; data: any }>;

const routes: Array<{ method: string; pattern: RegExp; keys: string[]; handler: RouteHandler }> = [];

/**
 * 注册一条路由。path 支持 :param 占位符，例如 /v1/film/site/:id
 */
export function route(method: string, path: string, handler: RouteHandler) {
  const keys: string[] = [];
  const pattern = new RegExp(
    '^' +
      path
        .replace(/\//g, '\\/')
        .replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
          keys.push(key);
          return '([^/]+)';
        }) +
      '$',
  );
  routes.push({ method: method.toUpperCase(), pattern, keys, handler });
}

/**
 * 简易 JSON 响应构造，对齐 Fastify 返回格式 { code, msg, data }
 */
export const ok = (data: any) => ({ data: { code: 0, msg: 'ok', data } });
export const fail = (msg: string, code = -1, status = 500) => ({
  status,
  data: { code, msg, data: null },
});

/**
 * 从 config.url 里剥离 host + prefix，得到干净的 /v1/xxx 路径。
 * renderer 传来的 url 可能是以下形式:
 *   - /v1/film/site/page            (beforeRequestHook 后已拼接完整)
 *   - http://127.0.0.1:9978/api/v1/film/site/page
 */
function normalizePath(rawUrl: string): string {
  let url = rawUrl;
  try {
    if (/^https?:\/\//i.test(url)) {
      const u = new URL(url);
      url = u.pathname + (u.search || '');
    }
  } catch {
    /* ignore */
  }
  // 剥离 /api 前缀
  url = url.replace(/^\/api(?=\/v\d)/, '');
  // 去掉 query
  const qIdx = url.indexOf('?');
  if (qIdx >= 0) url = url.slice(0, qIdx);
  return url;
}

function matchRoute(method: string, path: string) {
  for (const r of routes) {
    if (r.method !== method.toUpperCase()) continue;
    const m = r.pattern.exec(path);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => {
      params[k] = decodeURIComponent(m[i + 1]);
    });
    return { handler: r.handler, params };
  }
  return null;
}

const localAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  const method = (config.method || 'GET').toUpperCase();
  const rawUrl = config.url || '';
  const path = normalizePath(rawUrl);

  // 解析 params（GET query / POST body）
  const params: Record<string, any> = {};
  if (config.params && typeof config.params === 'object') {
    Object.assign(params, config.params);
  }
  // axios 有时会把 POST body 放 data
  let body = config.data;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      /* keep string */
    }
  }

  const matched = matchRoute(method, path);
  if (!matched) {
    console.warn('[local-router] 404', method, path);
    return {
      data: { code: -1, msg: `mobile: route not found ${method} ${path}`, data: null },
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config,
    } as AxiosResponse;
  }

  try {
    const result = await matched.handler({
      method,
      path,
      params: { ...params, ...matched.params },
      body,
    });
    return {
      data: result.data,
      status: result.status ?? 200,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse;
  } catch (e: any) {
    console.error('[local-router] handler error', path, e);
    return {
      data: { code: -1, msg: e?.message ?? String(e), data: null },
      status: 500,
      statusText: 'Internal Error',
      headers: {},
      config,
    } as AxiosResponse;
  }
};

let installed = false;
export function installLocalRouter() {
  if (installed) return;
  installed = true;

  const instance = apiRequest.getAxios();
  instance.defaults.adapter = localAdapter;

  // 同时给 axios 全局一份兜底（有些代码直接用 axios）
  axios.defaults.adapter = axios.defaults.adapter || localAdapter;

  console.log('[local-router] installed, routes =', routes.length);
}
