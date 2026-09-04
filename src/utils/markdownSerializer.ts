/**
 * Markdown 序列化器：把 Mubu 风格大纲 HTML 转换为结构保持的 Markdown。
 * 数据源为 outline.ts 的 parseHtmlToOutline 解析树；行内格式用 GFM +
 * 内联 HTML（<u> / <span style>）保持下划线、颜色、背景高亮。
 *
 * 纯逻辑、无 IO，便于单元测试。
 */
import type { OutlineDoc, OutlineNode } from '@/utils/outline';

/* ---------------------------------- 行内转换 ---------------------------------- */

/** 行内转换的公共状态：lineStart 标记当前位置是否位于行首（用于 #、-、+、> 的转义判断） */
interface InlineCtx {
  lineStart: boolean;
}

/** 一律转义的 Markdown 特殊字符 */
const INLINE_ESCAPE_ALWAYS = new Set(['\\', '`', '*', '_', '~', '[', ']', '!']);
/** 仅在行首需要转义的字符（列表/标题/引用语法） */
const INLINE_ESCAPE_LINE_START = new Set(['#', '-', '+', '>']);

/** 转义文本节点内容：Markdown 特殊字符加反斜杠；换行/制表符折叠为空格 */
function escapeText(text: string, ctx: InlineCtx): string {
  let out = '';
  for (const ch of text) {
    if (ch === '\n' || ch === '\r' || ch === '\t') {
      out += ' ';
      continue;
    }
    if (INLINE_ESCAPE_ALWAYS.has(ch)) {
      out += `\\${ch}`;
    } else if (ctx.lineStart && INLINE_ESCAPE_LINE_START.has(ch)) {
      out += `\\${ch}`;
    } else if (ch === '<') {
      out += '\\<';
    } else {
      out += ch;
    }
    ctx.lineStart = false;
  }
  return out;
}

/** 递归转换行内节点；br 输出换行（由调用方负责续行缩进） */
function walkInline(nodes: ArrayLike<Node>, ctx: InlineCtx): string {
  let out = '';
  for (const node of Array.from(nodes)) {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      out += escapeText(node.textContent ?? '', ctx);
      continue;
    }
    if (node.nodeType !== 1 /* ELEMENT_NODE */) continue;

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') {
      out += '\n';
      ctx.lineStart = true;
      continue;
    }

    const inner = walkInline(el.childNodes, ctx);

    switch (tag) {
      case 'strong':
      case 'b':
        out += inner.trim() ? `**${inner}**` : inner;
        break;
      case 's':
      case 'strike':
      case 'del':
        out += inner.trim() ? `~~${inner}~~` : inner;
        break;
      case 'em':
      case 'i':
        out += inner.trim() ? `*${inner}*` : inner;
        break;
      case 'code':
        out += inner ? `\`${inner}\`` : inner;
        break;
      case 'u':
        out += `<u>${inner}</u>`;
        break;
      case 'span': {
        if (el.classList.contains('underline')) {
          out += `<u>${inner}</u>`;
          break;
        }
        const color = el.getAttribute('data-fmt-color') ?? '';
        const bg = el.getAttribute('data-fmt-bg') ?? '';
        if (color || bg) {
          const styleParts: string[] = [];
          if (color) styleParts.push(`color:${color}`);
          if (bg) styleParts.push(`background-color:${bg}`);
          out += `<span style="${styleParts.join(';')}">${inner}</span>`;
        } else {
          out += inner;
        }
        break;
      }
      case 'a': {
        const href = el.getAttribute('href') ?? '';
        out += href ? `[${inner}](<${href}>)` : inner;
        break;
      }
      case 'img': {
        const alt = el.getAttribute('alt') ?? '';
        const src = el.getAttribute('src') ?? '';
        out += `![${alt}](<${src}>)`;
        break;
      }
      case 'ul':
      case 'ol': {
        // 罕见路径：行内上下文中出现通用列表，输出简易列表结构
        const items = Array.from(el.children).filter(
          (c) => c.tagName.toLowerCase() === 'li'
        );
        if (items.length > 0) {
          const lines = items.map(
            (li) => `- ${walkInline(li.childNodes, ctx).replace(/\n/g, ' ')}`
          );
          const prefix = out && !out.endsWith('\n') ? '\n' : '';
          out += `${prefix}${lines.join('\n')}`;
          ctx.lineStart = true;
        } else {
          out += inner;
        }
        break;
      }
      default:
        out += inner;
    }
  }
  return out;
}

