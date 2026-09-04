import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, Trash2 } from 'lucide-react';
import { getDocument } from '@/utils/storage';
import type { ReciteDocument } from '@/utils/storage';
import {
  emptyDiagram,
  createNode,
  addNode,
  updateNode,
  removeNode,
  addEdge,
  updateEdge,
  removeEdge,
  NODE_TYPES,
  NODE_TYPE_LIST,
  type DiagramData,
  type GraphEdge,
  type GraphNode,
  type EdgeStyle,
  type EdgeDash,
} from '@/utils/diagram';
import { saveDiagramTransaction, getDiagram } from '@/utils/diagramStorage';
import {
  createShare,
  buildShareLink,
  revokeShare,
  type ShareRecord,
} from '@/utils/share';
import { NodeCard } from '@/components/editor/NodeCard';
import { EdgeLayer } from '@/components/editor/EdgeLayer';
import { EditorToolbar, type SaveState } from '@/components/editor/EditorToolbar';

/** 画布逻辑尺寸（内容可超出，滚动查看） */
const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 1100;

/** 线条预设 */
const EDGE_COLORS = ['#94a3b8', '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#1f2937'];
const EDGE_WIDTHS = [1, 2, 3, 4, 6];
const EDGE_DASHES: { value: EdgeDash; label: string }[] = [
  { value: 'solid', label: '实线' },
  { value: 'dashed', label: '虚线' },
  { value: 'dotted', label: '点线' },
];

/**
 * 思维导图编辑器（独立功能，从文件管理「新建思维导图」进入）。
 * 以节点 + 连接线构建可视化图谱，编辑操作事务化即时保存，支持安全分享。
 */
