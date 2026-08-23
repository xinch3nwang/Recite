import { useEffect, useRef } from 'react';

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
      if (!item) return;
      const id = item.getAttribute('data-recite-id');
      if (!id) return;

      // Only reveal when the global switch is hiding highlights
      if (!showHighlights) {
        onRevealRef.current(id);
      }
    };

    container.addEventListener('click', handleClick);
    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, [html, showHighlights, onHighlightCount]);

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
      className="prose prose-stone max-w-none font-serif text-stone-800"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
