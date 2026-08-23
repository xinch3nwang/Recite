import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeFileName, downloadDocument, downloadDocumentsAsZip } from '@/services/downloadService';
import { saveDocument } from '@/utils/storage';

describe('safeFileName', () => {
  it('去除非法字符', () => {
    const result = safeFileName('a/b:c*?"<>|', 'x');
    expect(result.startsWith('a_b_c')).toBe(true);
    // 结果中不应再包含任何非法字符
    expect(result).not.toMatch(/[\\/:*?"<>|]/);
  });

  it('空标题使用回退名', () => {
    expect(safeFileName('   ', 'fallback')).toBe('fallback');
    expect(safeFileName('', 'fallback')).toBe('fallback');
  });

  it('合法标题原样保留', () => {
    expect(safeFileName('英语单词', 'x')).toBe('英语单词');
  });
});

describe('下载功能', () => {
  let createObjectUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // 模拟浏览器 Blob URL API
    createObjectUrl = vi.fn(() => 'blob:mock-url');
    vi.stubGlobal('URL', {
      createObjectURL: createObjectUrl,
      revokeObjectURL: vi.fn(),
    });
    // 避免 jsdom 对 navigation 的告警
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('下载单个存在的文档', () => {
    saveDocument({ id: 'd1', title: '测试文档', content: '<p>hi</p>', createdAt: 1, updatedAt: 1 });
    expect(() => downloadDocument('d1')).not.toThrow();
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
  });

  it('下载不存在的文档静默跳过', () => {
    expect(() => downloadDocument('missing')).not.toThrow();
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it('批量打包下载存在文档并返回数量', async () => {
    saveDocument({ id: 'a', title: 'A', content: '<p>a</p>', createdAt: 1, updatedAt: 1 });
    saveDocument({ id: 'b', title: 'B', content: '<p>b</p>', createdAt: 1, updatedAt: 1 });
    const count = await downloadDocumentsAsZip(['a', 'b', 'missing']);
    expect(count).toBe(2);
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
  });

  it('无可下载文档时返回 0 且不触发下载', async () => {
    const count = await downloadDocumentsAsZip(['missing']);
    expect(count).toBe(0);
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});
