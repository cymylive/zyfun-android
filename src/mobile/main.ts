/**
 * zyfun mobile entry (Android / Web)
 *
 * 复用 src/renderer 全部 UI 代码，通过两层 shim 让它在 WebView 里跑:
 *   1. window.electron.*  → 本地 IPC shim (shims/electron-api.ts)
 *   2. apiRequest axios adapter → 本地 REST 路由 (services/local-router.ts)
 * renderer 层零改动。
 */
import { createApp } from 'vue';

import { print as consolePrint } from '@/utils/console';
import { dom as initDom } from '@/utils/setup';
import App from '@/App.vue';
import i18n from '@/locales';
import router from '@/router';
import { store } from '@/store';

import { createElectronShim, setNavigator } from './shims/electron-api';
import { attachRouter, handleNavigate } from './shims/navigator';
import { installLocalRouter } from './services/local-router';
import { bootstrapLocalBackend } from './services/local-backend';

import '@/style/index.less';
import 'tdesign-vue-next/es/style/index.css';

// 1. 注入 window.electron shim（必须在 renderer 任何代码运行前完成）
(window as any).electron = createElectronShim();

// 2. 安装本地 REST 路由（替换 apiRequest 的 axios adapter）
installLocalRouter();

// 3. 把 shim 的 navigate 事件转成 vue-router 跳转
attachRouter(router);
setNavigator(handleNavigate);

// 4. 复用 renderer 启动逻辑
initDom();
consolePrint();

const app = createApp(App);
app.use(store);
app.use(router);
app.use(i18n);

// 5. 初始化本地后端（IndexedDB + 默认设置 + 路由注册）
bootstrapLocalBackend().finally(() => {
  app.mount('#app').$nextTick((window as any).removeLoading);
});