export default function MindMap() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [currentDoc, setCurrentDoc] = useState<ReciteDocument | null>(null);
  const [diagram, setDiagram] = useState<DiagramData>(emptyDiagram());
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [toast, setToast] = useState<string | null>(null);
  const [pendingEdge, setPendingEdge] = useState<{
    sourceId: string;
    x: number;
    y: number;
  } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareRecord, setShareRecord] = useState<ShareRecord | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    nodeId: string;
    startX: number;
    startY: number;
    nodeX: number;
    nodeY: number;
  } | null>(null);
  const diagramRef = useRef<DiagramData>(diagram);
  const pendingEdgeRef = useRef(pendingEdge);
  const skipSaveRef = useRef(true);
  const toastTimerRef = useRef<number | null>(null);

  /* ---------------------------------- 加载 ---------------------------------- */

  useEffect(() => {
    const docId = searchParams.get('doc');
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
    setDiagram(getDiagram(docId) ?? emptyDiagram());
    skipSaveRef.current = true; // 初次加载不触发保存
    setLoaded(true);
  }, [searchParams]);

  useEffect(() => {
    diagramRef.current = diagram;
  }, [diagram]);

  useEffect(() => {
    pendingEdgeRef.current = pendingEdge;
  }, [pendingEdge]);

  /* ---------------------------------- 即时保存（事务） ---------------------------------- */

  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (!currentDoc || !loaded) return;

    setSaveState('saving');
    const timer = window.setTimeout(() => {
      const result = saveDiagramTransaction(currentDoc.id, () => diagram);
      if (result.ok) {
        setSaveState('saved');
      } else {
        setSaveState('error');
        showToast(`保存失败：${result.error ?? '未知错误'}`);
      }
    }, 200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagram, currentDoc, loaded]);

  /* ---------------------------------- 提示 ---------------------------------- */

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  /* ---------------------------------- 节点操作 ---------------------------------- */

  const handleAddNode = useCallback(() => {
    if (!currentDoc) return;
    const x = 220 + Math.round(Math.random() * 360);
    const y = 140 + Math.round(Math.random() * 260);
    const node = createNode('concept', x, y);
    setDiagram((prev) => addNode(prev, node));
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    showToast('已添加节点，可在面板编辑');
  }, [currentDoc, showToast]);

  const selectedNode = selectedNodeId
    ? diagram.nodes.find((n) => n.id === selectedNodeId) ?? null
    : null;

  const handleUpdateNode = useCallback(
    (patch: Partial<Pick<GraphNode, 'type' | 'title' | 'content' | 'x' | 'y'>>) => {
      if (!selectedNodeId) return;
      setDiagram((prev) => updateNode(prev, selectedNodeId, patch));
    },
    [selectedNodeId]
  );

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    setDiagram((prev) => removeNode(prev, selectedNodeId));
    setSelectedNodeId(null);
    showToast('已删除节点及关联连接线');
  }, [selectedNodeId, showToast]);

  /* ---------------------------------- 连接线操作 ---------------------------------- */

  const selectedEdge = selectedEdgeId
    ? diagram.edges.find((e) => e.id === selectedEdgeId) ?? null
    : null;

  const handleUpdateEdge = useCallback(
    (patch: Partial<Pick<GraphEdge, 'style' | 'color' | 'width' | 'dash'>>) => {
      if (!selectedEdgeId) return;
      setDiagram((prev) => updateEdge(prev, selectedEdgeId, patch));
    },
    [selectedEdgeId]
  );

  const handleDeleteEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    setDiagram((prev) => removeEdge(prev, selectedEdgeId));
    setSelectedEdgeId(null);
    showToast('已删除连接线');
  }, [selectedEdgeId, showToast]);

  /* ---------------------------------- 画布交互 ---------------------------------- */

  const handleCanvasPointerDown = useCallback(() => {
    if (dragRef.current || pendingEdgeRef.current) return;
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const handleDragStart = useCallback((e: React.PointerEvent, nodeId: string) => {
    const node = diagramRef.current.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    dragRef.current = {
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };
  }, []);

  const handleConnectStart = useCallback((_e: React.PointerEvent, nodeId: string) => {
    const node = diagramRef.current.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setPendingEdge({
      sourceId: nodeId,
      x: node.x + 100,
      y: node.y + 48,
    });
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
  }, []);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (drag) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const nx = Math.max(0, Math.round(drag.nodeX + dx));
      const ny = Math.max(0, Math.round(drag.nodeY + dy));
      setDiagram((prev) => updateNode(prev, drag.nodeId, { x: nx, y: ny }));
      return;
    }
    const pending = pendingEdgeRef.current;
    if (pending && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setPendingEdge({ ...pending, x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, []);

  const handleCanvasPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragRef.current) {
        dragRef.current = null;
        return;
      }
      const pending = pendingEdgeRef.current;
      if (!pending) return;

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const targetEl = el?.closest('[data-node-id]');
      const targetId = targetEl?.getAttribute('data-node-id') ?? null;

      if (targetId && targetId !== pending.sourceId) {
        const result = addEdge(diagramRef.current, pending.sourceId, targetId);
        if (result) {
          const newEdge = result.edges[result.edges.length - 1];
          setDiagram(result);
          setSelectedEdgeId(newEdge.id);
          setSelectedNodeId(null);
          showToast('已建立连接');
        } else {
          showToast('无法连接：重复或非法');
        }
      }
      setPendingEdge(null);
    },
    [showToast]
  );

  /* ---------------------------------- 分享 ---------------------------------- */

  const handleShare = useCallback(() => {
    if (!currentDoc || diagram.nodes.length === 0) {
      showToast('请先添加节点后再分享');
      return;
    }
    const record = createShare(currentDoc.id);
    setShareRecord(record);
    setShareOpen(true);
  }, [currentDoc, diagram.nodes.length, showToast]);

  const handleCopyLink = useCallback(async () => {
    if (!shareRecord) return;
    const url = `${window.location.origin}${window.location.pathname}${buildShareLink(shareRecord)}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('分享链接已复制');
    } catch {
      showToast('复制失败，请手动长按复制链接');
    }
  }, [shareRecord, showToast]);

  const handleRevokeShare = useCallback(() => {
    if (!shareRecord) return;
    revokeShare(shareRecord.shareId);
    setShareOpen(false);
    setShareRecord(null);
    showToast('分享已撤销');
  }, [shareRecord, showToast]);

  const handleBack = useCallback(() => {
    navigate('/files', { replace: true });
  }, [navigate]);

  /* ---------------------------------- 渲染 ---------------------------------- */

  if (loaded && loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F9F7F2] px-6 dark:bg-[#0C0A09]">
        <div className="text-stone-600 dark:text-stone-300">{loadError}</div>
        <button
          type="button"
          onClick={() => navigate('/files', { replace: true })}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
        >
          返回文件管理
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

  return (
    <div className="min-h-screen bg-[#F9F7F2] dark:bg-[#0C0A09]">
      <EditorToolbar
        title={currentDoc?.title ?? '思维导图'}
        saveState={saveState}
        canShare={diagram.nodes.length > 0}
        onBack={handleBack}
        onAddNode={handleAddNode}
        onShare={handleShare}
      />

      {/* 画布 */}
      <div className="h-[calc(100vh-3.75rem)] overflow-auto px-0 pt-[3.75rem]">
        <div
          ref={canvasRef}
          className="relative mx-auto bg-[#F9F7F2]"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
        >
          <EdgeLayer
            diagram={diagram}
            selectedEdgeId={selectedEdgeId}
            pendingEdge={pendingEdge}
            onSelectEdge={(id) => {
              setSelectedEdgeId(id);
              setSelectedNodeId(null);
            }}
          />
          {diagram.nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              selected={node.id === selectedNodeId}
              onSelect={setSelectedNodeId}
              onDragStart={handleDragStart}
              onConnectStart={handleConnectStart}
            />
          ))}

          {diagram.nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone-400 dark:text-stone-500">
              <div className="text-sm">画布为空</div>
              <div className="text-xs">点击右上角「添加节点」开始编辑</div>
            </div>
          )}
        </div>
      </div>

      {/* 节点编辑面板 */}
      {selectedNode && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white p-4 shadow-lg md:inset-x-auto md:bottom-4 md:right-4 md:w-80 md:rounded-xl md:border md:shadow-xl dark:border-stone-700/60 dark:bg-stone-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-100">编辑节点</h2>
            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-300"
              aria-label="关闭面板"
            >
              <X size={16} />
            </button>
          </div>

          <label className="mb-2 block text-xs text-stone-500 dark:text-stone-400">类型</label>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {NODE_TYPE_LIST.map((type) => {
              const meta = NODE_TYPES[type];
              const active = selectedNode.type === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleUpdateNode({ type })}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    active
                      ? 'border-transparent text-white'
                      : 'border-stone-200 text-stone-600 hover:border-stone-300 dark:border-stone-700/60 dark:text-stone-300 dark:hover:border-stone-700'
                  }`}
                  style={active ? { backgroundColor: meta.color } : undefined}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: active ? '#fff' : meta.color }}
                  />
                  {meta.label}
                </button>
              );
            })}
          </div>

          <label className="mb-1 block text-xs text-stone-500 dark:text-stone-400">标题</label>
          <input
            value={selectedNode.title}
            onChange={(e) => handleUpdateNode({ title: e.target.value })}
            placeholder="输入标题"
            className="mb-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400 dark:border-stone-700 dark:bg-stone-800"
          />

          <label className="mb-1 block text-xs text-stone-500 dark:text-stone-400">内容</label>
          <textarea
            value={selectedNode.content}
            onChange={(e) => handleUpdateNode({ content: e.target.value })}
            placeholder="补充说明（可选）"
            rows={3}
            className="mb-3 w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400 dark:border-stone-700 dark:bg-stone-800"
          />

          <button
            type="button"
            onClick={handleDeleteNode}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/20"
          >
            <Trash2 size={15} />
            删除节点
          </button>
        </div>
      )}

      {/* 连接线编辑面板 */}
      {selectedEdge && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white p-4 shadow-lg md:inset-x-auto md:bottom-4 md:right-4 md:w-80 md:rounded-xl md:border md:shadow-xl dark:border-stone-700/60 dark:bg-stone-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-100">编辑连接线</h2>
            <button
              type="button"
              onClick={() => setSelectedEdgeId(null)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-300"
              aria-label="关闭面板"
            >
              <X size={16} />
            </button>
          </div>

          <label className="mb-1 block text-xs text-stone-500 dark:text-stone-400">连接样式</label>
          <div className="mb-3 flex gap-1.5">
            {(
              [
                { value: 'line', label: '直线' },
                { value: 'curve', label: '曲线' },
              ] as { value: EdgeStyle; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleUpdateEdge({ style: opt.value })}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  selectedEdge.style === opt.value
                    ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                    : 'border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label className="mb-1 block text-xs text-stone-500 dark:text-stone-400">颜色</label>
          <div className="mb-3 flex flex-wrap gap-2">
            {EDGE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleUpdateEdge({ color })}
                aria-label={`颜色 ${color}`}
                className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                  selectedEdge.color === color
                    ? 'ring-2 ring-amber-400 ring-offset-2'
                    : ''
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <label className="mb-1 block text-xs text-stone-500">粗细</label>
          <div className="mb-3 flex gap-1.5">
            {EDGE_WIDTHS.map((width) => (
              <button
                key={width}
                type="button"
                onClick={() => handleUpdateEdge({ width })}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs transition-colors ${
                  selectedEdge.width === width
                    ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                    : 'border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                {width}
              </button>
            ))}
          </div>

          <label className="mb-1 block text-xs text-stone-500 dark:text-stone-400">线型</label>
          <div className="mb-3 flex gap-1.5">
            {EDGE_DASHES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleUpdateEdge({ dash: opt.value })}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  selectedEdge.dash === opt.value
                    ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                    : 'border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleDeleteEdge}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/20"
          >
            <Trash2 size={15} />
            删除连接线
          </button>
        </div>
      )}

      {/* 分享弹窗 */}
      {shareOpen && shareRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl dark:bg-stone-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100">分享思维导图</h2>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-300"
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">
              链接包含访问令牌并设有有效期，仅持有链接者可查看，防止未授权访问。
            </p>
            <div className="mb-4 break-all rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600 dark:border-stone-700/60 dark:bg-stone-800/60 dark:text-stone-300">
              {window.location.origin}
              {window.location.pathname}
              {buildShareLink(shareRecord)}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
              >
                复制链接
              </button>
              <button
                type="button"
                onClick={handleRevokeShare}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:border-red-300 hover:text-red-600 dark:border-stone-700 dark:text-stone-300 dark:hover:border-red-400 dark:hover:text-red-400"
              >
                撤销分享
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-stone-800/90 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
