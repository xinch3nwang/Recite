# 文件管理「打包下载」改为「导出 HTML / Markdown / PDF」

## Context

文件管理界面批量操作栏现有「打包下载」仅把选中文档的原始 Mubu HTML 打成 zip，不便于直接查看与分享。需改为「导出」功能，支持 **HTML / Markdown / PDF** 三种格式并**保持格式**（加粗 `strong`、重点下划线 `span.underline`、删除线 `s`、颜色 `span[data-fmt-color]`、背景高亮 `span[data-fmt-bg]`、嵌套大纲、节点解释 note）。

已确认决策：

* PDF 用 **jsPDF（新增依赖，动态 import）+ 已有 html2canvas** 截图式分页（Android WebView 无系统打印，必须客户端生成；文字变位图可接受）

* **思维导图文档跳过**（content 为空、图数据在独立 JSON），结果中提示跳过数量

* UI：「导出」下拉菜单（HTML / Markdown / PDF 三项），复用「新建文档」下拉交互模式

* 多选导出打 zip；单选直接下载单文件；成功后清空选中（沿用现有语义）

## 文件清单

| 文件                                | 动作    | 职责                                                                                                                               |
| --------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                    | 改     | `npm install jspdf`（约 gzip 124KB，仅 PDF 导出时动态加载）                                                                                  |
| `src/services/downloadService.ts` | 改     | 瘦身为下载原语：保留 `safeFileName`，`triggerDownload` 改为导出；删除 `downloadDocument` / `downloadDocumentsAsZip`                                |
| `src/utils/exportStyles.ts`       | 新     | `EXPORT_CSS` 常量：以 [index.css](file:///d:/Code/Recite/src/index.css) L59-248 `.recite-document-content` 规则为蓝本，HTML 导出与 PDF 离屏渲染共用 |
| `src/utils/exportHtml.ts`         | 新     | `buildExportHtml(title, content): string` 自包含单文件 HTML                                                                            |
| `src/utils/markdownSerializer.ts` | 新     | `outlineToMarkdown(doc, fallbackTitle)`、`inlineHtmlToMarkdown(html)` 纯函数                                                         |
| `src/services/pdfExport.ts`       | 新     | `renderDocumentToPdfBlob(title, content): Promise<Blob>` + 纯函数 `computePdfPageLayout`                                            |
| `src/services/exportService.ts`   | 新     | `exportDocuments(ids, format, onProgress?): Promise<ExportResult>` + 纯函数 `dedupeFileNames`                                       |
| `src/pages/FileManager.tsx`       | 改     | 「打包下载」→「导出」下拉 + loading 态 + toast                                                                                                |
| `src/hooks/useClickOutside.ts`    | 新(可选) | 两个下拉共用外部点击关闭                                                                                                                     |
| 测试                                | 新/迁   | exportHtml / markdownSerializer / pdfExport(纯函数) / exportService 单测；downloadService.test.ts 中 zip 用例迁走                           |

## 关键设计

### 1. exportStyles.ts（EXPORT\_CSS）

* 复制 `.recite-document-content` 阅读样式等效规则（字体衬线、行高 1.8、node-list 缩进 4px/嵌套 20px、li.node 间距、bullet 圆点、underline 琥珀下划线、note 灰色小字、h1-h4/p/table）

* **剔除**：`div.title{display:none}`（导出需显示标题，改为居中 1.5rem 加粗）、折叠相关规则（is-collapsed/grid-template-rows）、recite-highlight-\* 类

### 2. exportHtml.ts

```
<!DOCTYPE html>…<title>{escapeHtml(title)}</title><style>${EXPORT_CSS}</style>
…<article class="recite-document-content">${sanitizeHtml(content)}</article>
```

* 正文过 [sanitizeHtml.ts](file:///d:/Code/Recite/src/utils/sanitizeHtml.ts)（已存在）；`.underline` 直接显示文本（导出用于备份/迁移，不做记忆隐藏）

### 3. markdownSerializer.ts（核心转换规则）

数据源：[outline.ts](file:///d:/Code/Recite/src/utils/outline.ts) `parseHtmlToOutline`（已有，jsdom 可测）。

结构映射：

* `div.title` → `# 标题`；titleHtml 为 null 时用 fallbackTitle 兜底

* Mubu `li.node` → `- 内容`，子节点嵌套列表**每层缩进 4 空格**

* `note` → 列表项内续行引用块 `> …`

* 通用块 h1-h6 → `#`×n；p/div → 段落；blockquote → `> `&#x20;

行内映射（DOM 递归遍历）：

* `strong/b`→`**`；`s/del`→`~~`；`em/i`→`*`；`code`→反引号；`a`→`[]()`

* `span.underline/u`→`<u>text</u>`（MD 无原生下划线，用内联 HTML）

* `span[data-fmt-color]`→`<span style="color:…">`、`span[data-fmt-bg]`→`<span style="background-color:…">`（同 span 双标记合并为一个 span；textFormat.ts 确认同时写 style 与 data attr）

* 文本节点转义：`\ `` `  \`\` \* \_ \~ \[ ] !`一律`\` 前缀；`#-+>` 仅行首转义；`<`→`\<`；空白折叠

### 4. pdfExport.ts

1. 动态 `await Promise.all([import('jspdf'), import('html2canvas')])`
2. 离屏容器：`position:fixed; left:-10000px; width:794px; background:#F9F7F2`（不能 display:none），innerHTML = `<style>${EXPORT_CSS}</style><article class="recite-document-content">…`
3. 双重 rAF + `document.fonts.ready` 等待字体；html2canvas `scale = min(2, 16000/文档高)`（Android canvas 高度上限，超长文档降 DPI 防崩）
4. 分页切片：`computePdfPageLayout`（纯函数：pxPerPt = canvasW/595.28；pageContentH = 793.89\*pxPerPt；pageCount=ceil）→ 每页 slice canvas 先铺米色底再 drawImage 偏移
5. jsPDF a4 pt 单位、边距 24pt、`addImage(JPEG, quality 0.92)`、末页按剩余高度、`output('blob')`

### 5. exportService.ts 编排

```ts
export type ExportFormat = 'html' | 'markdown' | 'pdf';
export interface ExportResult { exportedCount: number; skippedMindmapCount: number; failedCount: number; }
```

* 逐 id：读取失败→failedCount++；`type==='mindmap'`→skippedMindmapCount++；单篇 PDF 异常 catch 后计入 failedCount 继续

* `dedupeFileNames`：zip 内重名追加  ` (2)`、 ` (3)`（扩展名前）

* 下载：1 篇→直接下载单文件；>1 篇→JSZip 打包 `忆读-导出-{HTML|Markdown|PDF}-{ts}.zip`；0 篇→不下载

### 6. FileManager.tsx UI

* 参照「新建文档」下拉（L50-62 状态 / L316-340 菜单）：`exportOpen` + `exportRef` + 外部点击关闭 + `role="menu"/"menuitem"` + ChevronDown 旋转

* 按钮：`<Download/>` 导出 ↔ 导出中用 `<Loader2 className="animate-spin"/>` + disabled；菜单三项：导出 HTML（FileCode）/ 导出 Markdown（FileText）/ 导出 PDF（FileDown）

* `handleExport(format)`：调 exportDocuments → toast（复制 [Editor.tsx](file:///d:/Code/Recite/src/pages/Editor.tsx) L204-207 的 2.2s toast 模式）：

  * 全成功：`已导出 N 篇文档`

  * 有跳过：`已导出 N 篇，跳过 M 篇思维导图`（+失败数）

  * 全是 mindmap：`选中的均为思维导图，暂不支持导出`

* `exportedCount>0` 时清空选中；全失败/全跳过保留选中便于重试

## 边界处理

| 场景             | 行为                                   |
| -------------- | ------------------------------------ |
| 空文档 content="" | 正常导出（仅标题），不算失败                       |
| 超长文档 PDF       | scale 钳制 16000px，接受降清晰度              |
| 导出中重复点击        | exporting disabled + handleExport 早退 |
| zip 内同名        | dedupeFileNames 序号去重                 |

## 实施顺序

1. `npm install jspdf`
2. downloadService 瘦身 + 测试迁移
3. exportStyles → exportHtml → 单测
4. markdownSerializer → 单测（核心工作量）
5. pdfExport（computePdfPageLayout 纯函数先行）→ 单测
6. exportService → 单测
7. FileManager UI（下拉 + loading + toast）
8. 全量验证

## 验证

* `npm run check` / `npm run test` / `npm run build`（确认 jspdf 进独立 chunk）

* 单测覆盖：MD 转换全规则（标题/嵌套/note/六种行内格式/转义/空节点）、computePdfPageLayout 三种分页、dedupeFileNames、exportService 混合选中统计（stub createObjectURL）

* 手动（`npm run dev`）：单选/多选/含 mindmap 各导出三种格式；打开导出 HTML 核对标题居中、嵌套缩进、underline 显示、颜色高亮保留；MD 用 Obsidian 预览核对层级与格式；PDF 长文档分页无截断、中文正常

