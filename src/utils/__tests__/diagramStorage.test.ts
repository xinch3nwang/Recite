import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  diagramStorageKey,
  getDiagram,
  saveDiagramTransaction,
  deleteDiagramForDoc,
} from '@/utils/diagramStorage';
import { addNode, createNode, type DiagramData } from '@/utils/diagram';

function oneNode(diagram: DiagramData): DiagramData {
  return addNode(diagram, createNode('concept', 10, 20));
}

describe('编辑图持久化（事务）', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('保存后可读取，且读取结果合法', () => {
    const result = saveDiagramTransaction('d1', (prev) => oneNode(prev));
    expect(result.ok).toBe(true);
    const diagram = getDiagram('d1');
    expect(diagram).not.toBeNull();
    expect(diagram!.nodes).toHaveLength(1);
    expect(diagram!.nodes[0].type).toBe('concept');
  });

  it('updater 接收当前图为前值（增量更新）', () => {
    saveDiagramTransaction('d1', (prev) => oneNode(prev));
    const result = saveDiagramTransaction('d1', (prev) => {
      expect(prev.nodes).toHaveLength(1);
      return addNode(prev, createNode('question', 50, 60));
    });
    expect(result.ok).toBe(true);
    expect(getDiagram('d1')!.nodes).toHaveLength(2);
  });

  it('无图时返回 null，损坏数据返回 null', () => {
    expect(getDiagram('missing')).toBeNull();
    localStorage.setItem(diagramStorageKey('d1'), 'corrupted');
    expect(getDiagram('d1')).toBeNull();
  });

  it('校验失败不写入（原子性：不产生脏数据）', () => {
    const bad = saveDiagramTransaction('d1', () => {
      // 构造非法图数据（连接线引用不存在的节点）
      return {
        version: 1,
        nodes: [createNode('concept', 0, 0)],
        edges: [{ id: 'e', sourceId: 'x', targetId: 'y', style: 'line', color: '#000', width: 2, dash: 'solid' }],
      } as DiagramData;
    });
    expect(bad.ok).toBe(false);
    expect(getDiagram('d1')).toBeNull();
  });

  it('写入异常时回滚到写入前状态（有图场景）', () => {
    saveDiagramTransaction('d1', (prev) => oneNode(prev));
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });
    const result = saveDiagramTransaction('d1', (prev) =>
      addNode(prev, createNode('point', 0, 0))
    );
    spy.mockRestore();

    expect(result.ok).toBe(false);
    // 回滚后仍是写入前的一份节点
    expect(getDiagram('d1')!.nodes).toHaveLength(1);
  });

  it('写入异常时回滚（无图场景：移除键）', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });
    const result = saveDiagramTransaction('d1', (prev) => oneNode(prev));
    spy.mockRestore();

    expect(result.ok).toBe(false);
    expect(localStorage.getItem(diagramStorageKey('d1'))).toBeNull();
  });

  it('deleteDiagramForDoc 清理数据', () => {
    saveDiagramTransaction('d1', (prev) => oneNode(prev));
    deleteDiagramForDoc('d1');
    expect(getDiagram('d1')).toBeNull();
  });

  it('diagramStorageKey 按文档隔离', () => {
    expect(diagramStorageKey('a')).toBe('recite_diagram_a');
    expect(diagramStorageKey('a')).not.toBe(diagramStorageKey('b'));
  });
});
