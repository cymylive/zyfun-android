/**
 * /v1/setting/* 本地路由 —— 对齐 src/main/services/FastifyService/routes/v1/setting/index.ts
 */
import { settingList as tblSetting, setupKeys } from '@shared/config/tblSetting';
import type { ISettingKey } from '@shared/config/tblSetting';

import { route, ok, fail } from '../local-router';
import { mobileDb, settingStore } from '../store';

export function registerSettingRoutes() {
  // POST /v1/setting  —— 新增
  route('POST', '/v1/setting', async ({ body }) => {
    try {
      const { key, value } = body ?? {};
      const res = await mobileDb.setting.setValue(key, value);
      return ok(res);
    } catch (e: any) {
      return fail(e.message);
    }
  });

  // DELETE /v1/setting —— 删除
  route('DELETE', '/v1/setting', async ({ body }) => {
    try {
      const { keys } = body ?? {};
      const all = await settingStore.all();
      for (const row of all) {
        if (!keys || keys.length === 0 || keys.includes(row.key)) {
          await mobileDb.setting['clear']?.();
          break;
        }
      }
      // 简化: 无 keys 清空，有 keys 逐条重置
      if (keys?.length) {
        for (const k of keys) {
          const def = tblSetting.find((s) => s.key === k);
          if (def) await settingStore.setValue(k, def.value);
        }
      }
      return ok(null);
    } catch (e: any) {
      return fail(e.message);
    }
  });

  // PUT /v1/setting  —— 更新
  route('PUT', '/v1/setting', async ({ body }) => {
    try {
      const { key, value } = body ?? {};
      await settingStore.setValue(key, value);
      // 同步运行时配置
      if (key === 'ua' || key === 'timeout') {
        const { loadRuntimeConfig } = await import('../request');
        await loadRuntimeConfig();
      }
      return ok(null);
    } catch (e: any) {
      return fail(e.message);
    }
  });

  // PUT /v1/setting/source —— 数据源相关设置
  route('PUT', '/v1/setting/source', async ({ body }) => {
    try {
      const doc = body ?? {};
      for (const [k, v] of Object.entries(doc)) {
        await settingStore.setValue(k, v);
      }
      return ok(null);
    } catch (e: any) {
      return fail(e.message);
    }
  });

  // GET /v1/setting/list
  route('GET', '/v1/setting/list', async () => {
    try {
      const rows = await settingStore.all();
      return ok(rows);
    } catch (e: any) {
      return fail(e.message);
    }
  });

  // GET /v1/setting/setup —— App.vue 启动时调用，返回 setupKeys 对应的值
  route('GET', '/v1/setting/setup', async () => {
    try {
      const entries = await Promise.all(
        setupKeys.map(async (key: ISettingKey) => [key, await settingStore.getValue(key)]),
      );
      return ok(Object.fromEntries(entries));
    } catch (e: any) {
      return fail(e.message);
    }
  });

  // GET /v1/setting/value/:key  —— 注意要放在 /:key 之前匹配
  route('GET', '/v1/setting/value/:key', async ({ params }) => {
    try {
      const v = await settingStore.getValue(params.key);
      return ok(v);
    } catch (e: any) {
      return fail(e.message);
    }
  });

  // GET /v1/setting/:key
  route('GET', '/v1/setting/:key', async ({ params }) => {
    try {
      const v = await settingStore.getValue(params.key);
      return ok(v);
    } catch (e: any) {
      return fail(e.message);
    }
  });

  // POST /v1/setting/default —— 恢复默认
  route('POST', '/v1/setting/default', async () => {
    try {
      for (const { key, value } of tblSetting) {
        await settingStore.setValue(key, value);
      }
      return ok(null);
    } catch (e: any) {
      return fail(e.message);
    }
  });
}
