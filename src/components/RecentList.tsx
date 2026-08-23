import { Clock, Trash2, ChevronRight } from 'lucide-react';
import type { RecentDocument } from '@/utils/storage';

interface RecentListProps {
  documents: RecentDocument[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

function formatLastRead(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN');
}

export function RecentList({ documents, onSelect, onRemove }: RecentListProps) {
  if (documents.length === 0) {
    return (
      <div className="rounded-xl bg-stone-100/50 px-6 py-10 text-center text-sm text-stone-500">
        暂无阅读记录，上传文档开始阅读
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="group flex items-center justify-between rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
        >
          <button
            type="button"
            onClick={() => onSelect(doc.id)}
            className="flex flex-1 items-center gap-4 text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock size={18} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-sm font-medium text-stone-800">{doc.title}</h4>
              <div className="mt-1 flex items-center gap-3 text-xs text-stone-500">
                <span>{formatLastRead(doc.lastReadAt)}</span>
                <span className="flex items-center gap-1">
                  进度
                  <span className="font-medium text-amber-600">{Math.round(doc.progressPercent)}%</span>
                </span>
              </div>
            </div>
            <ChevronRight size={18} className="text-stone-300 transition-colors group-hover:text-amber-500" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(doc.id);
            }}
            className="ml-3 flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
            aria-label="删除记录"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
