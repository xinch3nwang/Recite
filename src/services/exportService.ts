/**
 * 导出编排服务：把选中文档导出为 HTML / Markdown / PDF。
 * - 思维导图文档（图数据为独立 JSON）跳过并计数提示；
 * - 单篇直接下载单文件，多篇打 zip；无可导出内容时不触发下载；
 * - 单篇失败不影响其余文档。
 */
import JSZip from 'jszip';
import { getDocument } from '@/utils/storage';
import { parseHtmlToOutline } from '@/utils/outline';
import { outlineToMarkdown } from '@/utils/markdownSerializer';
import { buildExportHtml } from '@/utils/exportHtml';
import { renderDocumentToPdfBlob } from '@/services/pdfExport';
import { safeFileName, triggerDownload } from '@/services/downloadService';

export type ExportFormat = 'html' | 'markdown' | 'pdf';

/** 导出产物：文件名（含扩展名）+ 内容 blob */
export interface ExportFile {
  fileName: string;
  blob: Blob;
}

/** 导出统计结果 */
export interface ExportResult {
  /** 成功导出篇数 */
  exportedCount: number;
  /** 跳过的思维导图篇数 */
  skippedMindmapCount: number;
  /** 读取失败或生成异常篇数 */
  failedCount: number;
}

/** 各格式的展示名（用于 zip 文件名与日志） */
const FORMAT_LABEL: Record<ExportFormat, string> = {
  html: 'HTML',
  markdown: 'Markdown',
  pdf: 'PDF',
};

/**
 * 纯函数：zip 内文件重名去重，重名追加序号（扩展名前），
 * 如 A.html → A (2).html → A (3).html。
 */
export function dedupeFileNames(files: ExportFile[]): ExportFile[] {
  const used = new Set<string>();
  return files.map((file) => {
    if (!used.has(file.fileName.toLowerCase())) {
      used.add(file.fileName.toLowerCase());
      return file;
    }
    const dotIdx = file.fileName.lastIndexOf('.');
    const base = dotIdx > 0 ? file.fileName.slice(0, dotIdx) : file.fileName;
    const ext = dotIdx > 0 ? file.fileName.slice(dotIdx) : '';
    let serial = 2;
    let candidate = `${base} (${serial})${ext}`;
    while (used.has(candidate.toLowerCase())) {
      serial += 1;
      candidate = `${base} (${serial})${ext}`;
    }
    used.add(candidate.toLowerCase());
    return { ...file, fileName: candidate };
  });
}

/** 按格式把单个文档转换为导出产物 */
async function buildExportFile(
  docId: string,
  title: string,
  content: string,
  format: ExportFormat
): Promise<ExportFile> {
  const safeTitle = safeFileName(title, '文档');
  switch (format) {
    case 'html':
      return {
        fileName: `${safeTitle}.html`,
        blob: new Blob([buildExportHtml(title, content)], { type: 'text/html;charset=utf-8' }),
      };
    case 'markdown': {
      const md = outlineToMarkdown(parseHtmlToOutline(content || ''), title);
      return {
        fileName: `${safeTitle}.md`,
        blob: new Blob([md], { type: 'text/markdown;charset=utf-8' }),
      };
    }
    case 'pdf':
      return {
        fileName: `${safeTitle}.pdf`,
        blob: await renderDocumentToPdfBlob(title, content),
      };
  }
}

/**
 * 批量导出文档：
 * @param ids 选中文档 id 列表
 * @param format 导出格式
 * @param onProgress 可选进度回调（done / total，仅统计已处理篇数）
 */
export async function exportDocuments(
  ids: string[],
  format: ExportFormat,
  onProgress?: (done: number, total: number) => void
): Promise<ExportResult> {
  const result: ExportResult = { exportedCount: 0, skippedMindmapCount: 0, failedCount: 0 };
  const files: ExportFile[] = [];
  const total = ids.length;
  let done = 0;

  for (const id of ids) {
    try {
      const doc = getDocument(id);
      if (!doc) {
        result.failedCount += 1;
      } else if (doc.type === 'mindmap') {
        result.skippedMindmapCount += 1;
      } else {
        files.push(await buildExportFile(id, doc.title, doc.content, format));
        result.exportedCount += 1;
      }
    } catch {
      result.failedCount += 1;
    }
    done += 1;
    onProgress?.(done, total);
  }

  if (result.exportedCount === 1) {
    // 单篇：直接下载单文件
    triggerDownload(files[0].blob, files[0].fileName);
  } else if (result.exportedCount > 1) {
    // 多篇：打 zip（重名去重）
    const zip = new JSZip();
    dedupeFileNames(files).forEach((file) => zip.file(file.fileName, file.blob));
    const blob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(blob, `忆读-导出-${FORMAT_LABEL[format]}-${Date.now()}.zip`);
  }
  // exportedCount === 0：不下载任何内容

  return result;
}
