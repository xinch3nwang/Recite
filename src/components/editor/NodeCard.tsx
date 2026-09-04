import type { PointerEvent } from 'react';
import { NODE_TYPES, type GraphNode } from '@/utils/diagram';
import { NODE_WIDTH } from '@/utils/edgeGeometry';

interface NodeCardProps {
  node: GraphNode;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  onDragStart: (e: PointerEvent, nodeId: string) => void;
  onConnectStart: (e: PointerEvent, nodeId: string) => void;
}

/** 节点卡片：类型色条 + 标题 + 内容摘要 + 四向连接端口 */
export function NodeCard({
  node,
  selected,
  onSelect,
  onDragStart,
  onConnectStart,
}: NodeCardProps) {
  const meta = NODE_TYPES[node.type] ?? NODE_TYPES.concept;

  const handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    // 阻止冒泡到画布背景逻辑（画布 pointerdown 会清空选中）
    e.stopPropagation();
    onSelect(node.id);
    onDragStart(e, node.id);
  };

  return (
    <div
      data-node-id={node.id}
      className={`node-card group absolute select-none rounded-lg border bg-white shadow-sm transition-shadow dark:bg-stone-900 ${
        selected
          ? 'z-20 border-amber-400 shadow-md ring-2 ring-amber-200'
          : 'z-10 border-stone-200 hover:shadow-md dark:border-stone-700/60'
      }`}
      style={{ left: node.x, top: node.y, width: NODE_WIDTH, minHeight: 64 }}
      onPointerDown={handlePointerDown}
    >
      {/* 类型色条 */}
      <div
        className="h-1.5 w-full rounded-t-lg"
        style={{ backgroundColor: meta.color }}
      />
      <div className="px-3 py-2">
        <div className="text-[10px] font-medium" style={{ color: meta.color }}>
          {meta.label}
        </div>
        <div className="mt-0.5 truncate text-sm font-medium text-stone-800 dark:text-stone-100">
          {node.title || '未命名节点'}
        </div>
        {node.content && (
          <div className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-xs text-stone-500 dark:text-stone-400">
            {node.content}
          </div>
        )}
      </div>

      {/* 四向连接端口：按住可拖出连接线 */}
      {(
        [
          { side: 'top', cls: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2' },
          { side: 'right', cls: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2' },
          { side: 'bottom', cls: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2' },
          { side: 'left', cls: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2' },
        ] as const
      ).map(({ side, cls }) => (
        <button
          key={side}
          type="button"
          aria-label={`从该节点向${side}连线`}
          className={`absolute h-3 w-3 cursor-crosshair rounded-full border-2 border-white bg-stone-400 opacity-0 shadow-sm transition-opacity hover:bg-amber-500 group-hover:opacity-100 dark:bg-stone-500 ${
            selected ? 'opacity-100' : ''
          } ${cls}`}
          onPointerDown={(e) => {
            e.stopPropagation();
            onConnectStart(e, node.id);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ))}
    </div>
  );
}
