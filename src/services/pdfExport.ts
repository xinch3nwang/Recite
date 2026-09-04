/**
 * PDF 导出：离屏渲染文档 HTML → html2canvas 截图 → jsPDF 分页组装。
 * 采用截图式保证格式 100% 保持（颜色/下划线/高亮/嵌套列表），
 * 文字以位图嵌入（Android WebView 无系统打印，必须客户端生成）。
 *
 * 分页布局计算拆为纯函数 computePdfPageLayout，便于单元测试；
 * jsPDF / html2canvas 动态加载，不拖累首屏包体。
 */
import { EXPORT_CSS } from '@/utils/exportStyles';
import { sanitizeHtml } from '@/utils/sanitizeHtml';

/** A4 纵向页面尺寸（pt） */
export const PDF_PAGE_WIDTH_PT = 595.28;
export const PDF_PAGE_HEIGHT_PT = 841.89;
/** 页面四周边距（pt） */
export const PDF_MARGIN_PT = 24;
/** Android WebView canvas 高度保守上限（px），超长文档自动降低截图倍率 */
export const MAX_CANVAS_HEIGHT_PX = 16000;

/** 分页布局计算结果 */
export interface PdfPageLayout {
  /** canvas 像素 / PDF 磅 的比例 */
  pxPerPt: number;
  /** 每页内容区对应的 canvas 像素高 */
  pageContentHeightPx: number;
  /** 总页数（至少 1 页） */
  pageCount: number;
}

/**
 * 纯函数：根据 canvas 尺寸计算 A4 分页布局。
 * canvas 整幅宽度铺满 PDF 内容区宽（页宽 - 2×边距），纵向按同一比例换算。
 */
export function computePdfPageLayout(
  canvasWidthPx: number,
  canvasHeightPx: number
): PdfPageLayout {
  const contentWidthPt = PDF_PAGE_WIDTH_PT - PDF_MARGIN_PT * 2;
  const contentHeightPt = PDF_PAGE_HEIGHT_PT - PDF_MARGIN_PT * 2;
  const pxPerPt = canvasWidthPx / contentWidthPt;
  const pageContentHeightPx = Math.floor(contentHeightPt * pxPerPt);
  const pageCount = Math.max(1, Math.ceil(canvasHeightPx / pageContentHeightPx));
  return { pxPerPt, pageContentHeightPx, pageCount };
}

/** 双重 requestAnimationFrame：确保离屏 DOM 完成布局与绘制 */
function nextPaintFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** 等待字体就绪（中文衬线字体首次渲染）；字体 API 不可用时忽略 */
async function waitForFonts(): Promise<void> {
  try {
    await document.fonts.ready;
  } catch {
    // 忽略字体 API 异常
  }
}

/**
 * 把文档渲染为分页 PDF Blob。
 * 单篇文档独立成 PDF；异常由调用方（exportService）捕获统计。
 */
export async function renderDocumentToPdfBlob(title: string, content: string): Promise<Blob> {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const html2canvas = html2canvasModule.default;

  // 离屏容器：fixed 移出视口但保留渲染树（display:none 会导致 html2canvas 失败）
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = '794px'; // A4 宽度 210mm ≈ 794px @96dpi
  host.style.zIndex = '-1';
  host.style.background = '#F9F7F2';
  host.innerHTML = `<style>${EXPORT_CSS}</style><article class="recite-document-content">${sanitizeHtml(content)}</article>`;
  document.body.appendChild(host);

  try {
    const article = host.querySelector('.recite-document-content') as HTMLElement;
    await Promise.all([nextPaintFrame(), waitForFonts()]);

    // 截图倍率：目标 2x，超长文档按 canvas 高度上限自适应降倍率
    const cssHeight = Math.max(article.scrollHeight, 1);
    const scale = Math.min(2, MAX_CANVAS_HEIGHT_PX / cssHeight);
    const canvas = await html2canvas(article, {
      scale,
      backgroundColor: '#F9F7F2',
      logging: false,
      useCORS: true,
    });

    const layout = computePdfPageLayout(canvas.width, canvas.height);
    const contentWidthPt = PDF_PAGE_WIDTH_PT - PDF_MARGIN_PT * 2;
    const contentHeightPt = PDF_PAGE_HEIGHT_PT - PDF_MARGIN_PT * 2;

    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });

    for (let page = 0; page < layout.pageCount; page += 1) {
      if (page > 0) pdf.addPage();

      const offsetPx = page * layout.pageContentHeightPx;
      const sliceHeightPx = Math.min(
        layout.pageContentHeightPx,
        canvas.height - offsetPx
      );
      const sliceHeightPt = sliceHeightPx / layout.pxPerPt;

      // 每页切片：先铺米色底（JPEG 无透明通道，防止黑底），再按偏移绘制
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceHeightPx;
      const ctx = slice.getContext('2d');
      if (!ctx) throw new Error('PDF 导出失败：无法创建画布上下文');
      ctx.fillStyle = '#F9F7F2';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, -offsetPx);

      const dataUrl = slice.toDataURL('image/jpeg', 0.92);
      pdf.addImage(
        dataUrl,
        'JPEG',
        PDF_MARGIN_PT,
        PDF_MARGIN_PT,
        contentWidthPt,
        sliceHeightPt,
        undefined,
        'FAST'
      );
    }

    return pdf.output('blob');
  } finally {
    host.remove();
  }
}
