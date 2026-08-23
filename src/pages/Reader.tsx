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

  if (!currentDoc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F7F2]">
        <div className="text-stone-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <ProgressBar progress={progressPercent} />
      <ReaderToolbar
        title={currentDoc.title}
        showHighlights={showHighlights}
        highlightCount={highlightCount}
        progressPercent={progressPercent}
        onBack={handleBack}
        onToggleHighlights={toggleHighlights}
      />

      <main
        className={[
          'mx-auto max-w-4xl px-6 pb-24 pt-24 transition-opacity duration-500',
          loaded ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      >
        <article className="recite-document-content rounded-xl border border-stone-200 bg-white px-8 py-12 shadow-sm sm:px-12 sm:py-16">
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
