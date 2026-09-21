/**
 * Electron API Shim for Android / Web
 * 目的: 让 src/renderer 里 27 个文件的 window.electron.* 调用无需改动即可运行。
 * 所有桌面专有能力降级为 no-op 或 Web 等价实现。
 */
import { IPC_CHANNEL } from '@shared/config/ipcChannel';
import { WINDOW_NAME } from '@shared/config/window';

type Handler = (...args: any[]) => void;

/** 简易事件总线，替代 Electron 的 ipcRenderer.on / emit */
class EventBus {
  private map = new Map<string, Set<Handler>>();

  on(channel: string, fn: Handler) {
    if (!this.map.has(channel)) this.map.set(channel, new Set());
    this.map.get(channel)!.add(fn);
    return this;
  }

  once(channel: string, fn: Handler) {
    const wrap = (...args: any[]) => {
      this.off(channel, wrap);
      fn(...args);
    };
    return this.on(channel, wrap);
  }

  off(channel: string, fn: Handler) {
    this.map.get(channel)?.delete(fn);
    return this;
  }

  removeAllListeners(channel?: string) {
    if (channel) this.map.delete(channel);
    else this.map.clear();
    return this;
  }

  emit(channel: string, ...args: any[]) {
    this.map.get(channel)?.forEach((fn) => {
      try {
        fn(...args);
      } catch (e) {
        console.error('[shim] handler error', channel, e);
      }
    });
  }
}

export const shimBus = new EventBus();

/** 移动端没有多窗口，用路由 or 全屏组件代替 */
let onNavigate: ((name: string, payload?: any) => void) | null = null;
export const setNavigator = (fn: (name: string, payload?: any) => void) => {
  onNavigate = fn;
};

const navigate = (name: string, payload?: any) => {
  onNavigate?.(name, payload);
};

/** 移动端本地存储（替代 electron-store / 路径系统） */
const MEM_PREFIX = 'zyfun-mobile:';
const memGet = (k: string) => {
  try {
    return localStorage.getItem(MEM_PREFIX + k);
  } catch {
    return null;
  }
};
const memSet = (k: string, v: string) => {
  try {
    localStorage.setItem(MEM_PREFIX + k, v);
    return true;
  } catch {
    return false;
  }
};

