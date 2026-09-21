/**
 * t3Catopen worker 逻辑 —— 移动端改为导出 handlers，不再使用 workerpool
 */
import { isArray, isFunction, isJsonStr, isNil } from '@shared/modules/validate';
import { base64 } from '@zy/crypto';
import JSON5 from 'json5';

import { aesX, BaseSpider, desX, getProxy, local, md5X, req, rsaX } from './inject';

(globalThis as any).BaseSpider = BaseSpider;
(globalThis as any).getProxy = getProxy;
(globalThis as any).req = req;
(globalThis as any).local = local;
(globalThis as any).aesX = aesX;
(globalThis as any).desX = desX;
(globalThis as any).md5X = md5X;
(globalThis as any).rsaX = rsaX;

let spider: any;

export const handlers: Record<string, (options?: Record<string, any>) => Promise<any>> = {
  async init(options) {
    const { id, code, ext } = options!;

    const cfg = { stype: 4, skey: id, sourceKey: id, ext };

    // 移动端: assets://js/lib/ 无法映射到本地文件，直接置空（依赖 lib 的源会失败）
    const normalizedCode = String(code).replaceAll('assets://js/lib/', '');

    const dataUri = `data:text/javascript;base64,${base64.encode({ src: normalizedCode })}`;
    const modRaw = await import(/* @vite-ignore */ dataUri);
    const mod = isFunction((modRaw as any).__jsEvalReturn) ? (modRaw as any).__jsEvalReturn() : ((modRaw as any).default ?? modRaw);

    spider = mod;
    await mod.init(cfg);

    return mod;
  },

  async home() {
    const resp = await spider.home(true);
    return isJsonStr(resp) ? JSON5.parse(resp) : resp;
  },

  async homeVod() {
    const resp = await spider.homeVod();
    return isJsonStr(resp) ? JSON5.parse(resp) : resp;
  },

  async category(options) {
    const { tid, page, extend } = options!;
    const hasExtend = Object.keys(extend).length > 0;
    const resp = await spider.category(tid, page, hasExtend, hasExtend ? extend : {});
    return isJsonStr(resp) ? JSON5.parse(resp) : resp;
  },

  async detail(options) {
    const { ids } = options!;
    let resp = '{}';
    if (isFunction(spider.detailContent)) {
      resp = await spider.detailContent(isArray(ids) ? ids : [ids]);
    } else {
      resp = await spider.detail(ids);
    }
    return isJsonStr(resp) ? JSON5.parse(resp) : resp;
  },

  async play(options) {
    const { flag, play: input } = options!;
    const resp = await spider.play(flag, input, []);
    return isJsonStr(resp) ? JSON5.parse(resp) : resp;
  },

  async search(options) {
    const { wd, page } = options!;
    const resp = await spider.search(wd, false, page);
    return isJsonStr(resp) ? JSON5.parse(resp) : resp;
  },

  async action(options) {
    const { action, value, timeout } = options!;
    if (timeout && timeout > 0) (globalThis as any).variable = { timeout };
    else delete (globalThis as any).variable?.timeout;
    return await spider.action(action, value);
  },

  async proxy(options) {
    const resp = await spider.proxy(options);
    return isJsonStr(resp) ? JSON5.parse(resp) : resp;
  },
};

export const runHandler = async (type: string, options?: Record<string, any>) => {
  const handler = handlers[type];
  if (isNil(handler)) throw new Error(`Handler not found for type: ${type}`);
  return await handler(options);
};
