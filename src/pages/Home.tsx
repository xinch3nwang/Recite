import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shuffle, ChevronRight, BookOpenCheck } from 'lucide-react';
import { FileUploader } from '@/components/FileUploader';
import { RecentList } from '@/components/RecentList';
import { useReciteStore } from '@/store/useReciteStore';
import { sanitizeHtml, extractTitle, countHighlights } from '@/utils/sanitizeHtml';
import { saveDocument } from '@/utils/storage';

export default function Home() {
  const navigate = useNavigate();
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
      const reader = new FileReader();
      reader.onload = () => {
        const rawHtml = String(reader.result || '');
        const cleanHtml = sanitizeHtml(rawHtml);
        const title = extractTitle(rawHtml);
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
    <div className="min-h-screen bg-[#F9F7F2] px-4 pb-28 pt-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center">
          <h1 className="mb-6 text-center text-3xl font-semibold tracking-tight text-stone-800 sm:text-4xl">
            忆读
          </h1>
          <p className="text-base text-stone-500">
            隐藏重点内容，辅助记忆与复习
          </p>
        </div>

        <div className="mb-6 animate-[fadeIn_0.5s_ease-out]">
          <FileUploader onFileSelect={handleFileSelect} />
        </div>

        {/* 功能入口区 */}
        <div className="mb-4 animate-[fadeIn_0.5s_ease-out_0.1s]">
          <button
            type="button"
            onClick={() => navigate('/quiz')}
            className="group flex w-full items-center gap-4 rounded-xl border border-stone-200 bg-white px-5 py-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 transition-transform duration-200 group-hover:scale-110">
              <Shuffle size={20} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-stone-800">随机抽背</h3>
              <p className="mt-0.5 text-xs text-stone-500">
                从文档中随机抽取重点内容，检验记忆效果
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-stone-300 transition-colors group-hover:text-amber-500" />
          </button>
        </div>

        {/* 没掌握清单入口 */}
        <div className="mb-6 animate-[fadeIn_0.5s_ease-out_0.15s]">
          <button
            type="button"
            onClick={() => navigate('/unmastered')}
            className="group flex w-full items-center gap-4 rounded-xl border border-stone-200 bg-white px-5 py-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 transition-transform duration-200 group-hover:scale-110">
              <BookOpenCheck size={20} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-2 text-sm font-medium text-stone-800">
                没掌握清单
                {unmastered.length > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                    {unmastered.length}
                  </span>
                )}
              </h3>
              <p className="mt-0.5 text-xs text-stone-500">
                集中复习未掌握的重点内容，逐项攻破
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-stone-300 transition-colors group-hover:text-red-500" />
          </button>
        </div>

        <div>
          <h2 className="mb-4 flex items-center gap-2 text-base font-medium text-stone-800">
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