const invoke = async (channel: string, ...args: any[]): Promise<any> => {
  switch (channel) {
    // ---- 窗口控制：移动端无窗口，用导航代替 ----
    case IPC_CHANNEL.WINDOW_MIN:
    case IPC_CHANNEL.WINDOW_MAX:
    case IPC_CHANNEL.WINDOW_PIN:
    case IPC_CHANNEL.WINDOW_CLOSE:
    case IPC_CHANNEL.WINDOW_SIZE:
    case IPC_CHANNEL.WINDOW_POSITION:
    case IPC_CHANNEL.WINDOW_DRAG:
    case IPC_CHANNEL.WINDOW_FULLSCREEN:
      return false;

    case IPC_CHANNEL.WINDOW_STATUS:
      // 返回 true 表示"窗口已存在"，让调用方走 show 分支
      return false;

    case IPC_CHANNEL.WINDOW_PLAYER:
    case IPC_CHANNEL.WINDOW_SHOW:
      navigate(args[0] ?? WINDOW_NAME.PLAYER, args[1]);
      return true;

    case IPC_CHANNEL.WINDOW_MAIN:
      navigate(WINDOW_NAME.MAIN);
      return true;

    case IPC_CHANNEL.WINDOW_HIDE:
    case IPC_CHANNEL.WINDOW_DESTROY:
      shimBus.emit(channel, ...args);
      return true;

    case IPC_CHANNEL.WINDOW_BROWSER:
      navigate(WINDOW_NAME.BROWSER, { url: args[0], headers: args[1] });
      return true;

    // ---- 业务：播放器跳转 ----
    case IPC_CHANNEL.CALL_PLAYER: {
      const [type, url] = args;
      navigate(WINDOW_NAME.PLAYER, { external: type, url });
      return true;
    }

    // ---- 应用级：移动端无意义 ----
    case IPC_CHANNEL.APP_QUIT:
    case IPC_CHANNEL.APP_REBOOT:
    case IPC_CHANNEL.APP_AUTO_LAUNCH:
    case IPC_CHANNEL.APP_DNS:
    case IPC_CHANNEL.APP_PROXY:
    case IPC_CHANNEL.APP_PROXY_SYSTEM:
    case IPC_CHANNEL.APP_ZOOM:
    case IPC_CHANNEL.BINARY_INSTALL:
    case IPC_CHANNEL.INSTALL_UV_BINARY:
    case IPC_CHANNEL.PYTHON_EXECUTE:
      return false;

    case IPC_CHANNEL.CHANGE_LANG:
    case IPC_CHANNEL.CHANGE_ZOOM:
    case IPC_CHANNEL.CHANGE_THEME:
      shimBus.emit(channel, ...args);
      return true;

    // ---- 文件系统：移动端走 Capacitor Filesystem 或降级 ----
    case IPC_CHANNEL.FS_EXIST:
      return memGet(String(args[0])) !== null;
    case IPC_CHANNEL.FS_FILE_READ:
      return memGet(String(args[0]));
    case IPC_CHANNEL.FS_FILE_WRITE:
      return memSet(String(args[0]), String(args[1]));
    case IPC_CHANNEL.FS_DIR_READ:
    case IPC_CHANNEL.FS_DIR_CREATE:
      return [];
    case IPC_CHANNEL.FILE_SELECT_FILE_DIALOG:
    case IPC_CHANNEL.FILE_SAVE_FILE_DIALOG:
    case IPC_CHANNEL.FILE_SELECT_FOLDER_DIALOG:
    case IPC_CHANNEL.FILE_SELECT_FOLDER_READ:
    case IPC_CHANNEL.FILE_SELECT_FILE_WRITE:
      // 移动端后续接 @capawesome/capacitor-file-picker
      return null;

    // ---- 路径：虚拟化 ----
    case IPC_CHANNEL.PATH_SYSTEM:
      return 'app';
    case IPC_CHANNEL.PATH_HOME:
      return 'home';
    case IPC_CHANNEL.PATH_USER:
      return 'user';
    case IPC_CHANNEL.PATH_JOIN:
      return args.filter(Boolean).join('/');
    case IPC_CHANNEL.PATH_RESOLVE:
      return args.filter(Boolean).join('/');

    // ---- 打开外部：系统浏览器 ----
    case IPC_CHANNEL.OPEN_WEBSITE:
    case IPC_CHANNEL.OPEN_PATH: {
      const url = String(args[0] ?? '');
      if (url.startsWith('http')) window.open(url, '_blank', 'noopener');
      return true;
    }

    // ---- 更新：APK 走 GitHub Release，另行处理 ----
    case IPC_CHANNEL.UPDATE_CHECK:
      return { update: false };
    case IPC_CHANNEL.UPDATE_DOWNLOAD:
    case IPC_CHANNEL.UPDATE_INSTALL:
      return false;

    // ---- 日志：打 console ----
    case IPC_CHANNEL.APP_LOG_TO_MAIN:
      console.log('[renderer]', ...args);
      return true;

    // ---- 系统信息 ----
    case IPC_CHANNEL.SYSTEM_PLATFORM:
      return 'android';
    case IPC_CHANNEL.SYSTEM_ARCH:
      return 'arm64';

    // ---- 服务器控制：移动端无 Fastify ----
    case IPC_CHANNEL.API_SERVER_START:
    case IPC_CHANNEL.API_SERVER_RESTART:
      return true;
    case IPC_CHANNEL.API_SERVER_STOP:
      return true;
    case IPC_CHANNEL.API_SERVER_STATUS:
      return true;

    // ---- 快捷键：移动端无 ----
    case IPC_CHANNEL.SHORTCUT_REGISTER:
    case IPC_CHANNEL.SHORTCUT_UNREGISTER:
    case IPC_CHANNEL.SHORTCUT_CLEAR:
    case IPC_CHANNEL.SHORTCUTS_IS_REGISTERD:
      return false;

    // ---- 缓存 ----
    case IPC_CHANNEL.APP_GET_CACHE_SIZE:
      return 0;
    case IPC_CHANNEL.APP_CLEAR_CACHE:
      return true;

    // ---- 插件（移动端先不支持 Python / 二进制插件）----
    case IPC_CHANNEL.PLUGIN_INSTALL:
    case IPC_CHANNEL.PLUGIN_UNINSTALL:
    case IPC_CHANNEL.PLUGIN_START:
    case IPC_CHANNEL.PLUGIN_STOP:
      return false;

    // ---- WebView 相关 ----
    case IPC_CHANNEL.WEBVIEW_SPELL_CHECK:
    case IPC_CHANNEL.WEBVIEW_LINK_BLOCK:
    case IPC_CHANNEL.WEBVIEW_HEADER_BLOCK:
    case IPC_CHANNEL.WEBVIEW_SEARCH_HOTKEY:
      return true;

    // ---- 通知 ----
    case IPC_CHANNEL.NOTIFICATION_SEND:
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(String(args[0] ?? 'zyfun'));
      }
      return true;

    default:
      console.warn('[shim] unhandled IPC channel:', channel, args);
      return null;
  }
};

/** 构造 window.electron，结构对齐 @electron-toolkit/preload */
export const createElectronShim = () => ({
  ipcRenderer: {
    invoke,
    send: (channel: string, ...args: any[]) => {
      void invoke(channel, ...args);
    },
    on: (channel: string, fn: Handler) => shimBus.on(channel, fn),
    once: (channel: string, fn: Handler) => shimBus.once(channel, fn),
    off: (channel: string, fn: Handler) => shimBus.off(channel, fn),
    removeListener: (channel: string, fn: Handler) => shimBus.off(channel, fn),
    removeAllListeners: (channel: string) => shimBus.removeAllListeners(channel),
  },
  process: {
    env: { NODE_ENV: import.meta.env.MODE, ...import.meta.env },
    platform: 'android',
  },
});
