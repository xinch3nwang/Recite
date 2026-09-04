import { useEffect, useMemo, useState } from 'react';
import { X, FolderPlus } from 'lucide-react';
import type { ReciteCategory } from '@/utils/storage';
import { validateCategoryName, validateCategoryDescription, wouldCreateCycle } from '@/utils/categories';

interface CategoryDialogProps {
  open: boolean;
  /** 编辑时传入现有分类，新建时传 null */
  editing: ReciteCategory | null;
  categories: ReciteCategory[];
  onClose: () => void;
  onSave: (data: {
    id?: string;
    name: string;
    description: string;
    parentId: string | null;
    sortOrder: number;
  }) => void;
}

export function CategoryDialog({ open, editing, categories, onClose, onSave }: CategoryDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string>('none');
  const [sortOrder, setSortOrder] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setName(editing.name);
      setDescription(editing.description);
      setParentId(editing.parentId ?? 'none');
      setSortOrder(editing.sortOrder);
    } else {
      setName('');
      setDescription('');
      setParentId('none');
      setSortOrder(0);
    }
  }, [open, editing]);

  /** 可作为父级的分类（排除自身及其后代，避免循环引用） */
  const parentOptions = useMemo(() => {
    if (!editing) return categories;
    return categories.filter((cat) => cat.id !== editing.id && !wouldCreateCycle(categories, editing.id, cat.id));
  }, [categories, editing]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nameError = validateCategoryName(name);
    if (nameError) {
      setError(nameError);
      return;
    }
    const descError = validateCategoryDescription(description);
    if (descError) {
      setError(descError);
      return;
    }
    onSave({
      id: editing?.id,
      name: name.trim(),
      description: description.trim(),
      parentId: parentId === 'none' ? null : parentId,
      sortOrder,
    });
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
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-medium text-stone-800 dark:text-stone-100">
            <FolderPlus size={18} className="text-amber-500" />
            {editing ? '编辑分类' : '新建分类'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-200">分类名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：英语单词"
              maxLength={30}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:border-stone-700 dark:bg-stone-900"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-200">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选，简要说明该分类的用途"
              rows={2}
              maxLength={200}
              className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-200">上级分类</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-stone-700 dark:bg-stone-900"
            >
              <option value="none">无（作为一级分类）</option>
              {parentOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">排序号</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-stone-700 dark:bg-stone-900"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/15 dark:text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
