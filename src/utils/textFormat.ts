/**
 * 文本内联格式化核心（手动 DOM 操作）。
 *
 * 针对 contentEditable 当前选区，实现 加粗 / 下划线 / 删除线 / 文本颜色 / 荧光笔
 * 五种格式的应用与切换（toggle），并保持选区以支持连续操作与即时预览。
 * 不依赖已废弃的 document.execCommand，标签生成统一、跨浏览器行为一致。
 *
 * 本模块只负责 DOM 层的选区格式化，不触碰节点树；上层在每次应用后读取
 * host.innerHTML 同步到大纲节点（从而自动纳入编辑器的撤销/重做历史）。
 */

export type FormatAction = 'bold' | 'underline' | 'strike' | 'color' | 'highlight' | 'clear';

interface FormatSpec {
  /** 包装用的标签 */
  tag: string;
  /** 用于 toggle 判断与 unwrap 的选择器 */
  selector: string;
  /** 样式型格式：CSS 属性名（如 color / background-color） */
  prop?: string;
}

const FORMAT_SPECS: Record<Exclude<FormatAction, 'clear'>, FormatSpec> = {
  bold: { tag: 'strong', selector: 'b, strong' },
  underline: { tag: 'span', selector: 'u, span.underline' },
  strike: { tag: 's', selector: 's, strike, del' },
  color: { tag: 'span', selector: 'span[style]', prop: 'color' },
  highlight: { tag: 'span', selector: 'span[style]', prop: 'background-color' },
};

/** 样式属性 → 自定义 data 属性键（用于可靠地记录/比较我们应用过的颜色值） */
function formatDataKey(prop: string): string {
  return prop === 'color' ? 'data-fmt-color' : 'data-fmt-bg';
}

/** 从任意节点向上定位其所在的 .outline-editable 编辑区 */
function hostOf(node: Node): HTMLElement | null {
  let el: Node | null = node;
  while (el && el.nodeType !== Node.ELEMENT_NODE) el = el.parentNode;
  let host = el as HTMLElement | null;
  while (host && !host.classList.contains('outline-editable')) host = host.parentElement;
  return host && host.isContentEditable ? host : null;
}

/** 从选区定位其所在的 .outline-editable 编辑区 */
function findHost(range: Range): HTMLElement | null {
  return hostOf(range.commonAncestorContainer);
}

/** 将 range 边界处部分选中的文本节点分裂，使选区只覆盖完整文本节点 */
function splitRangeBoundaries(range: Range): void {
  const start = range.startContainer;
  if (start.nodeType === Node.TEXT_NODE) {
    const t = start as Text;
    if (range.startOffset > 0 && range.startOffset < t.length) {
      const tail = t.splitText(range.startOffset);
      range.setStart(tail, 0);
    }
  }
  const end = range.endContainer;
  if (end.nodeType === Node.TEXT_NODE) {
    const t = end as Text;
    if (range.endOffset > 0 && range.endOffset < t.length) {
      t.splitText(range.endOffset);
      range.setEnd(t, t.length);
    }
  }
}

/** 收集 range 覆盖的所有文本节点（按文档顺序） */
function collectTextNodes(range: Range): Text[] {
  const root = range.commonAncestorContainer;
  const nodes: Text[] = [];
  // 选区整体落在单个文本节点内（root 即文本节点）：TreeWalker 以文本节点为根会遍历不到任何内容，
  // 需直接收集该节点。
  if (root.nodeType === Node.TEXT_NODE) {
    const t = root as Text;
    if (t.textContent && t.textContent.trim() !== '') nodes.push(t);
    return nodes;
  }
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    }
  );
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    if (t.textContent && t.textContent.trim() !== '') nodes.push(t);
  }
  // 确保首尾文本节点也被包含（walk 基于 commonAncestorContainer 已覆盖选区）
  return nodes;
}

/** 用新元素包裹文本节点（保持 DOM 连续） */
function wrapText(text: Text, el: HTMLElement): void {
  text.parentNode?.insertBefore(el, text);
  el.appendChild(text);
}

/** 解包元素（把其内容上提，移除自身） */
function unwrap(el: HTMLElement): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

