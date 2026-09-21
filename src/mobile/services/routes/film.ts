/**
 * /v1/film/* 本地路由 —— 对齐桌面版 film/site.ts + film/cms/index.ts
 */
import { isArray, isArrayEmpty, isJsonStr, isObject, isObjectEmpty, isPositiveFiniteNumber, isStrEmpty, isString } from '@shared/modules/validate';
import JSON5 from 'json5';

import { adapter } from '../cms/cache';
import { route, ok, fail } from '../local-router';
import { mobileDb } from '../store';

/** ---------- site ---------- */

const SITE_PREFIX = '/v1/film/site';

const formatCategories = (str: string): string[] =>
  str ? [...new Set(str.split(/[,，]/).map((c) => c.trim()).filter(Boolean))] : [];

const formatEpisode = (playFroms: string, playUrls: string) => {
  try {
    if (!isString(playFroms) || isStrEmpty(playFroms) || !isString(playUrls) || isStrEmpty(playUrls)) return {};
    const episodesBySource = playUrls.split('$$$').map((s) =>
      s.split('#').map((ep) => {
        if (ep.includes('$')) {
          const [text, link] = ep.split('$');
          return { text: text || '正片', link: link || '' };
        }
        return { text: '正片', link: ep };
      }),
    );
    return playFroms.split('$$$').reduce((acc: Record<string, any>, name, i) => {
      acc[name] = episodesBySource[i] || [];
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const formatInfoContent = (val: string, key?: string): string => {
  if (!isString(val) || isStrEmpty(val)) return val?.toString() || '';
  const DEFAULT_PREFIXES = ['年份','年代','上映','地区','类型','语言','更新','更新至','评分','导演','编剧','主演','演员','简介','背景','详情','片长','状态','播放','集数','标签'];
  const SEPARATORS = ['：', ':', ' '];
  let text = String(val).trim();
  const prefixes = key ? [key] : DEFAULT_PREFIXES;
  const prefix = prefixes.find((p) => text.startsWith(p));
  if (prefix) {
    text = text.slice(prefix.length).trim();
    const sep = SEPARATORS.find((s) => text.startsWith(s));
    if (sep) text = text.slice(sep.length).trim();
  }
  if (text.startsWith('/') || text.endsWith('/')) {
    text = text.split('/').map((s) => s.trim()).filter(Boolean).join(', ');
  }
  return text;
};

export function registerFilmRoutes() {
  // site CRUD
  route('POST', SITE_PREFIX, async ({ body }) => {
    try {
      const doc = body ?? {};
      const res = await mobileDb.site.add(doc);
      return ok(res);
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('DELETE', SITE_PREFIX, async ({ body }) => {
    try {
      const { id } = body ?? {};
      if (id && id.length) await mobileDb.site.remove(Array.isArray(id) ? id : [id]);
      else await mobileDb.site.clear();
      return ok(null);
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('PUT', SITE_PREFIX, async ({ body }) => {
    try {
      const { id, doc } = body ?? {};
      const res = await mobileDb.site.update(Array.isArray(id) ? id : [id], doc);
      return ok(res);
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('PUT', `${SITE_PREFIX}/default/:id`, async ({ params }) => {
    try {
      const { settingStore } = await import('../store');
      await settingStore.setValue('defaultSite', params.id);
      return ok(null);
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${SITE_PREFIX}/active`, async () => {
    try {
      return ok(await mobileDb.site.active());
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${SITE_PREFIX}/page`, async ({ params }) => {
    try {
      const { pageNum = 1, pageSize = 10, kw } = params;
      const res = await mobileDb.site.page(Number(pageNum), Number(pageSize), kw);
      const { settingStore } = await import('../store');
      const defaultId = await settingStore.getValue('defaultSite');
      return ok({ ...res, defaultId });
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${SITE_PREFIX}/key/:key`, async ({ params }) => {
    try {
      return ok(await mobileDb.site.getByKey(params.key));
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${SITE_PREFIX}/:id`, async ({ params }) => {
    try {
      return ok(await mobileDb.site.get(params.id));
    } catch (e: any) {
      return fail(e.message);
    }
  });

  /** ---------- cms ---------- */

  const CMS = '/v1/film/cms';

  route('GET', `${CMS}/init`, async ({ params }) => {
    try {
      const { uuid, force = false } = params;
      try {
        await adapter(uuid, force === true || force === 'true');
        return ok({ success: true });
      } catch (e: any) {
        console.warn('[cms/init] failed:', e.message);
        return ok({ success: false });
      }
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${CMS}/home`, async ({ params }) => {
    try {
      const { uuid } = params;
      const ins = await adapter(uuid);
      const resp = await ins.home();
      const source: any = await mobileDb.site.get(uuid);
      const categories = formatCategories(source?.categories || '');

      const rawClassList = Array.isArray(resp?.class) ? resp.class : [];
      const classes = rawClassList
        .filter(
          (item: any, index: number, self: any[]) =>
            item.type_id && item.type_name && !categories.includes(item.type_name) &&
            self.findIndex((o) => o.type_id === item.type_id) === index,
        )
        .map((item: any) => ({
          type_id: String(item.type_id ?? '').trim(),
          type_name: item.type_name?.toString().trim() ?? '',
        }));
      const classIds = classes.map((c) => c.type_id);
      const rawFiltersObj = (resp as any)?.filters && Object.keys((resp as any).filters).length ? (resp as any).filters : {};
      const filters = Object.keys(rawFiltersObj).reduce<Record<string, any>>((acc, key) => {
        if (String(key) && classIds.includes(String(key))) acc[String(key)] = rawFiltersObj[key];
        return acc;
      }, {});
      return ok({ class: classes, filters });
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${CMS}/homeVod`, async ({ params }) => {
    try {
      const { uuid } = params;
      const ins = await adapter(uuid);
      const resp = await ins.homeVod();
      const videos = (Array.isArray(resp?.list) ? resp.list : [])
        .filter((v: any) => v.vod_id && v.vod_id !== 'no_data')
        .map((v: any) => ({
          vod_id: String(v.vod_id ?? ''),
          vod_name: v.vod_name ?? '',
          vod_pic: v.vod_pic ?? '',
          vod_remarks: formatInfoContent(v.vod_remarks ?? ''),
          vod_blurb: formatInfoContent(v.vod_blurb ?? ''),
          vod_tag: ['action', 'file', 'folder'].includes(v.vod_tag || 'file') ? v.vod_tag : 'file',
        }));
      return ok({
        page: Number(resp?.page) || 1,
        pagecount: Number(resp?.pagecount) || 0,
        total: Number(resp?.total) || 0,
        list: videos,
      });
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${CMS}/category`, async ({ params }) => {
    try {
      let { uuid, tid, page = 1, extend: rawExtend = '{}' } = params;
      if (isString(page)) page = Number.parseInt(page);
      if (!isPositiveFiniteNumber(page)) page = 1;
      const extend = isJsonStr(rawExtend) ? JSON5.parse(rawExtend) : {};
      const ins = await adapter(uuid);
      const resp = tid === '' ? await ins.homeVod() : await ins.category({ tid, page, extend });
      const videos = (Array.isArray(resp?.list) ? resp.list : [])
        .filter((v: any) => v.vod_id && v.vod_id !== 'no_data')
        .map((v: any) => ({
          vod_id: String(v.vod_id ?? ''),
          vod_name: v.vod_name ?? '',
          vod_pic: v.vod_pic ?? '',
          vod_remarks: formatInfoContent(v.vod_remarks ?? ''),
          vod_blurb: formatInfoContent(v.vod_blurb ?? ''),
          vod_tag: ['action', 'file', 'folder'].includes(v.vod_tag || 'file') ? v.vod_tag : 'file',
        }));
      return ok({
        page: Number(resp?.page) || page,
        pagecount: Number(resp?.pagecount) || 0,
        total: Number(resp?.total) || 0,
        list: videos,
      });
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${CMS}/detail`, async ({ params }) => {
    try {
      const { uuid, ids } = params;
      const ins = await adapter(uuid);
      const resp = await ins.detail({ ids });
      const videos = (Array.isArray(resp?.list) ? resp.list : [])
        .filter((v: any) => v.vod_id)
        .map((v: any) => ({
          vod_id: String(v.vod_id),
          vod_name: v.vod_name ?? '',
          vod_pic: v.vod_pic ?? '',
          vod_remarks: formatInfoContent(v.vod_remarks ?? ''),
          vod_year: formatInfoContent(String(v.vod_year ?? '')),
          vod_lang: formatInfoContent(v.vod_lang ?? ''),
          vod_area: formatInfoContent(v.vod_area ?? ''),
          vod_score: formatInfoContent(String((v.vod_score || v.vod_douban_score) ?? '0.0')),
          vod_state: formatInfoContent(v.vod_state ?? ''),
          vod_class: formatInfoContent(v.vod_class ?? ''),
          vod_actor: formatInfoContent(v.vod_actor ?? ''),
          vod_director: formatInfoContent(v.vod_director ?? ''),
          vod_content: formatInfoContent(v.vod_content ?? ''),
          vod_blurb: formatInfoContent(v.vod_blurb ?? ''),
          vod_play_from: v.vod_play_from ?? '',
          vod_play_url: v.vod_play_url ?? '',
          vod_episode: formatEpisode(v.vod_play_from, v.vod_play_url) || {},
          type_name: v.type_name ?? '',
        }));
      return ok({
        page: Number(resp?.page) || 1,
        pagecount: Number(resp?.pagecount) || 0,
        total: Number(resp?.total) || 0,
        list: videos,
      });
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${CMS}/search`, async ({ params }) => {
    try {
      let { uuid, wd, page = 1 } = params;
      if (isString(page)) page = Number.parseInt(page);
      if (!isPositiveFiniteNumber(page)) page = 1;
      const ins = await adapter(uuid);
      const resp = await ins.search({ wd, page });
      const videos = (Array.isArray(resp?.list) ? resp.list : [])
        .filter((v: any) => v.vod_id)
        .map((v: any) => ({
          vod_id: String(v.vod_id ?? ''),
          vod_name: v.vod_name ?? '',
          vod_pic: v.vod_pic ?? '',
          vod_remarks: formatInfoContent(v.vod_remarks ?? ''),
          vod_blurb: formatInfoContent(v.vod_blurb ?? ''),
          vod_tag: ['action', 'file', 'folder'].includes(v.vod_tag || 'file') ? v.vod_tag : 'file',
        }));
      return ok({
        page: Number(resp?.page) || page,
        pagecount: Number(resp?.pagecount) || 0,
        total: Number(resp?.total) || 0,
        list: videos,
      });
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${CMS}/play`, async ({ params }) => {
    try {
      const { uuid, flag, play } = params;
      const ins = await adapter(uuid);
      const resp = await ins.play({ flag, play });
      return ok({
        url: isString(resp?.url) && !isStrEmpty(resp.url) ? resp.url : '',
        quality: isArray(resp?.quality) && !isArrayEmpty(resp.quality) ? resp.quality : [],
        parse: isPositiveFiniteNumber(resp?.parse) ? resp.parse : 0,
        jx: isPositiveFiniteNumber(resp?.jx) ? resp.jx : 0,
        headers: isObject(resp?.headers) && !isObjectEmpty(resp.headers) ? resp.headers : {},
        script: isObject(resp?.script) && !isObjectEmpty(resp.script) ? resp.script : {},
      });
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${CMS}/action`, async ({ params }) => {
    try {
      const { uuid, action, value, timeout } = params;
      const ins = await adapter(uuid);
      const v = isJsonStr(value) ? JSON5.parse(value) : value;
      const resp = await ins.action({ action, value: v, timeout: Number(timeout) || undefined });
      return ok(resp);
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${CMS}/check`, async () => ok({ success: true }));

  route('GET', `${CMS}/proxy`, async ({ params }) => {
    try {
      const { uuid } = params;
      const ins = await adapter(uuid);
      const resp = await ins.proxy(params);
      return ok(resp);
    } catch (e: any) {
      return fail(e.message);
    }
  });
}
