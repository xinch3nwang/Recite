import { describe, it, expect, beforeEach } from 'vitest';
import {
  queryDocuments,
  searchDocuments,
  getPage,
  getDocumentText,
  clearContentCache,
  getAllDocumentMetas,
  moveDocuments,
  removeDocuments,
  countDocumentsInCategory,
} from '@/services/documentService';
import { saveDocument, saveCategory, type DocumentMeta } from '@/utils/storage';

function makeMeta(id: string, title: string, extra: Partial<DocumentMeta> = {}): DocumentMeta {
  return { id, title, createdAt: 100, updatedAt: 100, categoryId: null, accessCount: 0, ...extra };
}

describe('queryDocuments（同步查询管线）', () => {
  it('组合分类过滤 + 关键词 + 排序', () => {
    const metas = [
      makeMeta('1', 'Beta', { categoryId: 'c1' }),
      makeMeta('2', 'Alpha', { categoryId: 'c2' }),
      makeMeta('3', 'Beta X', { categoryId: 'c1' }),
    ];
    const result = queryDocuments(metas, {
      categoryIds: ['c1'],
      keyword: 'beta',
      sortBy: 'title',
      sortDir: 'asc',
    });
    expect(result.map((m) => m.title)).toEqual(['Beta', 'Beta X']);
  });
});

describe('searchDocuments（全文检索管线）', () => {
  beforeEach(() => {
    clearContentCache();
    localStorage.clear();
  });

  it('命中标题或正文并排序', async () => {
    saveDocument({
      id: 'a',
      title: '标题文件',
      content: '<p>没有关键词</p>',
      createdAt: 1,
      updatedAt: 1,
    });
    saveDocument({
      id: 'b',
      title: '其他',
      content: '<p>正文里有独家关键词XYZ</p>',
      createdAt: 2,
      updatedAt: 2,
    });
    const metas = getAllDocumentMetas();
    const result = await searchDocuments(metas, '关键词', {
      categoryIds: null,
      sortBy: 'title',
      sortDir: 'asc',
    });
    expect(result.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });
});

describe('getPage', () => {
  it('默认每页 20 条分页', () => {
    const list = Array.from({ length: 45 }, (_, i) => i);
    expect(getPage(list, 1)).toHaveLength(20);
    expect(getPage(list, 3)).toHaveLength(5);
  });
});

describe('getDocumentText', () => {
  it('提取正文纯文本并缓存', async () => {
    saveDocument({
      id: 'd1',
      title: 'T',
      content: '<p>Hello <b>World</b></p>',
      createdAt: 1,
      updatedAt: 1,
    });
    const text = await getDocumentText('d1');
    expect(text).toContain('Hello World');
    // 缓存命中
    const again = await getDocumentText('d1');
    expect(again).toBe(text);
  });

  it('缺失文档返回 null', async () => {
    expect(await getDocumentText('missing')).toBeNull();
  });
});

describe('批量操作与统计', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('moveDocuments 移动分类', () => {
    saveDocument({ id: 'a', title: 'A', content: 'x', createdAt: 1, updatedAt: 1 });
    moveDocuments(['a'], 'cat1');
    expect(countDocumentsInCategory(['cat1'])).toBe(1);
  });

  it('removeDocuments 删除文档', () => {
    saveDocument({ id: 'a', title: 'A', content: 'x', createdAt: 1, updatedAt: 1 });
    saveDocument({ id: 'b', title: 'B', content: 'y', createdAt: 1, updatedAt: 1 });
    removeDocuments(['a']);
    expect(getAllDocumentMetas()).toHaveLength(1);
    expect(getAllDocumentMetas()[0].id).toBe('b');
  });

  it('countDocumentsInCategory 支持多分类聚合', () => {
    saveDocument({ id: 'a', title: 'A', content: 'x', createdAt: 1, updatedAt: 1, categoryId: 'c1' });
    saveDocument({ id: 'b', title: 'B', content: 'y', createdAt: 1, updatedAt: 1, categoryId: 'c2' });
    expect(countDocumentsInCategory(['c1', 'c2'])).toBe(2);
    expect(countDocumentsInCategory(['zz'])).toBe(0);
  });

  it('saveCategory 与 count 协同可用', () => {
    saveCategory({ id: 'c1', name: 'C', description: '', parentId: null, sortOrder: 0, createdAt: 1 });
    saveDocument({ id: 'a', title: 'A', content: 'x', createdAt: 1, updatedAt: 1, categoryId: 'c1' });
    expect(countDocumentsInCategory(['c1'])).toBe(1);
  });
});
