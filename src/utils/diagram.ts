/**
 * 可视化编辑（节点图）纯逻辑层：定义节点/连接线数据模型，
 * 提供节点与连线的增删改、数据校验与序列化。不依赖 React，便于单元测试。
 */

/** 节点类型 */
export type NodeType = 'concept' | 'point' | 'question' | 'note';

/** 节点类型元数据：标签与主题色 */
export const NODE_TYPES: Record<NodeType, { label: string; color: string }> = {
  concept: { label: '概念', color: '#f59e0b' },
  point: { label: '要点', color: '#3b82f6' },
  question: { label: '疑问', color: '#ef4444' },
  note: { label: '备注', color: '#10b981' },
};

/** 节点类型列表（用于渲染选择器） */
export const NODE_TYPE_LIST = Object.keys(NODE_TYPES) as NodeType[];

/** 单个节点 */
export interface GraphNode {
  id: string;
  type: NodeType;
  /** 标题（必填，用于展示） */
  title: string;
  /** 内容（可选，补充说明） */
  content: string;
  /** 画布横坐标 */
  x: number;
  /** 画布纵坐标 */
  y: number;
}

/** 连接线样式：直线 / 曲线 */
export type EdgeStyle = 'line' | 'curve';

/** 线条样式：实线 / 虚线 / 点线 */
export type EdgeDash = 'solid' | 'dashed' | 'dotted';

/** 节点间连接线 */
export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  style: EdgeStyle;
  /** 线条颜色（CSS 颜色） */
  color: string;
  /** 线条粗细（px） */
  width: number;
  dash: EdgeDash;
}

