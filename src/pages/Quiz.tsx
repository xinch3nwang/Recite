import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Shuffle,
  Eye,
  EyeOff,
  Check,
  X,
  RotateCcw,
  FileText,
  Trophy,
  BookOpenCheck,
} from 'lucide-react';
import { useReciteStore } from '@/store/useReciteStore';
import { getDocument } from '@/utils/storage';
import {
  buildQuizQueue,
  nextUnansweredIndex,
  summarizeResults,
  toUnmasteredItem,
  QUIZ_PLACEHOLDER,
  type QuizItem,
} from '@/utils/quiz';

type Phase = 'select' | 'quiz' | 'result';

/** 渲染题干：将占位符拆分为琥珀色占位横线，其余文本原样展示 */
function renderPrompt(prompt: string, keyPrefix: string) {
  const parts = prompt.split(QUIZ_PLACEHOLDER);
  return parts.map((part, i) => (
    <Fragment key={`${keyPrefix}-${i}`}>
      {part}
      {i < parts.length - 1 && (
        <span
          className="mx-0.5 inline-block min-w-[4.5em] align-bottom"
          style={{
            height: '1em',
            borderBottom: '2px solid #D97706',
            backgroundColor: 'rgba(254, 243, 199, 0.4)',
            borderRadius: 2,
          }}
        />
      )}
    </Fragment>
  ));
}

