import { describe, it, expect, afterEach } from 'vitest';
import { applyTextFormatToRange } from '@/utils/textFormat';

/** 构造一个模拟大纲节点的可编辑宿主 */
function host(html = '这是第一段加粗目标文字结尾'): HTMLElement {
  const el = document.createElement('div');
  el.className = 'outline-editable';
  el.contentEditable = 'true';
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

/** 按全文文本偏移建立选区（跨文本节点按文档顺序累加） */
function selectTextIn(container: HTMLElement, start: number, end: number): Range {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) texts.push(n as Text);

  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;
  let offset = 0;
  for (const t of texts) {
    const len = t.length;
    // start 采用半开区间 [offset, offset+len)，避免落在下一节点起点；
    // end 采用 (offset, offset+len]，落在节点末尾时归属本节点。
    if (start >= offset && start < offset + len) {
      startNode = t;
      startOffset = start - offset;
    }
    if (end > offset && end <= offset + len) {
      endNode = t;
      endOffset = end - offset;
    }
    offset += len;
  }
  if (!startNode || !endNode) throw new Error('selection out of bounds');
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

const SELECT_START = '这是第一段'.length; // 5
const SELECT_END = SELECT_START + '加粗目标'.length; // 9
const sel = (el: HTMLElement) => selectTextIn(el, SELECT_START, SELECT_END);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('applyTextFormatToRange', () => {
  it('加粗：选区在单个文本节点内也能生效（修复 TreeWalker 根为文本节点的缺陷）', () => {
    const el = host();
    const changed = applyTextFormatToRange(sel(el), 'bold');
    expect(changed).toBe(true);
    expect(el.innerHTML).toBe('这是第一段<strong>加粗目标</strong>文字结尾');
  });

  it('加粗 toggle：再次应用同一格式则取消', () => {
    const el = host();
    applyTextFormatToRange(sel(el), 'bold');
    applyTextFormatToRange(sel(el), 'bold');
    expect(el.innerHTML).toBe('这是第一段加粗目标文字结尾');
  });

  it('下划线：生成 span.underline', () => {
    const el = host();
    applyTextFormatToRange(sel(el), 'underline');
    expect(el.innerHTML).toBe('这是第一段<span class="underline">加粗目标</span>文字结尾');
    // toggle 取消
    applyTextFormatToRange(sel(el), 'underline');
    expect(el.innerHTML).toBe('这是第一段加粗目标文字结尾');
  });

  it('删除线：生成 s 标签', () => {
    const el = host();
    applyTextFormatToRange(sel(el), 'strike');
    expect(el.innerHTML).toBe('这是第一段<s>加粗目标</s>文字结尾');
  });

  it('文本颜色：生成带 data-fmt-color 的 span，可切换取消/换色', () => {
    const el = host();
    applyTextFormatToRange(sel(el), 'color', '#dc2626');
    const span = el.querySelector<HTMLElement>('span[data-fmt-color="#dc2626"]');
    expect(span).toBeTruthy();
    expect(span!.textContent).toBe('加粗目标');
    expect(span!.style.color).toBeTruthy();

    // 取消颜色
    applyTextFormatToRange(sel(el), 'color', '#dc2626');
    expect(el.querySelector('span[data-fmt-color]')).toBeNull();
    expect(el.innerHTML).toBe('这是第一段加粗目标文字结尾');

    // 换色：包裹新的颜色 span
    applyTextFormatToRange(sel(el), 'color', '#2563eb');
    const blue = el.querySelector<HTMLElement>('span[data-fmt-color="#2563eb"]');
    expect(blue).toBeTruthy();
    expect(blue!.textContent).toBe('加粗目标');
  });

  it('荧光笔：生成带 data-fmt-bg 的半透明 span', () => {
    const el = host();
    applyTextFormatToRange(sel(el), 'highlight', 'rgba(250, 204, 21, 0.45)');
    const span = el.querySelector<HTMLElement>('span[data-fmt-bg="rgba(250, 204, 21, 0.45)"]');
    expect(span).toBeTruthy();
    expect(span!.textContent).toBe('加粗目标');
    expect(span!.style.backgroundColor).toBeTruthy();

    applyTextFormatToRange(sel(el), 'highlight', 'rgba(250, 204, 21, 0.45)');
    expect(el.querySelector('span[data-fmt-bg]')).toBeNull();
  });

  it('组合使用：加粗+下划线可嵌套，且可独立取消外层格式', () => {
    const el = host();
    applyTextFormatToRange(sel(el), 'bold');
    applyTextFormatToRange(sel(el), 'underline');
    expect(el.innerHTML).toContain('span class="underline"');
    expect(el.innerHTML).toContain('<strong>');

    // 取消外层加粗：下划线应保留（需沿祖先链识别格式）
    applyTextFormatToRange(sel(el), 'bold');
    expect(el.innerHTML).toBe('这是第一段<span class="underline">加粗目标</span>文字结尾');

    // 再取消下划线
    applyTextFormatToRange(sel(el), 'underline');
    expect(el.innerHTML).toBe('这是第一段加粗目标文字结尾');
  });

  it('清除格式：逐层移除嵌套的全部格式', () => {
    const el = host();
    applyTextFormatToRange(sel(el), 'bold');
    applyTextFormatToRange(sel(el), 'underline');
    applyTextFormatToRange(sel(el), 'strike');
    applyTextFormatToRange(sel(el), 'color', '#dc2626');
    expect(el.querySelectorAll('strong, span.underline, s, span[style]').length).toBeGreaterThan(0);

    applyTextFormatToRange(sel(el), 'clear');
    expect(el.innerHTML).toBe('这是第一段加粗目标文字结尾');
  });

  it('跨多个文本节点：仅对选中部分应用格式', () => {
    const el = host('前置<span class="underline">已有</span>后置内容');
    // 选区覆盖「已有」及其后文本：偏移从 2 到 8
    const range = selectTextIn(el, 2, 8);
    applyTextFormatToRange(range, 'bold');
    // 未选中的「前置」不被加粗；选中的「已有」「后置内容」被加粗
    expect(el.innerHTML).toBe(
      '前置<span class="underline"><strong>已有</strong></span><strong>后置内容</strong>'
    );
  });

  it('选区为空或未命中文本时返回 false', () => {
    const el = host();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    expect(applyTextFormatToRange(range, 'bold')).toBe(false);
  });
});
