/**
 * 连接线几何计算：基于节点坐标计算端点与 SVG 路径。
 * 与 React 解耦，便于单元测试。
 */
import type { EdgeDash, GraphEdge, GraphNode } from '@/utils/diagram';

/** 节点卡片固定宽度（与 UI 保持一致，用于端点计算） */
export const NODE_WIDTH = 200;
/** 节点卡片估算高度（用于端点计算，UI 实际高度由内容决定） */
export const NODE_ESTIMATED_HEIGHT = 96;

/** 节点中心点（连线端点以中心为锚，卡片覆盖中段，视觉上等效于接到边缘） */
export function nodeCenter(node: GraphNode): { x: number; y: number } {
  return { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_ESTIMATED_HEIGHT / 2 };
}

export interface EdgePoints {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

/** 计算一条边的两端坐标（节点缺失时返回 null） */
export function computeEdgePoints(
  edge: Pick<GraphEdge, 'sourceId' | 'targetId'>,
  nodes: GraphNode[]
): EdgePoints | null {
  const source = nodes.find((n) => n.id === edge.sourceId);
  const target = nodes.find((n) => n.id === edge.targetId);
  if (!source || !target) return null;
  const s = nodeCenter(source);
  const t = nodeCenter(target);
  return { sx: s.x, sy: s.y, tx: t.x, ty: t.y };
}

/**
 * 生成 SVG path 数据：
 * - line：直线
 * - curve：三次贝塞尔曲线（两端水平控制点，横向展开更美观）
 */
export function buildEdgePath(
  edge: Pick<GraphEdge, 'sourceId' | 'targetId' | 'style'>,
  nodes: GraphNode[]
): string | null {
  const p = computeEdgePoints(edge, nodes);
  if (!p) return null;
  if (edge.style === 'curve') {
    const dx = Math.max(48, Math.abs(p.tx - p.sx) * 0.4);
    const c1x = p.sx + dx;
    const c2x = p.tx - dx;
    return `M ${p.sx} ${p.sy} C ${c1x} ${p.sy}, ${c2x} ${p.ty}, ${p.tx} ${p.ty}`;
  }
  return `M ${p.sx} ${p.sy} L ${p.tx} ${p.ty}`;
}

/** 线条样式的 SVG stroke-dasharray 值 */
export function dashArray(dash: EdgeDash): string {
  switch (dash) {
    case 'dashed':
      return '8 6';
    case 'dotted':
      return '2 6';
    default:
      return '';
  }
}
