import { ArrowLeft } from 'lucide-react';
import { HighlightToggle } from './HighlightToggle';

interface ReaderToolbarProps {
  title: string;
  showHighlights: boolean;
  highlightCount: number;
  progressPercent: number;
  onBack: () => void;
  onToggleHighlights: () => void;
}

export function ReaderToolbar({
  title,
  showHighlights,
  highlightCount,
  progressPercent,
  onBack,
  onToggleHighlights,
}: ReaderToolbarProps) {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-stone-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-md sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
            aria-label="返回首页"
          >
            <ArrowLeft size={18} strokeWidth={1.8} />
          </button>
          <h1 className="truncate text-sm font-medium text-stone-800 sm:text-base" title={title}>
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden text-xs text-stone-500 sm:block">
            阅读进度 <span className="font-medium text-amber-600">{Math.round(progressPercent)}%</span>
          </div>
          <HighlightToggle
            showHighlights={showHighlights}
            count={highlightCount}
            onToggle={onToggleHighlights}
          />
        </div>
      </div>
    </header>
  );
}
