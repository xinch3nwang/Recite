import { FileText, Inbox } from 'lucide-react';
import type { DocumentMeta } from '@/utils/storage';

interface DocTableProps {
  metas: DocumentMeta[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpen: (id: string) => void;
  /** 分类 id → 名称 */
  categoryName: (categoryId: string | null) => string;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN');
}

export function DocTable({
  metas,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpen,
  categoryName,
}: DocTableProps) {
  if (metas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-stone-100/50 px-6 py-16 text-stone-500">
        <Inbox size={32} className="mb-3 text-stone-300" />
        <p className="text-sm">当前条件下没有文档</p>
      </div>
    );
  }

  const allSelected = metas.length > 0 && metas.every((meta) => selectedIds.has(meta.id));

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      {/* 桌面表格 */}
      <table className="hidden w-full md:table">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="accent-amber-500"
                aria-label="全选"
              />
            </th>
            <th className="px-2 py-3 font-medium">文档名称</th>
            <th className="w-36 px-2 py-3 font-medium">分类</th>
            <th className="w-28 px-2 py-3 font-medium">上传时间</th>
            <th className="w-20 px-2 py-3 text-right font-medium">访问</th>
          </tr>
        </thead>
        <tbody>
          {metas.map((meta) => (
            <tr
              key={meta.id}
              className="group border-b border-stone-100 transition-colors hover:bg-amber-50/40"
            >
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(meta.id)}
                  onChange={() => onToggleSelect(meta.id)}
                  className="accent-amber-500"
                  aria-label={`选择 ${meta.title}`}
                />
              </td>
              <td className="px-2 py-3">
                <button
                  type="button"
                  onClick={() => onOpen(meta.id)}
                  className="flex items-center gap-2 text-left text-sm text-stone-800 transition-colors hover:text-amber-600"
                >
                  <FileText size={15} className="shrink-0 text-stone-300 group-hover:text-amber-500" />
                  <span className="max-w-[300px] truncate font-medium">{meta.title}</span>
                </button>
              </td>
              <td className="px-2 py-3">
                <span className="inline-block max-w-[120px] truncate rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                  {categoryName(meta.categoryId) || '未分类'}
                </span>
              </td>
              <td className="px-2 py-3 text-xs text-stone-500">{formatDate(meta.createdAt)}</td>
              <td className="px-2 py-3 text-right text-xs text-stone-500">{meta.accessCount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 移动端卡片列表 */}
      <ul className="divide-y divide-stone-100 md:hidden">
        {metas.map((meta) => (
          <li key={meta.id} className="flex items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              checked={selectedIds.has(meta.id)}
              onChange={() => onToggleSelect(meta.id)}
              className="shrink-0 accent-amber-500"
              aria-label={`选择 ${meta.title}`}
            />
            <button
              type="button"
              onClick={() => onOpen(meta.id)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm font-medium text-stone-800">{meta.title}</p>
              <p className="mt-0.5 text-xs text-stone-500">
                {categoryName(meta.categoryId) || '未分类'} · {formatDate(meta.createdAt)}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
