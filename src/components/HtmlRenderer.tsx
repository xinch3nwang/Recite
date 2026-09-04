import { useEffect, useRef, useState } from 'react';

interface HtmlRendererProps {
  html: string;
  showHighlights: boolean;
  revealedIds: Set<string>;
  onHighlightCount: (count: number) => void;
  onReveal: (id: string) => void;
}

const HIGHLIGHT_ID_PREFIX = 'recite-highlight-';

export function HtmlRenderer({
  html,
  showHighlights,
  revealedIds,
  onHighlightCount,
  onReveal,
}: HtmlRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onRevealRef = useRef(onReveal);
  onRevealRef.current = onReveal;

  // 已折叠节点（仅记录含子节点的 li.node 的索引），切换后保留内容，仅隐藏子节点
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const toggleFoldRef = useRef<(id: number) => void>(() => {});
  toggleFoldRef.current = (id: number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 文档内容更换时重置折叠状态
  useEffect(() => {
    setCollapsedIds(new Set());
  }, [html]);

  // Assign IDs and attach click handlers after each render
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const highlights = container.querySelectorAll('.underline');
    onHighlightCount(highlights.length);

    highlights.forEach((el, index) => {
      const id = `${HIGHLIGHT_ID_PREFIX}${index}`;
      el.setAttribute('data-recite-id', id);
      el.classList.add('recite-highlight-item');
    });

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const item = target.closest('.recite-highlight-item');
      if (item) {
        const id = item.getAttribute('data-recite-id');
        if (!id) return;
        // Only reveal when the global switch is hiding highlights
        if (!showHighlights) {
          onRevealRef.current(id);
        }
        return;
      }

      // 圆点即折叠开关（不额外占用空间）：点击含子节点节点的圆点或空白缩进区可折叠/展开其子树
      const row = target.closest('li.node');
      if (!row || !row.classList.contains('is-foldable')) return;
      // 点击正文/解释文本不触发折叠，避免误折；圆点区与空白缩进区触发
      const onContent = row.querySelector(':scope > .content')?.contains(target);
      const onNote = row.querySelector(':scope > .note')?.contains(target);
      if (onContent || onNote) return;
      const foldId = Number(row.getAttribute('data-fold-id'));
      if (!Number.isNaN(foldId)) {
        toggleFoldRef.current(foldId);
      }
    };

    container.addEventListener('click', handleClick);
    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, [html, showHighlights, onHighlightCount]);

  // 标记可折叠节点并应用折叠样式
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.querySelectorAll('li.node').forEach((li, index) => {
      const hasChildren = li.querySelector(':scope > .children');
      if (hasChildren) {
        li.setAttribute('data-fold-id', String(index));
        li.classList.add('is-foldable');
        if (collapsedIds.has(index)) li.classList.add('is-collapsed');
        else li.classList.remove('is-collapsed');
      } else {
        li.removeAttribute('data-fold-id');
        li.classList.remove('is-foldable', 'is-collapsed');
      }
    });
  }, [html, collapsedIds]);

  // Apply visibility classes based on current state
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const highlights = container.querySelectorAll('.recite-highlight-item');
    highlights.forEach((el) => {
      const id = el.getAttribute('data-recite-id');
      const isRevealed = id ? revealedIds.has(id) : false;

      if (showHighlights || isRevealed) {
        el.classList.remove('recite-highlight-hidden');
        el.classList.remove('recite-highlight-placeholder');
      } else {
        el.classList.add('recite-highlight-hidden');
        el.classList.add('recite-highlight-placeholder');
      }
    });
  }, [showHighlights, revealedIds]);

  return (
    <div
      ref={containerRef}
      className="prose prose-stone max-w-none font-serif dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
