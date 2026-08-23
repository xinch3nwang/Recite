import { useState } from 'react';
import { X, FolderInput } from 'lucide-react';
import type { ReciteCategory } from '@/utils/storage';

interface MoveDocsDialogProps {
  open: boolean;
  count: number;
  categories: ReciteCategory[];
  onClose: () => void;
  onConfirm: (targetCategoryId: string | null) => void;
}

/** 批量移动文档到目标分类的确认弹窗 */
export function MoveDocsDialog({ open, count, categories, onClose, onConfirm }: MoveDocsDialogProps) {
  const [targetId, setTargetId] = useState<string>('none');

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm(targetId === 'none' ? null : targetId);
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
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-medium text-stone-800">
            <FolderInput size={18} className="text-amber-500" />
            移动文档
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mb-4 text-sm text-stone-700">
          将选中的 <span className="font-medium text-amber-600">{count}</span> 个文档移动到：
        </p>

        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="mb-5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
        >
          <option value="none">未分类</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            确认移动
          </button>
        </div>
      </div>
    </div>
  );
}
