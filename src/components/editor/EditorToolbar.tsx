import { ArrowLeft, Plus, Share2 } from 'lucide-react';

export type SaveState = 'saved' | 'saving' | 'error';

interface EditorToolbarProps {
  title: string;
  saveState: SaveState;
  canShare: boolean;
  onBack: () => void;
  onAddNode: () => void;
  onShare: () => void;
}

const SAVE_LABEL: Record<SaveState, string> = {
  saved: '已保存',
  saving: '保存中…',
  error: '保存失败',
};

/** 编辑器顶部工具栏：返回 / 标题 / 保存状态 / 添加节点 / 分享 */
export function EditorToolbar({
  title,
  saveState,
  canShare,
  onBack,
  onAddNode,
  onShare,
}: EditorToolbarProps) {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-stone-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-md sm:px-6 dark:border-stone-700/60 dark:bg-stone-900/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            aria-label="返回阅读"
          >
            <ArrowLeft size={18} strokeWidth={1.8} />
          </button>
          <h1 className="truncate text-sm font-medium text-stone-800 sm:text-base dark:text-stone-100" title={title}>
            {title}
          </h1>
          <span
            className={`hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex ${
              saveState === 'error'
                ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400'
                : saveState === 'saving'
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
            }`}
            role="status"
          >
            {SAVE_LABEL[saveState]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddNode}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
          >
            <Plus size={15} />
            添加节点
          </button>
          <button
            type="button"
            onClick={onShare}
            disabled={!canShare}
            className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:border-amber-400 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-stone-300 disabled:hover:text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:text-amber-400 dark:disabled:hover:border-stone-700 dark:disabled:hover:text-stone-400"
          >
            <Share2 size={15} />
            分享
          </button>
        </div>
      </div>
    </header>
  );
}
