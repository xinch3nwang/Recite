import { describe, it, expect } from 'vitest';
import { parseHtmlToOutline } from '@/utils/outline';
import { outlineToMarkdown, inlineHtmlToMarkdown } from '@/utils/markdownSerializer';

/** 便捷入口：HTML → OutlineDoc → Markdown */
function toMd(html: string, fallbackTitle?: string): string {
  return outlineToMarkdown(parseHtmlToOutline(html), fallbackTitle);
}

describe('inlineHtmlToMarkdown', () => {
  it('strong / s / em / code 转换为 Markdown 标记', () => {
    expect(inlineHtmlToMarkdown('<strong>加粗</strong>')).toBe('**加粗**');
    expect(inlineHtmlToMarkdown('<b>加粗</b>')).toBe('**加粗**');
    expect(inlineHtmlToMarkdown('<s>删除</s>')).toBe('~~删除~~');
    expect(inlineHtmlToMarkdown('<del>删除</del>')).toBe('~~删除~~');
    expect(inlineHtmlToMarkdown('<em>斜体</em>')).toBe('*斜体*');
    expect(inlineHtmlToMarkdown('<code>code</code>')).toBe('`code`');
  });

  it('underline 与 u 转换为内联 <u>', () => {
    expect(inlineHtmlToMarkdown('<span class="underline">重点</span>')).toBe('<u>重点</u>');
    expect(inlineHtmlToMarkdown('<u>下划线</u>')).toBe('<u>下划线</u>');
  });

  it('data-fmt-color / data-fmt-bg 转换为内联 span 样式', () => {
    expect(inlineHtmlToMarkdown('<span data-fmt-color="#ff0000">红</span>')).toBe(
      '<span style="color:#ff0000">红</span>'
    );
    expect(inlineHtmlToMarkdown('<span data-fmt-bg="#fff3cd">亮</span>')).toBe(
      '<span style="background-color:#fff3cd">亮</span>'
    );
  });

  it('同 span 双标记合并为一个 span', () => {
    const html = '<span data-fmt-color="#ff0000" data-fmt-bg="#fff3cd">标</span>';
    expect(inlineHtmlToMarkdown(html)).toBe(
      '<span style="color:#ff0000;background-color:#fff3cd">标</span>'
    );
  });

  it('链接与图片', () => {
    expect(inlineHtmlToMarkdown('<a href="https://a.b">链</a>')).toBe('[链](<https://a.b>)');
    expect(inlineHtmlToMarkdown('<img alt="图" src="x.png">')).toBe('![图](<x.png>)');
  });

  it('br 输出换行', () => {
    expect(inlineHtmlToMarkdown('a<br>b')).toBe('a\nb');
  });

  it('Markdown 特殊字符被转义', () => {
    expect(inlineHtmlToMarkdown('*abc*')).toBe('\\*abc\\*');
    expect(inlineHtmlToMarkdown('a_b')).toBe('a\\_b');
    expect(inlineHtmlToMarkdown('5 < 6')).toBe('5 \\< 6');
  });

  it('行首的 # - + > 被转义，行中不转义', () => {
    expect(inlineHtmlToMarkdown('- 开头')).toBe('\\- 开头');
    expect(inlineHtmlToMarkdown('a - b')).toBe('a - b');
    expect(inlineHtmlToMarkdown('# 开头')).toBe('\\# 开头');
  });

  it('普通中文文本原样保留', () => {
    expect(inlineHtmlToMarkdown('中文内容，标点。')).toBe('中文内容，标点。');
  });
});

describe('outlineToMarkdown 结构映射', () => {
  it('标题映射为一级标题', () => {
    const md = toMd('<div class="title">文档标题</div>');
    expect(md).toBe('# 文档标题\n');
  });

  it('titleHtml 为 null 时使用 fallbackTitle 兜底', () => {
    const parsed = parseHtmlToOutline('<ul class="node-list"><li class="node"><div class="content mm-editor">内容</div></li></ul>');
    expect(parsed.titleHtml).toBeNull();
    const md = outlineToMarkdown(parsed, '备用标题');
    expect(md).toContain('# 备用标题');
  });

  it('Mubu 节点转换为列表项，三层嵌套每层缩进 4 空格', () => {
    const md = toMd(
      '<ul class="node-list">' +
        '<li class="node">' +
          '<div class="content mm-editor">一层</div>' +
          '<div class="children"><ul class="node-list">' +
            '<li class="node">' +
              '<div class="content mm-editor">二层</div>' +
              '<div class="children"><ul class="node-list">' +
                '<li class="node"><div class="content mm-editor">三层</div></li>' +
              '</ul></div>' +
            '</li>' +
          '</ul></div>' +
        '</li>' +
      '</ul>'
    );
    expect(md).toBe('' +
      '- 一层\n' +
      '    - 二层\n' +
      '        - 三层\n');
  });

  it('note 转换为列表项内引用块', () => {
    const md = toMd(
      '<ul class="node-list"><li class="node">' +
        '<div class="content mm-editor">正文</div>' +
        '<div class="note mm-editor">这是解释</div>' +
      '</li></ul>'
    );
    expect(md).toBe('- 正文\n  > 这是解释\n');
  });

  it('空节点输出空列表项', () => {
    const md = toMd(
      '<ul class="node-list"><li class="node"><div class="content mm-editor"><span></span></div></li></ul>'
    );
    expect(md).toBe('-\n');
  });

  it('通用块 h1-h6 / p / blockquote 映射', () => {
    const md = toMd('<h1>大标题</h1><p>段落内容</p><blockquote>引用句子</blockquote>');
    expect(md).toContain('# 大标题');
    expect(md).toContain('段落内容');
    expect(md).toContain('> 引用句子');
    // 段与段之间空行分隔
    expect(md).toContain('段落内容\n\n> 引用句子');
  });

  it('文档以单个换行结尾', () => {
    const md = toMd('<div class="title">T</div>');
    expect(md.endsWith('\n')).toBe(true);
    expect(md.endsWith('\n\n')).toBe(false);
  });

  it('格式化标记在列表项内保持', () => {
    const md = toMd(
      '<ul class="node-list"><li class="node"><div class="content mm-editor">' +
        '<strong>词</strong>与<span class="underline">重点</span>及' +
        '<span data-fmt-color="#ff0000">彩</span>' +
      '</div></li></ul>'
    );
    expect(md).toBe('- **词**与<u>重点</u>及<span style="color:#ff0000">彩</span>\n');
  });

  it('空文档输出空字符串', () => {
    expect(toMd('')).toBe('');
  });
});
