import { describe, it, expect, vi } from 'vitest';
import {
  extractHighlightTexts,
  extractHighlightContexts,
  shuffle,
  buildQuizQueue,
  nextUnansweredIndex,
  summarizeResults,
  toUnmasteredItem,
  buildReviewQueue,
} from '@/utils/quiz';

describe('extractHighlightTexts', () => {
  it('提取 .underline 文本并去重、忽略空白', () => {
    const html = `
      <p>苹果是<span class="underline">红色的</span>。</p>
      <p>苹果是<span class="underline">红色的</span>（重复）。</p>
      <p>空<span class="underline">  </span>标签忽略。</p>
      <p>香蕉是<span class="underline">黄色的</span>。</p>
    `;
    const texts = extractHighlightTexts(html);
    expect(texts.sort()).toEqual(['红色的', '黄色的']);
  });

  it('无重点时返回空数组', () => {
    expect(extractHighlightTexts('<p>nothing</p>')).toEqual([]);
  });
});

describe('extractHighlightContexts', () => {
  it('提取完整原句、题干与上一节点主题', () => {
    const html = `
      <h2>第一课 水果</h2>
      <p>苹果是<span class="underline">红色的</span>，并且很甜。</p>
    `;
    const items = extractHighlightContexts(html, 'doc1');
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('红色的');
    // 题干：原句中当前重点被占位符替换
    expect(items[0].prompt).toBe('苹果是____，并且很甜。');
    expect(items[0].sentence).toBe('苹果是红色的，并且很甜。');
    expect(items[0].heading).toBe('第一课 水果');
    expect(items[0].docId).toBe('doc1');
  });

  it('题干只隐藏当前重点，其他重点作为上下文保留', () => {
    const html = `
      <h3>综合句</h3>
      <p>第一个<span class="underline">重点A</span>与第二个<span class="underline">重点B</span>并列。</p>
    `;
    const items = extractHighlightContexts(html, 'doc1');
    expect(items).toHaveLength(2);
    const itemA = items.find((i) => i.text === '重点A')!;
    const itemB = items.find((i) => i.text === '重点B')!;
    expect(itemA.prompt).toBe('第一个____与第二个重点B并列。');
    expect(itemB.prompt).toBe('第一个重点A与第二个____并列。');
  });

  it('无标题时 heading 为空，使用最近的块容器作为原句', () => {
    const html = `
      <div><section>第一段<span class="underline">重点A</span>结尾</section></div>
    `;
    const items = extractHighlightContexts(html, 'doc1');
    expect(items[0].sentence).toBe('第一段重点A结尾');
    expect(items[0].prompt).toBe('第一段____结尾');
    expect(items[0].heading).toBeUndefined();
  });

  it('同一文本去重，只保留第一个出现的上下文', () => {
    const html = `
      <h2>标题</h2>
      <p>第一次<span class="underline">重复词</span>。</p>
      <p>第二次<span class="underline">重复词</span>。</p>
    `;
    const items = extractHighlightContexts(html, 'doc1');
    expect(items).toHaveLength(1);
    expect(items[0].sentence).toBe('第一次重复词。');
    expect(items[0].prompt).toBe('第一次____。');
  });

  it('无重点时返回空数组', () => {
    expect(extractHighlightContexts('<p>nothing</p>', 'doc1')).toEqual([]);
  });
});

describe('shuffle', () => {
  it('洗牌后元素集合不变（不增不减不重复）', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const result = shuffle(input);
    expect([...result].sort()).toEqual([...input].sort());
    expect(result).not.toBe(input); // 返回新数组
  });

  it('空数组与单元素数组稳定', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([1])).toEqual([1]);
  });
});

describe('buildQuizQueue', () => {
  it('构建随机顺序的题目队列并编号', () => {
    const html = '<span class="underline">A</span><span class="underline">B</span><span class="underline">C</span>';
    const queue = buildQuizQueue(html, 'doc1');
    expect(queue).toHaveLength(3);
    expect(queue.every((item) => item.docId === 'doc1')).toBe(true);
    expect(new Set(queue.map((item) => item.text))).toEqual(new Set(['A', 'B', 'C']));
    // ID 绑定提取顺序，洗牌后顺序随机，仅校验集合与唯一性
    expect(new Set(queue.map((item) => item.id))).toEqual(new Set(['doc1-0', 'doc1-1', 'doc1-2']));
    expect(new Set(queue.map((item) => item.id)).size).toBe(3);
  });

  it('maxItems 限制数量', () => {
    const html = '<span class="underline">A</span><span class="underline">B</span><span class="underline">C</span>';
    expect(buildQuizQueue(html, 'doc1', 2)).toHaveLength(2);
    expect(buildQuizQueue(html, 'doc1', 0)).toHaveLength(3);
  });
});

describe('nextUnansweredIndex', () => {
  it('返回下一个未作答索引', () => {
    const answers: boolean[] = [true, undefined, undefined, false];
    expect(nextUnansweredIndex(answers, 0)).toBe(1);
    expect(nextUnansweredIndex(answers, 2)).toBe(2);
  });

  it('全部作答后返回 -1', () => {
    expect(nextUnansweredIndex([true, false, true], 0)).toBe(-1);
  });
});

describe('summarizeResults', () => {
  it('按作答结果分组统计', () => {
    const items = [
      { id: 'a', docId: 'd', text: 'A', prompt: '____A', sentence: '句A' },
      { id: 'b', docId: 'd', text: 'B', prompt: '____B', sentence: '句B' },
      { id: 'c', docId: 'd', text: 'C', prompt: '____C', sentence: '句C' },
    ];
    const answers = [true, false, true];
    const result = summarizeResults(items, answers);
    expect(result.total).toBe(3);
    expect(result.mastered.map((i) => i.text)).toEqual(['A', 'C']);
    expect(result.unmastered.map((i) => i.text)).toEqual(['B']);
  });

  it('空队列', () => {
    const result = summarizeResults([], []);
    expect(result.total).toBe(0);
    expect(result.mastered).toEqual([]);
    expect(result.unmastered).toEqual([]);
  });
});

describe('toUnmasteredItem / buildReviewQueue', () => {
  const item = {
    id: 'd1:重点',
    docId: 'd1',
    text: '重点',
    prompt: '苹果是____。',
    sentence: '苹果是重点。',
    heading: '第一章',
  };

  it('生成清单条目并携带分类标签与时间戳', () => {
    const now = Date.now();
    const u = toUnmasteredItem(item, '文档标题', 'cat1', '生物');
    expect(u.docTitle).toBe('文档标题');
    expect(u.categoryId).toBe('cat1');
    expect(u.categoryName).toBe('生物');
    expect(u.prompt).toBe('苹果是____。');
    expect(u.sentence).toBe('苹果是重点。');
    expect(u.quizzedAt).toBeGreaterThanOrEqual(now);
  });

  it('从清单条目构建复习队列（保留题干/原句/主题）', () => {
    const entry = toUnmasteredItem(item, '文档标题', null, '未分类');
    const queue = buildReviewQueue([entry]);
    expect(queue[0]).toEqual({ id: 'd1:重点', docId: 'd1', text: '重点', prompt: '苹果是____。', sentence: '苹果是重点。', heading: '第一章' });
  });
});

describe('shuffle 随机性（弱校验）', () => {
  it('固定 seed 下仍可用 Math.random mock 验证不崩溃', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = shuffle([1, 2, 3, 4]);
    expect(result).toHaveLength(4);
    vi.restoreAllMocks();
  });
});
