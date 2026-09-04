import { useEffect, useRef, useState } from 'react';
import { Bold, Underline, Strikethrough, Highlighter, Eraser } from 'lucide-react';
import type { FormatAction } from '@/utils/textFormat';
import { ColorPicker } from '@/components/editor/ColorPicker';

interface SelectionToolbarProps {
  onFormat: (action: FormatAction, value?: string) => void;
}

/** 悬浮按钮统一样式 */
const FLOAT_BTN_CLASS =
  'flex h-8 w-8 items-center justify-center rounded-md text-white/90 transition-colors hover:bg-white/20';

/**
 * 选中文本时紧邻选区显示的悬浮格式化条（移动端/上下文菜单体验）。
 * 点击格式化后保持选区，可连续操作；点击别处自动隐藏。
 */
export function SelectionToolbar({ onFormat }: SelectionToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ x: number; top: number } | null>(null);
  const [openPanel, setOpenPanel] = useState<'color' | 'highlight' | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setVisible(false);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setVisible(false);
        return;
      }
      // 仅当选区位于大纲编辑区内才显示
      let el: Node | null = range.commonAncestorContainer;
      while (el && el.nodeType !== Node.ELEMENT_NODE) el = el.parentNode;
      let host = el as HTMLElement | null;
      while (host && !host.classList.contains('outline-editable')) host = host.parentElement;
      if (!host || !host.isContentEditable) {
        setVisible(false);
        return;
      }
      setVisible(true);
      // 浮条居中于选区上方，避免超出屏幕
      const cx = rect.left + rect.width / 2;
      const clamped = Math.max(70, Math.min(cx, window.innerWidth - 70));
      setPos({ x: clamped, top: rect.top });
    };

    document.addEventListener('selectionchange', update);
    document.addEventListener('mouseup', update);
    document.addEventListener('touchend', update);
    window.addEventListener('scroll', () => setVisible(false), true);
    window.addEventListener('resize', () => setVisible(false));
    return () => {
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('mouseup', update);
      document.removeEventListener('touchend', update);
      window.removeEventListener('scroll', () => setVisible(false), true);
      window.removeEventListener('resize', () => setVisible(false));
    };
  }, []);

  const handle = (action: FormatAction, value?: string) => {
    onFormat(action, value);
    setOpenPanel(null);
    // 格式化后选区保持，下一帧重新定位浮条
    requestAnimationFrame(() => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        if (rect.width > 0) {
          const cx = rect.left + rect.width / 2;
          setPos({ x: Math.max(70, Math.min(cx, window.innerWidth - 70)), top: rect.top });
        }
      }
    });
  };

  if (!visible || !pos) return null;

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="文本格式工具栏"
      className="pointer-events-none fixed left-0 top-0 z-[60] flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-xl bg-stone-800/95 px-2 py-1.5 shadow-xl animate-[fadeIn_0.12s_ease-out] dark:bg-stone-950/95"
      style={{ left: pos.x, top: pos.top - 8 }}
    >
      <div className="pointer-events-auto flex items-center gap-0.5">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handle('bold')}
          className={FLOAT_BTN_CLASS}
          aria-label="加粗"
          title="加粗"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handle('underline')}
          className={FLOAT_BTN_CLASS}
          aria-label="重点划线"
          title="重点划线"
        >
          <Underline size={15} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handle('strike')}
          className={FLOAT_BTN_CLASS}
          aria-label="删除线"
          title="删除线"
        >
          <Strikethrough size={15} />
        </button>

        <span className="mx-0.5 h-4 w-px bg-white/20" aria-hidden="true" />

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpenPanel((cur) => (cur === 'color' ? null : 'color'))}
          className={`${FLOAT_BTN_CLASS} ${openPanel === 'color' ? 'bg-white/20' : ''}`}
          aria-label="文本颜色"
          aria-expanded={openPanel === 'color'}
          title="文本颜色"
        >
          <span className="text-[12px] font-bold leading-none">A</span>
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpenPanel((cur) => (cur === 'highlight' ? null : 'highlight'))}
          className={`${FLOAT_BTN_CLASS} ${openPanel === 'highlight' ? 'bg-white/20' : ''}`}
          aria-label="荧光笔"
          aria-expanded={openPanel === 'highlight'}
          title="荧光笔"
        >
          <Highlighter size={15} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handle('clear')}
          className={FLOAT_BTN_CLASS}
          aria-label="清除格式"
          title="清除格式"
        >
          <Eraser size={15} />
        </button>
      </div>

      {openPanel && (
        <div className="pointer-events-auto absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2">
          <ColorPicker
            mode={openPanel}
            onPick={(v) => handle(openPanel, v)}
            onClose={() => setOpenPanel(null)}
          />
        </div>
      )}
    </div>
  );
}
