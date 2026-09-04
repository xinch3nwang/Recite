import { describe, it, expect } from 'vitest';
import {
  emptyDiagram,
  createNode,
  addNode,
  updateNode,
  removeNode,
  addEdge,
  updateEdge,
  removeEdge,
  validateDiagram,
  serializeDiagram,
  parseDiagram,
  DIAGRAM_VERSION,
  type DiagramData,
  type GraphNode,
} from '@/utils/diagram';

function node(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return { id, type: 'concept', title: `标题${id}`, content: '', x: 0, y: 0, ...overrides };
}

function withNode(node: GraphNode): DiagramData {
  return addNode(emptyDiagram(), node);
}

describe('节点管理', () => {
  it('createNode 生成合法节点', () => {
    const n = createNode('concept', 100, 200);
    expect(n.id).toBeTruthy();
    expect(n.type).toBe('concept');
    expect(n.x).toBe(100);
    expect(n.y).toBe(200);
    expect(n.title).toBe('');
  });

  it('addNode 追加节点', () => {
    const d = withNode(node('a'));
    expect(d.nodes).toHaveLength(1);
  });

  it('updateNode 仅更新目标节点', () => {
    const d = addNode(addNode(emptyDiagram(), node('a')), node('b'));
    const next = updateNode(d, 'a', { title: '新标题', type: 'question' });
    expect(next.nodes.find((n) => n.id === 'a')?.title).toBe('新标题');
    expect(next.nodes.find((n) => n.id === 'a')?.type).toBe('question');
    expect(next.nodes.find((n) => n.id === 'b')?.title).toBe('标题b');
  });

  it('removeNode 删除节点并清理关联连接线', () => {
    let d = withNode(node('a'));
    d = addNode(d, node('b'));
    const withEdge = addEdge(d, 'a', 'b')!;
    expect(withEdge.edges).toHaveLength(1);
    const next = removeNode(withEdge, 'a');
    expect(next.nodes.map((n) => n.id)).toEqual(['b']);
    expect(next.edges).toHaveLength(0); // 悬空边被清理
  });
});

describe('连接线管理', () => {
  function base() {
    let d = withNode(node('a'));
    d = addNode(d, node('b'));
    d = addNode(d, node('c'));
    return d;
  }

  it('addEdge 建立连接并返回新边', () => {
    const d = base();
    const next = addEdge(d, 'a', 'b');
    expect(next).not.toBeNull();
    expect(next!.edges).toHaveLength(1);
    const edge = next!.edges[0];
    expect(edge.sourceId).toBe('a');
    expect(edge.targetId).toBe('b');
    expect(edge.style).toBe('line');
  });

  it('addEdge 支持覆盖样式参数', () => {
    const d = base();
    const next = addEdge(d, 'a', 'b', { style: 'curve', color: '#f00', width: 4, dash: 'dashed' });
    expect(next!.edges[0]).toMatchObject({ style: 'curve', color: '#f00', width: 4, dash: 'dashed' });
  });

  it('addEdge 拒绝自环、重复与悬空引用', () => {
    let d = base();
    expect(addEdge(d, 'a', 'a')).toBeNull(); // 自环
    d = addEdge(d, 'a', 'b')!;
    expect(addEdge(d, 'a', 'b')).toBeNull(); // 重复（同向）
    expect(addEdge(d, 'b', 'a')).toBeNull(); // 重复（反向）
    expect(addEdge(d, 'a', 'missing')).toBeNull(); // 终点不存在
    expect(addEdge(d, 'missing', 'a')).toBeNull(); // 起点不存在
  });

  it('updateEdge / removeEdge', () => {
    const d = base();
    const withEdge = addEdge(d, 'a', 'b')!;
    const id = withEdge.edges[0].id;
    const updated = updateEdge(withEdge, id, { color: '#0f0', width: 6 });
    expect(updated.edges[0].color).toBe('#0f0');
    const removed = removeEdge(updated, id);
    expect(removed.edges).toHaveLength(0);
  });
});

describe('validateDiagram', () => {
  it('合法数据校验通过', () => {
    let d = withNode(node('a'));
    d = addNode(d, node('b'));
    d = addEdge(d, 'a', 'b')!;
    const result = validateDiagram(d);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('空图合法', () => {
    expect(validateDiagram(emptyDiagram()).ok).toBe(true);
  });

  it('非法输入返回错误', () => {
    expect(validateDiagram(null).ok).toBe(false);
    expect(validateDiagram(42).ok).toBe(false);
    expect(validateDiagram({}).ok).toBe(false);
  });

  it('节点 id 重复报错', () => {
    const d = { ...emptyDiagram(), nodes: [node('a'), node('a')] };
    const result = validateDiagram(d);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('重复'))).toBe(true);
  });

  it('节点类型非法 / 坐标 NaN 报错', () => {
    const d = {
      ...emptyDiagram(),
      nodes: [{ id: 'a', type: 'bad', title: '', content: '', x: NaN, y: 0 }],
    };
    const result = validateDiagram(d);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('类型非法'))).toBe(true);
    expect(result.errors.some((e) => e.includes('坐标非法'))).toBe(true);
  });

  it('连接线引用缺失节点 / 自环 / 宽度非法报错', () => {
    const d = {
      ...emptyDiagram(),
      nodes: [node('a'), node('b')],
      edges: [
        { id: 'e1', sourceId: 'a', targetId: 'nope', style: 'line', color: '#000', width: 2, dash: 'solid' },
        { id: 'e2', sourceId: 'b', targetId: 'b', style: 'line', color: '#000', width: 0, dash: 'solid' },
      ],
    };
    const result = validateDiagram(d);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('终点不存在'))).toBe(true);
    expect(result.errors.some((e) => e.includes('自环'))).toBe(true);
    expect(result.errors.some((e) => e.includes('粗细非法'))).toBe(true);
  });
});

describe('序列化', () => {
  it('roundtrip：序列化后解析一致', () => {
    let d = withNode(node('a'));
    d = addNode(d, node('b'));
    d = addEdge(d, 'a', 'b', { style: 'curve' })!;
    const json = serializeDiagram(d);
    const parsed = parseDiagram(json)!;
    expect(parsed.version).toBe(DIAGRAM_VERSION);
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.edges).toHaveLength(1);
    expect(parsed.edges[0].style).toBe('curve');
  });

  it('损坏 JSON 返回 null', () => {
    expect(parseDiagram('not-json')).toBeNull();
    expect(parseDiagram('')).toBeNull();
    expect(parseDiagram(null)).toBeNull();
  });

  it('校验不通过的 JSON 返回 null', () => {
    // 节点类型非法导致整体校验失败
    expect(
      parseDiagram('{"nodes":[{"id":"a","type":"bad","title":"","content":"","x":0,"y":0}],"edges":[]}')
    ).toBeNull();
  });

  it('缺省字段用默认值补齐（容错）', () => {
    const parsed = parseDiagram('{"nodes":[],"edges":[]}')!;
    expect(parsed.version).toBe(DIAGRAM_VERSION);
  });
});
