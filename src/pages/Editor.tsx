import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { ArrowLeft, ListTree, Plus, Redo2, Save, Undo2 } from 'lucide-react';
import { getDocument, updateDocumentContent } from '@/utils/storage';
import type { ReciteDocument } from '@/utils/storage';
import {
  parseHtmlToOutline,
  serializeOutline,
  createNodeLike,
  updateNodeHtml,
  updateNodeNote,
  ensureNodeNote,
  removeNode,
  addChild,
  addSibling,
  moveNode,
  countNodes,
  type OutlineNode,
} from '@/utils/outline';
import { OutlineRow } from '@/components/editor/OutlineRow';
import { FormatToolbar } from '@/components/editor/FormatToolbar';
import { SelectionToolbar } from '@/components/editor/SelectionToolbar';
import { applyTextFormat, type FormatAction } from '@/utils/textFormat';
import { useReciteStore } from '@/store/useReciteStore';

/** 保存状态：dirty=未保存更改，saved=已保存，saving=保存中，error=保存失败 */
type SaveState = 'dirty' | 'saved' | 'saving' | 'error';

const SAVE_LABEL: Record<SaveState, string> = {
  dirty: '未保存更改',
  saved: '已保存',
  saving: '保存中…',
  error: '保存失败',
};

const SAVE_BADGE_CLASS: Record<SaveState, string> = {
  dirty: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  saved: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  saving: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  error: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400',
};

/**
 * 每层缩进像素（需与渲染容器的嵌套缩进一致）：
 * 竖屏窄屏收紧为 12px（ml-2 + pl-1），≥sm 为 24px（ml-4 + pl-2），
 * 保证拖拽指示线与视觉缩进对齐。
 */
function getIndentPx(): number {
  return window.matchMedia('(min-width: 640px)').matches ? 24 : 12;
}

/** 折叠状态持久化键前缀（按文档隔离，刷新/重开保持节点折叠视图） */
const COLLAPSED_STORAGE_PREFIX = 'recite_editor_collapsed_';

