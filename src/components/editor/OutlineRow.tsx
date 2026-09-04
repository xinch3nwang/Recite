import { useEffect, useRef, useState } from 'react';
import { Plus, ChevronRight, Trash2, StickyNote, X } from 'lucide-react';
import type { OutlineNode } from '@/utils/outline';

/** 长按触发拖拽所需的最小移动阈值（px），防止长按与滚动冲突 */
const DRAG_SLOP = 8;
/** 长按判定时长（ms） */
const LONG_PRESS_MS = 400;

interface OutlineRowProps {
  node: OutlineNode;
  collapsed: boolean;
  onToggleCollapse: (id: string) => void;
  onChange: (id: string, html: string) => void;
  onNoteChange: (id: string, note: string) => void;
  onAddExplanation: (id: string) => void;
  onAddChild: (id: string) => void;
  onAddSibling: (id: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (id: string) => void;
}

/**
 * 大纲单行：折叠箭头 + 圆点 + 可编辑内容（+ 可添加/编辑的解释）。
 * 文本使用 contentEditable，仅在失焦时同步外部 html，避免输入时光标跳动。
 * 不区分标题级别；缩进由 Editor 递归容器的缩进量决定（本组件不再按深度内边距）。
 * 解释（note）仅 Mubu 列表项支持，序列化写入 .note.mm-editor，保持原始结构。
 */
export function OutlineRow({
  node,
  collapsed,
  onToggleCollapse,
  onChange,
  onNoteChange,
  onAddExplanation,
  onAddChild,
  onAddSibling,
  onDelete,
  onDragStart,
  onDragMove,
  onDragEnd,
}: OutlineRowProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const [contentFocused, setContentFocused] = useState(false);
  const [noteFocused, setNoteFocused] = useState(false);

  // 长按拖拽手柄状态
  const pressTimerRef = useRef<number | null>(null);
  const dragRef = useRef(false); // 是否已进入拖拽
  const startRef = useRef<{ x: number; y: number } | null>(null);

  // 组件卸载时清理长按计时器
  useEffect(() => {
    return () => {
      if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current);
    };
  }, []);

  const clearPressTimer = () => {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  /** 按下 dot：捕获指针并启动长按计时器 */
  const handleDotPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    dragRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    clearPressTimer();
    pressTimerRef.current = window.setTimeout(() => {
      dragRef.current = true;
      onDragStart(node.id);
    }, LONG_PRESS_MS);
  };

