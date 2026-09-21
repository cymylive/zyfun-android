# zyfun 移动端（Android APK）

> 基于 [zyfun](https://github.com/Hiram-Wong/zyfun) v3.4.8 的 Android 移植版。
> 通过 Capacitor 把 Vue3 渲染层封装成原生 APK，采集/解析/播放全部在手机本地运行，**完全离线可用**。

## 特性

| 功能 | 状态 | 说明 |
|---|---|---|
| 📺 影视点播 | ✅ | 支持 CMS 采集源（XML/JSON/Alist/AppYs/XBPQ/XYQ/Drpy/CatOpen） |
| 📡 IPTV 直播 | ✅ | M3U / TXT 订阅，含 EPG、频道分组、回看参数 |
| ▶️ 视频播放 | ✅ | HLS / FLV / DASH / MP4 / m3u8，多播放器内核 |
| 🔍 搜索 | ✅ | 聚合搜索 + 筛选 |
| ⭐ 收藏 / 历史 | ✅ | 本地 IndexedDB 存储 |
| 🌐 多语言 | ✅ | 简体 / 繁体 / English |
| 🎨 主题 | ✅ | 亮 / 暗 / 跟随系统 |
| 🐍 Python 源 | ❌ | 需 Python 运行时，未实现 |
| ☕ CatVod 源 | ❌ | 需 Java 运行时，未实现 |
| 📥 下载 / 转码 | ❌ | 需 FFmpeg，未实现 |
| 🖥️ 多窗口 | ➖ | 移动端改为单窗口路由跳转 |

## 项目结构

```
zyfun-main/
├── src/
│   ├── renderer/              # 【复用】桌面版 Vue3 UI（几乎零改动）
│   ├── shared/                # 【复用】共享配置 / 类型 / 工具
│   ├── main/                  # 桌面版主进程（移动端不参与构建）
│   └── mobile/                # 【新增】移动端专属层
│       ├── index.html         # 移动端入口 HTML
│       ├── main.ts            # 启动流程：装 shim → 装路由 → 挂 App
│       ├── shims/
│       │   ├── electron-api.ts  # window.electron 兼容层（90+ IPC 通道）
│       │   └── navigator.ts     # 窗口事件 → vue-router 跳转
│       ├── services/
│       │   ├── local-router.ts  # 本地 REST 路由（替代 Fastify）
│       │   ├── local-backend.ts # 启动初始化
│       │   ├── store.ts         # IndexedDB 存储（替代 SQLite）
│       │   ├── request.ts       # 采集层 HTTP 客户端
│       │   ├── updater.ts       # APK 更新检查
│       │   ├── cms/             # 【移植】CMS 适配器（12 种源）
│       │   ├── hiker/           # 【移植】HTML/规则解析引擎
│       │   └── routes/          # REST 路由实现（film/live/setting/system）
│       └── utils/               # node:path / node:buffer / logger 的浏览器实现
├── capacitor.config.ts        # Capacitor 配置
├── vite.config.mobile.ts      # 移动端构建配置
└── .github/workflows/
    └── build-apk.yml          # GitHub Actions 自动构建 APK
```

## 核心设计

### 1. 双 shim 让 renderer 零改动

桌面版 renderer 依赖两条通道与主进程通信：

1. **IPC**：`window.electron.ipcRenderer.invoke(IPC_CHANNEL.*)` —— 90+ 处调用
2. **HTTP**：`apiRequest` → `http://127.0.0.1:9978/api/v1/*`

移动端分别用两个 shim 替换：

- **IPC shim**（`shims/electron-api.ts`）：把 90+ 个通道分五类处理（窗口控制→路由跳转、文件系统→localStorage、桌面专有→no-op、WebView→iframe、日志→console）
- **HTTP shim**（`services/local-router.ts`）：替换 axios adapter，把 `/api/v1/*` 请求分发给内存路由，路由处理函数直接复用桌面 Fastify 的业务逻辑

**结果**：`src/renderer/` 一行没改。

### 2. 采集层移植

桌面版采集逻辑（CMS 适配器 + hiker 引擎）本来就只依赖 `@shared/*` 和 axios，无 Node 专有 API，直接复制到 `src/mobile/services/` 并替换：

| 桌面依赖 | 移动端替换 |
|---|---|
| `@main/utils/request` | `@mobile/services/request`（fetch） |
| `workerpool`（子进程） | 主线程直接执行 |
| `hiker/request/syncFetch`（child_process） | 同步 XHR（`sync-request.ts`） |
| `node:path` / `node:buffer` | `@mobile/utils/path` / `buffer` |
| `@libsql/client`（SQLite） | IndexedDB |
| Python / CatVod 源 | 空实现（抛异常） |

### 3. 构建产物

- Vite 构建 → `dist-mobile/`（约 42 MB，386 文件）
- Capacitor 把 `dist-mobile/` 注入 Android 工程 → Gradle 编译 → APK

## 本地开发

```bash
# 1. 装依赖
pnpm install --ignore-scripts

# 2. 构建移动端 web 资源
pnpm build:mobile

# 3. 浏览器预览（验证 UI 层）
pnpm exec vite preview --config vite.config.mobile.ts

# 4. 同步到 Android 工程
pnpm cap:sync

# 5. 打开 Android Studio（或命令行构建）
pnpm cap:open
# 或
pnpm android:apk
```

## 在 GitHub 上构建 APK（无需本地 Android 环境）

见 [android-build-notes.md](./android-build-notes.md)。

简要流程：

1. 推送代码到 GitHub
2. 打开仓库 **Actions** → **Build Android APK** → **Run workflow**
3. 等 10-15 分钟
4. 在运行页下载 **zyfun-mobile-apk** artifact

或者打 tag 自动发 Release：

```bash
git tag v3.4.8-mobile.1
git push origin v3.4.8-mobile.1
```

## 导入数据源

APK 本身**不含任何影视源**。首次使用需要在「设置 → 数据源」导入：

- **点播源**：支持 JSON 格式的 CMS 源订阅（`.json`）
- **直播源**：支持 M3U / TXT 格式（`.m3u` / `.txt`）

请自行准备**合法授权**的内容源。

## 已知限制

1. **drpy 源的部分功能**：drpy2 内部用同步 `req()`，移动端用同步 XHR 实现，会阻塞 UI。用异步 API 的源不受影响。
2. **Python 源 / CatVod 源**：未实现，后续可用 Pyodide(WASM) / Android Java 层补回。
3. **Code Editor / Lab 页**：monaco-editor 在移动端基本不可用（已保留但体验差）。
4. **下载 / 转码**：无 FFmpeg。

## 上游同步

本项目 fork 自 `Hiram-Wong/zyfun`，移动端改动集中在：

- `src/mobile/`（新增，不冲突）
- `vite.config.mobile.ts`、`capacitor.config.ts`（新增）
- `package.json`（加 3 个 script）
- `.gitignore`（加 Android 相关忽略）

**renderer / shared / main 均未改动**，可直接 `git merge upstream/main`。

## License

AGPL-3.0（与上游一致）
