import { describe, it, expect } from 'vitest';
import {
  saveDocument,
  getDocument,
  getDocumentMetaList,
  saveProgress,
  getProgress,
  addRecentDocument,
  getRecentDocuments,
  removeRecentDocument,
  deleteDocument,
  deleteDocuments,
  batchUpdateDocumentCategory,
  recordDocumentAccess,
  saveCategory,
  getCategories,
  deleteCategoryRecord,
  metaFromDocument,
  upsertDocumentMeta,
  getUnmasteredList,
  addUnmasteredItems,
  removeUnmasteredItem,
  removeUnmasteredByDocIds,
  clearUnmasteredList,
  type UnmasteredItem,
} from '@/utils/storage';

function makeDoc(id: string, overrides: Partial<Parameters<typeof saveDocument>[0]> = {}) {
  return {
    id,
    title: `Doc ${id}`,
    content: '<p>hello</p>',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('文档正文与索引', () => {
  it('保存文档后可通过 id 读取，并自动建立索引', () => {
    saveDocument(makeDoc('d1'));
    expect(getDocument('d1')?.title).toBe('Doc d1');
    expect(getDocumentMetaList().map((m) => m.id)).toContain('d1');
    expect(getDocument('missing')).toBeNull();
  });

  it('metaFromDocument 提供默认值', () => {
    const meta = metaFromDocument(makeDoc('d1'));
    expect(meta.categoryId).toBeNull();
    expect(meta.accessCount).toBe(0);
  });

  it('upsertDocumentMeta 覆盖同 id 记录', () => {
    upsertDocumentMeta({ id: 'm1', title: 'A', createdAt: 1, updatedAt: 1, categoryId: null, accessCount: 0 });
    upsertDocumentMeta({ id: 'm1', title: 'B', createdAt: 1, updatedAt: 1, categoryId: 'c', accessCount: 5 });
    const list = getDocumentMetaList().filter((m) => m.id === 'm1');
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('B');
    expect(list[0].accessCount).toBe(5);
  });
});

describe('访问记录', () => {
  it('记录访问自增次数', () => {
    saveDocument(makeDoc('d1', { accessCount: 2 }));
    recordDocumentAccess('d1');
    expect(getDocumentMetaList().find((m) => m.id === 'd1')?.accessCount).toBe(3);
  });

  it('不存在的文档静默跳过', () => {
    expect(() => recordDocumentAccess('nope')).not.toThrow();
  });
});

describe('分类批量更新', () => {
  it('批量移动文档分类并刷新更新时间', () => {
    saveDocument(makeDoc('d1', { categoryId: 'old' }));
    saveDocument(makeDoc('d2', { categoryId: 'old' }));
    batchUpdateDocumentCategory(['d1', 'd2'], 'new');
    expect(getDocument('d1')?.categoryId).toBe('new');
    expect(getDocument('d2')?.categoryId).toBe('new');
  });
});

describe('删除文档', () => {
  it('单个删除清理索引/进度/最近记录', () => {
    saveDocument(makeDoc('d1'));
    saveProgress({ docId: 'd1', scrollY: 100, progressPercent: 50, lastReadAt: 1 });
    addRecentDocument({ id: 'd1', title: 'Doc d1', progressPercent: 50, lastReadAt: 1 });
    deleteDocument('d1');
    expect(getDocument('d1')).toBeNull();
    expect(getProgress('d1')).toBeNull();
    expect(getRecentDocuments().map((r) => r.id)).not.toContain('d1');
    expect(getDocumentMetaList().map((m) => m.id)).not.toContain('d1');
  });

  it('批量删除', () => {
    saveDocument(makeDoc('d1'));
    saveDocument(makeDoc('d2'));
    deleteDocuments(['d1', 'd2']);
    expect(getDocumentMetaList()).toHaveLength(0);
  });
});

describe('最近阅读', () => {
  it('添加最近阅读去重并限制 10 条', () => {
    for (let i = 0; i < 12; i++) {
      addRecentDocument({ id: `r${i}`, title: `R${i}`, progressPercent: 0, lastReadAt: i });
    }
    const recent = getRecentDocuments();
    expect(recent).toHaveLength(10);
    expect(recent[0].id).toBe('r11');
    expect(recent).not.toContain(expect.objectContaining({ id: 'r0' }));
  });

  it('removeRecentDocument 清理文档', () => {
    saveDocument(makeDoc('d1'));
    addRecentDocument({ id: 'd1', title: 'D', progressPercent: 0, lastReadAt: 1 });
    removeRecentDocument('d1');
    expect(getRecentDocuments()).toHaveLength(0);
    expect(getDocument('d1')).toBeNull();
  });
});

describe('分类存储', () => {
  it('保存/读取/删除分类', () => {
    const cat = { id: 'c1', name: '英语', description: '', parentId: null, sortOrder: 0, createdAt: 1 };
    saveCategory(cat);
    expect(getCategories()).toHaveLength(1);
    expect(getCategories()[0].name).toBe('英语');

    saveCategory({ ...cat, name: '数学' });
    expect(getCategories()).toHaveLength(1);
    expect(getCategories()[0].name).toBe('数学');

    deleteCategoryRecord('c1');
    expect(getCategories()).toHaveLength(0);
  });
});

describe('没掌握清单', () => {
  function makeItem(id: string, docId: string, text: string, quizzedAt: number): UnmasteredItem {
    return {
      id,
      docId,
      docTitle: '文档',
      text,
      prompt: `____${text}`,
      sentence: `原句${text}`,
      categoryId: null,
      categoryName: '未分类',
      quizzedAt,
    };
  }

  it('新增条目并持久化，按时间倒序返回', () => {
    addUnmasteredItems([makeItem('u1', 'd1', 'A', 100)]);
    addUnmasteredItems([makeItem('u2', 'd1', 'B', 300)]);
    const list = getUnmasteredList();
    expect(list.map((i) => i.id)).toEqual(['u2', 'u1']);
  });

  it('同文档同重点去重：刷新抽背时间而非重复累积', () => {
    addUnmasteredItems([makeItem('u1', 'd1', 'A', 100)]);
    addUnmasteredItems([makeItem('u1', 'd1', 'A', 999)]);
    const list = getUnmasteredList();
    expect(list).toHaveLength(1);
    expect(list[0].quizzedAt).toBe(999);
  });

  it('删除单条与按文档清理', () => {
    addUnmasteredItems([makeItem('u1', 'd1', 'A', 1), makeItem('u2', 'd2', 'B', 2), makeItem('u3', 'd2', 'C', 3)]);
    removeUnmasteredItem('u2');
    expect(getUnmasteredList().map((i) => i.id)).toEqual(['u3', 'u1']);
    removeUnmasteredByDocIds(['d2']);
    expect(getUnmasteredList().map((i) => i.id)).toEqual(['u1']);
  });

  it('清空清单', () => {
    addUnmasteredItems([makeItem('u1', 'd1', 'A', 1)]);
    clearUnmasteredList();
    expect(getUnmasteredList()).toEqual([]);
  });
});
