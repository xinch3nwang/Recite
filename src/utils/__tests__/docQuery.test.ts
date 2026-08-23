import { describe, it, expect } from 'vitest';
import type { DocumentMeta } from '@/utils/storage';
import {
  filterByCategories,
  filterByKeyword,
  sortMetas,
  paginate,
  fullTextSearch,
} from '@/utils/docQuery';

function makeMeta(id: string, title: string, extra: Partial<DocumentMeta> = {}): DocumentMeta {
  return {
    id,
    title,
    createdAt: 100,
    updatedAt: 100,
    categoryId: null,
    accessCount: 0,
    ...extra,
  };
}

describe('filterByCategories', () => {
  const metas = [
    makeMeta('1', 'a', { categoryId: 'c1' }),
    makeMeta('2', 'b', { categoryId: 'c2' }),
    makeMeta('3', 'c'),
  ];

  it('null 表示不过滤', () => {
    expect(filterByCategories(metas, null)).toHaveLength(3);
  });

  it('按分类过滤', () => {
    expect(filterByCategories(metas, ['c1']).map((m) => m.id)).toEqual(['1']);
    expect(filterByCategories(metas, ['c1', 'c2']).map((m) => m.id).sort()).toEqual(['1', '2']);
    expect(filterByCategories(metas, [])).toHaveLength(0);
  });

  it('未分类文档被排除', () => {
    expect(filterByCategories(metas, ['c1']).map((m) => m.id)).not.toContain('3');
  });
});

describe('filterByKeyword', () => {
  const metas = [makeMeta('1', 'English Notes'), makeMeta('2', '数学公式')];

  it('按标题包含匹配（忽略大小写与首尾空格）', () => {
    expect(filterByKeyword(metas, 'english').map((m) => m.id)).toEqual(['1']);
    expect(filterByKeyword(metas, ' 数学 ').map((m) => m.id)).toEqual(['2']);
    expect(filterByKeyword(metas, 'zzz')).toHaveLength(0);
  });

  it('空关键词返回全部', () => {
    expect(filterByKeyword(metas, '')).toHaveLength(2);
    expect(filterByKeyword(metas, '   ')).toHaveLength(2);
  });
});

describe('sortMetas', () => {
  const metas = [
    makeMeta('1', 'banana', { createdAt: 100, accessCount: 3 }),
    makeMeta('2', 'apple', { createdAt: 200, accessCount: 1 }),
    makeMeta('3', 'Cherry', { createdAt: 150, accessCount: 2 }),
  ];

  it('按名称升降序', () => {
    expect(sortMetas(metas, 'title', 'asc').map((m) => m.title)).toEqual([
      'apple',
      'banana',
      'Cherry',
    ]);
    expect(sortMetas(metas, 'title', 'desc')[0].title).toBe('Cherry');
  });

  it('按创建时间升降序', () => {
    expect(sortMetas(metas, 'createdAt', 'asc').map((m) => m.id)).toEqual(['1', '3', '2']);
    expect(sortMetas(metas, 'createdAt', 'desc').map((m) => m.id)).toEqual(['2', '3', '1']);
  });

  it('按访问次数升降序', () => {
    expect(sortMetas(metas, 'accessCount', 'desc').map((m) => m.id)).toEqual(['1', '3', '2']);
    expect(sortMetas(metas, 'accessCount', 'asc').map((m) => m.id)).toEqual(['2', '3', '1']);
  });

  it('不修改原数组', () => {
    const original = [...metas];
    sortMetas(metas, 'title', 'asc');
    expect(metas).toEqual(original);
  });
});

describe('paginate', () => {
  const list = [1, 2, 3, 4, 5, 6, 7];

  it('正常分页与越界处理', () => {
    expect(paginate(list, 1, 3)).toEqual([1, 2, 3]);
    expect(paginate(list, 2, 3)).toEqual([4, 5, 6]);
    expect(paginate(list, 3, 3)).toEqual([7]);
    expect(paginate(list, 9, 3)).toEqual([]);
  });
});

describe('fullTextSearch', () => {
  const metas = [
    makeMeta('1', 'Title Alpha'),
    makeMeta('2', 'Other Doc'),
    makeMeta('3', 'Third Doc'),
  ];

  it('按标题匹配', async () => {
    const result = await fullTextSearch(metas, 'alpha', async () => '');
    expect(result.map((m) => m.id)).toEqual(['1']);
  });

  it('按正文匹配', async () => {
    const getContent = async (id: string) => (id === '2' ? 'contains keyword inside' : 'no match');
    const result = await fullTextSearch(metas, 'keyword', getContent);
    expect(result.map((m) => m.id)).toEqual(['2']);
  });

  it('正文为 null 时忽略', async () => {
    const result = await fullTextSearch(metas, 'keyword', async () => null);
    expect(result).toHaveLength(0);
  });

  it('空关键词返回全部', async () => {
    const result = await fullTextSearch(metas, '  ', async () => '');
    expect(result).toHaveLength(3);
  });
});
