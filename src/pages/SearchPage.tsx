import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Search as SearchIcon, X, Loader2, FileSearch } from 'lucide-react';
import { searchDocumentNodes, recordDocumentAccess, type NodeSearchResult } from '@/services/documentService';
import { useReciteStore } from '@/store/useReciteStore';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

/** 关键词前后各保留的字符数（生成摘要片段，保证关键词不被行折叠隐藏） */
const SNIPPET_RADIUS = 25;

/**
 * 截取围绕关键词的摘要片段：取关键词前/后各 SNIPPET_RADIUS 字符，
 * 使关键词始终位于片段中部，配合行数折叠时不会把关键词裁掉。
 */
function snippetAroundKeyword(text: string, keyword: string): string {
  const kw = keyword.trim().toLowerCase();
  const lower = text.toLowerCase();
  const idx = lower.indexOf(kw);
  if (idx < 0) return text;
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(text.length, idx + kw.length + SNIPPET_RADIUS);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return prefix + text.slice(start, end) + suffix;
}

/** 将文本按关键词分割并高亮（关键词命中部分用琥珀色 mark 标记） */
function highlight(text: string, keyword: string): ReactNode[] {
  const kw = keyword.trim().toLowerCase();
  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(kw, i);
    if (idx < 0) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={idx} className="rounded bg-amber-300/70 px-0.5 font-semibold text-amber-950 dark:bg-amber-400/30 dark:text-amber-100">
        {text.slice(idx, idx + kw.length)}
      </mark>
    );
    i = idx + kw.length;
  }
  return parts;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const loadDocument = useReciteStore((s) => s.loadDocument);

  const [keyword, setKeyword] = useState('');
  const debounced = useDebouncedValue(keyword, 250);
  const [results, setResults] = useState<NodeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const kw = debounced.trim();
    if (!kw) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchDocumentNodes(kw).then((res) => {
      if (cancelled) return;
      setResults(res);
      setSearched(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  // 按文档分组，便于展示「文档标题 → 多个命中节点」
  const grouped = useMemo(() => {
    const map = new Map<string, { docTitle: string; items: NodeSearchResult[] }>();
    for (const r of results) {
      const g = map.get(r.docId) ?? { docTitle: r.docTitle, items: [] };
      g.items.push(r);
      map.set(r.docId, g);
    }
    return Array.from(map.values());
  }, [results]);

  const openDoc = useCallback(
    (id: string) => {
      recordDocumentAccess(id);
      loadDocument(id);
      navigate(`/reader?doc=${id}`);
    },
    [loadDocument, navigate]
  );

  const showPlaceholder = !keyword.trim() && !loading;

  return (
    <div className="min-h-screen bg-[#F9F7F2] dark:bg-[#0C0A09]">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#F9F7F2]/90 backdrop-blur dark:border-stone-700/60 dark:bg-[#0C0A09]/90">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg p-1.5 text-stone-600 transition-colors hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
            aria-label="返回"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-base font-medium text-stone-800 dark:text-stone-100">全文搜索</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4">
        {/* 搜索框 */}
        <div className="relative mb-5">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索全部文档中的节点内容..."
            autoFocus
            className="w-full rounded-lg border border-stone-300 bg-white py-2.5 pl-9 pr-9 text-sm outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:border-stone-700 dark:bg-stone-900"
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

        {/* 加载中 */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-stone-400 dark:text-stone-500">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">正在搜索全部文档...</span>
          </div>
        )}

        {/* 初始占位 */}
        {showPlaceholder && (
          <div className="flex flex-col items-center justify-center rounded-xl bg-stone-100/50 px-6 py-16 text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
            <FileSearch size={32} className="mb-3 text-stone-300 dark:text-stone-500" />
            <p className="text-sm">输入关键词，搜索全部文档中匹配的节点内容</p>
          </div>
        )}

        {/* 无结果 */}
        {!loading && searched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl bg-stone-100/50 px-6 py-16 text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
            <FileSearch size={32} className="mb-3 text-stone-300 dark:text-stone-500" />
            <p className="text-sm">没有找到包含「{debounced.trim()}」的节点内容</p>
          </div>
        )}

        {/* 结果列表：按文档分组 */}
        {!loading && results.length > 0 && (
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.docTitle} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-700/60 dark:bg-stone-900">
                <button
                  type="button"
                  onClick={() => openDoc(group.items[0].docId)}
                  className="flex w-full items-center gap-2 border-b border-stone-100 bg-stone-50/70 px-4 py-2.5 text-left transition-colors hover:bg-amber-50/40 dark:border-stone-800 dark:bg-stone-800/60 dark:hover:bg-amber-500/15"
                >
                  <FileText size={15} className="shrink-0 text-stone-400 dark:text-stone-500" />
                  <span className="truncate text-sm font-medium text-stone-700 dark:text-stone-200">{group.docTitle}</span>
                  <span className="ml-auto shrink-0 text-xs text-stone-400 dark:text-stone-500">{group.items.length} 处命中</span>
                </button>
                <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                  {group.items.map((item, idx) => (
                    <li key={`${item.docId}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => openDoc(item.docId)}
                        className="block w-full px-4 py-3 text-left transition-colors hover:bg-amber-50/30 dark:hover:bg-amber-500/15"
                      >
                        {item.path.length > 0 && (
                          <p className="mb-1 truncate text-xs text-stone-500 dark:text-stone-400">
                            {item.path.map((seg, i) => (
                              <span key={i}>
                                {i > 0 && <span className="mx-1 text-stone-400 dark:text-stone-500">›</span>}
                                {seg}
                              </span>
                            ))}
                          </p>
                        )}
                        <p className="line-clamp-3 text-sm leading-relaxed text-stone-700 dark:text-stone-200">
                          {highlight(snippetAroundKeyword(item.text, debounced), debounced)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
