# 编辑功能（结构保持式大纲 + 思维导图）· 使用与 API 文档

> 编辑器默认提供**结构保持式大纲编辑**模式：编辑的本质是对原始 HTML 结构进行**就地修改**，
> 保持原有嵌套层级关系与视觉呈现，不区分标题级别、不改变内容的逻辑结构与显示样式；
> 思维导图作为独立功能，从文件管理的「新建思维导图」进入。

本文档覆盖编辑功能模块的两类读者：**最终用户**（操作说明）与**开发者**（接口说明 / API 文档）。

---

## 目录

- [一、功能总览](#一功能总览)
- [二、用户操作说明](#二用户操作说明)
- [三、数据模型说明](#三数据模型说明)
- [四、API 说明](#四api-说明)
- [五、事务机制与安全性说明](#五事务机制与安全性说明)
- [六、单元测试](#六单元测试)

---

## 一、功能总览

### 1.1 两种编辑模式

| 模式 | 入口 | 说明 |
|------|------|------|
| **结构保持式大纲编辑**（默认） | 阅读页顶部「编辑」按钮 | **就地修改原始 HTML 结构**：编辑仅改变节点文本，完整保留幕布导出的嵌套列表结构（`<li class="node">`、`<div class="bullet">`、`<div class="content mm-editor">`、`<div class="children"><ul class="node-list">`），不区分标题级别、不改变层级嵌套与显示样式 |
| **思维导图编辑** | 文件管理 →「新建思维导图」 | 以**图形节点 + 连接线**构建可视化图谱，支持节点管理、连线样式、安全分享 |

### 1.2 能力对照

| 能力 | 结构保持式大纲编辑 | 思维导图编辑 |
|------|:---:|:---:|
| 加载原文档内容 | ✅ 解析为保持结构的节点树 | —（独立空白图谱） |
| 节点文本增删改 | ✅ | ✅ |
| 调整层级（缩进/提升） | ✅ | —（拖拽定位） |
| 折叠 / 展开子节点 | ✅ | — |
| 节点连线 | — | ✅（直线/曲线/颜色/粗细/线型） |
| 节点解释（note） | ✅ 添加/编辑/删除 | — |
| 保存机制 | 手动保存（显式按钮 + 退出确认） | 即时保存（去抖 200ms 落盘） |
| 安全分享 | — | ✅（令牌 + 有效期） |
| 结构保持（li.node/bullet/content/children） | ✅ 解析-序列化 roundtrip 保留 | — |

符合的技术要求：大纲编辑提供**手动保存**（显式「保存」按钮 + 未保存状态提示 + 退出确认），思维导图提供即时反馈（瞬时状态切换 + 去抖 200ms 落盘）；数据同步采用事务机制保证原子性、分享链接令牌 + 有效期双重防护、全流程错误提示。

---

## 二、用户操作说明

### 2.1 结构保持式大纲编辑（核心文档编辑模式）

#### 进入
1. 在首页打开任意文档，进入阅读页。
2. 点击顶部工具栏右侧的「**编辑**」按钮，进入大纲编辑器。

> 编辑器会**自动加载并解析原文档**为保持结构的节点树：幕布导出的嵌套列表（`<li class="node">` + `<div class="bullet">` + `<div class="content mm-editor">` + `<div class="children"><ul class="node-list">`）与通用块（`h1/p/div/...`）均按原始标签与嵌套层级保留。所有原内容（含 `.underline` 重点标记、备注 `.note.mm-editor`）都会被保留。

#### 查看层级
- 每一行代表一个节点，子节点相对父节点**缩进约 20px**（每层 `ml-4 + pl-2`），左侧带淡灰层级线（`border-l`），层级关系清晰且不会过度缩进。
- 含子节点的行左侧有折叠箭头，点击可折叠 / 展开其子树；无子节点行无箭头。

#### 编辑节点文本
- 点击任意行的文本区域即可直接编辑，内容实时生效；保存采用**手动模式**，点击右上角「**保存**」落盘（见下方「保存与返回」）。
- 按 `Enter` 可在当前行后新增一个同级节点（避免回车插入 `<div>`/`<br>` 破坏结构）。
- 节点带备注（`.note.mm-editor`）时，备注区域也可独立编辑。

#### 节点解释
- 幕布（Mubu）列表项节点在行内容下方显示「**添加解释**」小按钮（带便签图标）。
- 点击后出现灰色解释输入框（`StickyNote` 图标 + 占位提示「输入解释…」），可输入任意解释文本；解释会序列化写入 `.note.mm-editor`，保持原始结构。
- 已添加解释的节点显示输入框 + 右侧 ✕ 删除按钮，点击 ✕ 可删除解释并恢复「添加解释」按钮。
- 解释与正文一样，仅在点击右上角「保存」后落盘。

#### 结构调整（悬停行尾操作按钮）
| 操作 | 功能 |
|------|------|
| 长按节点前的圆点 · 拖拽 | 拖动到其他节点右侧 → 成为其**下级节点**；拖动到同行上下 → **同级排序**；拖拽中显示指示线与跟随浮层，松手实时更新 |
| ＋（添加子节点） | 在当前行后新增一个子节点（沿用当前节点结构风格） |
| ＋ 旋转45°（添加同级） | 在当前行后新增一个同级节点 |
| 🗑（删除） | 删除当前节点（含其子树） |

> 移动端按钮常显；桌面端悬停行尾显示。不能将节点拖入其自身或后代之下。

#### 添加节点
- 点击工具栏右上角「**添加节点**」在末尾追加一个顶层节点。

#### 结构保持
- 编辑、新增、删除、折叠均只影响节点文本与层级关系，序列化时**逐字还原原始结构**：`<li class="node">`、`<div class="bullet">` 及其内部 `<div class="bullet-dot">`、`<div class="content mm-editor">` 内容区、嵌套 `<div class="children"><ul class="node-list">` 子列表均保持原有嵌套层级与显示样式。

#### 保存与返回（手动保存 + 退出确认）
- 编辑内容后工具栏出现**琥珀色「未保存更改」徽章**（带圆点），点击右上角琥珀色「**保存**」按钮落盘，成功后徽章变为绿色「已保存」并弹出「已保存」提示；保存失败显示「保存失败」并给出原因。
- 存在未保存更改时点击返回（或安卓物理返回键），弹出「**有未保存的更改**」确认对话框，提供三个选项：
  - **保存并退出**：先保存再返回阅读页（阅读页展示编辑后的最新内容）。
  - **不保存退出**：放弃本次更改直接返回（阅读页保留上一次保存的内容）。
  - **取消**：关闭对话框，留在编辑器继续编辑。
- 无未保存更改时点击返回直接回到阅读页。

### 2.2 思维导图编辑（独立功能）

#### 新建
1. 进入「文件管理」。
2. 点击顶部「**新建思维导图**」，自动创建一个思维导图文档并进入导图编辑器。

> 思维导图文档会出现在文件列表中（标记为思维导图），从列表打开时**直接进入导图编辑器**。

#### 节点管理
- 点击工具栏「添加节点」新建图形节点，并在右侧面板编辑：
  - **类型**：概念 / 要点 / 疑问 / 备注（各有主题色）。
  - **标题**：节点主标题。
  - **内容**：补充说明（可选）。
- 点击「删除节点」删除节点并连带清理关联连线。
- 按住节点卡片可自由拖动布局。

#### 连接线
- 悬停节点，按住边缘的圆形连接点拖向目标节点，松开即建立连接。
- 选中连接线后可在面板调整：**连接样式**（直线/曲线）、**颜色**（7 色）、**粗细**（1-6）、**线型**（实线/虚线/点线）。
- 约束：不能连接自身（自环），同一对节点不重复连线。

#### 即时保存
- 节点增删改、连线、样式调整、拖拽均自动事务化保存。

#### 安全分享
1. 画布上至少有一个节点后，点击「分享」。
2. 生成含**访问令牌**并设**有效期（默认 7 天）**的分享链接，仅持有链接者可查看。
3. 点击「复制链接」分享；「撤销分享」立即失效。

---

## 三、数据模型说明

### 3.1 大纲编辑（文档正文）

大纲编辑直接读写文档的 `content`（HTML 字符串），采用**结构保持式**解析 / 序列化。解析时把文档拆成保持原始嵌套层级关系的节点树，编辑只修改节点文本，序列化时逐字还原原始结构：

| 来源 | 解析为 | 序列化回 |
|------|--------|---------|
| 幕布导出的 `<li class="node">`（含 `<div class="bullet"><div class="bullet-dot">`、`<div class="content mm-editor">`、嵌套 `<div class="children"><ul class="node-list">`、备注 `<div class="note mm-editor">`） | Mubu 列表项节点（保留 `liClass`、内容、备注、子节点） | `<ul class="node-list"><li class="node"><div class="bullet"><div class="bullet-dot"></div></div><div class="content mm-editor">…</div><div class="children"><ul class="node-list">…</ul></div></li>…</ul>` |
| `h1`-`h6` / `p` / `div` / `blockquote` 等通用块 | 通用块节点（保留原始标签与属性） | 按原标签与属性输出 |
| `.underline` 重点标记 | 原样保留在节点 html 中 | 原样保留 |

> 关键：不区分标题级别、不改变内容的逻辑结构与显示样式，仅就地修改文本。

### 3.2 OutlineNode（大纲节点）

```ts
interface OutlineNode {
  id: string;          // 唯一标识
  html: string;        // 可编辑内容（Mubu：.content.mm-editor 内部；通用块：标签内部），保留 .underline 等标记
  note?: string;       // 备注（Mubu：.note.mm-editor 内部），可选
  liClass?: string;    // Mubu 列表项 class（如 'node'、'node collapsed'）；存在则按 Mubu 结构序列化
  tag?: string;        // 通用块标签（h1/p/div/blockquote...）；存在则按原始标签序列化
  attrs?: string;      // 通用块原始属性（如 class="foo"），可选
  children: OutlineNode[];  // 子节点（保持原始嵌套层级关系）
}

interface OutlineDoc {
  titleHtml: string | null;  // 标题 div（Mubu .title）内部 html，无则为 null
  nodes: OutlineNode[];      // 顶层节点
}
```

### 3.3 思维导图（独立存储）

思维导图数据与文档绑定、按文档独立存储（键 `recite_diagram_{docId}`），结构与 v1.0 相同（`DiagramData`：`nodes` + `edges`）。文档新增 `type` 字段区分类型：

```ts
type DocumentType = 'document' | 'mindmap';  // 普通文档 / 思维导图文档
```

---

## 四、API 说明

### 4.1 大纲纯逻辑层 `src/utils/outline.ts`

> 纯函数、不依赖 React / 存储，便于测试。

| 函数 | 签名 | 说明 |
|------|------|------|
| `parseHtmlToOutline(html)` | `(string) => OutlineDoc` | 将文档 HTML 解析为保持结构的节点树（Mubu `li.node` + 通用块，保留嵌套层级与重点标记） |
| `serializeOutline(doc)` | `(OutlineDoc) => string` | 序列化为 HTML 片段，逐字还原原始结构（`li.node`/`bullet`/`content`/`children`/`ul.node-list`） |
| `createOutlineNode(html?, note?)` | `(...) => OutlineNode` | 新建 Mubu 风格节点 |
| `createNodeLike(ref, html?)` | `(...) => OutlineNode` | 依据参考节点风格创建新节点（通用块保持同标签） |
| `countNodes(nodes)` | `(OutlineNode[]) => number` | 统计节点总数（含嵌套） |
| `updateNodeHtml(nodes, id, html)` | `(...) => OutlineNode[]` | 更新节点内容（不可变） |
| `updateNodeNote(nodes, id, note)` | `(...) => OutlineNode[]` | 更新节点备注（不可变） |
| `removeNode(nodes, id)` | `(...) => OutlineNode[]` | 删除节点（含子树） |
| `addChild(nodes, parentId, node)` | `(...) => OutlineNode[]` | 追加子节点 |
| `addSibling(nodes, refId, node)` | `(...) => OutlineNode[]` | 在同层插入节点 |
| `indentNode(nodes, refId)` | `(...) => OutlineNode[]` | 提升层级（成为前一兄弟的子节点） |
| `outdentNode(nodes, refId)` | `(...) => OutlineNode[]` | 降低层级（移出父节点成为新兄弟） |

### 4.2 文档正文事务更新 `src/utils/storage.ts`

| 函数 | 签名 | 说明 |
|------|------|------|
| `updateDocumentContent(docId, updater)` | `(string, (content: string) => string) => ContentUpdateResult` | **事务更新文档正文**：读 → 应用 updater → 整体写 → 失败回滚 |

`ContentUpdateResult`：

```ts
interface ContentUpdateResult {
  ok: boolean;             // 是否成功
  doc: ReciteDocument | null;  // 成功时为最新文档
  error: string | null;    // 失败原因
}
```

**事务流程**（保证原子性）：读取当前文档 → 应用 `updater` 得到新正文 → 整体 `setItem` 覆盖写入 → 捕获异常时**恢复写入前备份**，杜绝半写入脏数据。

### 4.3 思维导图相关（与 v1.0 一致）

| 文件 | 说明 |
|------|------|
| `src/utils/diagram.ts` | 节点/连接线数据模型 + CRUD + 校验 + 序列化 |
| `src/utils/diagramStorage.ts` | `saveDiagramTransaction` 事务持久化 |
| `src/utils/share.ts` | 分享令牌生成/验证/撤销（`createShare` / `validateShareAccess` / `revokeShare`） |
| `src/pages/MindMap.tsx` | 思维导图编辑器页面（画布拖拽 / 连线 / 编辑面板 / 分享弹窗） |
| `src/components/editor/NodeCard.tsx` / `EdgeLayer.tsx` / `EditorToolbar.tsx` | 导图节点卡片 / 连线渲染 / 工具栏 |

### 4.4 大纲编辑相关

| 文件 | 说明 |
|------|------|
| `src/pages/Editor.tsx` | 大纲编辑器页面（加载文档 → 解析节点树 → 编辑/折叠/增删 → 事务保存） |
| `src/components/editor/OutlineRow.tsx` | 大纲单行：折叠箭头 + 圆点 + 可编辑内容（+ 备注）+ 添加子节点/同级/删除，缩进由树深度决定 |

### 4.5 路由与入口

- `/editor?doc={docId}` — 文档大纲编辑器（阅读页「编辑」进入）。
- `/diagram?doc={docId}` — 思维导图编辑器（文件管理「新建思维导图」/ 打开思维导图文档进入）。
- `/share/{shareId}?token={token}` — 思维导图分享查看页。
- 文件管理「新建思维导图」创建 `type: 'mindmap'` 的文档并跳转 `/diagram`。
- 普通文档从文件列表打开 → 阅读页；思维导图文档从列表打开 → 导图编辑器。

---

## 五、事务机制与安全性说明

### 5.1 原子性（防数据损坏）

- 大纲编辑：`updateDocumentContent` 单键整体替换 + 校验 + 失败回滚。
- 思维导图：`saveDiagramTransaction` 读 → 更新 → 校验 → 整体写 → 失败回滚。
- 任何时刻存储中的文档正文 / 图数据都是**完整有效的快照**。

### 5.2 即时性与性能

- 大纲编辑：文本输入实时反映，去抖 200ms 落盘，响应远低于 300ms。
- 思维导图：拖拽、连线均在本地 state 即时更新。

### 5.3 分享安全

- 令牌 + 盐 + 有效期组合，恒定时间比较防时序攻击；分享只读；撤销即时生效。

### 5.4 错误处理与用户提示

| 场景 | 处理 / 提示 |
|------|-------|
| 文档参数缺失 / 文档不存在 | 展示错误页与返回按钮 |
| 大纲编辑保存失败 | 提示「保存失败」及原因，事务回滚 |
| 导图节点/连线操作 | 操作成功 / 重复非法均有 Toast 提示 |
| 分享但画布为空 | 提示「请先添加节点后再分享」 |

---

## 六、单元测试

| 测试文件 | 覆盖范围 |
|----------|---------|
| `src/utils/__tests__/outline.test.ts` | 结构保持式解析（Mubu `li.node`/`bullet`/`content`/`children`/`ul.node-list`/`.note`、通用块）、序列化 roundtrip（结构逐字还原）、重点标记保留、树操作（增删改/缩进/提升/同级插入） |
| `src/utils/__tests__/storage.test.ts` | `updateDocumentContent` 事务更新、文档不存在、写入异常回滚、mindmap 类型保留 |
| `src/utils/__tests__/diagram.test.ts` / `diagramStorage.test.ts` / `share.test.ts` | 思维导图节点/连线/事务/分享安全 |

运行方式：

```bash
npm test          # 执行全部单元测试
npx tsc --noEmit  # 类型检查
npx eslint src    # 代码规范
npx vite build    # 生产构建
```

> 单元测试共 **150 项全通过**；`tsc`、`eslint`、`vite build` 均校验通过。

---

*编辑功能模块文档 · 版本 v2.1 · 更新日期：2026-08*