/**
 * 文档服务层：组合存储与查询纯逻辑，向页面提供统一的文档/分类查询入口。
 * 内置正文缓存以避免全文检索时反复读取 localStorage。
 */

import {
  getDocumentMetaList,
  getDocument,
  getCategories,
  batchUpdateDocumentCategory,
  deleteDocuments,
  type DocumentMeta,
  type ReciteDocument,
} from '@/utils/storage';
import { recordDocumentAccess as recordDocumentAccessStorage } from '@/utils/storage';
import {
  filterByCategories,
  filterByKeyword,
  sortMetas,
  paginate,
  fullTextSearch,
  DEFAULT_PAGE_SIZE,
  type SortKey,
  type SortDir,
} from '@/utils/docQuery';

/** 模块级正文缓存（仅保留纯文本，用于全文检索） */
const contentCache = new Map<string, string | null>();

/** 读取并缓存文档纯文本（用于全文检索）；读取失败返回 null */
export async function getDocumentText(id: string): Promise<string | null> {
  if (contentCache.has(id)) return contentCache.get(id) ?? null;
  const doc = getDocument(id);
  let text: string | null = null;
  if (doc) {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(doc.content, 'text/html');
    text = parsed.body.textContent ?? '';
  }
  contentCache.set(id, text);
  return text;
}

/** 清除正文缓存（文档被修改后调用） */
export function clearContentCache(id?: string): void {
  if (id) {
    contentCache.delete(id);
  } else {
    contentCache.clear();
  }
}

/** 按 id 读取完整文档 */
export function getDocumentById(id: string): ReciteDocument | null {
  return getDocument(id);
}

/** 获取全部文档元数据 */
export function getAllDocumentMetas(): DocumentMeta[] {
  return getDocumentMetaList();
}

/** 记录一次文档访问（转发至存储层） */
export function recordDocumentAccess(id: string): void {
  recordDocumentAccessStorage(id);
}

/** 分类过滤 + 标题关键词过滤 + 排序（同步） */
export function queryDocuments(
  metas: DocumentMeta[],
  options: {
    categoryIds: string[] | null;
    keyword: string;
    sortBy: SortKey;
    sortDir: SortDir;
  }
): DocumentMeta[] {
  const filtered = filterByCategories(metas, options.categoryIds);
  const keywordFiltered = filterByKeyword(filtered, options.keyword);
  return sortMetas(keywordFiltered, options.sortBy, options.sortDir);
}

/**
 * 高级搜索：标题匹配或正文全文匹配，返回元数据列表。
 * 未命中缓存时会异步读取正文，可能较慢，调用方应做防抖与加载态。
 */
export async function searchDocuments(
  metas: DocumentMeta[],
  keyword: string,
  options: {
    categoryIds: string[] | null;
    sortBy: SortKey;
    sortDir: SortDir;
  }
): Promise<DocumentMeta[]> {
  const filtered = filterByCategories(metas, options.categoryIds);
  const matched = await fullTextSearch(filtered, keyword, getDocumentText);
  return sortMetas(matched, options.sortBy, options.sortDir);
}

/** 分页获取（默认每页 20 条） */
export function getPage<T>(list: T[], page: number, pageSize = DEFAULT_PAGE_SIZE): T[] {
  return paginate(list, page, pageSize);
}

/** 批量移动文档到指定分类（categoryId 为 null 表示移出所有分类） */
export function moveDocuments(ids: string[], categoryId: string | null): void {
  batchUpdateDocumentCategory(ids, categoryId);
  ids.forEach((id) => clearContentCache(id));
}

/** 批量删除文档 */
export function removeDocuments(ids: string[]): void {
  deleteDocuments(ids);
  ids.forEach((id) => clearContentCache(id));
}

/** 判断分类下是否还有文档（用于删除分类时的提示） */
export function countDocumentsInCategory(categoryIds: string[]): number {
  const metas = getDocumentMetaList();
  return metas.filter((meta) => meta.categoryId && categoryIds.includes(meta.categoryId)).length;
}

/** 便捷方法：读取全部分类 */
export function loadCategories() {
  return getCategories();
}
