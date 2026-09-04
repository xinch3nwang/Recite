import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ReaderToolbar } from '@/components/ReaderToolbar';
import { HtmlRenderer } from '@/components/HtmlRenderer';
import { ProgressBar } from '@/components/ProgressBar';
import { useReciteStore } from '@/store/useReciteStore';
import { saveDocument, saveProgress, getProgress, getDocument } from '@/utils/storage';

export default function Reader() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    currentDoc,
    showHighlights,
    revealedIds,
    highlightCount,
    progress,
    setCurrentDoc,
    toggleHighlights,
    toggleHighlight,
    setHighlightCount,
    setProgress,
    saveCurrentProgress,
    addToRecent,
  } = useReciteStore();

  const [progressPercent, setProgressPercent] = useState(progress?.progressPercent || 0);
  const [loaded, setLoaded] = useState(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  const hasRestoredRef = useRef(false);

  // Load document from URL param or localStorage on mount / param change
  useEffect(() => {
    if (currentDoc) {
      return;
    }

    const docId = searchParams.get('doc');
    if (!docId) {
      navigate('/');
      return;
    }

    const doc = getDocument(docId);
    if (doc) {
      setCurrentDoc(doc);
    } else {
      navigate('/');
    }
  }, [currentDoc, navigate, searchParams, setCurrentDoc]);

  // Save document and count highlights once loaded
  useEffect(() => {
    if (!currentDoc) return;
    saveDocument(currentDoc);
  }, [currentDoc]);

  // Restore scroll position once content is rendered
  useEffect(() => {
    if (!currentDoc || hasRestoredRef.current) return;

    const attemptRestore = () => {
      const saved = getProgress(currentDoc.id);
      if (saved && saved.scrollY > 0) {
        window.scrollTo({ top: saved.scrollY, behavior: 'smooth' });
      }
      hasRestoredRef.current = true;
      setLoaded(true);
    };

    const timer = window.setTimeout(attemptRestore, 120);
    return () => window.clearTimeout(timer);
  }, [currentDoc]);

  // Track scroll progress with debounced save
  useEffect(() => {
    if (!currentDoc) return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

      setProgressPercent(percent);

      const nextProgress = {
        docId: currentDoc.id,
        scrollY: scrollTop,
        progressPercent: percent,
        lastReadAt: Date.now(),
      };
      setProgress(nextProgress);

      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(() => {
        saveProgress(nextProgress);
      }, 300);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [currentDoc, setProgress]);

  // Save progress on page unload
  useEffect(() => {
    if (!currentDoc) return;

    const handleBeforeUnload = () => {
      saveCurrentProgress();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentDoc, saveCurrentProgress]);

  const handleHighlightCount = useCallback(
    (count: number) => {
      setHighlightCount(count);
    },
    [setHighlightCount]
  );

  const handleReveal = useCallback(
    (id: string) => {
      toggleHighlight(id);
    },
    [toggleHighlight]
  );

  const handleBack = useCallback(() => {
    saveCurrentProgress();
    if (currentDoc) {
      addToRecent({
        id: currentDoc.id,
        title: currentDoc.title,
        progressPercent,
        lastReadAt: Date.now(),
      });
      saveDocument({ ...currentDoc, updatedAt: Date.now() });
    }
    // 遵循层级导航：从文件管理进入则返回文件管理，否则返回首页
    const from = searchParams.get('from');
    navigate(from === 'files' ? '/files' : '/', { replace: true });
  }, [navigate, currentDoc, progressPercent, addToRecent, saveCurrentProgress, searchParams]);

  // 进入编辑：思维导图文档进入导图编辑器，普通文档进入大纲编辑器
  const handleEdit = useCallback(() => {
    if (!currentDoc) return;
    if (currentDoc.type === 'mindmap') {
      navigate(`/diagram?doc=${currentDoc.id}`);
      return;
    }
    navigate(`/editor?doc=${currentDoc.id}`);
  }, [currentDoc, navigate]);

  if (!currentDoc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F7F2] dark:bg-[#0C0A09]">
        <div className="text-stone-500 dark:text-stone-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F7F2] dark:bg-[#0C0A09]">
      <ProgressBar progress={progressPercent} />
      <ReaderToolbar
        title={currentDoc.title}
        showHighlights={showHighlights}
        highlightCount={highlightCount}
        progressPercent={progressPercent}
        onBack={handleBack}
        onToggleHighlights={toggleHighlights}
        onEdit={handleEdit}
      />

      <main
        className={[
          'mx-auto max-w-6xl px-3 pb-24 pt-24 transition-opacity duration-500 sm:px-6',
          loaded ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      >
        {/* 移动端：去除卡片边框/阴影/圆角以充分占用屏幕宽度；平板及以上恢复卡片盒子并加宽内边距保持行宽舒适 */}
        <article className="recite-document-content bg-white px-3 py-8 sm:rounded-xl sm:border sm:border-stone-200 sm:px-10 sm:py-12 sm:shadow-sm dark:bg-stone-900 dark:sm:border-stone-700/60">
          <HtmlRenderer
            html={currentDoc.content}
            showHighlights={showHighlights}
            revealedIds={revealedIds}
            onHighlightCount={handleHighlightCount}
            onReveal={handleReveal}
          />
        </article>
      </main>
    </div>
  );
}
