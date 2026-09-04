/**
 * 编辑图数据的持久化层：以「单键整体替换 + 校验 + 失败回滚」模拟事务，
 * 保证编辑操作的原子性，防止数据损坏。数据按文档 id 独立存储，
 * 删除文档时同步清理。
 */
import {
  DiagramData,
  emptyDiagram,
  parseDiagram,
  serializeDiagram,
  validateDiagram,
} from '@/utils/diagram';

/** 图数据存储键 */
export function diagramStorageKey(docId: string): string {
  return `recite_diagram_${docId}`;
}

/** 事务保存结果（ok=false 时 error 提供原因，ok=true 时 data 为最新图） */
export interface SaveResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

/**
 * 事务保存：读取当前图 -> 应用更新 -> 校验 -> 整体写入。
 * - 校验失败：不写入（天然回滚），返回错误；
 * - 写入抛出异常：恢复写入前的备份，保证原子性。
 * updater 接收当前图（无图时为空白图），返回新图。
 */
export function saveDiagramTransaction(
  docId: string,
  updater: (prev: DiagramData) => DiagramData
): SaveResult<DiagramData> {
  const key = diagramStorageKey(docId);
  let prevRaw: string | null = null;
  try {
    prevRaw = localStorage.getItem(key);
    const prev = parseDiagram(prevRaw) ?? emptyDiagram();
    const next = updater(prev);

    const validation = validateDiagram(next);
    if (!validation.ok) {
      return { ok: false, data: null, error: `图数据校验失败：${validation.errors[0] ?? '未知错误'}` };
    }

    localStorage.setItem(key, serializeDiagram(next));
    return { ok: true, data: next, error: null };
  } catch (error) {
    // 写入失败：回滚到写入前的状态
    try {
      if (prevRaw === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, prevRaw);
      }
    } catch {
      // 回滚失败也不抛错，交由上层提示
    }
    return {
      ok: false,
      data: null,
      error: error instanceof Error ? error.message : '保存失败，请重试',
    };
  }
}

/** 读取指定文档的图数据（无图或损坏时返回 null） */
export function getDiagram(docId: string): DiagramData | null {
  try {
    return parseDiagram(localStorage.getItem(diagramStorageKey(docId)));
  } catch {
    return null;
  }
}

/** 删除指定文档的图数据（文档删除时调用，避免脏数据） */
export function deleteDiagramForDoc(docId: string): void {
  try {
    localStorage.removeItem(diagramStorageKey(docId));
  } catch {
    // Ignore storage errors
  }
}
