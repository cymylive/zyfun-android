/**
 * t3Drpy —— drpy JS 源
 *
 * 桌面版用 workerpool 开子进程跑 drpy2.min；移动端没有子进程，直接在
 * 主线程动态 import drpy2.min（纯 JS + cheerio + 我们的 fetch 实现）。
 */
import { SITE_TYPE } from '@shared/config/film';
import { isJson } from '@shared/modules/validate';
import type { ICmsParams, ICmsResultPromise, IConstructorOptions } from '@shared/types/cms';
import JSON5 from 'json5';

import { loggerService } from '@mobile/utils/logger';

const logger = loggerService.withContext(SITE_TYPE.T3_DRPY);

type ICmsResultCustom = Omit<Awaited<ICmsResultPromise>, 'play'> & {
  play: Awaited<ICmsResultPromise['play']> & {
    parse_extra?: string;
    js?: string;
    header?: Record<string, any>;
  };
};

const parseMaybeJson = (resp: any) => {
  if (typeof resp === 'string') {
    try {
      return JSON5.parse(resp);
    } catch {
      return resp;
    }
  }
  return resp;
};

class T3DrpyAdapter {
  private ext: string = '';
  private categories: string[] = [];
  private mod: any = null;
  private inited = false;

  constructor(source: IConstructorOptions) {
    this.ext = source.ext!;
    this.categories = source.categories;
  }

  private async ensureMod() {
    if (this.mod) return this.mod;
    // 动态加载 drpy2（Vite 会打成独立 chunk）
    const raw = await import('./drpy2.min');
    this.mod = (raw as any).default ?? raw;
    return this.mod;
  }

  private async call<T = any>(method: string, ...args: any[]): Promise<T> {
    const mod = await this.ensureMod();
    const fn = mod[method];
    if (typeof fn !== 'function') throw new Error(`drpy method not found: ${method}`);

    // 覆写 console 转发到 logger（drpy 内部大量 console.log）
    const originLog = console.log;
    console.log = (...msg: any[]) => {
      const text = msg.map((m) => (isJson(m) ? JSON.stringify(m) : String(m))).join(' ');
      logger.debug(text);
    };
    try {
      return parseMaybeJson(await fn(...args));
    } finally {
      console.log = originLog;
    }
  }

  public async init(): ICmsResultPromise['init'] {
    if (this.inited) return;
    await this.call('init', this.ext);
    this.inited = true;
  }

  public async home(): ICmsResultPromise['home'] {
    const resp = await this.call<ICmsResultCustom['home']>('home');
    const rawClassList = Array.isArray(resp?.class) ? resp!.class : [];
    const classes = rawClassList
      .map((item: any) => ({
        type_id: String(item.type_id ?? '').trim(),
        type_name: item.type_name?.toString().trim() ?? '',
      }))
      .filter(
        (item, index, self) =>
          item.type_id &&
          item.type_name &&
          !this.categories?.includes(item.type_name) &&
          self.findIndex((other) => other.type_id === item.type_id) === index,
      );
    const classIds = classes.map((item) => item.type_id);
    const rawFiltersObj = resp?.filters && Object.keys(resp.filters).length ? resp.filters : {};
    const filters = Object.keys(rawFiltersObj).reduce<Record<string, any>>((acc, key) => {
      if (String(key) && classIds.includes(String(key))) acc[String(key)] = rawFiltersObj[key];
      return acc;
    }, {});
    return { class: classes, filters };
  }

  public async homeVod(): ICmsResultPromise['homeVod'] {
    const resp = await this.call<any>('homeVod');
    const rawList = Array.isArray(resp?.list) ? resp.list : [];
    const videos = rawList
      .map((v: any) => ({
        vod_id: String(v.vod_id ?? ''),
        vod_name: v.vod_name ?? '',
        vod_pic: v.vod_pic ?? '',
        vod_remarks: v.vod_remarks ?? '',
        vod_blurb: (v.vod_blurb ?? '')?.trim(),
        vod_tag: ['action', 'file', 'folder'].includes(v.vod_tag || 'file') ? v.vod_tag : 'file',
      }))
      .filter((v) => v.vod_id);
    return {
      page: Number(resp?.page) || 1,
      pagecount: Number(resp?.pagecount) || (videos.length ? 1 : 0),
      total: Number(resp?.total) || videos.length,
      list: videos,
    };
  }

  public async category(doc: ICmsParams['category']): ICmsResultPromise['category'] {
    const { tid, page = 1, extend = {} } = doc || {};
    const hasExtend = Object.keys(extend).length > 0;
    const resp = await this.call<any>('category', tid, page, hasExtend, hasExtend ? extend : {});
    const rawList = Array.isArray(resp?.list) ? resp.list : [];
    const videos = rawList
      .map((v: any) => ({
        vod_id: String(v.vod_id ?? ''),
        vod_name: v.vod_name ?? '',
        vod_pic: v.vod_pic ?? '',
        vod_remarks: v.vod_remarks ?? '',
        vod_blurb: (v.vod_blurb ?? '')?.trim(),
        vod_tag: ['action', 'file', 'folder'].includes(v.vod_tag || 'file') ? v.vod_tag : 'file',
      }))
      .filter((v) => v.vod_id);
    return {
      page: Number(resp?.page) || page,
      pagecount: Number(resp?.pagecount) || (videos.length ? 1 : 0),
      total: Number(resp?.total) || videos.length,
      list: videos,
    };
  }

