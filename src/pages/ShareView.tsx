import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { validateShareAccess } from '@/utils/share';
import { getDiagram } from '@/utils/diagramStorage';
import { getDocument } from '@/utils/storage';
import { NODE_TYPES, type DiagramData } from '@/utils/diagram';
import { EdgeLayer } from '@/components/editor/EdgeLayer';
import { NODE_WIDTH } from '@/utils/edgeGeometry';

type ShareState =
  | { status: 'checking' }
  | { status: 'denied'; reason: string }
  | { status: 'empty' }
  | { status: 'ready'; diagram: DiagramData; title: string };

/** 只读节点：仅展示标题/内容/类型，无任何编辑交互 */
function ReadonlyNode({ node }: { node: DiagramData['nodes'][number] }) {
  const meta = NODE_TYPES[node.type] ?? NODE_TYPES.concept;
  return (
    <div
      className="absolute rounded-lg border border-stone-200 bg-white shadow-sm dark:border-stone-700/60 dark:bg-stone-900"
      style={{ left: node.x, top: node.y, width: NODE_WIDTH, minHeight: 64 }}
    >
      <div className="h-1.5 w-full rounded-t-lg" style={{ backgroundColor: meta.color }} />
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
    </div>
  );
}

/** 分享查看页：安全验证通过后只读展示编辑图 */
export default function ShareView() {
  const navigate = useNavigate();
  const { shareId } = useParams<{ shareId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<ShareState>({ status: 'checking' });

  useEffect(() => {
    const result = validateShareAccess(shareId ?? '', token ?? '');
    if (!result.ok || !result.record) {
      setState({
        status: 'denied',
        reason:
          result.reason === 'expired' ? '分享链接已过期' : '分享链接无效或未授权访问',
      });
      return;
    }
    const diagram = getDiagram(result.record.docId);
    if (!diagram || diagram.nodes.length === 0) {
      setState({ status: 'empty' });
      return;
    }
    const doc = getDocument(result.record.docId);
    setState({ status: 'ready', diagram, title: doc?.title ?? '分享的编辑图' });
  }, [shareId, token]);

  return (
    <div className="min-h-screen bg-[#F9F7F2] dark:bg-[#0C0A09]">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6 dark:border-stone-700/60 dark:bg-stone-900/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
              aria-label="返回首页"
            >
              <ArrowLeft size={18} strokeWidth={1.8} />
            </button>
            <h1 className="truncate text-sm font-medium text-stone-800 sm:text-base dark:text-stone-100">
              {state.status === 'ready' ? state.title : '分享的编辑图'}
            </h1>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <ShieldCheck size={13} />
            安全分享
          </span>
        </div>
      </header>

      {state.status === 'checking' && (
        <div className="flex min-h-[60vh] items-center justify-center text-stone-500 dark:text-stone-400">
          验证中...
        </div>
      )}

      {state.status === 'denied' && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="text-stone-600">{state.reason}</div>
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
          >
            返回首页
          </button>
        </div>
      )}

      {state.status === 'empty' && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="text-stone-600 dark:text-stone-300">分享内容不存在或已被删除</div>
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
          >
            返回首页
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <main className="mx-auto overflow-auto px-4 pb-16 pt-6 sm:px-6">
          <div
            className="relative"
            style={{ width: 1600, height: 1100 }}
          >
            <EdgeLayer
              diagram={state.diagram}
              selectedEdgeId={null}
              pendingEdge={null}
              onSelectEdge={() => {}}
            />
            {state.diagram.nodes.map((node) => (
              <ReadonlyNode key={node.id} node={node} />
            ))}
          </div>
        </main>
      )}
    </div>
  );
}
