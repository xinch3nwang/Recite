/**
 * Markdown 导入器：把 Markdown 文本转换为 Mubu 风格大纲 HTML，
 * 与 markdownSerializer（HTML→MD 导出）对称，形成导入/导出闭环。
 *
 * 结构映射：
 * - 第一个 H1 → 文档标题（div.title）；H2-H6 → 加粗节点；
 * - 嵌套列表（缩进自适应：以文档中最小非零缩进为单位）→ 嵌套 Mubu 节点；
 * - 引用行 → 附加为最近节点的解释（note），无最近节点时独立成节点；
 * - 行内格式与导出规则互逆：**→strong、~~→s、<u>→span.underline（重点还原）、
 *   <span style>→原样保留、`→code、[]()→a、![]()→img、转义序列还原为字面字符。
 */

/* ---------------------------------- 行内解析 ---------------------------------- */

/** HTML 转义（用于剩余文本与代码内容） */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 行内 Markdown → 行内 HTML。
 * 使用占位符暂存已确定的 HTML 片段（转义字符/代码/链接/内联标签），
 * 避免其内容被后续语法或 HTML 转义二次处理。
 */
function parseInlineMarkdown(md: string): string {
  const stash: string[] = [];
  const stashHtml = (html: string): string => `\uE000${stash.push(html) - 1}\uE001`;

  // 递归入口（链接/图片/内联标签的内容需继续解析行内格式）
  const parse = (text: string): string => {
    // 1. 反斜杠转义序列 → 字面字符（先于一切语法）
    let out = text.replace(/\\([\\`*_~[\]()#!<>-])/g, (_, ch) => stashHtml(escapeHtml(ch)));
    // 2. 行内代码（内容不再解析格式）
    out = out.replace(/`([^`]+)`/g, (_, code) => stashHtml(`<code>${escapeHtml(code)}</code>`));
    // 3. 图片（先于链接）
    out = out.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)\s*\)/g, (_, alt, src) =>
      stashHtml(`<img alt="${alt}" src="${src}">`)
    );
    // 4. 链接（label 递归解析嵌套格式）
    out = out.replace(/\[([^\]]+)\]\(\s*<?([^)\s>]*)>?\s*\)/g, (_, label, href) =>
      stashHtml(`<a href="${href}">${parse(label)}</a>`)
    );
    // 5. 内联 HTML（导出产物的回流：<u> → 重点下划线；带 style 的 span 原样保留）
    out = out.replace(/<u>([\s\S]*?)<\/u>/gi, (_, inner) =>
      stashHtml(`<span class="underline">${parse(inner)}</span>`)
    );
    out = out.replace(/<span style="([^"]*)">([\s\S]*?)<\/span>/gi, (_, style, inner) =>
      stashHtml(`<span style="${style}">${parse(inner)}</span>`)
    );
    // 6. 加粗 → 删除线 → 斜体（产出片段同样暂存，避免被步骤 7 二次转义；
    //    此时内容中仅剩占位符与纯文本，嵌套格式已在前面步骤处理）
    out = out.replace(/\*\*([^*]+)\*\*/g, (_, inner) => stashHtml(`<strong>${inner}</strong>`));
    out = out.replace(/~~([^~]+)~~/g, (_, inner) => stashHtml(`<s>${inner}</s>`));
    out = out.replace(/\*([^*\n]+)\*/g, (_, inner) => stashHtml(`<em>${inner}</em>`));
    out = out.replace(
      /(^|\s)_([^_\n]+)_(?=\s|$|[.,!?;:，。；：])/g,
      (_, lead, inner) => `${lead}${stashHtml(`<em>${inner}</em>`)}`
    );
    // 7. 剩余文本 HTML 转义
    out = escapeHtml(out);
    return out;
  };

  const result = parse(md);
  // 还原占位符（编号在 stash 中按序还原）
  return result.replace(/\uE000(\d+)\uE001/g, (_, idx) => stash[Number(idx)]);
}

/* ---------------------------------- 块级解析 ---------------------------------- */

/** 扁平节点（解析中间态）：level 为相对缩进层级（0 = 顶层） */
interface FlatNode {
  level: number;
  html: string;
  note?: string;
}

/** 节点树（序列化前中间态） */
interface TreeNode {
  html: string;
  note?: string;
  children: TreeNode[];
}

/** 判断是否水平线（--- / *** / ___），跳过不导入 */
function isHorizontalRule(line: string): boolean {
  return /^ {0,3}(?:(-{3,})|(\*{3,})|(_{3,}))\s*$/.test(line);
}

/** 解析列表项：返回缩进与内容，非列表项返回 null */
function parseListItem(line: string): { indent: number; content: string } | null {
  const match = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(.+)$/);
  if (!match) return null;
  // tab 按 4 空格计
  const indent = match[1].replace(/\t/g, '    ').length;
  return { indent, content: match[2] };
}

/** 标题行 → 节点内容（H1 首个作文档标题，其余与 H2-H6 一律加粗节点） */
function headingNodeHtml(level: number, text: string): string {
  return `<strong>${parseInlineMarkdown(text)}</strong>`;
}

