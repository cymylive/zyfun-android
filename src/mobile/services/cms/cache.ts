/**
 * CMS 适配器缓存 —— 对齐 src/main/services/FastifyService/routes/v1/film/cms/utils/cache.ts
 * 移动端不用 LRU，直接 Map + 数量上限。
 */
import { SITE_TYPE } from '@shared/config/film';
import type { ICmsAdapter } from '@shared/types/cms';
import { hash } from '@zy/crypto';

import { mobileDb } from '../store';
import {
  T0Adapter,
  T1Adapter,
  T3AlistAdapter,
  T3AppYsV2Adapter,
  T3CatopenAdapter,
  T3DrpyAdapter,
  T3PyAdapter,
  T3XbpqAdapter,
  T3XyqAdapter,
  T4CatvodAdapter,
  T4DrpyJs0Adapter,
  T4DrpysAdapter,
} from './adapter';

const CMS_ADAPTER_MAP: Record<number, any> = {
  [SITE_TYPE.T0_XML]: T0Adapter,
  [SITE_TYPE.T1_JSON]: T1Adapter,
  [SITE_TYPE.T4_DRPYJS0]: T4DrpyJs0Adapter,
  [SITE_TYPE.T4_DRPYS]: T4DrpysAdapter,
  [SITE_TYPE.T3_DRPY]: T3DrpyAdapter,
  [SITE_TYPE.T4_CATVOD]: T4CatvodAdapter,
  [SITE_TYPE.T3_XBPQ]: T3XbpqAdapter,
  [SITE_TYPE.T3_XYQ]: T3XyqAdapter,
  [SITE_TYPE.T3_APPYSV2]: T3AppYsV2Adapter,
  [SITE_TYPE.T3_PY]: T3PyAdapter,
  [SITE_TYPE.T3_ALIST]: T3AlistAdapter,
  [SITE_TYPE.T3_CATOPEN]: T3CatopenAdapter,
};

const CACHE_LIMIT = 10;
const cache = new Map<string, ICmsAdapter>();

function evictIfNeeded() {
  while (cache.size >= CACHE_LIMIT) {
    const firstKey = cache.keys().next().value;
    if (!firstKey) break;
    const ins = cache.get(firstKey);
    ins?.destroy?.();
    cache.delete(firstKey);
  }
}

export const adapter = async (uuid: string, force = false): Promise<ICmsAdapter> => {
  if (!uuid) throw new Error('Parameter "uuid" is required');

  const source: any = await mobileDb.site.get(uuid);
  if (!source) throw new Error('Site not found: ' + uuid);

  const categories = source.categories
    ? [...new Set(String(source.categories).split(/[,，]/).map((c) => c.trim()).filter(Boolean))]
    : [];

  const type = source.type;
  if (!type || !CMS_ADAPTER_MAP[type]) throw new Error('Db data type error');

  const contentHash = hash['md5-32']({ src: JSON.stringify(source) });
  const idHash = `${uuid}:${contentHash}`;

  if (force) {
    const old = cache.get(idHash);
    old?.destroy?.();
    cache.delete(idHash);
  }

  if (cache.has(idHash)) return cache.get(idHash)!;

  evictIfNeeded();
  const Adapter = CMS_ADAPTER_MAP[type];
  const ins: ICmsAdapter = new Adapter({ ...source, categories });
  await ins.init();
  cache.set(idHash, ins);
  return ins;
};

export const terminate = async () => {
  for (const ins of cache.values()) ins?.destroy?.();
  cache.clear();
};

export const setup = async () => {
  /* no-op on mobile */
};