/** 整张图数据 */
export interface DiagramData {
  version: 1;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const DIAGRAM_VERSION = 1;
export const DIAGRAM_DEFAULT_EDGE_COLOR = '#94a3b8';
export const DIAGRAM_DEFAULT_EDGE_WIDTH = 2;
/** 节点默认尺寸（用于连线端点计算） */
export const NODE_WIDTH = 200;
export const NODE_MIN_HEIGHT = 64;

/** 创建空白图数据 */
export function emptyDiagram(): DiagramData {
  return { version: DIAGRAM_VERSION, nodes: [], edges: [] };
}

/** 生成唯一 id（编辑器内自增方案更可控，这里提供通用实现） */
export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 新建节点（落到指定坐标，标题/内容为空） */
export function createNode(type: NodeType, x: number, y: number): GraphNode {
  return { id: createId('node'), type, title: '', content: '', x, y };
}

/** 新建连接线（默认直线、灰色、2px、实线） */
export function createEdge(sourceId: string, targetId: string): GraphEdge {
  return {
    id: createId('edge'),
    sourceId,
    targetId,
    style: 'line',
    color: DIAGRAM_DEFAULT_EDGE_COLOR,
    width: DIAGRAM_DEFAULT_EDGE_WIDTH,
    dash: 'solid',
  };
}

/* ---------------------------------- 节点 CRUD ---------------------------------- */

/** 新增节点 */
export function addNode(diagram: DiagramData, node: GraphNode): DiagramData {
  return { ...diagram, nodes: [...diagram.nodes, node] };
}

/** 更新节点字段（type/title/content/x/y） */
export function updateNode(
  diagram: DiagramData,
  nodeId: string,
  patch: Partial<Pick<GraphNode, 'type' | 'title' | 'content' | 'x' | 'y'>>
): DiagramData {
  return {
    ...diagram,
    nodes: diagram.nodes.map((node) =>
      node.id === nodeId ? { ...node, ...patch } : node
    ),
  };
}

/** 删除节点，并连带删除与其相连的所有连接线（避免悬空引用） */
export function removeNode(diagram: DiagramData, nodeId: string): DiagramData {
  return {
    ...diagram,
    nodes: diagram.nodes.filter((node) => node.id !== nodeId),
    edges: diagram.edges.filter(
      (edge) => edge.sourceId !== nodeId && edge.targetId !== nodeId
    ),
  };
}

/* ---------------------------------- 连接线 CRUD ---------------------------------- */

/**
 * 新增连接线：禁止自环与重复连线（同一对有向关系只允许一条）。
 * 返回 null 表示连线非法（自环/重复/引用不存在的节点）。
 */
export function addEdge(
  diagram: DiagramData,
  sourceId: string,
  targetId: string,
  overrides: Partial<Omit<GraphEdge, 'id' | 'sourceId' | 'targetId'>> = {}
): DiagramData | null {
  if (sourceId === targetId) return null;
  const hasSource = diagram.nodes.some((n) => n.id === sourceId);
  const hasTarget = diagram.nodes.some((n) => n.id === targetId);
  if (!hasSource || !hasTarget) return null;
  const duplicated = diagram.edges.some(
    (e) =>
      (e.sourceId === sourceId && e.targetId === targetId) ||
      (e.sourceId === targetId && e.targetId === sourceId)
  );
  if (duplicated) return null;
  const edge = { ...createEdge(sourceId, targetId), ...overrides };
  return { ...diagram, edges: [...diagram.edges, edge] };
}

/** 更新连接线字段（style/color/width/dash） */
export function updateEdge(
  diagram: DiagramData,
  edgeId: string,
  patch: Partial<Pick<GraphEdge, 'style' | 'color' | 'width' | 'dash'>>
): DiagramData {
  return {
    ...diagram,
    edges: diagram.edges.map((edge) =>
      edge.id === edgeId ? { ...edge, ...patch } : edge
    ),
  };
}

/** 删除连接线 */
export function removeEdge(diagram: DiagramData, edgeId: string): DiagramData {
  return {
    ...diagram,
    edges: diagram.edges.filter((edge) => edge.id !== edgeId),
  };
}

/* ---------------------------------- 数据校验 ---------------------------------- */

export interface DiagramValidation {
  ok: boolean;
  errors: string[];
}

/** 校验图数据的完整性与一致性（写入前必须通过） */
export function validateDiagram(d: unknown): DiagramValidation {
  const errors: string[] = [];
  if (!d || typeof d !== 'object') {
    return { ok: false, errors: ['图数据不是有效对象'] };
  }
  const data = d as DiagramData;

  if (!Array.isArray(data.nodes)) {
    errors.push('nodes 必须是数组');
  }
  if (!Array.isArray(data.edges)) {
    errors.push('edges 必须是数组');
  }
  if (errors.length > 0) return { ok: false, errors };

  const nodeIds = new Set<string>();
  for (const node of data.nodes) {
    if (!node || typeof node.id !== 'string' || !node.id) {
      errors.push('存在缺少 id 的节点');
      continue;
    }
    if (nodeIds.has(node.id)) {
      errors.push(`节点 id 重复：${node.id}`);
    }
    nodeIds.add(node.id);
    if (!(node.type in NODE_TYPES)) errors.push(`节点 ${node.id} 类型非法`);
    if (typeof node.title !== 'string') errors.push(`节点 ${node.id} 标题非法`);
    if (typeof node.content !== 'string') errors.push(`节点 ${node.id} 内容非法`);
    if (typeof node.x !== 'number' || !Number.isFinite(node.x)) errors.push(`节点 ${node.id} x 坐标非法`);
    if (typeof node.y !== 'number' || !Number.isFinite(node.y)) errors.push(`节点 ${node.id} y 坐标非法`);
  }

  const edgeIds = new Set<string>();
  for (const edge of data.edges) {
    if (!edge || typeof edge.id !== 'string' || !edge.id) {
      errors.push('存在缺少 id 的连接线');
      continue;
    }
    if (edgeIds.has(edge.id)) errors.push(`连接线 id 重复：${edge.id}`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.sourceId)) errors.push(`连接线 ${edge.id} 起点不存在`);
    if (!nodeIds.has(edge.targetId)) errors.push(`连接线 ${edge.id} 终点不存在`);
    if (edge.sourceId === edge.targetId) errors.push(`连接线 ${edge.id} 为自环`);
    if (edge.style !== 'line' && edge.style !== 'curve') errors.push(`连接线 ${edge.id} 样式非法`);
    if (typeof edge.color !== 'string' || !edge.color) errors.push(`连接线 ${edge.id} 颜色非法`);
    if (typeof edge.width !== 'number' || edge.width <= 0) errors.push(`连接线 ${edge.id} 粗细非法`);
    if (!['solid', 'dashed', 'dotted'].includes(edge.dash)) errors.push(`连接线 ${edge.id} 线型非法`);
  }

  return { ok: errors.length === 0, errors };
}

/* ---------------------------------- 序列化 ---------------------------------- */

/** 序列化为 JSON 字符串（含版本号，供持久化） */
export function serializeDiagram(diagram: DiagramData): string {
  return JSON.stringify(diagram);
}

/**
 * 从 JSON 字符串解析图数据：解析失败或校验不通过返回 null（容错，不抛异常）。
 */
export function parseDiagram(json: string | null | undefined): DiagramData | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as DiagramData;
    if (!parsed || typeof parsed !== 'object') return null;
    const merged: DiagramData = {
      version: DIAGRAM_VERSION,
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
    };
    if (!validateDiagram(merged).ok) return null;
    return merged;
  } catch {
    return null;
  }
}
