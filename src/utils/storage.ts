/**
 * 本地存储层：负责文档、阅读进度、最近阅读、文档索引与分类的持久化。
 * 所有读写均通过 localStorage，并对异常进行容错处理（读失败返回空值，写失败静默忽略）。
 */
import { deleteDiagramForDoc } from '@/utils/diagramStorage';

/** 文档类型：普通文档 / 思维导图文档 */
export type DocumentType = 'document' | 'mindmap';

export interface ReciteDocument {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  categoryId?: string | null;
  accessCount?: number;
  /** 文档类型（缺省视为普通文档） */
  type?: DocumentType;
}

export interface ReadingProgress {
  docId: string;
  scrollY: number;
  progressPercent: number;
  lastReadAt: number;
}

export interface RecentDocument {
  id: string;
  title: string;
  progressPercent: number;
  lastReadAt: number;
}

/** 文档元数据（不含正文，用于列表展示与检索，避免大正文常驻内存） */
export interface DocumentMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  categoryId: string | null;
  accessCount: number;
  /** 文档类型（缺省视为普通文档） */
  type?: DocumentType;
}

export interface ReciteCategory {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: number;
}

/** 没掌握清单条目：记录抽背时未掌握的重点内容，供针对性复习 */
export interface UnmasteredItem {
  /** 唯一标识（文档 id + 重点文本） */
  id: string;
  docId: string;
  docTitle: string;
  /** 重点内容 */
  text: string;
  /** 题干（完整原句中当前重点占位隐藏） */
  prompt: string;
  /** 完整原句 */
  sentence: string;
  /** 上一节点主题 */
  heading?: string;
  /** 分类标签 id（文档所属分类） */
  categoryId: string | null;
  /** 分类名称 */
  categoryName: string;
  /** 抽背时间戳 */
  quizzedAt: number;
}

const DOC_PREFIX = 'recite_doc_';
const PROGRESS_PREFIX = 'recite_progress_';
const CATEGORY_PREFIX = 'recite_cat_';
const RECENT_KEY = 'recite_recent_docs';
const ALL_META_KEY = 'recite_all_docs';
const UNMASTERED_KEY = 'recite_unmastered';
const MAX_RECENT = 10;

/* ---------------------------------- 文档正文 ---------------------------------- */

export function saveDocument(doc: ReciteDocument): void {
  try {
    localStorage.setItem(`${DOC_PREFIX}${doc.id}`, JSON.stringify(doc));
    upsertDocumentMeta(metaFromDocument(doc));
  } catch {
    // Ignore storage errors
  }
}

export function getDocument(id: string): ReciteDocument | null {
  try {
    const raw = localStorage.getItem(`${DOC_PREFIX}${id}`);
    return raw ? (JSON.parse(raw) as ReciteDocument) : null;
  } catch {
    return null;
  }
}

/* ---------------------------------- 文档索引 ---------------------------------- */

/** 从文档生成元数据（保证必要字段默认值） */
export function metaFromDocument(doc: ReciteDocument): DocumentMeta {
  return {
    id: doc.id,
    title: doc.title,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    categoryId: doc.categoryId ?? null,
    accessCount: doc.accessCount ?? 0,
    type: doc.type ?? 'document',
  };
}

/* ---------------------------------- 文档正文事务更新 ---------------------------------- */

/** 事务更新结果（ok=false 时 error 提供原因，ok=true 时 doc 为最新文档） */
export interface ContentUpdateResult {
  ok: boolean;
  doc: ReciteDocument | null;
  error: string | null;
}

/**
 * 事务更新文档正文：读取当前文档 -> 应用 updater 得到新正文 -> 整体写入。
 * - 文档不存在：不写入，返回错误；
 * - 写入抛出异常：恢复写入前的备份，保证原子性（防止数据损坏）。
 * updater 接收当前正文（HTML 字符串），返回新正文。
 */
export function updateDocumentContent(
  docId: string,
  updater: (content: string) => string
): ContentUpdateResult {
  const key = `${DOC_PREFIX}${docId}`;
  let prevRaw: string | null = null;
  try {
    prevRaw = localStorage.getItem(key);
    const doc = prevRaw ? (JSON.parse(prevRaw) as ReciteDocument) : null;
    if (!doc) {
      return { ok: false, doc: null, error: '文档不存在或已被删除' };
    }
    const next: ReciteDocument = {
      ...doc,
      content: updater(doc.content),
      updatedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(next));
    upsertDocumentMeta(metaFromDocument(next));
    return { ok: true, doc: next, error: null };
  } catch (error) {
    // 写入失败：回滚到写入前的状态
    try {
      if (prevRaw === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, prevRaw);
      }
    } catch {
      // 回滚失败也不抛错，交由上层提示
    }
    return {
      ok: false,
      doc: null,
      error: error instanceof Error ? error.message : '保存失败，请重试',
    };
  }
}