/** 把扁平节点列表按缩进层级组装为树（层级跳级时钳制为前节点 +1） */
function buildTree(flat: FlatNode[]): TreeNode[] {
  const root: TreeNode[] = [];
  // 栈中保存各层级的节点数组引用，stack[0] 为 root
  const stack: TreeNode[][] = [root];
  let prevLevel = -1;

  for (const node of flat) {
    // 层级钳制：相对前一个节点最多深一层
    const level = Math.min(node.level, prevLevel + 1);
    const treeNode: TreeNode = { html: node.html, note: node.note, children: [] };
    // 回退栈到目标层的父容器
    stack.length = level + 1;
    if (!stack[level]) stack[level] = [];
    stack[level].push(treeNode);
    stack[level + 1] = treeNode.children;
    prevLevel = level;
  }
  return root;
}

/** 序列化单个 Mubu 节点（含 bullet / content / note / children） */
function serializeNode(node: TreeNode): string {
  const note = node.note ? `<div class="note mm-editor">${node.note}</div>` : '';
  const children = node.children.length
    ? `<div class="children"><ul class="node-list">${node.children
        .map(serializeNode)
        .join('')}</ul></div>`
    : '';
  return (
    `<li class="node">` +
    `<div class="bullet"><div class="bullet-dot"></div></div>` +
    `<div class="content mm-editor">${node.html}</div>${note}${children}` +
    `</li>`
  );
}

/** 序列化整棵树为 Mubu 文档 HTML（div.title + ul.node-list） */
function serializeMubuHtml(title: string | null, nodes: TreeNode[]): string {
  const titleHtml = title ? `<div class="title">${escapeHtml(title)}</div>` : '';
  return `${titleHtml}<ul class="node-list">${nodes.map(serializeNode).join('')}</ul>`;
}

/** 从缩进空格列表推断缩进单位（最小非零值），默认回退 4 */
function inferIndentUnit(indents: number[]): number {
  const nonzero = indents.filter((n) => n > 0);
  if (nonzero.length === 0) return 4;
  return Math.min(...nonzero);
}

/* ---------------------------------- 主入口 ---------------------------------- */

/** Markdown 导入结果：文档标题 + Mubu 大纲 HTML */
export interface MarkdownImportResult {
  title: string;
  html: string;
}

/**
 * 把 Markdown 文本转换为 Mubu 大纲 HTML。
 * @param md Markdown 原文
 * @param fallbackTitle 无 H1 标题时使用的回退标题（如文件名）
 */
export function markdownToOutlineHtml(md: string, fallbackTitle?: string): MarkdownImportResult {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const flat: FlatNode[] = [];
  let title: string | null = null;
  let pendingHeading: { text: string } | null = null;

  // 第一遍：识别标题、收集列表缩进用于推断缩进单位
  const listIndents: number[] = [];
  for (const line of lines) {
    const item = parseListItem(line);
    if (item) listIndents.push(item.indent);
  }
  const indentUnit = inferIndentUnit(listIndents);

  // 第二遍：逐行状态机
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 围栏代码块：整体收集为一个节点
    if (/^ {0,3}```/.test(line)) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^ {0,3}```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // 跳过闭合 ```
      flat.push({
        level: 0,
        html: `<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`,
      });
      pendingHeading = null;
      continue;
    }

    // 空行 / 水平线：跳过
    if (!line.trim() || isHorizontalRule(line)) {
      i += 1;
      continue;
    }

    // 标题行
    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      if (level === 1 && title === null) {
        title = text;
      } else {
        pendingHeading = { text };
      }
      i += 1;
      continue;
    }

    // 列表项
    const item = parseListItem(line);
    if (item) {
      // 挂起标题：列表前出现的 H2-H6 视为该列表首个节点的引导（合并为独立节点）
      if (pendingHeading) {
        flat.push({ level: 0, html: headingNodeHtml(2, pendingHeading.text) });
        pendingHeading = null;
      }
      const level = Math.floor(item.indent / indentUnit);
      flat.push({ level, html: parseInlineMarkdown(item.content) });
      i += 1;
      continue;
    }

    // 引用行：附加为最近节点的解释（note）
    const quote = line.match(/^ {0,3}>\s?(.*)$/);
    if (quote) {
      const text = parseInlineMarkdown(quote[1]);
      const last = flat[flat.length - 1];
      if (last) {
        last.note = last.note ? `${last.note}\n${text}` : text;
      } else {
        flat.push({ level: 0, html: text });
      }
      i += 1;
      continue;
    }

    // 挂起标题独立成节点
    if (pendingHeading) {
      flat.push({ level: 0, html: headingNodeHtml(2, pendingHeading.text) });
      pendingHeading = null;
    }

    // 普通文本行：一个节点
    flat.push({ level: 0, html: parseInlineMarkdown(line.trim()) });
    i += 1;
  }

  // 收尾：残留的挂起标题
  if (pendingHeading) {
    flat.push({ level: 0, html: headingNodeHtml(2, pendingHeading.text) });
  }

  return {
    title: title ?? fallbackTitle?.trim() ?? '',
    html: serializeMubuHtml(title, buildTree(flat)),
  };
}
