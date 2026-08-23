# Android 构建说明

本项目已将 Web 应用同时配置为 **PWA** 和 **Capacitor Android 应用**。

> 说明：TWA（Trusted Web Activity）方案要求 PWA 必须部署在公网 HTTPS 地址，并配置 `/.well-known/assetlinks.json`。由于当前环境无法提供公网托管，因此选用 **Capacitor** 方案：它保留 PWA 全部能力（Service Worker、Manifest、离线缓存），同时将 Web 资源打包进 APK，无需公网服务器即可离线运行。

## 已完成的配置

- `vite-plugin-pwa` 已集成，生成 `manifest.webmanifest` 与 Service Worker
- PWA 图标与主题色已配置（`public/icon-*.png`）
- Android 自适应图标与启动屏已生成（`android/app/src/main/res/`）
- 路由已切换为 `HashRouter`，兼容 `file://` 与 TWA 环境
- Capacitor Android 项目已初始化：`android/`

## 环境要求

1. [Node.js](https://nodejs.org/)（项目使用 v22）
2. [JDK 17+](https://adoptium.net/)
3. [Android Studio](https://developer.android.com/studio)（推荐，自动安装 Android SDK）

## 构建步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 生成/更新图标（可选）

```bash
npm run icons
```

### 3. 构建 Web 资源并同步到 Android 项目

```bash
npm run cap:sync
```

### 4. 打开 Android Studio 构建 APK

```bash
npm run cap:open
```

在 Android Studio 中：
- 选择 `Build > Build Bundle(s) / APK(s) > Build APK(s)` 生成调试 APK
- 或选择 `Build > Generate Signed Bundle / APK...` 生成发布 APK

### 5. 命令行构建（可选）

如果已配置好 `ANDROID_HOME` 和 Gradle，可直接运行：

```bash
./android/gradlew assembleDebug
```

生成的 APK 位于 `android/app/build/outputs/apk/debug/app-debug.apk`。

## 发布到 Google Play

1. 生成签名密钥（只需执行一次）：

```bash
keytool -genkey -v -keystore recite-release-key.keystore -alias recite -keyalg RSA -keysize 2048 -validity 10000
```

2. 使用 Android Studio 的 `Generate Signed Bundle / APK...` 生成 `.aab` 或 `.apk`。
3. 若需 TWA 方案，请将应用部署到公网 HTTPS 地址，再用 PWABuilder/Bubblewrap 生成 TWA 项目。

## 离线能力

应用内置 Service Worker，首次启动后会缓存核心资源。后续即使没有网络，仍可正常打开并使用已上传的文档（文档数据保存在 WebView 的 localStorage 中）。
