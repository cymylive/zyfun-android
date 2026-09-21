/**
 * 移动端 getTimeout / getUserAgent —— 对齐 src/main/utils/tool.ts
 */
import { isPositiveFiniteNumber, isUndefined } from '@shared/modules/validate';

import { runtimeConfig } from '../services/request';

const MAX_TIMEOUT = 60 * 1000;
const MIN_TIMEOUT = 0;
const DEFAULT_TIMEOUT = 10 * 1000;

export const getTimeout = (timeout?: number, optionTimeout?: number): number => {
  const isVisable = (val?: number): boolean =>
    !!isPositiveFiniteNumber(val) && val! >= MIN_TIMEOUT && val! <= MAX_TIMEOUT;

  if (isVisable(timeout)) return timeout as number;
  if (isVisable(optionTimeout)) return optionTimeout as number;
  if (isVisable(runtimeConfig.timeout)) return runtimeConfig.timeout;

  return DEFAULT_TIMEOUT;
};

export const getUserAgent = (ua?: string, optionUa?: string): string => {
  if (!isUndefined(ua)) return ua;
  if (!isUndefined(optionUa)) return optionUa;
  if (!isUndefined(runtimeConfig.ua)) return runtimeConfig.ua;
  return runtimeConfig.ua;
};