/** 读取文档已保存的折叠节点 id 集合（容错：损坏或缺失时返回空集） */
function loadCollapsed(docId: string | null): Set<string> {
  if (!docId) return new Set();
  try {
    const raw = localStorage.getItem(`${COLLAPSED_STORAGE_PREFIX}${docId}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr)
      ? new Set(arr.filter((x): x is string => typeof x === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

/** 保存文档折叠节点 id 集合（静默容错） */
function persistCollapsed(docId: string | null, ids: Set<string>): void {
  if (!docId) return;
  try {
    localStorage.setItem(`${COLLAPSED_STORAGE_PREFIX}${docId}`, JSON.stringify([...ids]));
  } catch {
    // 忽略存储异常
  }
}

/** 撤销/重做历史最大步数，超出后丢弃最旧记录，避免内存无界增长 */
const MAX_HISTORY = 100;

/** 拖拽落点：目标父节点 + 目标索引 + 指示线相对树容器的坐标 */
interface DropTarget {
  parentId: string | null;
  index: number;
  depth: number;
  lineTopRel: number;
  lineLeftRel: number;
  lineWidth: number;
}

/**
 * 文档大纲编辑器（核心文档编辑模式）。
 *
 * 编辑的本质是对原始 HTML 结构进行就地修改：解析为保持嵌套层级关系的节点树，
 * 编辑只修改节点文本，序列化逐字还原原始结构（含幕布 li.node/bullet/content/children），
 * 不区分标题级别、不改变内容的逻辑结构与显示样式。
 *
 * 保存为「手动保存」模式：点击右上角「保存」落盘；存在未保存更改时退出会弹出
 * 确认对话框（保存并退出 / 不保存退出 / 取消）。
 */
export default function Editor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const docId = searchParams.get('doc');

  const [currentDoc, setCurrentDoc] = useState<ReciteDocument | null>(null);
  const [titleHtml, setTitleHtml] = useState<string | null>(null);
  const [nodes, setNodes] = useState<OutlineNode[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [exitOpen, setExitOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 拖拽：dragId=正在拖拽的节点，dragPos=指针坐标，dropTarget=指示线落点
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const treeRef = useRef<HTMLDivElement>(null);
  const rowElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const metaRef = useRef<
    Map<string, { parentId: string | null; depth: number; indexInParent: number; childrenCount: number }>
  >(new Map());
  const dragIdRef = useRef<string | null>(null);
  const dropTargetRef = useRef<DropTarget | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const requestExitRef = useRef<() => void>(() => {});
  const setStoreCurrentDoc = useReciteStore((s) => s.setCurrentDoc);

  // 撤销/重做：latestNodes 记录最新节点，stack 存历史状态，bumpHistory 触发按钮禁用态刷新
  const latestNodesRef = useRef<OutlineNode[]>([]);
  const undoStackRef = useRef<OutlineNode[][]>([]);
  const redoStackRef = useRef<OutlineNode[][]>([]);
  const [, bumpHistory] = useState(0);

  /** 是否存在未保存更改 */
  const dirty = saveState !== 'saved';

  /** 是否存在可撤销 / 可重做历史（由 bumpHistory 驱动重渲染刷新） */
  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

  /* ---------------------------------- 加载 ---------------------------------- */

  useEffect(() => {
    if (!docId) {
      setLoadError('缺少文档参数');
      setLoaded(true);
      return;
    }
    const doc = getDocument(docId);
    if (!doc) {
      setLoadError('文档不存在或已被删除');
      setLoaded(true);
      return;
    }
    setCurrentDoc(doc);
    const outline = parseHtmlToOutline(doc.content);
    setTitleHtml(outline.titleHtml);
    setNodes(outline.nodes);
    latestNodesRef.current = outline.nodes;
    undoStackRef.current = [];
    redoStackRef.current = [];
    bumpHistory((v) => v + 1);
    // 恢复本文档先前保存的折叠视图；越界 id 由后续结构同步 effect 清理
    setCollapsed(loadCollapsed(docId));
    setSaveState('saved');
    setExitOpen(false);
    setLoaded(true);
  }, [docId]);

  // 同步最新节点引用，供撤销/重做记录前值时使用
  useEffect(() => {
    latestNodesRef.current = nodes;
  }, [nodes]);

  // 节点结构变化（删除/重置/撤销等）后，清理已失效的折叠 id，避免残留脏数据
  useEffect(() => {
    if (docId) {
      setCollapsed((prev) => {
        const valid = collectNodeIds(nodes);
        let changed = false;
        const next = new Set<string>();
        for (const id of prev) {
          if (valid.has(id)) next.add(id);
          else changed = true;
        }
        if (!changed) return prev;
        persistCollapsed(docId, next);
        return next;
      });
    }
  }, [nodes, docId]);

  /* ---------------------------------- 提示 ---------------------------------- */

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  /* ---------------------------------- 节点操作 ---------------------------------- */

  /**
   * 应用一次节点变更：将当前节点状态压入撤销栈，清空重做栈，再写入新状态。
   * 每次变更（文本/备注/增删/拖拽）都会成为一次可撤销的历史步骤。
   */
  const applyNodes = useCallback((mapper: (cur: OutlineNode[]) => OutlineNode[]) => {
    undoStackRef.current.push(latestNodesRef.current);
    if (undoStackRef.current.length > MAX_HISTORY) undoStackRef.current.shift();
    redoStackRef.current = [];
    setNodes((prev) => mapper(prev));
    setSaveState('dirty');
    bumpHistory((v) => v + 1);
  }, []);

  /** 撤销：回到上一步状态 */
  const handleUndo = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    redoStackRef.current.push(latestNodesRef.current);
    setNodes(prev);
    setSaveState('dirty');
    bumpHistory((v) => v + 1);
  }, []);

  /** 重做：重放被撤销的操作 */
  const handleRedo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(latestNodesRef.current);
    setNodes(next);
    setSaveState('dirty');
    bumpHistory((v) => v + 1);
  }, []);

  const handleChange = useCallback(
    (id: string, html: string) => {
      applyNodes((cur) => updateNodeHtml(cur, id, html));
    },
    [applyNodes]
  );

  /**
   * 文本格式化：对当前选区应用格式（手动 DOM 操作，即时预览），
   * 随后把 host 最新 innerHTML 同步到大纲节点 → 经 applyNodes 自动纳入撤销/重做。
   */
  const handleFormat = useCallback(
    (action: FormatAction, value?: string) => {
      const host = getActiveEditable();
      if (!host) {
        showToast('请先选中要格式化的文本');
        return;
      }
      const changed = applyTextFormat(action, value);
      if (!changed) return;
      const id = host.getAttribute('data-outline-id');
      if (id) handleChange(id, host.innerHTML);
    },
    [handleChange, showToast]
  );

  // 键盘快捷键：Ctrl/Cmd+Z 撤销、Ctrl/Cmd+Shift+Z 或 Ctrl/Cmd+Y 重做；
  // 焦点在编辑区内时，Ctrl/Cmd+B 加粗、Ctrl/Cmd+U 重点划线、Ctrl/Cmd+Shift+X 删除线
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (focusInEditor()) {
        if (key === 'b') {
          e.preventDefault();
          handleFormat('bold');
        } else if (key === 'u') {
          e.preventDefault();
          handleFormat('underline');
        } else if (key === 'x' && e.shiftKey) {
          e.preventDefault();
          handleFormat('strike');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, handleFormat]);

  const handleNoteChange = useCallback(
    (id: string, note: string) => {
      applyNodes((cur) => updateNodeNote(cur, id, note));
    },
    [applyNodes]
  );

  const handleAddExplanation = useCallback(
    (id: string) => {
      applyNodes((cur) => ensureNodeNote(cur, id));
    },
    [applyNodes]
  );

  const handleAddChild = useCallback(
    (id: string) => {
      applyNodes((cur) => {
        const parent = findNode(cur, id);
        if (!parent) return cur;
        return addChild(cur, id, createNodeLike(parent));
      });
      showToast('已添加子节点');
    },
    [applyNodes, showToast]
  );

  const handleAddSibling = useCallback(
    (id: string) => {
      applyNodes((cur) => {
        const ref = findNode(cur, id);
        if (!ref) return cur;
        return addSibling(cur, id, createNodeLike(ref));
      });
    },
    [applyNodes]
  );

  const handleDelete = useCallback(
    (id: string) => {
      applyNodes((cur) => removeNode(cur, id));
      showToast('已删除节点');
    },
    [applyNodes, showToast]
  );

  const handleToggleCollapse = useCallback(
    (id: string) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        persistCollapsed(docId, next);
        return next;
      });
    },
    [docId]
  );

  const handleAddNode = useCallback(() => {
    applyNodes((cur) => [...cur, createNodeLike({ id: '', html: '', liClass: 'node', children: [] })]);
    showToast('已添加节点');
  }, [applyNodes, showToast]);

  /* ---------------------------------- 拖拽排序 / 形成层级 ---------------------------------- */

  /** 重建可见节点元信息（父节点/深度/层级索引），仅拖拽开始时调用 */
  const collectMeta = useCallback(() => {
    const meta = new Map<
      string,
      { parentId: string | null; depth: number; indexInParent: number; childrenCount: number }
    >();
    const walk = (list: OutlineNode[], parentId: string | null, depth: number) => {
      list.forEach((n, idx) => {
        meta.set(n.id, { parentId, depth, indexInParent: idx, childrenCount: n.children.length });
        if (!collapsed.has(n.id)) walk(n.children, n.id, depth + 1);
      });
    };
    walk(nodes, null, 0);
    metaRef.current = meta;
  }, [nodes, collapsed]);

  const handleDragStart = useCallback(
    (id: string) => {
      dragIdRef.current = id;
      setDragId(id);
      setDragPos(null);
      setDropTarget(null);
      dropTargetRef.current = null;
      collectMeta();
    },
    [collectMeta]
  );

  /** 依据指针坐标计算落点；x 深入当前行内容区右侧 → 成为其子节点，否则同级插入 */
  const computeDrop = useCallback((x: number, y: number): DropTarget | null => {
    const treeEl = treeRef.current;
    if (!treeEl) return null;
    const treeRect = treeEl.getBoundingClientRect();
    const meta = metaRef.current;

    // 找指针所在（或上方的最后一个）锚点行；rowEls 为 DOM 顺序（自上而下）
    let anchorId: string | null = null;
    for (const [id, el] of rowElsRef.current) {
      const r = el.getBoundingClientRect();
      if (y >= r.top) anchorId = id;
      else break;
    }
    if (!anchorId || anchorId === dragIdRef.current) return null;
    const am = meta.get(anchorId);
    const anchorEl = rowElsRef.current.get(anchorId);
    if (!am || !anchorEl) return null;
    const rect = anchorEl.getBoundingClientRect();
    const after = y >= rect.top + rect.height / 2;
    const indentPx = getIndentPx();
    const nesting = x >= treeRect.left + am.depth * indentPx + 12;

    if (nesting) {
      // 成为 anchor 的子节点
      const depth = am.depth + 1;
      const left = treeRect.left + depth * indentPx;
      return {
        parentId: anchorId,
        index: after ? am.childrenCount : 0,
        depth,
        lineTopRel: rect.bottom - treeRect.top,
        lineLeftRel: left - treeRect.left,
        lineWidth: treeRect.width - (left - treeRect.left),
      };
    }
    // 同级插入（anchor 之后 / 之前），同层时修正因移除拖拽节点导致的索引偏移
    let base = am.indexInParent + (after ? 1 : 0);
    const dm = meta.get(dragIdRef.current ?? '');
    if (dm && dm.parentId === am.parentId && dm.indexInParent < base) base -= 1;
    const left = treeRect.left + am.depth * indentPx;
    return {
      parentId: am.parentId,
      index: Math.max(0, base),
      depth: am.depth,
      lineTopRel: (after ? rect.bottom : rect.top) - treeRect.top,
      lineLeftRel: left - treeRect.left,
      lineWidth: treeRect.width - (left - treeRect.left),
    };
  }, []);

  const handleDragMove = useCallback(
    (x: number, y: number) => {
      setDragPos({ x, y });
      const target = computeDrop(x, y);
      setDropTarget(target);
      dropTargetRef.current = target;
    },
    [computeDrop]
  );

  const resetDrag = useCallback(() => {
    dragIdRef.current = null;
    setDragId(null);
    setDragPos(null);
    setDropTarget(null);
    dropTargetRef.current = null;
  }, []);

  const handleDragEnd = useCallback(() => {
    const id = dragIdRef.current;
    const target = dropTargetRef.current;
    if (id && target) {
      applyNodes((cur) => moveNode(cur, id, target.parentId, target.index));
    }
    resetDrag();
  }, [applyNodes, resetDrag]);

  /* ---------------------------------- 保存（手动） ---------------------------------- */

  /** 执行保存（事务写入），成功返回 true */
  const performSave = useCallback((): boolean => {
    if (!docId || !loaded) return false;
    setSaveState('saving');
    const result = updateDocumentContent(docId, () => serializeOutline({ titleHtml, nodes }));
    if (result.ok) {
      setSaveState('saved');
      // 同步 store 的 currentDoc，避免返回阅读页时 Reader 用陈旧内容覆盖本次保存
      if (result.doc) setStoreCurrentDoc(result.doc);
      showToast('已保存');
      return true;
    }
    setSaveState('error');
    showToast(`保存失败：${result.error ?? '未知错误'}`);
    return false;
  }, [docId, loaded, titleHtml, nodes, showToast, setStoreCurrentDoc]);

  /* ---------------------------------- 退出确认 ---------------------------------- */

  const goBack = useCallback(() => {
    if (!currentDoc) {
      navigate('/', { replace: true });
      return;
    }
    navigate(`/reader?doc=${currentDoc.id}`, { replace: true });
  }, [currentDoc, navigate]);

  /** 请求退出：有未保存更改则弹出确认，否则直接返回阅读页 */
  const requestExit = useCallback(() => {
    if (dirty) {
      setExitOpen(true);
      return;
    }
    goBack();
  }, [dirty, goBack]);

  useEffect(() => {
    requestExitRef.current = requestExit;
  }, [requestExit]);

  /** 安卓物理返回键：由编辑页自行处理（含未保存确认），App 层对 /editor 不再导航 */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapacitorApp.addListener('backButton', () => requestExitRef.current());
    return () => {
      listener.then((l) => l.remove()).catch(() => {});
    };
  }, []);

  const handleSaveAndExit = useCallback(() => {
    if (performSave()) {
      setExitOpen(false);
      goBack();
    }
  }, [performSave, goBack]);

  const handleDiscardAndExit = useCallback(() => {
    setExitOpen(false);
    goBack();
  }, [goBack]);

  /* ---------------------------------- 递归渲染 ---------------------------------- */

  const registerRow =
    (id: string) =>
    (el: HTMLDivElement | null) => {
      if (el) rowElsRef.current.set(id, el);
      else rowElsRef.current.delete(id);
    };

  const renderTree = (list: OutlineNode[], depth: number): ReactNode =>
    list.map((node) => (
      <div key={node.id}>
        <div
          ref={registerRow(node.id)}
          className={dragId === node.id ? 'relative rounded-lg opacity-40' : 'relative'}
        >
          <OutlineRow
            node={node}
            collapsed={collapsed.has(node.id)}
            onToggleCollapse={handleToggleCollapse}
            onChange={handleChange}
            onNoteChange={handleNoteChange}
            onAddExplanation={handleAddExplanation}
            onAddChild={handleAddChild}
            onAddSibling={handleAddSibling}
            onDelete={handleDelete}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          />
        </div>
        {!collapsed.has(node.id) && node.children.length > 0 && (
          <div className="ml-2 border-l border-stone-200/70 pl-1 sm:ml-4 sm:pl-2 dark:border-stone-700/60">
            {renderTree(node.children, depth + 1)}
          </div>
        )}
      </div>
    ));

  /* ---------------------------------- 渲染 ---------------------------------- */

  if (loaded && loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F9F7F2] px-6 dark:bg-[#0C0A09]">
        <div className="text-stone-600 dark:text-stone-300">{loadError}</div>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
        >
          返回首页
        </button>
      </div>
    );
  }

  if (loaded && !currentDoc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F7F2] dark:bg-[#0C0A09]">
        <div className="text-stone-500 dark:text-stone-400">加载中...</div>
      </div>
    );
  }

  const dragNode = dragId ? findNode(nodes, dragId) : null;
  const dragText = dragNode ? (dragNode.html || '').replace(/<[^>]*>/g, '') : '';

  return (
    <div className="min-h-screen bg-[#F9F7F2] dark:bg-[#0C0A09]">
      {/* 工具栏 */}
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-stone-200 bg-white/90 shadow-sm backdrop-blur-md dark:border-stone-700/60 dark:bg-stone-900/90">
        <div className="flex w-full items-center justify-between gap-3 px-3 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={requestExit}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
              aria-label="返回阅读"
            >
              <ArrowLeft size={18} strokeWidth={1.8} />
            </button>
            <div className="flex min-w-0 items-center gap-2">
              <ListTree size={16} className="shrink-0 text-amber-500" />
              <h1 className="truncate text-sm font-medium text-stone-800 sm:text-base dark:text-stone-100" title={currentDoc?.title}>
                {currentDoc?.title ?? '编辑'}
              </h1>
            </div>
            <span
              className={`hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex ${SAVE_BADGE_CLASS[saveState]}`}
              role="status"
            >
              {saveState === 'dirty' && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              )}
              {SAVE_LABEL[saveState]}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-stone-500 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100 dark:disabled:hover:bg-transparent dark:disabled:hover:text-stone-400"
              aria-label="撤销 (Ctrl+Z)"
              title="撤销 (Ctrl+Z)"
            >
              <Undo2 size={18} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-stone-500 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100 dark:disabled:hover:bg-transparent dark:disabled:hover:text-stone-400"
              aria-label="重做 (Ctrl+Shift+Z)"
              title="重做 (Ctrl+Shift+Z)"
            >
              <Redo2 size={18} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={performSave}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600"
            >
              <Save size={15} />
              保存
            </button>
            <button
              type="button"
              onClick={handleAddNode}
              className="flex items-center gap-1.5 rounded-lg bg-stone-100 px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            >
              <Plus size={15} />
              <span className="hidden xs:inline">添加节点</span>
            </button>
          </div>
        </div>
      </header>

      {/* 底部固定：文本格式化工具栏 */}
      <div className="fixed inset-x-0 bottom-0 z-40">
        <FormatToolbar onFormat={handleFormat} disabled={!loaded || !currentDoc} />
      </div>

      {/* 选中文本时的悬浮格式化条 */}
      <SelectionToolbar onFormat={handleFormat} />

      {/* 大纲树 */}
      <main className="px-3 pb-28 pt-20 sm:px-6 lg:px-8">
        <p className="mb-2 text-xs leading-relaxed text-stone-400 dark:text-stone-500">
          点击文本直接编辑；点击圆点左侧箭头可折叠 / 展开子节点（缩放后自动恢复折叠视图）；长按节点前的圆点拖拽可排序或成为下级；行尾操作按钮在悬停或编辑该行时浮现（添加子节点 / 添加同级 / 删除）。
          编辑后点击右上角「保存」手动保存，保持原有结构。支持 Ctrl/Cmd+Z 撤销、Ctrl/Cmd+Shift+Z（或 Y）重做。
        </p>
        <div
          ref={treeRef}
          className="relative rounded-xl border border-stone-200 bg-white px-1.5 py-2 shadow-sm sm:px-3 dark:border-stone-700/60 dark:bg-stone-900"
        >
          {nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-stone-400 dark:text-stone-500">
              <div className="text-sm">暂无内容</div>
              <div className="text-xs">点击右上角「添加节点」开始编辑</div>
            </div>
          ) : (
            renderTree(nodes, 0)
          )}

          {/* 拖拽落点指示线 */}
          {dragPos && dropTarget && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute z-10"
              style={{ top: dropTarget.lineTopRel - 1, left: dropTarget.lineLeftRel, width: dropTarget.lineWidth }}
            >
              <div className="mx-1 h-0.5 rounded-full bg-amber-500" />
            </div>
          )}
        </div>
        <p className="mt-3 text-right text-xs text-stone-300 dark:text-stone-500">共 {countNodes(nodes)} 个节点</p>
      </main>

      {/* 拖拽跟随浮层 */}
      {dragPos && dragId && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 max-w-[70vw] truncate rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm text-stone-700 shadow-lg"
          style={{ left: dragPos.x + 14, top: dragPos.y - 12 }}
        >
          {dragText}
        </div>
      )}

      {/* 退出确认对话框 */}
      {exitOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-6"
          role="dialog"
          aria-modal="true"
          aria-label="未保存的更改"
          onClick={() => setExitOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-stone-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100">有未保存的更改</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
              当前编辑尚未保存，退出后将丢失更改。
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSaveAndExit}
                className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600"
              >
                保存并退出
              </button>
              <button
                type="button"
                onClick={handleDiscardAndExit}
                className="rounded-lg bg-stone-100 px-4 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              >
                不保存退出
              </button>
              <button
                type="button"
                onClick={() => setExitOpen(false)}
                className="px-4 py-2 text-sm text-stone-500 transition-colors hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-100"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-stone-800/90 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/** 收集节点树中全部节点 id，用于清理已删除节点的折叠记录 */
function collectNodeIds(nodes: OutlineNode[]): Set<string> {
  const ids = new Set<string>();
  const walk = (list: OutlineNode[]) => {
    for (const n of list) {
      ids.add(n.id);
      walk(n.children);
    }
  };
  walk(nodes);
  return ids;
}

/** 在节点树中按 id 查找节点 */
function findNode(nodes: OutlineNode[], id: string): OutlineNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * 定位当前格式化目标所在的 .outline-editable 编辑区。
 * 优先取当前选区所在节点（顶部/悬浮工具栏点击后选区仍在），
 * 兜底取 focus 元素（点击节点后未选中文本时可对整段内容操作）。
 */
function getActiveEditable(): HTMLElement | null {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    let el: Node | null = sel.getRangeAt(0).commonAncestorContainer;
    while (el && el.nodeType !== Node.ELEMENT_NODE) el = el.parentNode;
    let host = el as HTMLElement | null;
    while (host && !host.classList.contains('outline-editable')) host = host.parentElement;
    if (host && host.isContentEditable) return host;
  }
  const active = document.activeElement as HTMLElement | null;
  if (active && active.classList.contains('outline-editable') && active.isContentEditable) return active;
  return null;
}

/** 焦点是否位于大纲编辑区内（限制格式化快捷键只在编辑区内生效） */
function focusInEditor(): boolean {
  return getActiveEditable() !== null;
}
