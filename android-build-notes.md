# Android 构建说明（GitHub Actions）

## 触发方式

### 方式 1: 手动触发（推荐首次）
1. 打开 https://github.com/cymylive/zyfun-android/actions
2. 左侧选 **Build Android APK**
3. 点 **Run workflow** → 填版本号（可选）→ 运行
4. 等 10-15 分钟，在运行页底部下载 **zyfun-mobile-apk** artifact

### 方式 2: 打 tag 自动发布 Release
```bash
git tag v3.4.8-mobile.1
git push origin v3.4.8-mobile.1
```
构建完成后会自动创建 Release 并附上 APK。

## 首次运行前的准备

1. **推送代码到 GitHub**
   ```bash
   cd C:\Users\Administrator\Desktop\zyfun-main
   git remote add mobile https://github.com/cymylive/zyfun-android.git
   git checkout -b mobile
   git add .
   git commit -m "feat(mobile): Android APK 支持"
   git push mobile mobile
   ```

2. **确认 workflow 文件已推送**
   ```bash
   git add .github/workflows/build-apk.yml
   git commit -m "ci: add APK build workflow"
   git push mobile mobile
   ```

## 产物说明

- 路径: `android/app/build/outputs/apk/debug/app-debug.apk`
- 类型: **debug 版**（已用默认 keystore 签名，可直接安装）
- 最低 Android 版本: 7.0 (API 24)

## 如果要发布版（release）签名

1. 本地生成 keystore:
   ```bash
   keytool -genkey -v -keystore zyfun.keystore -alias zyfun -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Base64 编码后放进 GitHub Secrets:
   ```bash
   base64 -w 0 zyfun.keystore > keystore.b64
   ```

3. 在仓库 Settings → Secrets 添加:
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
   - `ANDROID_STORE_PASSWORD`

4. 修改 workflow 增加 release 构建步骤（见下一版）。

## 常见问题

### Q: 构建失败提示 "SDK not found"
A: workflow 里的 `android-actions/setup-android@v3` 会自动安装。若失败，在 workflow 里加:
```yaml
- run: sdkmanager "platforms;android-35" "build-tools;35.0.0"
```

### Q: APK 装完闪退
A: 用 `adb logcat | grep -i chromium` 看 WebView 报错。常见原因:
- Vite 产物的 base 路径不对（已设 `base: './'`）
- 缺少 Capacitor 插件（如 Preferences）

### Q: 怎么改应用名 / 图标
A: 改 `capacitor.config.ts` 的 `appName`；图标换 `android/app/src/main/res/mipmap-*`。
