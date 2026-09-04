import { useRef, useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
}

export function FileUploader({ onFileSelect }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): boolean => {
    const validTypes = ['text/html', 'application/xhtml+xml', 'text/markdown'];
    const validExtensions = ['.html', '.htm', '.md', '.markdown'];
    const hasValidType = validTypes.includes(file.type);
    const hasValidExtension = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    return hasValidType || hasValidExtension;
  };

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (!validateFile(file)) {
        setError('请选择 .html、.htm 或 .md 格式的文件');
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={[
          'group relative flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed',
          'bg-white/60 px-6 py-7 text-center transition-all duration-300',
          'hover:border-amber-500 hover:bg-white hover:shadow-lg',
          isDragging ? 'border-amber-500 bg-amber-50 shadow-lg' : 'border-stone-300',
          'dark:bg-stone-900/60 dark:hover:bg-stone-800',
          isDragging ? 'dark:bg-amber-500/15' : 'dark:border-stone-700',
        ].join(' ')}
      >
        <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 transition-transform duration-300 group-hover:scale-110 dark:bg-amber-500/20 dark:text-amber-400">
          <Upload size={22} strokeWidth={1.8} />
        </div>
        <h3 className="mb-1 text-base font-medium text-stone-800 dark:text-stone-100">点击或拖拽上传文档</h3>
        <p className="mb-2.5 text-xs text-stone-500 dark:text-stone-400">支持 .html、.htm、.md 格式</p>
        <div className="flex items-center gap-1.5 rounded-full bg-stone-100 px-3.5 py-1.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">
          <FileText size={13} />
          <span>选择文件</span>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".html,.htm,.md,.markdown"
        onChange={handleChange}
        className="hidden"
      />
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/15 dark:text-red-400">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
