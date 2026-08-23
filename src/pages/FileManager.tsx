import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, Search, X, Download, Trash2, FolderInput } from 'lucide-react';
import { useReciteStore } from '@/store/useReciteStore';
import { buildCategoryTree, getCategorySubtreeIds, type CategoryNode } from '@/utils/categories';
import { queryDocuments, searchDocuments, getPage, recordDocumentAccess } from '@/services/documentService';
import { downloadDocumentsAsZip } from '@/services/downloadService';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { DocumentMeta, ReciteCategory } from '@/utils/storage';
import type { SortKey, SortDir } from '@/utils/docQuery';
import { CategoryTree } from '@/components/file-manager/CategoryTree';
import { CategoryDialog } from '@/components/file-manager/CategoryDialog';
import { DeleteCategoryDialog } from '@/components/file-manager/DeleteCategoryDialog';
import { MoveDocsDialog } from '@/components/file-manager/MoveDocsDialog';
import { ConfirmDialog } from '@/components/file-manager/ConfirmDialog';
import { DocTable } from '@/components/file-manager/DocTable';

const PAGE_SIZE = 20;

export default function FileManager() {
  const navigate = useNavigate();
  const {
    categories,
    docMetas,
    loadCategories,
    loadDocMetas,
    createCategory,
    updateCategory,
    removeCategory,
    moveDocs,
    removeDocs,
    loadDocument,
  } = useReciteStore();

  // 筛选 / 排序 / 搜索状态
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [sortBy, setSortBy] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [resultList, setResultList] = useState<DocumentMeta[]>([]);
  const [searching, setSearching] = useState(false);

  // 选中项
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 弹窗状态
  const [dialog, setDialog] = useState<
    | { type: 'none' }
    | { type: 'category'; editing: ReciteCategory | null }
    | { type: 'deleteCategory'; category: ReciteCategory }
    | { type: 'moveDocs' }
    | { type: 'deleteDocs' }
  >({ type: 'none' });

  // 初次加载分类与文档元数据
  useEffect(() => {
    loadCategories();
    loadDocMetas();
  }, [loadCategories, loadDocMetas]);

  /** 选中的分类（含后代）id 列表 */
  const selectedSubtreeIds = useMemo(() => {
    if (selectedCategory === null) return null;
    return getCategorySubtreeIds(categories, selectedCategory);
  }, [categories, selectedCategory]);

  /** 文档查询：空关键词走同步查询；非空关键词走异步全文检索 */
  useEffect(() => {
    let cancelled = false;
    setPage(1);

    if (debouncedKeyword.trim()) {
      setSearching(true);
      searchDocuments(docMetas, debouncedKeyword, {
        categoryIds: selectedSubtreeIds,
        sortBy,
        sortDir,
      }).then((result) => {
        if (!cancelled) {
          setResultList(result);
          setSearching(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    setResultList(
      queryDocuments(docMetas, {
        categoryIds: selectedSubtreeIds,
        keyword: '',
        sortBy,
        sortDir,
      })
    );
    return () => {
      cancelled = true;
    };
  }, [docMetas, debouncedKeyword, selectedSubtreeIds, sortBy, sortDir]);

  /** 分类树与分类文档计数 */
  const tree: CategoryNode[] = useMemo(() => buildCategoryTree(categories), [categories]);

  const countMap = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((cat) => {
      map.set(cat.id, 0);
    });
    docMetas.forEach((meta) => {
      if (!meta.categoryId) return;
      categories.forEach((cat) => {
        if (getCategorySubtreeIds(categories, cat.id).includes(meta.categoryId)) {
          map.set(cat.id, (map.get(cat.id) ?? 0) + 1);
        }
      });
    });
    return map;
  }, [categories, docMetas]);

  const categoryName = useCallback(
    (categoryId: string | null) => {
      return categories.find((cat) => cat.id === categoryId)?.name ?? null;
    },
    [categories]
  );

  /** 分页 */
  const pageItems = useMemo(() => getPage(resultList, page, PAGE_SIZE), [resultList, page]);
  const hasMore = page * PAGE_SIZE < resultList.length;
  const totalCount = resultList.length;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === pageItems.length && pageItems.length > 0) {
        return new Set();
      }
      return new Set(pageItems.map((item) => item.id));
    });
  }, [pageItems]);

  const openDocument = useCallback(
    (id: string) => {
      recordDocumentAccess(id);
      loadDocument(id);
      // 携带 from=files，阅读页返回时回到文件管理界面
      navigate(`/reader?doc=${id}&from=files`);
    },
    [loadDocument, navigate]
  );

  /** 新建/保存分类 */
  const handleSaveCategory = useCallback(
    (data: {
      id?: string;
      name: string;
      description: string;
      parentId: string | null;
      sortOrder: number;
    }) => {
      if (data.id) {
        const existing = categories.find((cat) => cat.id === data.id);
        if (existing) {
          updateCategory({ ...existing, ...data, id: data.id });
        }
      } else {
        createCategory({
          id: `cat_${Date.now()}`,
          name: data.name,
          description: data.description,
          parentId: data.parentId,
          sortOrder: data.sortOrder,
          createdAt: Date.now(),
        });
      }
      setSelectedIds(new Set());
    },
    [categories, createCategory, updateCategory]
  );

  const handleDeleteCategory = useCallback(
    (strategy: 'move' | 'delete', targetCategoryId: string | null) => {
      const category = dialog.type === 'deleteCategory' ? dialog.category : null;
      if (!category) return;
      removeCategory(category.id, strategy, targetCategoryId);
      if (selectedCategory === category.id) setSelectedCategory(null);
      setSelectedIds(new Set());
    },
    [dialog, removeCategory, selectedCategory]
  );

  const handleMoveDocs = useCallback(
    (targetCategoryId: string | null) => {
      moveDocs([...selectedIds], targetCategoryId);
      setSelectedIds(new Set());
    },
    [selectedIds, moveDocs]
  );

  const handleDeleteDocs = useCallback(() => {
    removeDocs([...selectedIds]);
    setSelectedIds(new Set());
  }, [selectedIds, removeDocs]);

  const handleBatchDownload = useCallback(() => {
    void downloadDocumentsAsZip([...selectedIds]).then((count) => {
      if (count > 0) setSelectedIds(new Set());
    });
  }, [selectedIds]);

  const deleteCategoryDocCount = useMemo(() => {
    if (dialog.type !== 'deleteCategory') return 0;
    const ids = getCategorySubtreeIds(categories, dialog.category.id);
    return docMetas.filter((meta) => meta.categoryId && ids.includes(meta.categoryId)).length;
  }, [dialog, categories, docMetas]);

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: 'title', label: '名称' },
    { value: 'createdAt', label: '上传时间' },
    { value: 'updatedAt', label: '最近访问' },
    { value: 'accessCount', label: '访问次数' },
  ];

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#F9F7F2]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-3 sm:px-6">
          <h1 className="text-base font-medium text-stone-800">文件管理</h1>
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => setDialog({ type: 'category', editing: null })}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
            >
              <FolderPlus size={15} />
              新建分类
            </button>
          </div>
        </div>
      </header>

      {/* 移动端（<lg）纵向堆叠：分类在上、文档列表在下，避免竖屏挤压错乱 */}
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-28 pt-6 sm:px-6 lg:flex-row">
        {/* 分类侧栏：移动端全宽，桌面端固定宽度并吸顶 */}
        <aside className="w-full shrink-0 lg:w-60">
          <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm lg:sticky lg:top-20">
            <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-stone-400">
              分类
            </h2>
            {/* 移动端限制高度便于滚动，桌面端完全展开 */}
            <div className="max-h-64 overflow-y-auto lg:max-h-none">
              <CategoryTree
                tree={tree}
                selectedId={selectedCategory}
                onSelect={(id) => {
                  setSelectedCategory(id);
                  setSelectedIds(new Set());
                }}
                onEdit={(category) => setDialog({ type: 'category', editing: category })}
                onDelete={(category) => setDialog({ type: 'deleteCategory', category })}
                countMap={countMap}
                totalCount={docMetas.length}
              />
            </div>
          </div>
        </aside>

        {/* 文档列表区 */}
        <section className="min-w-0 flex-1">
          {/* 工具栏：搜索 + 排序 */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索文档名称或正文内容..."
                className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-9 text-sm outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => setKeyword('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  aria-label="清空搜索"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-amber-500"
                aria-label="排序字段"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-sm text-stone-600 hover:bg-stone-50"
                aria-label="切换排序方向"
              >
                {sortDir === 'asc' ? '升序 ↑' : '降序 ↓'}
              </button>
            </div>
          </div>

          {searching && (
            <p className="mb-3 text-xs text-stone-400">正在全文检索，请稍候...</p>
          )}

          <DocTable
            metas={pageItems}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onOpen={openDocument}
            categoryName={categoryName}
          />

          {hasMore && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-stone-300 bg-white px-5 py-2 text-sm text-stone-600 transition-colors hover:border-amber-400 hover:text-amber-600"
              >
                加载更多（已显示 {pageItems.length}/{totalCount}）
              </button>
            </div>
          )}

          {/* 批量操作栏（窄屏可换行，避免溢出屏幕） */}
          {selectedIds.size > 0 && (
            <div className="fixed bottom-24 left-1/2 z-40 flex w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 shadow-lg">
              <span className="mr-1 text-xs text-stone-500">已选 {selectedIds.size} 项</span>
              <button
                type="button"
                onClick={() => setDialog({ type: 'moveDocs' })}
                className="flex items-center gap-1 rounded-lg bg-stone-100 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-200"
              >
                <FolderInput size={13} />
                移动
              </button>
              <button
                type="button"
                onClick={handleBatchDownload}
                className="flex items-center gap-1 rounded-lg bg-stone-100 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-200"
              >
                <Download size={13} />
                打包下载
              </button>
              <button
                type="button"
                onClick={() => setDialog({ type: 'deleteDocs' })}
                className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100"
              >
                <Trash2 size={13} />
                删除
              </button>
            </div>
          )}
        </section>
      </main>

      {/* 弹窗 */}
      <CategoryDialog
        open={dialog.type === 'category'}
        editing={dialog.type === 'category' ? dialog.editing : null}
        categories={categories}
        onClose={() => setDialog({ type: 'none' })}
        onSave={handleSaveCategory}
      />
      <DeleteCategoryDialog
        open={dialog.type === 'deleteCategory'}
        category={dialog.type === 'deleteCategory' ? dialog.category : null}
        categories={categories}
        affectedDocCount={deleteCategoryDocCount}
        onClose={() => setDialog({ type: 'none' })}
        onConfirm={handleDeleteCategory}
      />
      <MoveDocsDialog
        open={dialog.type === 'moveDocs'}
        count={selectedIds.size}
        categories={categories}
        onClose={() => setDialog({ type: 'none' })}
        onConfirm={handleMoveDocs}
      />
      <ConfirmDialog
        open={dialog.type === 'deleteDocs'}
        title="批量删除文档"
        message={`确定删除选中的 ${selectedIds.size} 个文档吗？此操作不可撤销。`}
        confirmText="删除"
        danger
        onClose={() => setDialog({ type: 'none' })}
        onConfirm={handleDeleteDocs}
      />
    </div>
  );
}
