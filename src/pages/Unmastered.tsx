import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpenCheck,
  Play,
  Trash2,
  Tag,
  Clock,
  ListX,
} from 'lucide-react';
import { useReciteStore } from '@/store/useReciteStore';
import { buildReviewQueue } from '@/utils/quiz';

/** 格式化抽背时间（月-日 时:分） */
function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Unmastered() {
  const navigate = useNavigate();
  const {
    unmastered,
    loadUnmastered,
    removeUnmastered,
    clearUnmastered,
    startReview,
  } = useReciteStore();

  useEffect(() => {
    loadUnmastered();
  }, [loadUnmastered]);

  /** 针对性复习：将清单（或指定条目）转换为抽背队列并跳转 */
  const handleReview = useCallback(
    (ids?: string[]) => {
      const items = ids
        ? unmastered.filter((item) => ids.includes(item.id))
        : unmastered;
      if (items.length === 0) return;
      startReview(buildReviewQueue(items));
      navigate('/quiz');
    },
    [unmastered, startReview, navigate]
  );

  /** 清空清单（二次确认） */
  const handleClear = useCallback(() => {
    if (window.confirm('确定清空全部没掌握清单吗？此操作不可撤销。')) {
      clearUnmastered();
    }
  }, [clearUnmastered]);

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#F9F7F2]/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-200 hover:text-stone-800"
            aria-label="返回上一页"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="flex items-center gap-2 text-base font-medium text-stone-800">
            <BookOpenCheck size={18} className="text-amber-500" />
            没掌握清单
          </h1>
          <span className="ml-auto text-xs text-stone-400">{unmastered.length} 项</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {unmastered.length === 0 ? (
          <div className="rounded-xl bg-stone-100/50 px-6 py-16 text-center text-sm text-stone-500">
            <p className="mb-2">暂无没掌握内容</p>
            <p className="text-xs text-stone-400">抽背时点击「没掌握」的内容会自动加入此清单</p>
          </div>
        ) : (
          <div className="space-y-3">
            {unmastered.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    {/* 重点内容 + 文档/主题 */}
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-stone-800">{item.text}</p>
                      {item.heading && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-600">
                          {item.heading}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      {item.docTitle}
                      {item.categoryName && (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-stone-400">
                          <Tag size={11} />
                          {item.categoryName}
                        </span>
                      )}
                    </p>
                    {/* 完整原句 */}
                    <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-sm leading-relaxed text-stone-600">
                      {item.sentence}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-stone-400">
                      <Clock size={11} />
                      {formatTime(item.quizzedAt)}
                    </p>
                  </div>
                  {/* 操作按钮 */}
                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => handleReview([item.id])}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 transition-colors hover:bg-amber-100"
                      aria-label="复习该条"
                      title="针对性复习该条"
                    >
                      <Play size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeUnmastered(item.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      aria-label="删除该条"
                      title="从清单移除"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 底部操作栏 */}
      {unmastered.length > 0 && (
        <div className="sticky bottom-4 z-40 mx-auto mb-4 flex w-max max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 shadow-lg">
          <button
            type="button"
            onClick={() => handleReview()}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
          >
            <Play size={14} />
            针对性复习全部（{unmastered.length}）
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
          >
            <ListX size={14} />
            清空清单
          </button>
        </div>
      )}
    </div>
  );
}
