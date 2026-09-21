/**
 * hiker request —— 移动端 fetch 实现
 * 对齐 src/main/utils/hiker/request/asyncAxios.ts 的对外接口
 */
import { convertHeaders } from '@shared/modules/headers';
import { toString } from '@shared/modules/toString';
import { isJsonStr } from '@shared/modules/validate';
import JSON5 from 'json5';

import { MOBILE_UA, PC_UA } from '../ua';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';

interface RequestOptions {
  method?: HttpMethod;
  timeout?: number;
  body?: any;
  headers?: Record<string, string>;
  redirect?: 0 | 1 | boolean;
  toHex?: boolean;
  onlyHeaders?: boolean;
  withHeaders?: boolean;
  withStatusCode?: boolean;
}

const getTimeout = (timeout: number | undefined | null) => {
  const base = 5000;
  if (timeout !== null && timeout !== undefined) return Math.max(base, timeout);
  if ((globalThis as any).variable?.timeout) return Math.max(base, (globalThis as any).variable.timeout);
  return base;
};

const serialize2dict = (headers: Headers) => {
  const dict: Record<string, string[]> = {};
  headers.forEach((value, key) => {
    dict[key] = [value];
  });
  return dict;
};

const bufToHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const decodeText = (buf: ArrayBuffer, charset = 'utf-8') => {
  try {
    return new TextDecoder(charset as any).decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
};

const fetchImpl = async (url: string, options: RequestOptions = {}): Promise<any> => {
  const method = (options.method || 'GET').toUpperCase() as HttpMethod;
  const headers = convertHeaders(options.headers || {}) as Record<string, string>;

  if (!headers['User-Agent']) headers['User-Agent'] = MOBILE_UA;
  if (!headers.Accept) headers.Accept = '*/*';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getTimeout(options?.timeout));

  let body: any;
  const contentType = headers['Content-Type'] || '';
  if (method !== 'GET' && options.body !== undefined) {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const obj = isJsonStr(options.body) ? JSON5.parse(options.body) : options.body;
      body = new URLSearchParams(obj).toString();
    } else if (contentType.includes('application/json') || !contentType) {
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
      body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    } else {
      body = options.body;
    }
  }

  try {
    const resp = await fetch(url, { method, headers, body, signal: controller.signal });
    const arrBuf = await resp.arrayBuffer();

    const headerDict = serialize2dict(resp.headers);

    if (options.onlyHeaders) return toString(headerDict);

    let charset = 'utf-8';
    if (contentType.includes('charset=')) {
      const m = contentType.match(/charset=([\w-]+)/i);
      if (m?.[1]) charset = m[1];
    }

    const content = options.toHex ? bufToHex(arrBuf) : decodeText(arrBuf, charset);

    if (!(options.withHeaders || options.withStatusCode)) return toString(content);

    return toString({
      headers: headerDict,
      statusCode: resp.status,
      body: content,
    });
  } finally {
    clearTimeout(timer);
  }
};

export const fetch = fetchImpl;
export const request = fetchImpl;

export const fetchCookie = async (url: string, options: RequestOptions = {}) => {
  const opts = { ...options, onlyHeaders: true };
  delete (opts as any).withHeaders;
  delete (opts as any).withStatusCode;
  delete (opts as any).toHex;
  const headerStr = (await fetchImpl(url, opts)) || '{}';
  const headerObj = JSON5.parse(headerStr as string);
  const setCk = Object.keys(headerObj).find((it) => it.toLowerCase() === 'set-cookie');
  const cookie = setCk ? headerObj[setCk] : [];
  return JSON.stringify(cookie);
};

export const post = async (url: string, options: RequestOptions = {}) =>
  fetchImpl(url, { ...options, method: 'POST' });

export const fetchPC = async (url: string, options: RequestOptions = {}) => {
  const headers = { ...(options.headers || {}) };
  if (!convertHeaders(headers)['User-Agent']) headers['User-Agent'] = PC_UA;
  return fetchImpl(url, { ...options, headers });
};

export const postPC = async (url: string, options: RequestOptions = {}) => {
  const headers = { ...(options.headers || {}) };
  if (!convertHeaders(headers)['User-Agent']) headers['User-Agent'] = PC_UA;
  return post(url, { ...options, headers });
};

export const convertBase64Image = async (url: string, options: RequestOptions = {}) => {
  const opts: RequestOptions = { ...options, toHex: true };
  delete (opts as any).withHeaders;
  delete (opts as any).withStatusCode;
  delete (opts as any).onlyHeaders;

  const hexStr = (await fetchImpl(url, opts)) as string;
  if (!hexStr) return '';

  const bytes = new Uint8Array(hexStr.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary);
  const ext = url.split('?')[0].split('.').pop() || 'png';
  return `data:image/${ext};base64,${b64}`;
};

export const batchFetch = async (requests: any[], threads = 16) => {
  const results: any[] = [];
  const run = async (list: any[]) => {
    for (const r of list) {
      try {
        results.push(await fetchImpl(r.url, r.options));
      } catch (e: any) {
        results.push(`Request to ${r.url} failed: ${e.message}`);
      }
    }
  };
  for (let i = 0; i < requests.length; i += threads) {
    await run(requests.slice(i, i + threads));
  }
  return results;
};

export const bf = batchFetch;