/** 把行内 HTML 片段转换为 Markdown 文本 */
export function inlineHtmlToMarkdown(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  return walkInline(parsed.body.childNodes, { lineStart: true });
}

/* ---------------------------------- 结构转换 ---------------------------------- */

/** 输出 Mubu 列表项（含 note 引用块与嵌套子列表，每层缩进 4 空格） */
function emitListItem(node: OutlineNode, depth: number, out: string[]): void {
  const indent = '    '.repeat(depth);
  const text = inlineHtmlToMarkdown(node.html);
  const textLines = text.split('\n');
  out.push(text ? `${indent}- ${textLines[0]}` : `${indent}-`);
  textLines.slice(1).forEach((line) => out.push(`${indent}  ${line}`));

  if (node.note) {
    const noteLines = inlineHtmlToMarkdown(node.note).split('\n');
    noteLines.forEach((line) => out.push(`${indent}  > ${line}`));
  }

  node.children.forEach((child) => emitListItem(child, depth + 1, out));
}

/** 输出通用块（h1-h6 / blockquote / p / div / 通用列表等） */
function emitGenericBlock(node: OutlineNode, out: string[]): void {
  const tag = node.tag ?? 'p';
  const html = node.html;

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag[1]);
    const text = inlineHtmlToMarkdown(html).replace(/\n/g, ' ').trim();
    out.push(text ? `${'#'.repeat(level)} ${text}` : '');
    return;
  }

  if (tag === 'blockquote') {
    inlineHtmlToMarkdown(html)
      .split('\n')
      .forEach((line) => out.push(line.trim() ? `> ${line}` : '>'));
    return;
  }

  // p / div / 通用列表：按行输出（行内转换中的 ul/ol 分支已生成 '- ' 列表行）
  out.push(...inlineHtmlToMarkdown(html).split('\n'));
}

/** 输出顶层节点序列：Mubu 节点连成紧凑列表，通用块之间以空行分隔 */
function emitBlocks(nodes: OutlineNode[], out: string[]): void {
  let prevWasListItem = false;
  nodes.forEach((node, idx) => {
    if (!node.tag) {
      // 通用块之后接列表：先补空行分隔
      if (idx > 0 && !prevWasListItem && out.length > 0) out.push('');
      emitListItem(node, 0, out);
      prevWasListItem = true;
    } else {
      if (out.length > 0) out.push('');
      emitGenericBlock(node, out);
      prevWasListItem = false;
    }
  });
}

/**
 * 把解析后的大纲文档转换为 Markdown：
 * - 标题 → `# `（titleHtml 为 null 时用 fallbackTitle 兜底）；
 * - Mubu 节点 → 嵌套列表（每层缩进 4 空格），note → 引用块；
 * - 通用块按标签映射；段与段之间空行分隔，文档以单个换行结尾。
 */
export function outlineToMarkdown(doc: OutlineDoc, fallbackTitle?: string): string {
  const out: string[] = [];

  if (doc.titleHtml !== null) {
    const title = inlineHtmlToMarkdown(doc.titleHtml).replace(/\n/g, ' ').trim();
    if (title) out.push(`# ${title}`);
  } else if (fallbackTitle && fallbackTitle.trim()) {
    out.push(`# ${fallbackTitle.trim()}`);
  }

  emitBlocks(doc.nodes, out);

  if (out.length === 0) return '';
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}