export function getDocumentMetaList(): DocumentMeta[] {
  try {
    const raw = localStorage.getItem(ALL_META_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as DocumentMeta[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** 更新（新增或覆盖）一条文档元数据索引 */
export function upsertDocumentMeta(meta: DocumentMeta): void {
  try {
    const list = getDocumentMetaList().filter((item) => item.id !== meta.id);
    list.push(meta);
    localStorage.setItem(ALL_META_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}

function removeDocumentMeta(id: string): void {
  try {
    const list = getDocumentMetaList().filter((item) => item.id !== id);
    localStorage.setItem(ALL_META_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}

/** 记录一次访问：自增访问次数并刷新更新时间 */
export function recordDocumentAccess(id: string): void {
  const meta = getDocumentMetaList().find((item) => item.id === id);
  if (!meta) return;
  upsertDocumentMeta({ ...meta, accessCount: meta.accessCount + 1, updatedAt: Date.now() });
}

/** 批量更新分类（用于“移动至其他分类”等操作） */
export function batchUpdateDocumentCategory(ids: string[], categoryId: string | null): void {
  for (const id of ids) {
    const doc = getDocument(id);
    if (doc) {
      saveDocument({ ...doc, categoryId, updatedAt: Date.now() });
    }
  }
}

/** 删除单个文档（正文 + 索引 + 进度 + 最近记录 + 编辑图数据） */
export function deleteDocument(id: string): void {
  try {
    removeDocumentMeta(id);
    localStorage.removeItem(`${DOC_PREFIX}${id}`);
    localStorage.removeItem(`${PROGRESS_PREFIX}${id}`);
    deleteDiagramForDoc(id);
    const recent = getRecentDocuments().filter((item) => item.id !== id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch {
    // Ignore storage errors
  }
}

/** 批量删除文档 */
export function deleteDocuments(ids: string[]): void {
  for (const id of ids) {
    deleteDocument(id);
  }
}

/* ---------------------------------- 阅读进度 ---------------------------------- */

export function saveProgress(progress: ReadingProgress): void {
  try {
    localStorage.setItem(`${PROGRESS_PREFIX}${progress.docId}`, JSON.stringify(progress));
  } catch {
    // Ignore storage errors
  }
}

export function getProgress(docId: string): ReadingProgress | null {
  try {
    const raw = localStorage.getItem(`${PROGRESS_PREFIX}${docId}`);
    return raw ? (JSON.parse(raw) as ReadingProgress) : null;
  } catch {
    return null;
  }
}

/* ---------------------------------- 最近阅读 ---------------------------------- */

export function getRecentDocuments(): RecentDocument[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as RecentDocument[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addRecentDocument(doc: RecentDocument): void {
  try {
    const recent = getRecentDocuments().filter((item) => item.id !== doc.id);
    recent.unshift(doc);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // Ignore storage errors
  }
}

export function removeRecentDocument(id: string): void {
  try {
    const recent = getRecentDocuments().filter((item) => item.id !== id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    localStorage.removeItem(`${DOC_PREFIX}${id}`);
    localStorage.removeItem(`${PROGRESS_PREFIX}${id}`);
    removeDocumentMeta(id);
  } catch {
    // Ignore storage errors
  }
}

/* ---------------------------------- 分类管理 ---------------------------------- */

export function getCategories(): ReciteCategory[] {
  try {
    const raw = localStorage.getItem(CATEGORY_PREFIX);
    if (!raw) return [];
    const list = JSON.parse(raw) as ReciteCategory[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveCategory(category: ReciteCategory): void {
  try {
    const list = getCategories().filter((item) => item.id !== category.id);
    list.push(category);
    localStorage.setItem(CATEGORY_PREFIX, JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}

export function deleteCategoryRecord(id: string): void {
  try {
    const list = getCategories().filter((item) => item.id !== id);
    localStorage.setItem(CATEGORY_PREFIX, JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}

/* ---------------------------------- 没掌握清单 ---------------------------------- */

/** 读取没掌握清单（按抽背时间倒序，最新在前） */
export function getUnmasteredList(): UnmasteredItem[] {
  try {
    const raw = localStorage.getItem(UNMASTERED_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as UnmasteredItem[];
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => b.quizzedAt - a.quizzedAt);
  } catch {
    return [];
  }
}

/**
 * 批量新增没掌握条目：同一文档同一重点已存在时刷新抽背时间，
 * 避免重复积累；否则追加新条目。
 */
export function addUnmasteredItems(items: UnmasteredItem[]): void {
  try {
    const list = getUnmasteredList();
    for (const item of items) {
      const idx = list.findIndex((it) => it.docId === item.docId && it.text === item.text);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...item, quizzedAt: item.quizzedAt };
      } else {
        list.push(item);
      }
    }
    list.sort((a, b) => b.quizzedAt - a.quizzedAt);
    localStorage.setItem(UNMASTERED_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}

/** 删除单条没掌握条目 */
export function removeUnmasteredItem(id: string): void {
  try {
    const list = getUnmasteredList().filter((item) => item.id !== id);
    localStorage.setItem(UNMASTERED_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}

/** 按文档删除没掌握条目（文档被删除时清理，避免脏数据） */
export function removeUnmasteredByDocIds(docIds: string[]): void {
  try {
    const list = getUnmasteredList().filter((item) => !docIds.includes(item.docId));
    localStorage.setItem(UNMASTERED_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}

/** 清空没掌握清单 */
export function clearUnmasteredList(): void {
  try {
    localStorage.removeItem(UNMASTERED_KEY);
  } catch {
    // Ignore storage errors
  }
}
