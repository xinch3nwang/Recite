import { ArrowLeft, Pencil } from 'lucide-react';
import { HighlightToggle } from './HighlightToggle';

interface ReaderToolbarProps {
  title: string;
  showHighlights: boolean;
  highlightCount: number;
  progressPercent: number;
  onBack: () => void;
  onToggleHighlights: () => void;
  onEdit: () => void;
}

export function ReaderToolbar({
  title,
  showHighlights,
  highlightCount,
  progressPercent,
  onBack,
  onToggleHighlights,
  onEdit,
}: ReaderToolbarProps) {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-stone-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-md sm:px-6 dark:border-stone-700/60 dark:bg-stone-900/90">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            aria-label="返回首页"
          >
            <ArrowLeft size={18} strokeWidth={1.8} />
          </button>
          <h1 className="truncate text-sm font-medium text-stone-800 sm:text-base dark:text-stone-100" title={title}>
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden text-xs text-stone-500 sm:block dark:text-stone-400">
            阅读进度 <span className="font-medium text-amber-600 dark:text-amber-400">{Math.round(progressPercent)}%</span>
          </div>
          <HighlightToggle
            showHighlights={showHighlights}
            count={highlightCount}
            onToggle={onToggleHighlights}
          />
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-amber-400 hover:text-amber-600 sm:text-sm dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:text-amber-400"
          >
            <Pencil size={14} />
            编辑
          </button>
        </div>
      </div>
    </header>
  );
}
