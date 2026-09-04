import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import type { ReciteCategory } from '@/utils/storage';
import type { CategoryNode } from '@/utils/categories';

interface CategoryTreeProps {
  tree: CategoryNode[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (category: ReciteCategory) => void;
  onDelete: (category: ReciteCategory) => void;
  /** 分类 id → 该分类（含后代）下的文档数量 */
  countMap: Map<string, number>;
  /** 全部文档数量 */
  totalCount: number;
}

/** 单个树节点（递归渲染） */
function TreeItem({
  node,
  depth,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  countMap,
  count,
}: {
  node: CategoryNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (category: ReciteCategory) => void;
  onDelete: (category: ReciteCategory) => void;
  countMap: Map<string, number>;
  count: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        className={[
          'group flex cursor-pointer items-center gap-1 rounded-lg py-2 pr-2 text-sm transition-colors',
          isSelected ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300' : 'text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800',
        ].join(' ')}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        <button
          type="button"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-stone-400 hover:bg-stone-200 dark:text-stone-500 dark:hover:bg-stone-700"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded((v) => !v);
          }}
          aria-label={expanded ? '折叠' : '展开'}
        >
          {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </button>
        {expanded && hasChildren ? (
          <FolderOpen size={15} className="shrink-0 text-amber-500" />
        ) : (
          <Folder size={15} className="shrink-0 text-amber-400" />
        )}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <span className="shrink-0 text-xs text-stone-400">{count}</span>
        <div className="flex shrink-0 items-center gap-0.5 md:hidden md:group-hover:flex">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(node);
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-stone-400 hover:bg-amber-50 hover:text-amber-600 dark:text-stone-500 dark:hover:bg-amber-500/15"
            aria-label="编辑分类"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node);
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-stone-400 hover:bg-red-50 hover:text-red-500 dark:text-stone-500 dark:hover:bg-red-500/15"
            aria-label="删除分类"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {expanded &&
        node.children.map((child) => (
          <TreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            onEdit={onEdit}
            onDelete={onDelete}
            countMap={countMap}
            count={countMap.get(child.id) ?? 0}
          />
        ))}
    </div>
  );
}

export function CategoryTree({
  tree,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  countMap,
  totalCount,
}: CategoryTreeProps) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={[
          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
          selectedId === null
            ? 'bg-amber-100 font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-300'
            : 'text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800',
        ].join(' ')}
      >
        <FolderOpen size={15} className="shrink-0 text-amber-500" />
        <span className="flex-1 text-left">全部文档</span>
        <span className="text-xs text-stone-400 dark:text-stone-500">{totalCount}</span>
      </button>
      {tree.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          countMap={countMap}
          count={countMap.get(node.id) ?? 0}
        />
      ))}
    </div>
  );
}
