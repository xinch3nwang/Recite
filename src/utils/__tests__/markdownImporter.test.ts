import { describe, it, expect } from 'vitest';
import { markdownToOutlineHtml } from '@/utils/markdownImporter';
import { parseHtmlToOutline } from '@/utils/outline';
import { outlineToMarkdown } from '@/utils/markdownSerializer';

/** 便捷入口：MD → Mubu HTML */
function toHtml(md: string, fallbackTitle?: string): string {
  return markdownToOutlineHtml(md, fallbackTitle).html;
}

describe('markdownToOutlineHtml 结构映射', () => {
  it('第一个 H1 转换为文档标题 div.title', () => {
    const html = toHtml('# 文档标题\n\n- 项目');
    expect(html).toContain('<div class="title">文档标题</div>');
    expect(html).toContain('node-list');
  });

  it('无 H1 时使用 fallbackTitle 兜底且不输出 title div', () => {
    const result = markdownToOutlineHtml('- 项目', '我的文件');
    expect(result.title).toBe('我的文件');
    expect(result.html).not.toContain('<div class="title">');
  });

  it('H2-H6 转换为加粗节点', () => {
    const html = toHtml('## 章节标题\n\n- 项目');
    expect(html).toContain('<div class="content mm-editor"><strong>章节标题</strong></div>');
  });

  it('顶层项目转换为一个 Mubu 节点', () => {
    const html = toHtml('- 项目一\n- 项目二');
    expect((html.match(/<li class="node">/g) ?? []).length).toBe(2);
  });

  it('嵌套列表（4 空格缩进，导出格式）转换嵌套结构', () => {
    const html = toHtml('- 一层\n    - 二层\n        - 三层');
    expect(html).toContain('<div class="children"><ul class="node-list">');
    const parsed = parseHtmlToOutline(html);
    expect(parsed.nodes[0].children[0].children[0].html).toBe('三层');
  });

  it('嵌套列表（2 空格缩进，常见格式）转换嵌套结构', () => {
    const html = toHtml('- 一层\n  - 二层');
    const parsed = parseHtmlToOutline(html);
    expect(parsed.nodes[0].children[0].html).toBe('二层');
  });

  it('引用行附加为最近节点的 note', () => {
    const html = toHtml('- 正文\n> 解释内容');
    const parsed = parseHtmlToOutline(html);
    expect(parsed.nodes[0].note).toBe('解释内容');
  });

  it('无前节点的引用独立成节点', () => {
    const html = toHtml('> 独立引用');
    const parsed = parseHtmlToOutline(html);
    expect(parsed.nodes[0].html).toBe('独立引用');
  });

  it('围栏代码块转换为 pre/code 节点且内容转义', () => {
    const html = toHtml('```\n<div>raw</div>\n```');
    expect(html).toContain('<pre><code>&lt;div&gt;raw&lt;/div&gt;</code></pre>');
  });

  it('水平线与空行被跳过', () => {
    const html = toHtml('---\n\n- 项目\n\n***');
    expect((html.match(/<li class="node">/g) ?? []).length).toBe(1);
  });
});

describe('markdownToOutlineHtml 行内格式', () => {
  it('加粗/删除线/斜体/行内代码', () => {
    const html = toHtml('- **粗** ~~删~~ *斜* `代码`');
    expect(html).toContain('<strong>粗</strong>');
    expect(html).toContain('<s>删</s>');
    expect(html).toContain('<em>斜</em>');
    expect(html).toContain('<code>代码</code>');
  });

  it('<u> 还原为重点下划线 span.underline', () => {
    const html = toHtml('- <u>重点内容</u>');
    expect(html).toContain('<span class="underline">重点内容</span>');
  });

  it('带 style 的 span 原样保留（颜色/背景高亮回流）', () => {
    const html = toHtml('- <span style="color:#ff0000">红</span> <span style="background-color:#fff3cd">亮</span>');
    expect(html).toContain('<span style="color:#ff0000">红</span>');
    expect(html).toContain('<span style="background-color:#fff3cd">亮</span>');
  });

  it('链接与图片', () => {
    const html = toHtml('- [链接](https://a.b) ![图](x.png)');
    expect(html).toContain('<a href="https://a.b">链接</a>');
    expect(html).toContain('<img alt="图" src="x.png">');
  });

  it('转义序列还原为字面字符', () => {
    const html = toHtml('- \\*星号\\* 与 \\# 井号');
    expect(html).toContain('*星号* 与 # 井号');
    expect(html).not.toContain('<strong>');
  });

  it('剩余文本进行 HTML 转义', () => {
    const html = toHtml('- 1 < 2 与 3 > 2');
    expect(html).toContain('1 &lt; 2 与 3 &gt; 2');
  });
});

describe('导入/导出 roundtrip', () => {
  it('导出的 Markdown 重新导入后层级与格式等价', () => {
    const originalHtml =
      '<div class="title">古诗</div>' +
      '<ul class="node-list">' +
      '<li class="node">' +
      '<div class="content mm-editor"><strong>静夜思</strong></div>' +
      '<div class="note mm-editor">李白</div>' +
      '<div class="children"><ul class="node-list">' +
      '<li class="node">' +
      '<div class="content mm-editor">床前<span class="underline">明月</span>光</div>' +
      '</li>' +
      '<li class="node">' +
      '<div class="content mm-editor">疑是地上霜</div>' +
      '</li>' +
      '</ul></div>' +
      '</li>' +
      '</ul>';

    // 导出 → 导入
    const md = outlineToMarkdown(parseHtmlToOutline(originalHtml), '古诗');
    const reimported = markdownToOutlineHtml(md, '古诗');

    // 再解析比较结构
    const a = parseHtmlToOutline(originalHtml);
    const b = parseHtmlToOutline(reimported.html);

    expect(b.titleHtml).toBe(a.titleHtml);
    expect(b.nodes.length).toBe(a.nodes.length);
    expect(b.nodes[0].html).toBe(a.nodes[0].html); // strong 保留
    expect(b.nodes[0].note).toBe(a.nodes[0].note); // note 保留
    expect(b.nodes[0].children.length).toBe(a.nodes[0].children.length);
    expect(b.nodes[0].children[0].html).toBe(a.nodes[0].children[0].html); // underline 保留
    expect(b.nodes[0].children[1].html).toBe(a.nodes[0].children[1].html);
  });

  it('第二次 roundtrip 结果稳定', () => {
    const originalHtml =
      '<div class="title">T</div>' +
      '<ul class="node-list">' +
      '<li class="node">' +
      '<div class="content mm-editor"><span style="color:#123456">彩</span>与<u>重点</u></div>' +
      '<div class="children"><ul class="node-list">' +
      '<li class="node"><div class="content mm-editor">子节点</div></li>' +
      '</ul></div>' +
      '</li>' +
      '</ul>';

    const once = markdownToOutlineHtml(outlineToMarkdown(parseHtmlToOutline(originalHtml)), 'T');
    const twice = markdownToOutlineHtml(outlineToMarkdown(parseHtmlToOutline(once.html)), 'T');
    expect(twice.html).toBe(once.html);
  });
});
