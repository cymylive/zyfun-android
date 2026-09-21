/**
 * 本地后端启动 —— 替代桌面版 Fastify + DbService 的初始化流程
 *
 * 做的事：
 *   1. 首次启动写入默认 setting（对齐 src/shared/config/tblSetting.ts）
 *   2. 加载 UA / timeout 到运行时
 *   3. 把内置默认源（点播 + IPTV）写进 IndexedDB
 *   4. 注册全部 /v1/* 本地路由
 */
import { settingList } from '@shared/config/tblSetting';

import { registerFilmRoutes } from './routes/film';
import { registerLiveRoutes } from './routes/live';
import { registerSettingRoutes } from './routes/setting';
import { registerSystemRoutes } from './routes/system';
import { loadRuntimeConfig } from './request';
import { mobileDb, settingStore } from './store';

const SEED_KEY = 'mobile:seeded';

async function seedDefaultSetting() {
  const seeded = await settingStore.getValue(SEED_KEY);
  if (seeded) return;

  for (const { key, value } of settingList) {
    const exists = await settingStore.getValue(key);
    if (exists === undefined || exists === null) {
      await settingStore.setValue(key, value);
    }
  }
  await settingStore.setValue(SEED_KEY, true);
}

/**
 * 首次启动时预置一批可用的采集源。
 * 用户后续可在「设置 → 数据源」里增删改。
 * 注意: 这里只放"接口格式说明"，不放任何盗版站点地址，由用户自行导入合法订阅。
 */
async function seedEmptySources() {
  // 故意留空。用户导入自己的 .json / .m3u 订阅。
}

export async function bootstrapLocalBackend() {
  try {
    await seedDefaultSetting();
    await seedEmptySources();
    await loadRuntimeConfig();

    // 注册路由
    registerSettingRoutes();
    registerSystemRoutes();
    registerFilmRoutes();
    registerLiveRoutes();

    // 若用户从未导入过点播源，给出引导标记
    const siteCount = (await mobileDb.site.all()).length;
    const iptvCount = (await mobileDb.iptv.all()).length;
    console.log('[mobile] bootstrap done. sites =', siteCount, ', iptv =', iptvCount);
  } catch (e) {
    console.error('[mobile] bootstrap failed', e);
  }
}
