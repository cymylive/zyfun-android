/**
 * 移动端采集层专用 HTTP 客户端 —— 对齐 src/main/utils/request/index.ts
 *
 * 桌面版在 main 进程用 axios + fetch adapter；移动端直接在 WebView 里跑，
 * 用同一个 VAxios 封装即可，只是 UA / timeout 从 IndexedDB 的 setting 读取。
 */
import { VAxios } from '@shared/modules/request';
import type { AxiosTransform, CreateAxiosOptions } from '@shared/modules/request/axios/AxiosTransform';
import { ContentTypeEnum } from '@shared/modules/request/constants';
import { formatRequestDate, joinTimestamp, setObjToUrlParams } from '@shared/modules/request/utils';
import { isHttp, isObject, isString } from '@shared/modules/validate';
import type { AxiosInstance } from 'axios';
import { merge } from 'es-toolkit';

import { settingStore } from './store';

const MAX_TIMEOUT = 60 * 1000;
const MIN_TIMEOUT = 0;
const DEFAULT_TIMEOUT = 10 * 1000;

const DEFAULT_UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

/** 运行时注入的配置（由 local-backend 初始化后写入） */
export const runtimeConfig = {
  timeout: DEFAULT_TIMEOUT,
  ua: DEFAULT_UA,
};

export async function loadRuntimeConfig() {
  try {
    const t = Number(await settingStore.getValue('timeout'));
    if (Number.isFinite(t) && t >= MIN_TIMEOUT && t <= MAX_TIMEOUT) runtimeConfig.timeout = t;

    const ua = await settingStore.getValue('ua');
    if (isString(ua) && ua.length) runtimeConfig.ua = ua;
  } catch {
    /* 用默认值 */
  }
}

const transform: AxiosTransform = {
  transformRequestHook: (res, _options) => {
    const method = res.config.method?.toLowerCase();
    if (res.status === 204 && ['put', 'patch', 'delete'].includes(method!)) return res;
    return res.data as any;
  },

  beforeRequestHook: (config, options) => {
    const { apiUrl, isJoinPrefix, urlPrefix, joinParamsToUrl, formatDate, joinTime = true } = options;

    if (isJoinPrefix && urlPrefix && isString(urlPrefix) && !isHttp(config.url)) {
      config.url = `${urlPrefix}${config.url}`;
    }
    if (apiUrl && isString(apiUrl) && !isHttp(config.url)) {
      config.url = `${apiUrl}${config.url}`;
    }
    const params = config.params || {};
    const data = config.data || false;

    if (formatDate && data && !isString(data)) formatRequestDate(data);

    if (config.method?.toUpperCase() === 'GET') {
      if (!isString(params)) {
        config.params = Object.assign(params || {}, joinTimestamp(joinTime, false));
      } else {
        config.url = `${config.url + params}${joinTimestamp(joinTime, true)}`;
        config.params = undefined;
      }
    } else if (!isString(params)) {
      if (formatDate) formatRequestDate(params);
      if (Reflect.has(config, 'data') && config.data && (Object.keys(config.data).length > 0 || data instanceof FormData)) {
        config.data = data;
        config.params = params;
      } else {
        config.data = params;
        config.params = undefined;
      }
      if (joinParamsToUrl) {
        config.url = setObjToUrlParams(config.url as string, { ...config.params, ...config.data });
      }
    } else {
      config.url += params;
      config.params = undefined;
    }

    config.timeout = runtimeConfig.timeout;
    config.headers = {
      ...(isObject(config.headers) ? config.headers : {}),
      'User-Agent': (config.headers?.['User-Agent'] as string) ?? runtimeConfig.ua,
    };
    return config;
  },

  requestInterceptors: (config) => config,
  responseInterceptors: (res) => res,

  responseInterceptorsCatch: (error: any, instance: AxiosInstance) => {
    const { config } = error;
    if (!config || !config.requestOptions?.retry) return Promise.reject(error);
    config.retryCount = config.retryCount || 0;
    if (config.retryCount >= config.requestOptions.retry.count) return Promise.reject(error);
    config.retryCount += 1;
    const backoff = new Promise((resolve) => {
      setTimeout(() => resolve(config), config.requestOptions.retry.delay || 1);
    });
    config.headers = { ...config.headers, 'Content-Type': ContentTypeEnum.Json };
    return backoff.then((cfg) => instance.request(cfg!));
  },
};

function createAxios(opt?: Partial<CreateAxiosOptions>) {
  return new VAxios(
    merge(
      <CreateAxiosOptions>{
        authenticationScheme: '',
        timeout: DEFAULT_TIMEOUT,
        withCredentials: false,
        headers: { 'Content-Type': ContentTypeEnum.Json },
        transform,
        requestOptions: {
          apiUrl: '',
          isJoinPrefix: true,
          urlPrefix: '',
          isReturnNativeResponse: true,
          isTransformResponse: false,
          joinParamsToUrl: false,
          formatDate: true,
          joinTime: false,
          ignoreCancelToken: true,
          withToken: false,
          retry: { count: 0, delay: 1000 },
        },
      },
      opt || {},
    ),
  );
}

export const request = createAxios({ adapter: 'fetch' });
export default request;
