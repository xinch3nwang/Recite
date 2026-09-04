import { describe, it, expect } from 'vitest';
import {
  computePdfPageLayout,
  PDF_PAGE_WIDTH_PT,
  PDF_PAGE_HEIGHT_PT,
  PDF_MARGIN_PT,
} from '@/services/pdfExport';

describe('computePdfPageLayout', () => {
  /** 期望的每页内容区像素高（按内容区宽/高与 canvas 宽度等比换算） */
  function expectedPageContentHeightPx(canvasWidth: number): number {
    const contentW = PDF_PAGE_WIDTH_PT - PDF_MARGIN_PT * 2;
    const contentH = PDF_PAGE_HEIGHT_PT - PDF_MARGIN_PT * 2;
    return Math.floor(contentH * (canvasWidth / contentW));
  }

  it('内容不足一页时输出单页', () => {
    const layout = computePdfPageLayout(794, 1000);
    expect(layout.pageCount).toBe(1);
    expect(layout.pxPerPt).toBeCloseTo(794 / (PDF_PAGE_WIDTH_PT - PDF_MARGIN_PT * 2));
  });

  it('整除高度时页数正确', () => {
    // scale=2 → canvas 宽 1588，每页内容区 ≈ 2303px
    const layout = computePdfPageLayout(1588, 4000);
    expect(layout.pageContentHeightPx).toBe(expectedPageContentHeightPx(1588));
    expect(layout.pageCount).toBe(2);
  });

  it('有余数高度时向上取整', () => {
    const layout = computePdfPageLayout(1588, 4100);
    expect(layout.pageCount).toBe(2);
  });

  it('超长文档页数递增', () => {
    const layout = computePdfPageLayout(1588, 12000);
    const perPage = expectedPageContentHeightPx(1588);
    expect(layout.pageCount).toBe(Math.ceil(12000 / perPage));
  });

  it('零高度至少输出一页', () => {
    const layout = computePdfPageLayout(794, 0);
    expect(layout.pageCount).toBe(1);
  });
});
