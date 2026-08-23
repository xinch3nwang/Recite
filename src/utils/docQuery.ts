/**
 * 文档查询纯逻辑层：负责分类过滤、关键词过滤、全文检索、多维排序与分页。
 * 纯函数（filterDocs / sortDocs / paginate）不依赖 DOM 与存储，便于测试；
 * 全文检索需要读取正文，由 DocumentService 在调用方注入获取正文的回调。
 */

import type { DocumentMeta } from '@/utils/storage';

export type SortKey = 'title' | 'createdAt' | 'updatedAt' | 'accessCount';
export type SortDir = 'asc' | 'desc';

export const DEFAULT_PAGE_SIZE = 20;

export interface QueryOptions {
  /** 允许展示的分类 id 集合；null 表示不限分类 */
  categoryIds: string[] | null;
  keyword: string;
  sortBy: SortKey;
  sortDir: SortDir;
  page: number;
  pageSize: number;
}

/**
 * 按分类过滤文档。categoryIds 为 null 表示不过滤；
 * 传入数组时严格匹配（空数组 → 无结果）。
 */
export function filterByCategories(metas: DocumentMeta[], categoryIds: string[] | null): DocumentMeta[] {
  if (!categoryIds) return metas;
  if (categoryIds.length === 0) return [];
  return metas.filter((meta) => meta.categoryId && categoryIds.includes(meta.categoryId));
}

/**
 * 按标题关键词过滤（大小写不敏感、包含匹配）。
 */
export function filterByKeyword(metas: DocumentMeta[], keyword: string): DocumentMeta[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return metas;
  return metas.filter((meta) => meta.title.toLowerCase().includes(kw));
}

/**
 * 多维度排序。名称按 localeCompare 排序；数值字段（时间戳/访问次数）按数值比较。
 */
export function sortMetas(metas: DocumentMeta[], sortBy: SortKey, sortDir: SortDir): DocumentMeta[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  const copy = [...metas];
  copy.sort((a, b) => {
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title, 'zh-CN') * dir;
    }
    return (a[sortBy] - b[sortBy]) * dir;
  });
  return copy;
}

/** 分页：按 page/pageSize 切片，返回当前页数据 */
export function paginate<T>(list: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return list.slice(start, start + pageSize);
}

/**
 * 全文检索：先按标题匹配，再按正文内容匹配。
 * getContent 由调用方注入（读取正文），返回文档纯文本；为 null 表示无法读取。
 */
export async function fullTextSearch(
  metas: DocumentMeta[],
  keyword: string,
  getContent: (id: string) => Promise<string | null>
): Promise<DocumentMeta[]> {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return metas;

  const titleMatches = new Set(
    metas.filter((meta) => meta.title.toLowerCase().includes(kw)).map((meta) => meta.id)
  );

  // 全文检索逐篇读取正文，按需惰性执行
  const contentMatches: string[] = [];
  for (const meta of metas) {
    if (titleMatches.has(meta.id)) continue;
    const content = await getContent(meta.id);
    if (content && content.toLowerCase().includes(kw)) {
      contentMatches.push(meta.id);
    }
  }

  const matchedIds = new Set([...titleMatches, ...contentMatches]);
  return metas.filter((meta) => matchedIds.has(meta.id));
}
