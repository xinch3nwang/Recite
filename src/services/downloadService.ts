/**
 * 下载服务：单个文档下载与批量打包下载（zip）。
 * 依赖 jszip 实现多文档打包，产物为浏览器 blob 下载。
 */

import JSZip from 'jszip';
import { getDocument, type ReciteDocument } from '@/utils/storage';

/** 生成安全的文件名（去除非法字符） */
export function safeFileName(title: string, fallback: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned || fallback;
}

/** 触发浏览器下载 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** 下载单个文档（.html） */
export function downloadDocument(id: string): void {
  const doc = getDocument(id);
  if (!doc) return;
  const blob = new Blob([doc.content], { type: 'text/html;charset=utf-8' });
  triggerDownload(blob, `${safeFileName(doc.title, 'document')}.html`);
}

/** 批量打包下载为 zip（忽略无法读取的文档） */
export async function downloadDocumentsAsZip(ids: string[]): Promise<number> {
  const zip = new JSZip();
  let downloaded = 0;

  for (const id of ids) {
    const doc: ReciteDocument | null = getDocument(id);
    if (!doc) continue;
    zip.file(`${safeFileName(doc.title, 'document')}.html`, doc.content);
    downloaded += 1;
  }

  if (downloaded === 0) return 0;
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(blob, `忆读-文档打包-${Date.now()}.zip`);
  return downloaded;
}
