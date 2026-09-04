/**
 * 下载原语：安全文件名生成与浏览器 blob 下载触发。
 * 具体的 HTML / Markdown / PDF 导出编排见 exportService.ts。
 */

/** 生成安全的文件名（去除非法字符） */
export function safeFileName(title: string, fallback: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned || fallback;
}

/** 触发浏览器下载 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