  public async detail(doc: ICmsParams['detail']): ICmsResultPromise['detail'] {
    const { ids } = doc || {};
    const resp = await this.call<any>('detail', ids);
    const idsArray = [ids];
    const rawList = Array.isArray(resp?.list) ? resp.list : [];
    const videos = rawList
      .map((v: any, i: number) => ({
        vod_id: String((v.vod_id || idsArray[i]) ?? ''),
        vod_name: v.vod_name ?? '',
        vod_pic: v.vod_pic ?? '',
        vod_remarks: v.vod_remarks ?? '',
        vod_year: String(v.vod_year ?? ''),
        vod_lang: v.vod_lang ?? '',
        vod_area: v.vod_area ?? '',
        vod_score: String(v.vod_score ?? '0.0'),
        vod_state: v.vod_state ?? '',
        vod_class: v.vod_class ?? '',
        vod_actor: v.vod_actor ?? '',
        vod_director: v.vod_director ?? '',
        vod_content: (v.vod_content ?? '')?.trim(),
        vod_blurb: (v.vod_blurb ?? '')?.trim(),
        vod_play_from: v.vod_play_from ?? '',
        vod_play_url: v.vod_play_url ?? '',
        type_name: v.type_name ?? '',
      }))
      .filter((v) => v.vod_id);
    return {
      page: Number(resp?.page) || 1,
      pagecount: Number(resp?.pagecount) || (videos.length ? 1 : 0),
      total: Number(resp?.total) || videos.length,
      list: videos,
    };
  }

  public async search(doc: ICmsParams['search']): ICmsResultPromise['search'] {
    const { wd, page = 1 } = doc || {};
    const resp = await this.call<any>('search', wd, false, page);
    const rawList = Array.isArray(resp?.list) ? resp.list : [];
    const videos = rawList
      .map((v: any) => ({
        vod_id: String(v.vod_id ?? ''),
        vod_name: v.vod_name ?? '',
        vod_pic: v.vod_pic ?? '',
        vod_remarks: v.vod_remarks ?? '',
        vod_blurb: (v.vod_blurb ?? '')?.trim(),
        vod_tag: ['action', 'file', 'folder'].includes(v.vod_tag || 'file') ? v.vod_tag : 'file',
      }))
      .filter((v) => v.vod_id);
    return {
      page: Number(resp?.page) || page,
      pagecount: Number(resp?.pagecount) || (videos.length ? 1 : 0),
      total: Number(resp?.total) || videos.length,
      list: videos,
    };
  }

  public async play(doc: ICmsParams['play']): ICmsResultPromise['play'] {
    const { flag, play } = doc || {};
    const resp = await this.call<any>('play', flag, play, []);
    const qs = resp?.parse_extra;
    const scriptObj = qs ? Object.fromEntries(new URLSearchParams(qs)) : {};
    return {
      url: (Array.isArray(resp?.url) && resp.url.length > 0 ? resp.url?.[1] : resp?.url) || '',
      quality:
        Array.isArray(resp?.url) && resp.url.length > 0
          ? resp.url.flatMap((name: string, i: number, arr: any[]) =>
              i % 2 === 0 && arr[i + 1] ? [{ name, url: arr[i + 1] }] : [],
            )
          : [],
      parse: resp?.parse || 0,
      jx: resp?.jx || 0,
      headers: resp?.header || resp?.headers || {},
      script: Object.keys(scriptObj).length
        ? {
            ...(resp.js ? { runScript: resp.js } : {}),
            ...(scriptObj.init_script ? { initScript: scriptObj.init_script } : {}),
            ...(scriptObj.custom_regex ? { customRegex: scriptObj.custom_regex } : {}),
            ...(scriptObj.sniffer_exclude ? { snifferExclude: scriptObj.sniffer_exclude } : {}),
          }
        : {},
    } as any;
  }

  async action(doc: ICmsParams['action']): ICmsResultPromise['action'] {
    const { action, value, timeout } = doc || {};
    if (timeout && timeout > 0) (globalThis as any).variable = { timeout };
    else delete (globalThis as any).variable?.timeout;
    return await this.call('action', action, value);
  }

  async proxy(doc: ICmsParams['proxy']): ICmsResultPromise['proxy'] {
    return await this.call('proxy', doc);
  }

  public async runMain(doc: ICmsParams['runMain']): ICmsResultPromise['runMain'] {
    return await this.call('runMain', doc);
  }
}

export default T3DrpyAdapter;
