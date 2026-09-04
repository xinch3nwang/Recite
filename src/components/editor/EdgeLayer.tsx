import { buildEdgePath, dashArray } from '@/utils/edgeGeometry';
import type { DiagramData, GraphEdge, GraphNode } from '@/utils/diagram';

interface PendingEdge {
  sourceId: string;
  /** 指针当前坐标（画布坐标系） */
  x: number;
  y: number;
}

interface EdgeLayerProps {
  diagram: DiagramData;
  selectedEdgeId: string | null;
  pendingEdge: PendingEdge | null;
  onSelectEdge: (edgeId: string | null) => void;
}

/** 渲染单条边：透明命中路径（扩大点击区）+ 可见路径 */
function EdgePath({
  edge,
  nodes,
  selected,
  onSelect,
}: {
  edge: GraphEdge;
  nodes: GraphNode[];
  selected: boolean;
  onSelect: () => void;
}) {
  const d = buildEdgePath(edge, nodes);
  if (!d) return null;
  const dash = dashArray(edge.dash);

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      />
      <path
        d={d}
        fill="none"
        stroke={edge.color}
        strokeWidth={selected ? edge.width + 2 : edge.width}
        strokeDasharray={dash || undefined}
        strokeLinecap="round"
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
}

/**
 * 连接线层：以 SVG 绘制全部连接线与拖线中的临时边。
 * 坐标与画布一致（overflow-visible），节点层级在其上，选中态高亮。
 */
export function EdgeLayer({
  diagram,
  selectedEdgeId,
  pendingEdge,
  onSelectEdge,
}: EdgeLayerProps) {
  const sourceNode = pendingEdge
    ? diagram.nodes.find((n) => n.id === pendingEdge.sourceId)
    : null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
      aria-hidden="true"
    >
      {diagram.edges.map((edge) => (
        <EdgePath
          key={edge.id}
          edge={edge}
          nodes={diagram.nodes}
          selected={edge.id === selectedEdgeId}
          onSelect={() => onSelectEdge(edge.id)}
        />
      ))}

      {/* 拖线中的临时边 */}
      {sourceNode && pendingEdge && (
        <path
          d={`M ${sourceNode.x + 100} ${sourceNode.y + 48} L ${pendingEdge.x} ${pendingEdge.y}`}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </svg>
  );
}
