import { Eye, EyeOff } from 'lucide-react';

interface HighlightToggleProps {
  showHighlights: boolean;
  count: number;
  onToggle: () => void;
}

export function HighlightToggle({ showHighlights, count, onToggle }: HighlightToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200',
        showHighlights
          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/20'
          : 'bg-stone-200 text-stone-600 hover:bg-stone-300 dark:bg-stone-700/60 dark:text-stone-300 dark:hover:bg-stone-600',
      ].join(' ')}
      aria-pressed={showHighlights}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 shadow-sm dark:bg-stone-900/80">
        {showHighlights ? <Eye size={15} /> : <EyeOff size={15} />}
      </span>
      <span className="hidden sm:inline">{showHighlights ? '重点显示中' : '重点已隐藏'}</span>
      <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs dark:bg-stone-900/60">{count}</span>
    </button>
  );
}
