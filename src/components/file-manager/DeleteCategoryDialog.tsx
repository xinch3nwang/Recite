import { useEffect, useMemo, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import type { ReciteCategory } from '@/utils/storage';
import { getCategorySubtreeIds } from '@/utils/categories';

interface DeleteCategoryDialogProps {
  open: boolean;
  category: ReciteCategory | null;
  categories: ReciteCategory[];
  /** 该分类（含后代）下的文档数量 */
  affectedDocCount: number;
  onClose: () => void;
  onConfirm: (strategy: 'move' | 'delete', targetCategoryId: string | null) => void;
}

export function DeleteCategoryDialog({
  open,
  category,
  categories,
  affectedDocCount,
  onClose,
  onConfirm,
}: DeleteCategoryDialogProps) {
  const [strategy, setStrategy] = useState<'move' | 'delete'>('move');
  const [targetId, setTargetId] = useState<string>('none');

  // 打开时重置选择
  useEffect(() => {
    if (!open) return;
    setStrategy('move');
    setTargetId('none');
  }, [open, category]);

  /** 可选的目标分类（排除被删分类及其后代） */
  const targetOptions = useMemo(() => {
    if (!category) return categories;
    const excluded = new Set(getCategorySubtreeIds(categories, category.id));
    return categories.filter((cat) => !excluded.has(cat.id));
  }, [categories, category]);

  if (!open || !category) return null;

  const handleConfirm = () => {
    if (strategy === 'move') {
      onConfirm('move', targetId === 'none' ? null : targetId);
    } else {
      onConfirm('delete', null);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-medium text-red-600">
            <AlertTriangle size={18} />
            删除分类
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 dark:text-stone-500 dark:hover:bg-stone-800"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mb-1 text-sm text-stone-700 dark:text-stone-200">
          确定删除分类「<span className="font-medium">{category.name}</span>」吗？此操作不可撤销。
        </p>
        <p className="mb-4 text-xs text-stone-500 dark:text-stone-400">
          该分类及其子分类下共 <span className="font-medium text-red-500 dark:text-red-400">{affectedDocCount}</span> 个文档，
          请选择处理方式：
        </p>

        <div className="mb-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-stone-200 p-3 hover:border-amber-300 dark:border-stone-700/60">
            <input
              type="radio"
              name="strategy"
              checked={strategy === 'move'}
              onChange={() => setStrategy('move')}
              className="mt-0.5 accent-amber-500"
            />
            <span className="flex-1 text-sm text-stone-700 dark:text-stone-200">
              将文档移动到其他分类
              {strategy === 'move' && (
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-stone-700 dark:bg-stone-900"
                >
                  <option value="none">未分类</option>
                  {targetOptions.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              )}
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-stone-200 p-3 hover:border-red-300 dark:border-stone-700/60">
            <input
              type="radio"
              name="strategy"
              checked={strategy === 'delete'}
              onChange={() => setStrategy('delete')}
              className="mt-0.5 accent-red-500"
            />
            <span className="flex-1 text-sm text-red-600 dark:text-red-400">
              连同分类下的文档一起删除（{affectedDocCount} 个文档将被永久删除）
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
