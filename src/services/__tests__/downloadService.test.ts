import { describe, it, expect } from 'vitest';
import { safeFileName } from '@/services/downloadService';

describe('safeFileName', () => {
  it('去除非法字符', () => {
    const result = safeFileName('a/b:c*?"<>|', 'x');
    expect(result.startsWith('a_b_c')).toBe(true);
    // 结果中不应再包含任何非法字符
    expect(result).not.toMatch(/[\\/:*?"<>|]/);
  });

  it('空标题使用回退名', () => {
    expect(safeFileName('   ', 'fallback')).toBe('fallback');
    expect(safeFileName('', 'fallback')).toBe('fallback');
  });

  it('合法标题原样保留', () => {
    expect(safeFileName('英语单词', 'x')).toBe('英语单词');
  });
});
