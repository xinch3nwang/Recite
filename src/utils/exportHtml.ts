/**
 * HTML 导出：把文档正文包装为自包含的单文件 HTML（内嵌导出样式，无脚本）。
 * 导出用途为备份/迁移/分享，重点下划线等标记内容全部直接可见。
 */
import { sanitizeHtml } from '@/utils/sanitizeHtml';
import { EXPORT_CSS } from '@/utils/exportStyles';

/** 转义 HTML 特殊字符（仅用于 <title> 等纯文本位置） */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 生成自包含的导出 HTML 文档 */
export function buildExportHtml(title: string, content: string): string {
  const safeTitle = escapeHtml(title || '未命名文档');
  const safeContent = sanitizeHtml(content);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<style>
${EXPORT_CSS}
</style>
</head>
<body>
<article class="recite-document-content">
${safeContent}
</article>
</body>
</html>
`;
}
