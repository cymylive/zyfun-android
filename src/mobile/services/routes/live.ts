/**
 * /v1/live/* 本地路由 —— 对齐桌面版 live/iptv.ts + live/channel.ts
 * 含 m3u/txt 频道解析（移植自 live/utils/channel.ts，去掉 node:fs 依赖）
 */
import { IPTV_TYPE } from '@shared/config/live';
import type { IIptvType } from '@shared/config/live';
import { pascalCase } from '@shared/modules/camelcase';
import { isHttp, isNil, isStrEmpty } from '@shared/modules/validate';

import { route, ok, fail } from '../local-router';
import { mobileDb, settingStore } from '../store';

interface IChannelItem {
  name: string;
  api: string;
  logo?: string;
  group?: string;
  playback?: string;
  headers?: Record<string, any>;
}

type ICatchupMode = 'append' | 'shift' | 'default' | '';

/** M3U 解析 */
const m3uToStandard = (text: string): IChannelItem[] => {
  const GROUP = /.*group-title="(.?|.+?)".*/i;
  const LOGO = /.*tvg-logo="(.?|.+?)".*/i;
  const NAME = /.*,\s*(.+)/;
  const CATCHUP = /.*catchup="(.+?)"/i;
  const CATCHUP_SOURCE = /.*catchup-source="(.+?)"/i;
  const VLC_OPT_HEADER = /^#EXTVLCOPT:\s*([^\s=]+)=(.+)$/i;

  const docs: IChannelItem[] = [];
  let current: Partial<IChannelItem> = {};
  let currentCatchup: { mode?: string; source?: string } = {};
  let globalCatchup: { mode?: string; source?: string } = {};

  const resolveCatchup = (url: string): string => {
    if (url.includes('PLTV') || url.includes('TVOD')) {
      return 'append-?playseek=${(b)yyyyMMddHHmmss}-${(e)yyyyMMddHHmmss}';
    }
    if (currentCatchup.mode) return `${currentCatchup.mode}-${currentCatchup.source}`;
    if (globalCatchup.mode) return `${globalCatchup.mode}-${globalCatchup.source}`;
    return '';
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTM3U')) {
      globalCatchup = {
        mode: (line.match(CATCHUP)?.[1]?.trim() as ICatchupMode) ?? '',
        source: line.match(CATCHUP_SOURCE)?.[1]?.trim() ?? '',
      };
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      current = {
        name: line.match(NAME)?.[1]?.trim() ?? '',
        logo: line.match(LOGO)?.[1]?.trim(),
        group: line.match(GROUP)?.[1]?.trim(),
      };
      currentCatchup = {
        mode: (line.match(CATCHUP)?.[1]?.trim() as ICatchupMode) ?? '',
        source: line.match(CATCHUP_SOURCE)?.[1]?.trim() ?? '',
      };
      continue;
    }

    if (line.startsWith('#EXTVLCOPT:')) {
      let [, key, value] = line.match(VLC_OPT_HEADER) || [];
      if (!key || !key.includes('http') || !value) continue;
      key = pascalCase(key.replace('http-', ' '), '-', '-');
      if (!current.headers) current.headers = {};
      current.headers[key] = value;
      continue;
    }

    if (isHttp(line)) {
      current.api = line;
      current.playback = resolveCatchup(line);
      docs.push({ ...current, headers: current.headers ? { ...current.headers } : {} } as IChannelItem);
      current = {};
      currentCatchup = {};
    }
  }
  return docs;
};

/** TXT 解析 */
const txtToStandard = (text: string): IChannelItem[] => {
  if (isStrEmpty(text)) return [];
  const docs: IChannelItem[] = [];
  let currentGroup = '';
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || !line.includes(',')) continue;
    const [first = '', second = ''] = line.split(',', 2).map((s) => s.trim());
    if (!first || !second) continue;
    if (second === '#genre#') {
      currentGroup = first;
      continue;
    }
    if (isHttp(second)) docs.push({ name: first, api: second, headers: {}, group: currentGroup });
  }
  return docs;
};

/** 把远程 / 本地 / 手写内容统一转为频道数组 */
const convertToStandard = async (path: string, type: IIptvType): Promise<IChannelItem[]> => {
  let content: string | null = null;
  switch (type) {
    case IPTV_TYPE.REMOTE: {
      try {
        const resp = await fetch(path);
        content = await resp.text();
      } catch {
        content = null;
      }
      break;
    }
    case IPTV_TYPE.LOCAL: {
      // 移动端: 用户通过文件选择器导入后，内容存在 setting 里（见 import 路由）
      content = (await settingStore.getValue(`live:local:${path}`)) ?? null;
      break;
    }
    case IPTV_TYPE.MANUAL: {
      content = path;
      break;
    }
  }
  if (isNil(content) || isStrEmpty(content)) return [];
  return content.includes('#EXTM3U') ? m3uToStandard(content) : txtToStandard(content);
};

