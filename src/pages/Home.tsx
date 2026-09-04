import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shuffle, ChevronRight, BookOpenCheck, Search, Moon, Sun } from 'lucide-react';
import { FileUploader } from '@/components/FileUploader';
import { RecentList } from '@/components/RecentList';
import { useReciteStore } from '@/store/useReciteStore';
import { useTheme } from '@/hooks/useTheme';
import { sanitizeHtml, extractTitle, countHighlights } from '@/utils/sanitizeHtml';
import { markdownToOutlineHtml } from '@/utils/markdownImporter';
import { saveDocument } from '@/utils/storage';

export default function Home() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const {
    recentDocs,
    loadRecentDocuments,
    setCurrentDoc,
    loadDocument,
    addToRecent,
    removeFromRecent,
    unmastered,
    loadUnmastered,
  } = useReciteStore();

  useEffect(() => {
    loadRecentDocuments();
    loadUnmastered();
  }, [loadRecentDocuments, loadUnmastered]);

  const handleFileSelect = useCallback(
    (file: File) => {
      // Markdown 文件先转换为 Mubu 大纲 HTML，再走统一的导入管道
      const isMarkdown = /\.(md|markdown)$/i.test(file.name);
      const fallbackTitle = file.name.replace(/\.(md|markdown)$/i, '');
      const reader = new FileReader();
      reader.onload = () => {
        const rawText = String(reader.result || '');
        const imported = isMarkdown ? markdownToOutlineHtml(rawText, fallbackTitle) : null;
        const rawHtml = imported ? imported.html : rawText;
        const cleanHtml = sanitizeHtml(rawHtml);
        const title =
          imported && imported.title ? imported.title : extractTitle(rawHtml);
        const highlightCount = countHighlights(cleanHtml);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const now = Date.now();

        const doc = {
          id,
          title,
          content: cleanHtml,
          createdAt: now,
          updatedAt: now,
        };

        setCurrentDoc(doc);
        saveDocument(doc);
        addToRecent({
          id,
          title,
          progressPercent: 0,
          lastReadAt: now,
        });

        navigate(`/reader?doc=${id}`, { state: { highlightCount } });
      };
      reader.readAsText(file);
    },
    [navigate, setCurrentDoc, addToRecent]
  );

  const handleSelectRecent = useCallback(
    (id: string) => {
      const recent = recentDocs.find((item) => item.id === id);
      if (!recent) return;
      loadDocument(id);
      addToRecent({ ...recent, lastReadAt: Date.now() });
      navigate(`/reader?doc=${id}`);
    },
    [navigate, recentDocs, loadDocument, addToRecent]
  );

  return (
    <div className="min-h-screen bg-[#F9F7F2] px-4 pb-28 pt-6 sm:px-6 lg:px-8 dark:bg-[#0C0A09]">
      <div className="mx-auto max-w-3xl">
        {/* 标题左对齐，夜间模式按钮同行右对齐，flex 垂直居中保持协调 */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-800 sm:text-3xl dark:text-stone-100">
            忆读
          </h1>
          {/* 夜间模式切换：仅图标，置于首页右上角 */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-pressed={isDark}
            title={isDark ? '切换到日间模式' : '切换到夜间模式'}
            aria-label={isDark ? '切换到日间模式' : '切换到夜间模式'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-200/60 text-stone-500 transition-colors hover:bg-amber-100 hover:text-amber-600 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700/70 dark:hover:text-amber-400"
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>

        <div className="mb-2.5 animate-[fadeIn_0.5s_ease-out]">
          <FileUploader onFileSelect={handleFileSelect} />
        </div>

        {/* 全文搜索入口 */}
        <div className="mb-2.5 animate-[fadeIn_0.5s_ease-out_0.1s]">
          <button
            type="button"
            onClick={() => navigate('/search')}
            className="group flex w-full items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md dark:border-stone-700/60 dark:bg-stone-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 transition-transform duration-200 group-hover:scale-110 dark:bg-amber-500/15 dark:text-amber-400">
              <Search size={19} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-stone-800 dark:text-stone-100">全文搜索</h3>
              <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">搜索全部文档中的节点内容</p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-stone-300 transition-colors group-hover:text-amber-500 dark:text-stone-500" />
          </button>
        </div>

        {/* 功能入口区 */}
        <div className="mb-2.5 animate-[fadeIn_0.5s_ease-out_0.1s]">
          <button
            type="button"
            onClick={() => navigate('/quiz')}
            className="group flex w-full items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md dark:border-stone-700/60 dark:bg-stone-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 transition-transform duration-200 group-hover:scale-110 dark:bg-amber-500/15 dark:text-amber-400">
              <Shuffle size={19} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-stone-800 dark:text-stone-100">随机抽背</h3>
              <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">随机抽取重点，检验记忆效果</p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-stone-300 transition-colors group-hover:text-amber-500 dark:text-stone-500" />
          </button>
        </div>

        {/* 没掌握清单入口 */}
        <div className="mb-4 animate-[fadeIn_0.5s_ease-out_0.15s]">
          <button
            type="button"
            onClick={() => navigate('/unmastered')}
            className="group flex w-full items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md dark:border-stone-700/60 dark:bg-stone-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 transition-transform duration-200 group-hover:scale-110 dark:bg-red-500/15 dark:text-red-400">
              <BookOpenCheck size={19} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-2 text-sm font-medium text-stone-800 dark:text-stone-100">
                未掌握清单
                {unmastered.length > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                    {unmastered.length}
                  </span>
                )}
              </h3>
              <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">集中复习未掌握的重点内容</p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-stone-300 transition-colors group-hover:text-red-500 dark:text-stone-500" />
          </button>
        </div>

        <div>
          <h2 className="mb-3 flex items-center gap-2 text-base font-medium text-stone-800 dark:text-stone-100">
            <span className="h-5 w-1 rounded-full bg-amber-500" />
            最近阅读
          </h2>
          <RecentList
            documents={recentDocs}
            onSelect={handleSelectRecent}
            onRemove={removeFromRecent}
          />
        </div>
      </div>
    </div>
  );
}