  /** 移动：拖拽中上报坐标；否则位移超过阈值则取消长按（当作滚动） */
  const handleDotPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (dragRef.current) {
      onDragMove(e.clientX, e.clientY);
      return;
    }
    const s = startRef.current;
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > DRAG_SLOP) {
      clearPressTimer();
    }
  };

  /** 松手 / 取消：结束拖拽并释放指针捕获 */
  const handleDotPointerEnd = (e: React.PointerEvent<HTMLElement>) => {
    clearPressTimer();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* 忽略释放异常 */
    }
    if (dragRef.current) onDragEnd(node.id);
    dragRef.current = false;
    startRef.current = null;
  };

  useEffect(() => {
    if (!contentFocused && contentRef.current && contentRef.current.innerHTML !== node.html) {
      contentRef.current.innerHTML = node.html;
    }
  }, [node.html, contentFocused]);

  useEffect(() => {
    const note = node.note ?? '';
    if (!noteFocused && noteRef.current && noteRef.current.innerHTML !== note) {
      noteRef.current.innerHTML = note;
    }
  }, [node.note, noteFocused]);

  const isMubu = Boolean(node.liClass);

  return (
    <div className="group relative flex items-start gap-1 rounded-lg px-1 py-2 transition-colors hover:bg-stone-50 sm:gap-1.5 dark:hover:bg-stone-800">
      {/* 折叠箭头 / 占位 */}
      <span className="mt-1 flex w-4 shrink-0 items-center justify-center">
        {node.children.length > 0 ? (
          <button
            type="button"
            onClick={() => onToggleCollapse(node.id)}
            aria-label={collapsed ? '展开子节点' : '折叠子节点'}
            className="flex h-5 w-5 items-center justify-center rounded text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-700 dark:hover:text-stone-300"
          >
            <ChevronRight size={14} className={`transition-transform ${collapsed ? '' : 'rotate-90'}`} />
          </button>
        ) : null}
      </span>

      {/* 圆点（长按可拖拽排序 / 成为下级） */}
      <span
        role="button"
        tabIndex={-1}
        aria-label="长按拖拽节点"
        title="长按拖拽"
        onPointerDown={handleDotPointerDown}
        onPointerMove={handleDotPointerMove}
        onPointerUp={handleDotPointerEnd}
        onPointerCancel={handleDotPointerEnd}
        className="mt-[0.6rem] h-2.5 w-2.5 shrink-0 cursor-grab touch-none rounded-full bg-amber-500 opacity-90 transition-opacity select-none active:cursor-grabbing hover:opacity-100"
      />

      <div className="min-w-0 flex-1">
        <div
          ref={contentRef}
          contentEditable
          suppressContentEditableWarning
          data-outline-id={node.id}
          data-placeholder="点击输入内容"
          onFocus={() => setContentFocused(true)}
          onBlur={() => setContentFocused(false)}
          onInput={() => {
            if (contentRef.current) onChange(node.id, contentRef.current.innerHTML);
          }}
          onKeyDown={(e) => {
            // Enter 在同层新增节点，避免回车插入 <div>/<br> 破坏结构
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onAddSibling(node.id);
            }
          }}
          className="outline-editable min-h-[1.5rem] cursor-text rounded px-1 py-0.5 text-sm text-stone-700 outline-none transition-colors focus:bg-amber-50/60 dark:text-stone-200 dark:focus:bg-amber-500/15"
        />

        {/* 解释：已有则编辑 + 删除，Mubu 节点无解释时可添加 */}
        {node.note !== undefined ? (
          <div className="mt-1 flex items-start gap-1">
            <div className="flex min-w-0 flex-1 items-start gap-1.5 rounded-lg bg-stone-50 px-1.5 py-1 dark:bg-stone-800/60">
              <StickyNote size={12} className="mt-1 shrink-0 text-stone-300 dark:text-stone-500" aria-hidden="true" />
              <div
                ref={noteRef}
                contentEditable
                suppressContentEditableWarning
                data-outline-note={node.id}
                data-placeholder="输入解释…"
                onFocus={() => setNoteFocused(true)}
                onBlur={() => setNoteFocused(false)}
                onInput={() => {
                  if (noteRef.current) onNoteChange(node.id, noteRef.current.innerHTML);
                }}
                className="outline-editable min-h-[1.25rem] flex-1 cursor-text text-xs text-stone-500 outline-none transition-colors focus:bg-amber-50/60 dark:text-stone-400 dark:focus:bg-amber-500/15"
              />
            </div>
            <button
              type="button"
              onClick={() => onNoteChange(node.id, '')}
              aria-label="删除解释"
              title="删除解释"
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-stone-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-stone-500 dark:hover:bg-red-500/15 dark:hover:text-red-400"
            >
              <X size={12} />
            </button>
          </div>
        ) : isMubu ? (
          <button
            type="button"
            onClick={() => onAddExplanation(node.id)}
            className="mt-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-stone-400 transition-colors hover:bg-amber-50 hover:text-amber-600 dark:text-stone-500 dark:hover:bg-amber-500/15 dark:hover:text-amber-400"
          >
            <StickyNote size={12} />
            添加解释
          </button>
        ) : null}
      </div>

      {/* 行内操作：竖向悬浮于行尾（横向遮挡最小，不占布局宽度）；编辑该行或桌面悬停时浮现 */}
      <div className="pointer-events-none absolute right-1 top-2 z-10 flex flex-col items-center gap-0.5 rounded-lg bg-white/95 p-0.5 opacity-0 shadow-sm transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100 dark:bg-stone-900/95">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAddChild(node.id)}
          aria-label="添加子节点"
          title="添加子节点"
          className="flex h-6 w-6 items-center justify-center rounded text-stone-400 transition-colors hover:bg-amber-50 hover:text-amber-600 dark:text-stone-500 dark:hover:bg-amber-500/15 dark:hover:text-amber-400"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAddSibling(node.id)}
          aria-label="添加同级"
          title="添加同级"
          className="flex h-6 w-6 items-center justify-center rounded text-stone-400 transition-colors hover:bg-amber-50 hover:text-amber-600 dark:text-stone-500 dark:hover:bg-amber-500/15 dark:hover:text-amber-400"
        >
          <Plus size={14} className="rotate-45" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onDelete(node.id)}
          aria-label="删除节点"
          title="删除节点"
          className="flex h-6 w-6 items-center justify-center rounded text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-stone-500 dark:hover:bg-red-500/15 dark:hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