export function registerLiveRoutes() {
  const IPTV = '/v1/live/iptv';
  const CH = '/v1/live/channel';

  /** ---------- iptv ---------- */

  route('POST', IPTV, async ({ body }) => {
    try {
      return ok(await mobileDb.iptv.add(body ?? {}));
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('DELETE', IPTV, async ({ body }) => {
    try {
      const { id } = body ?? {};
      if (id && id.length) await mobileDb.iptv.remove(Array.isArray(id) ? id : [id]);
      else await mobileDb.iptv.clear();
      return ok(null);
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('PUT', IPTV, async ({ body }) => {
    try {
      const { id, doc } = body ?? {};
      return ok(await mobileDb.iptv.update(Array.isArray(id) ? id : [id], doc));
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${IPTV}/page`, async ({ params }) => {
    try {
      const { pageNum = 1, pageSize = 10, kw } = params;
      const res = await mobileDb.iptv.page(Number(pageNum), Number(pageSize), kw);
      const defaultId = await settingStore.getValue('defaultIptv');
      return ok({ list: res.list, total: res.total, default: defaultId ?? '' });
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${IPTV}/active`, async () => {
    try {
      const [list, defaultId, liveConf] = await Promise.all([
        mobileDb.iptv.active(),
        settingStore.getValue('defaultIptv'),
        settingStore.getValue('live'),
      ]);
      const def = defaultId ? await mobileDb.iptv.get(defaultId) : {};
      return ok({
        list,
        default: def ?? {},
        extra: {
          epg: liveConf?.epg ?? '',
          logo: liveConf?.logo ?? '',
          ipMark: liveConf?.ipMark ?? '',
          delay: liveConf?.delay ?? '',
          thumbnail: liveConf?.thumbnail ?? '',
        },
      });
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${IPTV}/key/:key`, async ({ params }) => {
    try {
      const res = await mobileDb.iptv.getByKey(params.key);
      return ok(res ?? {});
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('PUT', `${IPTV}/default/:id`, async ({ params }) => {
    try {
      const detail: any = await mobileDb.iptv.get(params.id);
      const { api, type } = detail || {};
      if (isStrEmpty(api) || typeof type !== 'number') return fail('Invalid parameters', -1, 400);

      const parseRes = await convertToStandard(api, type as IIptvType);
      if (!parseRes.length) return ok({ success: false });

      await mobileDb.channel.set(parseRes as any[]);
      await settingStore.setValue('defaultIptv', params.id);
      return ok({ success: true });
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${IPTV}/check/:id`, async ({ params }) => {
    try {
      const detail: any = await mobileDb.iptv.get(params.id);
      const { api, type } = detail || {};
      if (isStrEmpty(api) || typeof type !== 'number') return fail('Invalid parameters', -1, 400);
      const parseRes = await convertToStandard(api, type as IIptvType);
      return ok({ success: parseRes.length > 0 });
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${IPTV}/:id`, async ({ params }) => {
    try {
      return ok(await mobileDb.iptv.get(params.id));
    } catch (e: any) {
      return fail(e.message);
    }
  });

  /** ---------- channel ---------- */

  route('POST', CH, async ({ body }) => {
    try {
      return ok(await mobileDb.channel.add(body ?? {}));
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('DELETE', CH, async ({ body }) => {
    try {
      const { id } = body ?? {};
      if (id && id.length) await mobileDb.channel.remove(Array.isArray(id) ? id : [id]);
      else await mobileDb.channel.clear();
      return ok(null);
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('PUT', CH, async ({ body }) => {
    try {
      const { id, doc } = body ?? {};
      return ok(await mobileDb.channel.update(Array.isArray(id) ? id : [id], doc));
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${CH}/page`, async ({ params }) => {
    try {
      const { pageNum = 1, pageSize = 10, kw, group } = params;
      const [res, defaultIptvId, liveConf, allChannels] = await Promise.all([
        mobileDb.channel.page(Number(pageNum), Number(pageSize), kw),
        settingStore.getValue('defaultIptv'),
        settingStore.getValue('live'),
        mobileDb.channel.all(),
      ]);

      const defIptv: any = defaultIptvId ? await mobileDb.iptv.get(defaultIptvId) : null;
      const defaultLogo = defIptv?.logo || liveConf?.logo || '';

      let list = res.list;
      if (group) list = list.filter((c) => c.group === group);

      const classList = [...new Set(allChannels.map((c) => c.group).filter(Boolean))];

      return ok({
        list: list.map((item) => ({
          ...item,
          logo: item?.logo || defaultLogo.replace('{name}', item.name),
        })),
        total: group ? list.length : res.total,
        class: classList,
      });
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${CH}/epg`, async ({ params }) => {
    try {
      const { ch, date } = params;
      if (isStrEmpty(ch)) return fail('Invalid parameters', -1, 400);

      const defaultIptvId = await settingStore.getValue('defaultIptv');
      const sourceEpg = defaultIptvId ? (await mobileDb.iptv.get(defaultIptvId))?.epg : '';
      const seeingEpg = (await settingStore.getValue('live'))?.epg;
      const api = sourceEpg || seeingEpg || '';
      if (isStrEmpty(api)) return fail('EPG URL not found', -1, 400);

      try {
        const url = api.replace('{name}', encodeURIComponent(ch)).replace('{date}', date ?? '');
        const resp = await fetch(url);
        const text = await resp.text();
        return ok(text);
      } catch {
        return ok([]);
      }
    } catch (e: any) {
      return fail(e.message);
    }
  });

  route('GET', `${CH}/:id`, async ({ params }) => {
    try {
      return ok(await mobileDb.channel.get(params.id));
    } catch (e: any) {
      return fail(e.message);
    }
  });
}
