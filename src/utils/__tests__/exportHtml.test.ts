import { describe, it, expect } from 'vitest';
import { buildExportHtml } from '@/utils/exportHtml';
import { EXPORT_CSS } from '@/utils/exportStyles';

describe('buildExportHtml', () => {
  it('生成包含导出样式与正文的完整 HTML 文档', () => {
    const html = buildExportHtml('测试文档', '<ul class="node-list"><li class="node"><div class="content mm-editor">内容</div></li></ul>');
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain(EXPORT_CSS);
    expect(html).toContain('<title>测试文档</title>');
    expect(html).toContain('class="recite-document-content"');
    expect(html).toContain('node-list');
  });

  it('正文经过 sanitize：script 被移除', () => {
    const html = buildExportHtml('T', '<p>ok</p><script>alert(1)</script>');
    expect(html).toContain('<p>ok</p>');
    expect(html).not.toContain('<script>');
  });

  it('标题中的 HTML 特殊字符被转义', () => {
    const html = buildExportHtml('a<b>&"c"', '<p>x</p>');
    expect(html).toContain('<title>a&lt;b&gt;&amp;&quot;c&quot;</title>');
  });

  it('重点下划线内容在导出中直接保留', () => {
    const html = buildExportHtml('T', '<span class="underline">重点</span>');
    expect(html).toContain('<span class="underline">重点</span>');
  });

  it('空内容仍产出合法文档', () => {
    const html = buildExportHtml('空文档', '');
    expect(html).toContain('<title>空文档</title>');
    expect(html).toContain('class="recite-document-content"');
  });
});
