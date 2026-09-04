import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportDocuments, dedupeFileNames } from '@/services/exportService';
import { saveDocument } from '@/utils/storage';
import type { ExportFile } from '@/services/exportService';

/** stub 浏览器 Blob URL API 与锚点点击，统计下载次数与文件名 */
function stubDownload() {
  const downloadNames: string[] = [];
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => `blob:mock-${downloadNames.length}`),
    revokeObjectURL: vi.fn(),
  });
  const clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function (this: HTMLAnchorElement) {
      downloadNames.push(this.download);
    });
  return { downloadNames, clickSpy };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('dedupeFileNames', () => {
  const file = (fileName: string): ExportFile => ({
    fileName,
    blob: new Blob(['x']),
  });

  it('无重名时原样返回', () => {
    const files = [file('A.html'), file('B.html')];
    expect(dedupeFileNames(files).map((f) => f.fileName)).toEqual(['A.html', 'B.html']);
  });

  it('两重名时第二个追加序号', () => {
    const files = [file('A.html'), file('A.html')];
    expect(dedupeFileNames(files).map((f) => f.fileName)).toEqual(['A.html', 'A (2).html']);
  });

  it('三重名时序号递增', () => {
    const files = [file('A.md'), file('A.md'), file('A.md')];
    expect(dedupeFileNames(files).map((f) => f.fileName)).toEqual([
      'A.md',
      'A (2).md',
      'A (3).md',
    ]);
  });

  it('重名判断忽略大小写', () => {
    const files = [file('a.html'), file('A.html')];
    expect(dedupeFileNames(files).map((f) => f.fileName)).toEqual(['a.html', 'A (2).html']);
  });
});

describe('exportDocuments', () => {
  it('混合选中：普通文档导出、思维导图跳过、无效 id 计失败', async () => {
    saveDocument({ id: 'd1', title: '文档一', content: '<p>a</p>', createdAt: 1, updatedAt: 1 });
    saveDocument({
      id: 'm1',
      title: '导图',
      content: '',
      createdAt: 1,
      updatedAt: 1,
      type: 'mindmap',
    });
    const { downloadNames } = stubDownload();

    const result = await exportDocuments(['d1', 'm1', 'missing'], 'html');

    expect(result.exportedCount).toBe(1);
    expect(result.skippedMindmapCount).toBe(1);
    expect(result.failedCount).toBe(1);
    // 单篇直接下载单文件
    expect(downloadNames).toEqual(['文档一.html']);
  });

  it('全部为思维导图时不触发下载', async () => {
    saveDocument({
      id: 'm1',
      title: '导图',
      content: '',
      createdAt: 1,
      updatedAt: 1,
      type: 'mindmap',
    });
    const { downloadNames } = stubDownload();

    const result = await exportDocuments(['m1'], 'markdown');

    expect(result.exportedCount).toBe(0);
    expect(result.skippedMindmapCount).toBe(1);
    expect(downloadNames).toEqual([]);
  });

  it('多篇导出 HTML 时打包 zip', async () => {
    saveDocument({ id: 'a', title: 'A', content: '<p>a</p>', createdAt: 1, updatedAt: 1 });
    saveDocument({ id: 'b', title: 'B', content: '<p>b</p>', createdAt: 1, updatedAt: 1 });
    const { downloadNames } = stubDownload();

    const result = await exportDocuments(['a', 'b'], 'html');

    expect(result.exportedCount).toBe(2);
    expect(downloadNames).toHaveLength(1);
    expect(downloadNames[0]).toMatch(/^忆读-导出-HTML-\d+\.zip$/);
  });

  it('Markdown 导出产物文件名正确', async () => {
    saveDocument({
      id: 'd1',
      title: '古诗',
      content:
        '<div class="title">古诗</div><ul class="node-list"><li class="node"><div class="content mm-editor"><strong>静夜思</strong></div></li></ul>',
      createdAt: 1,
      updatedAt: 1,
    });
    const { downloadNames } = stubDownload();

    const result = await exportDocuments(['d1'], 'markdown');

    expect(result.exportedCount).toBe(1);
    expect(downloadNames).toEqual(['古诗.md']);
  });

  it('导出成功后进度回调按篇推进', async () => {
    saveDocument({ id: 'a', title: 'A', content: '<p>a</p>', createdAt: 1, updatedAt: 1 });
    saveDocument({ id: 'b', title: 'B', content: '<p>b</p>', createdAt: 1, updatedAt: 1 });
    stubDownload();

    const progress: Array<[number, number]> = [];
    await exportDocuments(['a', 'b'], 'html', (done, total) => progress.push([done, total]));

    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it('空选中列表不触发下载', async () => {
    const { downloadNames } = stubDownload();
    const result = await exportDocuments([], 'pdf');
    expect(result.exportedCount).toBe(0);
    expect(downloadNames).toEqual([]);
  });
});
