import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderPlus,
  Search,
  X,
  Download,
  Trash2,
  FolderInput,
  GitBranch,
  FilePlus,
  FileText,
  FileCode,
  FileDown,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { useReciteStore } from '@/store/useReciteStore';
import { buildCategoryTree, getCategorySubtreeIds, type CategoryNode } from '@/utils/categories';
import { queryDocuments, searchDocuments, getPage, recordDocumentAccess } from '@/services/documentService';
import { exportDocuments, type ExportFormat } from '@/services/exportService';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { saveDocument } from '@/utils/storage';
import type { DocumentMeta, ReciteCategory, ReciteDocument } from '@/utils/storage';
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

  // "新建文档"下拉菜单状态
  const [newDocOpen, setNewDocOpen] = useState(false);
  const newDocRef = useRef<HTMLDivElement>(null);

  // "导出"下拉菜单状态（exporting 同时作为 loading 标记与当前导出格式）
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // 点击下拉区域外时关闭菜单（新建文档 + 导出）
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (newDocRef.current && !newDocRef.current.contains(target)) {
        setNewDocOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(target)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // 短暂提示（2.2s 后自动消失，与编辑器一致）
  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

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
      const meta = docMetas.find((m) => m.id === id);
      loadDocument(id);
      // 思维导图文档直接进入导图编辑器；普通文档进入阅读页
      if (meta?.type === 'mindmap') {
        navigate(`/diagram?doc=${id}&from=files`);
        return;
      }
      // 携带 from=files，阅读页返回时回到文件管理界面
      navigate(`/reader?doc=${id}&from=files`);
    },
    [docMetas, loadDocument, navigate]
  );

  /** 新建文字文档：创建带默认首节点的文字文档并进入大纲编辑器 */
  const handleNewTextDoc = useCallback(() => {
    setNewDocOpen(false);
    const doc: ReciteDocument = {
      id: `doc-${Date.now()}`,
      title: '未命名文档',
      content:
        '<div class="title">未命名文档</div><ul class="node-list"><li class="node"><div class="bullet"><div class="bullet-dot"></div></div><div class="content mm-editor"><span></span></div></li></ul>',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      type: 'document',
    };
    saveDocument(doc);
    loadDocMetas();
    navigate(`/editor?doc=${doc.id}`);
  }, [loadDocMetas, navigate]);

  /** 新建思维导图：创建思维导图文档并进入导图编辑器 */
  const handleNewMindMap = useCallback(() => {
    setNewDocOpen(false);
    const doc: ReciteDocument = {
      id: `mindmap-${Date.now()}`,
      title: '未命名思维导图',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      type: 'mindmap',
    };
    saveDocument(doc);
    loadDocMetas();
    navigate(`/diagram?doc=${doc.id}`);
  }, [loadDocMetas, navigate]);

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

  /** 批量导出：按格式导出选中文档（思维导图跳过并提示） */
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExportOpen(false);
      if (exporting) return;
      setExporting(format);
      try {
        const result = await exportDocuments([...selectedIds], format);
        if (result.exportedCount > 0) {
          const parts = [`已导出 ${result.exportedCount} 篇文档`];
          if (result.skippedMindmapCount > 0) parts.push(`跳过 ${result.skippedMindmapCount} 篇思维导图`);
          if (result.failedCount > 0) parts.push(`${result.failedCount} 篇失败`);
          showToast(parts.join('，'));
          setSelectedIds(new Set());
        } else if (result.skippedMindmapCount > 0) {
          showToast('选中的均为思维导图，暂不支持导出');
        } else {
          showToast('没有可导出的文档');
        }
      } catch {
        showToast('导出失败，请重试');
      } finally {
        setExporting(null);
      }
    },
    [exporting, selectedIds, showToast]
  );

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
    <div className="min-h-screen bg-[#F9F7F2] dark:bg-[#0C0A09]">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#F9F7F2]/90 backdrop-blur dark:border-stone-700/60 dark:bg-[#0C0A09]/90">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-3 sm:px-6">
          <h1 className="text-base font-medium text-stone-800 dark:text-stone-100">文件管理</h1>
          <div className="ml-auto flex items-center gap-2">
            {/* "新建文档"模块：含 新建文字文档 / 新建思维导图 两个选项 */}
            <div className="relative" ref={newDocRef}>
              <button
                type="button"
                onClick={() => setNewDocOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={newDocOpen}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
              >
                <FilePlus size={15} />
                新建文档
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${newDocOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {newDocOpen && (
                <div
                  role="menu"
                  aria-label="新建文档"
                  className="absolute right-0 top-full z-40 mt-1.5 w-44 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-lg dark:border-stone-700/60 dark:bg-stone-900"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleNewTextDoc}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 transition-colors hover:bg-amber-50 dark:text-stone-200 dark:hover:bg-amber-500/15"
                  >
                    <FileText size={15} className="text-stone-400 dark:text-stone-500" />
                    新建文字文档
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleNewMindMap}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 transition-colors hover:bg-amber-50 dark:text-stone-200 dark:hover:bg-amber-500/15"
                  >
                    <GitBranch size={15} className="text-amber-500" />
                    新建思维导图
                  </button>
                </div>
              )}
            </div>
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
          <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm lg:sticky lg:top-20 dark:border-stone-700/60 dark:bg-stone-900">
            <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
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
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索文档名称"
                className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-9 text-sm outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:border-stone-700 dark:bg-stone-900"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => setKeyword('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
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
                className="rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-amber-500 dark:border-stone-700 dark:bg-stone-900"
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
            <p className="mb-3 text-xs text-stone-400 dark:text-stone-500">正在全文检索，请稍候...</p>
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
                className="rounded-lg border border-stone-300 bg-white px-5 py-2 text-sm text-stone-600 transition-colors hover:border-amber-400 hover:text-amber-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:text-amber-400"
              >
                加载更多（已显示 {pageItems.length}/{totalCount}）
              </button>
            </div>
          )}

          {/* 批量操作栏（窄屏可换行，避免溢出屏幕） */}
          {selectedIds.size > 0 && (
            <div className="fixed bottom-24 left-1/2 z-40 flex w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 shadow-lg dark:border-stone-700/60 dark:bg-stone-900">
              <span className="mr-1 text-xs text-stone-500 dark:text-stone-400">已选 {selectedIds.size} 项</span>
              <button
                type="button"
                onClick={() => setDialog({ type: 'moveDocs' })}
                className="flex items-center gap-1 rounded-lg bg-stone-100 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
              >
                <FolderInput size={13} />
                移动
              </button>
              <div className="relative" ref={exportRef}>
                <button
                  type="button"
                  onClick={() => setExportOpen((o) => !o)}
                  disabled={exporting !== null}
                  aria-haspopup="menu"
                  aria-expanded={exportOpen}
                  className="flex items-center gap-1 rounded-lg bg-stone-100 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
                >
                  {exporting ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Download size={13} />
                  )}
                  {exporting ? '导出中…' : '导出'}
                  <ChevronDown
                    size={12}
                    className={`transition-transform duration-200 ${exportOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {exportOpen && (
                  <div
                    role="menu"
                    aria-label="导出格式"
                    className="absolute bottom-full left-1/2 z-50 mb-1.5 w-40 -translate-x-1/2 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-lg dark:border-stone-700/60 dark:bg-stone-900"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleExport('html')}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 transition-colors hover:bg-amber-50 dark:text-stone-200 dark:hover:bg-amber-500/15"
                    >
                      <FileCode size={15} className="text-stone-400 dark:text-stone-500" />
                      导出 HTML
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleExport('markdown')}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 transition-colors hover:bg-amber-50 dark:text-stone-200 dark:hover:bg-amber-500/15"
                    >
                      <FileText size={15} className="text-stone-400 dark:text-stone-500" />
                      导出 Markdown
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleExport('pdf')}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 transition-colors hover:bg-amber-50 dark:text-stone-200 dark:hover:bg-amber-500/15"
                    >
                      <FileDown size={15} className="text-stone-400 dark:text-stone-500" />
                      导出 PDF
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDialog({ type: 'deleteDocs' })}
                className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/20"
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

      {/* 导出结果提示 */}
      {toast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-stone-800/90 px-4 py-2 text-sm text-white shadow-lg dark:bg-stone-700/90">
          {toast}
        </div>
      )}
    </div>
  );
}