export default function Quiz() {
  const navigate = useNavigate();
  const { docMetas, loadDocMetas, categories, loadCategories, unmastered, loadUnmastered, addUnmastered, reviewQueue, clearReview } = useReciteStore();

  const [phase, setPhase] = useState<Phase>('select');
  const [docId, setDocId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [queue, setQueue] = useState<QuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [revealed, setRevealed] = useState(false);
  // 是否由“没掌握清单”发起的针对性复习（返回时回到清单页）
  const [isReview, setIsReview] = useState(false);
  // 即时操作反馈（如“已加入没掌握清单”）
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  // 初始化加载文档元数据、分类与没掌握清单
  useEffect(() => {
    loadDocMetas();
    loadCategories();
    loadUnmastered();
  }, [loadDocMetas, loadCategories, loadUnmastered]);

  // 针对性复习模式：从没掌握清单发起的复习队列，读取后直接进入抽背
  useEffect(() => {
    if (reviewQueue && reviewQueue.length > 0) {
      const first = reviewQueue[0];
      const doc = getDocument(first.docId);
      setDocId(first.docId);
      setDocTitle(doc?.title ?? '针对性复习');
      setQueue(reviewQueue);
      setAnswers(new Array(reviewQueue.length).fill(undefined));
      setCurrentIndex(0);
      setRevealed(false);
      setIsReview(true);
      setPhase('quiz');
      clearReview();
    }
  }, [reviewQueue, clearReview]);

  /** 各文档的重点数量（惰性解析并缓存） */
  const highlightCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const meta of docMetas) {
      const doc = getDocument(meta.id);
      if (doc) {
        const parser = new DOMParser();
        const parsed = parser.parseFromString(doc.content, 'text/html');
        map.set(meta.id, parsed.querySelectorAll('.underline').length);
      } else {
        map.set(meta.id, 0);
      }
    }
    return map;
  }, [docMetas]);

  /** 开始抽背：构建随机题目队列 */
  const startQuiz = useCallback((id: string) => {
    const doc = getDocument(id);
    if (!doc) return;
    const q = buildQuizQueue(doc.content, id);
    if (q.length === 0) {
      alert('该文档没有可抽背的重点内容（未找到 underline 标记）。');
      return;
    }
    setDocId(id);
    setDocTitle(doc.title);
    setQueue(q);
    setAnswers(new Array(q.length).fill(undefined));
    setCurrentIndex(0);
    setRevealed(false);
    setIsReview(false);
    setPhase('quiz');
  }, []);

  /** 记录当前题作答结果 */
  const recordAnswer = useCallback(
    (mastered: boolean) => {
      setAnswers((prev) => {
        const next = [...prev];
        next[currentIndex] = mastered;
        return next;
      });
    },
    [currentIndex]
  );

  /** 推进到下一未答题，全部作答则进入结果页 */
  const advance = useCallback(
    (hypothetical: boolean[]) => {
      const next = nextUnansweredIndex(hypothetical, currentIndex);
      if (next === -1) {
        setPhase('result');
      } else {
        setCurrentIndex(next);
        setRevealed(false);
      }
    },
    [currentIndex]
  );

  /** “掌握了”：记录并立即推进到下一题 */
  const handleMastered = useCallback(() => {
    // 基于“当前题已作答”的假设数组计算下一题，避免依赖已过期的 state
    const hypothetical = answers.map((v, i) => (i === currentIndex ? true : v));
    recordAnswer(true);
    advance(hypothetical);
  }, [answers, currentIndex, recordAnswer, advance]);

  /** “没掌握”：记录、加入没掌握清单（含原句/时间/分类标签）并立即推进 */
  const handleNotMastered = useCallback(() => {
    recordAnswer(false);
    const item = queue[currentIndex];
    const meta = docMetas.find((m) => m.id === item.docId);
    const category = categories.find((c) => c.id === meta?.categoryId);
    addUnmastered([
      toUnmasteredItem(item, docTitle, meta?.categoryId ?? null, category?.name ?? '未分类'),
    ]);
    showToast('已加入没掌握清单');
    const hypothetical = answers.map((v, i) => (i === currentIndex ? false : v));
    advance(hypothetical);
  }, [answers, currentIndex, queue, recordAnswer, advance, addUnmastered, docMetas, categories, docTitle, showToast]);

  const result = useMemo(() => summarizeResults(queue, answers), [queue, answers]);

  if (phase === 'select') {
    return (
      <div className="min-h-screen bg-[#F9F7F2]">
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#F9F7F2]/90 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-200 hover:text-stone-800"
              aria-label="返回首页"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="flex items-center gap-2 text-base font-medium text-stone-800">
              <Shuffle size={18} className="text-amber-500" />
              随机抽背
            </h1>
            <button
              type="button"
              onClick={() => navigate('/unmastered')}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 shadow-sm transition-colors hover:border-amber-400 hover:text-amber-600"
            >
              <BookOpenCheck size={15} />
              没掌握清单
              {unmastered.length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                  {unmastered.length}
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <p className="mb-6 text-sm text-stone-500">选择要抽背的文档，系统将随机抽取其中的重点内容进行提问。</p>
          {docMetas.length === 0 ? (
            <div className="rounded-xl bg-stone-100/50 px-6 py-16 text-center text-sm text-stone-500">
              暂无文档，请先到首页上传文档
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {docMetas.map((meta) => {
                const count = highlightCounts.get(meta.id) ?? 0;
                return (
                  <button
                    key={meta.id}
                    type="button"
                    onClick={() => startQuiz(meta.id)}
                    className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-5 py-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <FileText size={18} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-800">{meta.title}</p>
                      <p className="mt-1 text-xs text-stone-500">{count} 个重点内容</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>

        {toast && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-stone-800/90 px-4 py-2 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}
      </div>
    );
  }

  if (phase === 'result') {
    return (
      <div className="min-h-screen bg-[#F9F7F2]">
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#F9F7F2]/90 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setPhase('select')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-200 hover:text-stone-800"
              aria-label="返回选择文档"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-base font-medium text-stone-800">抽背结果</h1>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Trophy size={28} />
            </div>
            <h2 className="mb-2 text-lg font-medium text-stone-800">本次抽背完成</h2>
            <p className="mb-6 text-sm text-stone-500">文档「{docTitle}」共 {result.total} 题</p>
            <div className="mb-8 flex justify-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-semibold text-green-600">{result.mastered.length}</p>
                <p className="mt-1 text-xs text-stone-500">已掌握</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-red-500">{result.unmastered.length}</p>
                <p className="mt-1 text-xs text-stone-500">未掌握</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setPhase('select')}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
              >
                换一篇文档
              </button>
              <button
                type="button"
                onClick={() => docId && startQuiz(docId)}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
              >
                <RotateCcw size={14} />
                重新抽背
              </button>
              {unmastered.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/unmastered')}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                >
                  <BookOpenCheck size={14} />
                  查看没掌握清单（{unmastered.length}）
                </button>
              )}
            </div>
          </div>
        </main>

        {toast && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-stone-800/90 px-4 py-2 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}
      </div>
    );
  }

  // quiz 阶段
  const currentItem = queue[currentIndex];
  const answeredCount = answers.filter((a) => a !== undefined).length;

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#F9F7F2]/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => (isReview ? navigate('/unmastered') : setPhase('select'))}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-200 hover:text-stone-800"
            aria-label={isReview ? '返回没掌握清单' : '返回选择文档'}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-medium text-stone-800">{docTitle}</h1>
            <p className="text-xs text-stone-500">
              第 {currentIndex + 1}/{queue.length} 题
            </p>
          </div>
          <span className="text-xs text-stone-400">已答 {answeredCount} 题</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
          <p className="mb-6 text-sm text-stone-500">
            请回忆划线部分的内容，点击「显示答案」查看对照：
          </p>

          {/* 内容展示区 */}
          <div className="mb-8 min-h-[96px] rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-5">
            {revealed ? (
              /* “显示答案”：重点 + 上一节点主题 + 上下文 */
              <div>
                {currentItem.heading && (
                  <p className="mb-1 text-xs font-medium text-amber-600">主题：{currentItem.heading}</p>
                )}
                <p className="text-xl font-semibold text-stone-800">{currentItem.text}</p>
                {currentItem.sentence && (
                  <p className="mt-2 text-sm leading-relaxed text-stone-500">{currentItem.sentence}</p>
                )}
              </div>
            ) : (
              /* 初始状态：展示题干（重点处以占位横线隐藏），供用户根据上下文回忆 */
              <div>
                {currentItem.heading && (
                  <p className="mb-2 text-xs font-medium text-amber-600">主题：{currentItem.heading}</p>
                )}
                <p className="text-base leading-relaxed text-stone-800">
                  {renderPrompt(currentItem.prompt, `q${currentIndex}`)}
                </p>
                <p className="mt-4 flex items-center justify-center text-xs text-stone-400">
                  <EyeOff size={14} className="mr-1.5" />
                  划线部分已隐藏，请根据上下文回忆并填空
                </p>
              </div>
            )}
          </div>

          {!revealed ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600"
              >
                <Eye size={16} />
                显示答案
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={handleNotMastered}
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
              >
                <X size={15} />
                没掌握
              </button>
              <button
                type="button"
                onClick={handleMastered}
                className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-5 py-2.5 text-sm font-medium text-green-600 transition-colors hover:bg-green-100"
              >
                <Check size={15} />
                掌握了
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => (isReview ? navigate('/unmastered') : setPhase('select'))}
            className="text-sm text-stone-500 underline-offset-4 hover:text-stone-700 hover:underline"
          >
            {isReview ? '返回没掌握清单' : '返回选择文档'}
          </button>
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-stone-800/90 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
