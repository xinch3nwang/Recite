import { useState } from 'react';
import { Bold, Underline, Strikethrough, Highlighter } from 'lucide-react';
import type { FormatAction } from '@/utils/textFormat';
import { ColorPicker } from '@/components/editor/ColorPicker';

interface FormatToolbarProps {
  onFormat: (action: FormatAction, value?: string) => void;
  disabled?: boolean;
}

/** 工具栏按钮统一样式 */
const TOOL_BTN_CLASS =
  'relative flex h-9 w-9 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-30 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100';

/**
 * 编辑器底部格式化工具栏：加粗 / 下划线（重点划线）/ 删除线 / 文本颜色 / 荧光笔。
 * 颜色类按钮向上展开色板（预设 + 自定义 + 最近使用）。
 */
export function FormatToolbar({ onFormat, disabled }: FormatToolbarProps) {
  const [openPanel, setOpenPanel] = useState<'color' | 'highlight' | null>(null);

  const togglePanel = (mode: 'color' | 'highlight') => {
    setOpenPanel((cur) => (cur === mode ? null : mode));
  };

  return (
    <div className="flex items-center gap-1 border-t border-stone-200 bg-white/95 px-3 py-2 backdrop-blur-md sm:px-6 dark:border-stone-700/60 dark:bg-stone-900/95">
      <span className="mr-1 hidden text-xs text-stone-400 sm:inline dark:text-stone-500">格式</span>
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onFormat('bold')}
        className={TOOL_BTN_CLASS}
        aria-label="加粗 (Ctrl+B)"
        title="加粗 (Ctrl+B)"
      >
        <Bold size={17} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onFormat('underline')}
        className={TOOL_BTN_CLASS}
        aria-label="重点划线 (Ctrl+U)"
        title="重点划线 (Ctrl+U)"
      >
        <Underline size={17} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onFormat('strike')}
        className={TOOL_BTN_CLASS}
        aria-label="删除线 (Ctrl+Shift+X)"
        title="删除线 (Ctrl+Shift+X)"
      >
        <Strikethrough size={17} strokeWidth={1.8} />
      </button>

      <span className="mx-1 h-5 w-px bg-stone-200 dark:bg-stone-700/60" aria-hidden="true" />

      {/* 文本颜色 */}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => togglePanel('color')}
          className={`${TOOL_BTN_CLASS} ${openPanel === 'color' ? 'bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100' : ''}`}
          aria-label="文本颜色"
          aria-expanded={openPanel === 'color'}
          title="文本颜色"
        >
          <span className="flex flex-col items-center leading-none">
            <span className="text-[13px] font-bold">A</span>
            <span className="mt-0.5 h-1 w-4 rounded-sm bg-amber-500" aria-hidden="true" />
          </span>
        </button>
        {openPanel === 'color' && (
          <div className="absolute bottom-full left-0 z-50 mb-1.5">
            <ColorPicker
              mode="color"
              onPick={(v) => onFormat('color', v)}
              onClose={() => setOpenPanel(null)}
            />
          </div>
        )}
      </div>

      {/* 荧光笔 */}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => togglePanel('highlight')}
          className={`${TOOL_BTN_CLASS} ${openPanel === 'highlight' ? 'bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100' : ''}`}
          aria-label="荧光笔"
          aria-expanded={openPanel === 'highlight'}
          title="荧光笔"
        >
          <Highlighter size={17} strokeWidth={1.8} />
        </button>
        {openPanel === 'highlight' && (
          <div className="absolute bottom-full left-0 z-50 mb-1.5">
            <ColorPicker
              mode="highlight"
              onPick={(v) => onFormat('highlight', v)}
              onClose={() => setOpenPanel(null)}
            />
          </div>
        )}
      </div>

      {/* 清除格式 */}
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onFormat('clear')}
        className={TOOL_BTN_CLASS}
        aria-label="清除格式"
        title="清除格式"
      >
        <span className="text-[12px] font-medium leading-none text-stone-400 line-through dark:text-stone-500">A</span>
      </button>
    </div>
  );
}
