import { describe, it, expect } from 'vitest';
import { sanitizeHtml, extractTitle, countHighlights } from '@/utils/sanitizeHtml';

describe('sanitizeHtml', () => {
  it('移除危险脚本标签及其内容', () => {
    const html = '<p>hello</p><script>alert(1)</script>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('alert');
    expect(result).not.toContain('<script');
  });

  it('移除危险 iframe/object/embed/form 等标签', () => {
    const html = '<iframe src="x"></iframe><form><input></form><object></object>';
    const result = sanitizeHtml(html);
    expect(result.toLowerCase()).not.toContain('iframe');
    expect(result.toLowerCase()).not.toContain('form');
    expect(result.toLowerCase()).not.toContain('input');
    expect(result.toLowerCase()).not.toContain('object');
  });

  it('移除内联事件属性（onclick 等）', () => {
    const html = '<p onclick="alert(1)">hi</p><div onmouseover="x()">y</div>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onmouseover');
    expect(result).toContain('hi');
  });

  it('移除危险协议的链接（javascript: / data:）', () => {
    const html = '<a href="javascript:alert(1)">x</a><img src="data:text/html,evil">';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('data:text/html');
  });

  it('保留正常的 href 与结构', () => {
    const html = '<a href="https://example.com">link</a><p>text</p>';
    const result = sanitizeHtml(html);
    expect(result).toContain('https://example.com');
    expect(result).toContain('<p>text</p>');
  });

  it('空文档不抛错', () => {
    expect(() => sanitizeHtml('')).not.toThrow();
  });
});

describe('extractTitle', () => {
  it('优先使用 <title>', () => {
    expect(extractTitle('<html><head><title>我的标题</title></head><body></body></html>')).toBe('我的标题');
  });

  it('无 title 时使用首个标题标签', () => {
    expect(extractTitle('<h2>章节标题</h2><p>正文</p>')).toBe('章节标题');
  });

  it('无标题时使用首个段落截断', () => {
    expect(extractTitle('<p>这是第一段非常长的内容...</p>')).toBe('这是第一段非常长的内容...');
  });

  it('全部缺失时返回默认名', () => {
    expect(extractTitle('<div></div>')).toBe('未命名文档');
  });
});

describe('countHighlights', () => {
  it('统计 .underline 元素数量', () => {
    const html = '<span class="underline">a</span><p>x</p><span class="underline">b</span>';
    expect(countHighlights(html)).toBe(2);
  });

  it('无重点时返回 0', () => {
    expect(countHighlights('<p>plain</p>')).toBe(0);
  });
});
