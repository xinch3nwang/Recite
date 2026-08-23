import { create } from 'zustand';
import type {
  ReciteDocument,
  RecentDocument,
  ReadingProgress,
  ReciteCategory,
  DocumentMeta,
  UnmasteredItem,
} from '@/utils/storage';
import type { QuizItem } from '@/utils/quiz';
import {
  addRecentDocument,
  getDocument,
  getProgress,
  getRecentDocuments,
  getDocumentMetaList,
  removeRecentDocument,
  saveDocument,
  saveProgress,
  getCategories,
  saveCategory,
  deleteCategoryRecord,
  deleteDocuments,
  batchUpdateDocumentCategory,
  getUnmasteredList,
  addUnmasteredItems,
  removeUnmasteredItem,
  removeUnmasteredByDocIds,
  clearUnmasteredList,
} from '@/utils/storage';
import { getCategorySubtreeIds } from '@/utils/categories';

interface ReciteState {
  currentDoc: ReciteDocument | null;
  showHighlights: boolean;
  revealedIds: Set<string>;
  highlightCount: number;
  recentDocs: RecentDocument[];
  progress: ReadingProgress | null;
  categories: ReciteCategory[];
  docMetas: DocumentMeta[];
  /** 没掌握清单 */
  unmastered: UnmasteredItem[];
  /** 针对性复习队列：由清单发起复习时使用，抽背页读取后清空 */
  reviewQueue: QuizItem[] | null;
  setCurrentDoc: (doc: ReciteDocument | null) => void;
  loadDocument: (id: string) => void;
  saveCurrentDocument: () => void;
  toggleHighlights: () => void;
  toggleHighlight: (id: string) => void;
  clearRevealedHighlights: () => void;
  setHighlightCount: (count: number) => void;
  setProgress: (progress: ReadingProgress) => void;
  saveCurrentProgress: () => void;
  loadRecentDocuments: () => void;
  addToRecent: (doc: RecentDocument) => void;
  removeFromRecent: (id: string) => void;
  loadCategories: () => void;
  loadDocMetas: () => void;
  createCategory: (category: ReciteCategory) => void;
  updateCategory: (category: ReciteCategory) => void;
  /** 删除分类：strategy 为 'move' 时移入 targetCategoryId；为 'delete' 时连文档删除 */
  removeCategory: (
    id: string,
    strategy: 'move' | 'delete',
    targetCategoryId?: string | null
  ) => void;
  moveDocs: (ids: string[], categoryId: string | null) => void;
  removeDocs: (ids: string[]) => void;
  loadUnmastered: () => void;
  addUnmastered: (items: UnmasteredItem[]) => void;
  removeUnmastered: (id: string) => void;
  clearUnmastered: () => void;
  startReview: (items: QuizItem[]) => void;
  clearReview: () => void;
}

export const useReciteStore = create<ReciteState>((set, get) => ({
  currentDoc: null,
  showHighlights: false,
  revealedIds: new Set<string>(),
  highlightCount: 0,
  recentDocs: [],
  progress: null,
  categories: [],
  docMetas: [],
  unmastered: [],
  reviewQueue: null,

  setCurrentDoc: (doc) => {
    set({ currentDoc: doc, revealedIds: new Set<string>(), showHighlights: false });
  },

  loadDocument: (id) => {
    const doc = getDocument(id);
    const progress = getProgress(id);
    set({
      currentDoc: doc,
      progress,
      revealedIds: new Set<string>(),
      showHighlights: false,
    });
  },

  saveCurrentDocument: () => {
    const doc = get().currentDoc;
    if (doc) {
      saveDocument(doc);
    }
  },

  toggleHighlights: () => {
    set((state) => ({
      showHighlights: !state.showHighlights,
      revealedIds: new Set<string>(),
    }));
  },

  toggleHighlight: (id) => {
    set((state) => {
      const next = new Set(state.revealedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { revealedIds: next };
    });
  },

  clearRevealedHighlights: () => {
    set({ revealedIds: new Set<string>() });
  },

  setHighlightCount: (count) => {
    set({ highlightCount: count });
  },

  setProgress: (progress) => {
    set({ progress });
  },

  saveCurrentProgress: () => {
    const progress = get().progress;
    if (progress) {
      saveProgress(progress);
    }
  },

  loadRecentDocuments: () => {
    set({ recentDocs: getRecentDocuments() });
  },

  addToRecent: (doc) => {
    addRecentDocument(doc);
    set({ recentDocs: getRecentDocuments() });
  },

  removeFromRecent: (id) => {
    removeRecentDocument(id);
    set({ recentDocs: getRecentDocuments() });
  },

  loadCategories: () => {
    set({ categories: getCategories() });
  },

  loadDocMetas: () => {
    set({ docMetas: getDocumentMetaList() });
  },

  createCategory: (category) => {
    saveCategory(category);
    set({ categories: getCategories() });
  },

  updateCategory: (category) => {
    saveCategory(category);
    set({ categories: getCategories() });
  },

  removeCategory: (id, strategy, targetCategoryId = null) => {
    const { categories } = get();
    // 找到该分类及全部后代分类，一起处理
    const affectedIds = getCategorySubtreeIds(categories, id);

    if (strategy === 'delete') {
      // 连带删除这些分类下的所有文档
      const docIds = getDocumentMetaList()
        .filter((meta) => meta.categoryId && affectedIds.includes(meta.categoryId))
        .map((meta) => meta.id);
      if (docIds.length > 0) {
        deleteDocuments(docIds);
        removeUnmasteredByDocIds(docIds);
      }
    } else {
      // 移动到目标分类（目标分类不能是被删除的分类或其子孙）
      const docIds = getDocumentMetaList()
        .filter((meta) => meta.categoryId && affectedIds.includes(meta.categoryId))
        .map((meta) => meta.id);
      if (docIds.length > 0) {
        batchUpdateDocumentCategory(docIds, targetCategoryId);
      }
    }

    // 删除受影响分类记录
    affectedIds.forEach((catId) => deleteCategoryRecord(catId));
    set({ categories: getCategories(), docMetas: getDocumentMetaList() });
  },

  moveDocs: (ids, categoryId) => {
    batchUpdateDocumentCategory(ids, categoryId);
    set({ docMetas: getDocumentMetaList() });
  },

  removeDocs: (ids) => {
    deleteDocuments(ids);
    removeUnmasteredByDocIds(ids);
    set({ docMetas: getDocumentMetaList(), recentDocs: getRecentDocuments(), unmastered: getUnmasteredList() });
  },

  loadUnmastered: () => {
    set({ unmastered: getUnmasteredList() });
  },

  addUnmastered: (items) => {
    addUnmasteredItems(items);
    set({ unmastered: getUnmasteredList() });
  },

  removeUnmastered: (id) => {
    removeUnmasteredItem(id);
    set({ unmastered: getUnmasteredList() });
  },

  clearUnmastered: () => {
    clearUnmasteredList();
    set({ unmastered: [] });
  },

  startReview: (items) => {
    set({ reviewQueue: items });
  },

  clearReview: () => {
    set({ reviewQueue: null });
  },
}));
