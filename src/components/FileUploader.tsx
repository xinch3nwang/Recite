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
    const validTypes = ['text/html', 'application/xhtml+xml'];
    const validExtensions = ['.html', '.htm'];
    const hasValidType = validTypes.includes(file.type);
    const hasValidExtension = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    return hasValidType || hasValidExtension;
  };

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (!validateFile(file)) {
        setError('请选择 .html 或 .htm 格式的文件');
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
          'bg-white/60 px-8 py-14 text-center transition-all duration-300',
          'hover:border-amber-500 hover:bg-white hover:shadow-lg',
          isDragging ? 'border-amber-500 bg-amber-50 shadow-lg' : 'border-stone-300',
        ].join(' ')}
      >
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 transition-transform duration-300 group-hover:scale-110">
          <Upload size={28} strokeWidth={1.8} />
        </div>
        <h3 className="mb-2 text-lg font-medium text-stone-800">点击或拖拽上传 HTML 文档</h3>
        <p className="mb-4 text-sm text-stone-500">支持 .html、.htm 格式</p>
        <div className="flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-xs text-stone-600">
          <FileText size={14} />
          <span>选择文件</span>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".html,.htm"
        onChange={handleChange}
        className="hidden"
      />
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
