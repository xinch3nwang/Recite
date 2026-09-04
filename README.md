# 忆读

「隐藏重点内容，辅助记忆与复习」——一个面向背诵场景的文档阅读与编辑应用。导入 HTML / Markdown 文档后，可将划线标注的重点内容一键隐藏，阅读时点击即可切换显示 / 隐藏，适合背诵、复习与自测。

## 功能特性

- **重点隐藏背诵**：标注（下划线重点）内容默认隐藏，点击切换显示，辅助记忆与自测
- **大纲编辑器**：Mubu 风格的结构化大纲编辑，支持节点增删、缩进层级、拖拽排序、节点折叠、解释（note）与文本格式化（加粗 / 划线 / 删除线 / 颜色 / 荧光笔），手动保存
- **思维导图**：独立导图编辑器，支持以导图形式整理知识结构
- **文档管理**：分类管理、全文搜索、随机抽背、批量导出
- **导入 / 导出**：支持 HTML 与 Markdown 导入；可导出为自包含 HTML、Markdown、PDF（单文件或批量 zip）
- **夜间模式**：一键切换深色 / 浅色主题，跟随系统偏好并本地持久化
- **移动端适配**：响应式布局，竖屏手机优化；支持 PWA 安装，并可通过 Capacitor 打包为 Android 应用

## 技术栈

- React 18 + TypeScript + Vite
- Tailwind CSS（含 Typography 插件）
- Zustand（状态管理）+ React Router 7
- Vitest + Testing Library（单元测试）
- vite-plugin-pwa（PWA）
- Capacitor 8（Android 打包）
- jsPDF + html2canvas（PDF 导出）、JSZip（批量导出）

## 快速开始

```bash
# 安装依赖
npm install

# 本地开发（HMR）
npm run dev

# 类型检查 / 单元测试
npm run check
npm run test

# 生产构建 + 本地预览
npm run build
npm run preview
```

## Android 打包

依赖 JDK 21，详见 [ANDROID_BUILD.md](./ANDROID_BUILD.md)。

```bash
npm run icons        # 生成应用图标与启动图
npm run cap:sync     # 构建 Web 资源并同步到 Android
npm run cap:open     # 用 Android Studio 打开工程
npm run cap:build:android
```

## 项目结构

```
src/
├── pages/        # 页面：Home（首页/文件管理）、Reader、Editor、Diagram 等
├── components/   # 通用组件（上传、格式化工具栏等）
├── lib/          # 核心逻辑：outline 模型、导入/导出、存储服务
└── store/        # Zustand 状态
```