/** 恢复选区覆盖到给定文本节点集合（支持应用后连续 toggle） */
function restoreSelection(nodes: Text[]): void {
  if (nodes.length === 0) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const range = document.createRange();
  try {
    range.setStart(first, 0);
    range.setEnd(last, last.length);
  } catch {
    return;
  }
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/**
 * 从文本节点向上找到最近已应用指定格式的元素（不越过 host 边界）。
 * 支持嵌套格式（如加粗内嵌删除线）时对外层格式的识别与移除。
 */
function findFormatEl(text: Text, spec: FormatSpec, value?: string): HTMLElement | null {
  const host = hostOf(text);
  let p = text.parentElement;
  while (p && p !== host) {
    if (spec.prop) {
      const recorded = p.getAttribute(formatDataKey(spec.prop));
      if (recorded && recorded === value) return p;
      if (p.style.getPropertyValue(spec.prop).toLowerCase() === String(value ?? '').toLowerCase()) return p;
    } else if (p.matches(spec.selector)) {
      return p;
    }
    p = p.parentElement;
  }
  return null;
}

/** 判断文本节点是否已应用指定格式 */
function isFormatted(text: Text, spec: FormatSpec, value?: string): boolean {
  return findFormatEl(text, spec, value) !== null;
}

/** 从元素上移除指定样式（仅当记录的正是该值时），若元素因此清空则解包 */
function removeStyleFromEl(el: HTMLElement, spec: FormatSpec, value: string): void {
  if (!spec.prop) return;
  const key = formatDataKey(spec.prop);
  const recorded = el.getAttribute(key);
  if (recorded === value || el.style.getPropertyValue(spec.prop).toLowerCase() === value.toLowerCase()) {
    el.style.removeProperty(spec.prop);
    el.removeAttribute(key);
    if (el.tagName === 'SPAN' && el.style.cssText === '' && !el.getAttribute('class')) {
      unwrap(el);
    }
  }
}

/** 将样式型格式应用到单个文本节点 */
function wrapStyle(text: Text, spec: FormatSpec, value: string): void {
  const el = document.createElement(spec.tag);
  el.style.setProperty(spec.prop!, value);
  el.setAttribute(formatDataKey(spec.prop!), value);
  wrapText(text, el);
}

/**
 * 对当前选区应用/切换格式。返回是否发生了实际变更。
 * 调用方需保证存在非空选区，且选区位于某个 .outline-editable 内。
 */
export function applyTextFormat(action: FormatAction, value?: string): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return false;
  const host = findHost(range);
  if (!host) return false;
  return applyTextFormatToRange(range, action, value);
}

/**
 * 对给定选区范围应用/切换格式（纯 DOM 操作，不含选区获取，便于单元测试）。
 */
export function applyTextFormatToRange(range: Range, action: FormatAction, value?: string): boolean {
  if (action === 'clear') {
    clearFormat(range);
    return true;
  }

  const spec = FORMAT_SPECS[action];
  if (spec.prop && !value) return false;

  splitRangeBoundaries(range);
  const textNodes = collectTextNodes(range);
  if (textNodes.length === 0) return false;

  const allMatch = textNodes.every((t) => isFormatted(t, spec, value));

  for (const t of textNodes) {
    if (allMatch) {
      // 全部已应用 → 切换为移除（解包最近的格式元素，支持嵌套格式）
      const fmtEl = findFormatEl(t, spec, value);
      if (fmtEl) {
        if (spec.prop) removeStyleFromEl(fmtEl, spec, value!);
        else unwrap(fmtEl);
      }
    } else if (!isFormatted(t, spec, value)) {
      if (spec.prop) {
        wrapStyle(t, spec, value!);
      } else {
        const el = document.createElement(spec.tag);
        if (action === 'underline') el.setAttribute('class', 'underline');
        wrapText(t, el);
      }
    }
  }

  restoreSelection(textNodes);
  return true;
}

/** 清除选中范围内文本上的全部格式化标签（加粗/下划线/删除线/颜色/荧光笔） */
function clearFormat(range: Range): void {
  splitRangeBoundaries(range);
  const textNodes = collectTextNodes(range);
  const formatted = 'b, strong, u, span.underline, s, strike, del, span[style]';
  for (const t of textNodes) {
    // 沿祖先链逐层解包所有格式元素（处理嵌套格式）
    let p = t.parentElement;
    while (p && p.matches(formatted)) {
      const next = p.parentElement;
      unwrap(p);
      p = next;
    }
  }
  restoreSelection(textNodes);
}
