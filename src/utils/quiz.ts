/**
 * 随机抽背纯逻辑层：负责从文档中提取重点内容、打乱顺序、
 * 维护答题进度与结果统计。不依赖 React，便于单元测试。
 */
import type { UnmasteredItem } from '@/utils/storage';

/** 单个抽背题目 */
export interface QuizItem {
  /** 题目在题目队列中的唯一标识 */
  id: string;
  /** 该题对应的文档 id */
  docId: string;
  /** 重点内容文本（用于展示与“显示答案”） */
  text: string;
  /** 题干：完整原句中当前重点被占位符替换，供用户根据上下文回忆填空 */
  prompt: string;
  /** 重点所在完整原句（段落/列表项文本，用于“没掌握”时辅助记忆） */
  sentence: string;
  /** 上一节点主题（最近标题），可能为空 */
  heading?: string;
}

/** 答题结果 */
export interface QuizResult {
  mastered: QuizItem[];
  unmastered: QuizItem[];
  total: number;
}

/** 句子级容器：视为“一句话/一条”的粒度 */
const SENTENCE_TAGS = /^(P|LI|BLOCKQUOTE|TD|H1|H2|H3|H4|H5|H6)$/i;
/** 块级容器回退标签 */
const BLOCK_TAGS = /^(DIV|SECTION|ARTICLE)$/i;
/** 题干中重点内容的占位符标记，UI 渲染时可据此拆分为占位横线 */
export const QUIZ_PLACEHOLDER = '____';

/**
 * 从 HTML 字符串中提取所有 .underline 元素的文本内容。
 * 返回去重后的文本数组（同一文本可能出现在多处，合并可避免重复出题）。
 */
export function extractHighlightTexts(html: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const nodes = doc.querySelectorAll('.underline');
  const texts: string[] = [];
  const seen = new Set<string>();

  nodes.forEach((node) => {
    const text = (node.textContent ?? '').trim();
    if (!text) return;
    if (seen.has(text)) return;
    seen.add(text);
    texts.push(text);
  });
  return texts;
}

/**
 * 提取所有 .underline 重点内容及其上下文（所在完整原句 + 上一节点主题）。
 * 为每个重点生成题干（prompt）：原句中仅隐藏当前重点，其余保留作回忆上下文。
 * 去重规则与 extractHighlightTexts 一致（按重点文本去重）。
 */
export function extractHighlightContexts(html: string, docId: string): QuizItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const nodes = Array.from(doc.querySelectorAll('.underline'));
  const items: QuizItem[] = [];
  const seen = new Set<string>();

  nodes.forEach((node, index) => {
    const text = (node.textContent ?? '').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);

    const container = getSentenceContainer(node);
    const sentence = (container.textContent ?? '').replace(/\s+/g, ' ').trim();
    const prompt = buildPrompt(container, text);
    const heading = getNearestHeading(node, doc);
    items.push({ id: `${docId}-${index}`, docId, text, prompt, sentence, heading });
  });

  return items;
}

/** 获取重点所在的句子级容器元素（优先最近的句子级容器，其次最近的块容器） */
function getSentenceContainer(node: Element): Element {
  let el: HTMLElement | null = node.parentElement;
  while (el && !SENTENCE_TAGS.test(el.tagName)) {
    el = el.parentElement;
  }
  if (!el) {
    el = node.parentElement;
    while (el && !BLOCK_TAGS.test(el.tagName)) {
      el = el.parentElement;
    }
  }
  return el ?? node;
}

/**
 * 构建题干：克隆句子容器，将文本等于当前重点的 .underline 替换为占位符，
 * 其余内容（含其他重点）原样保留，作为回忆的上下文线索。
 */
function buildPrompt(container: Element, targetText: string): string {
  const clone = container.cloneNode(true) as Element;
  clone.querySelectorAll('.underline').forEach((u) => {
    if ((u.textContent ?? '').trim() === targetText) {
      u.textContent = QUIZ_PLACEHOLDER;
    }
  });
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** 获取重点之前的最近标题（上一节点主题）：先查祖先，再按文档顺序向前查找 */
function getNearestHeading(node: Element, doc: Document): string | undefined {
  let ancestor: HTMLElement | null = node.parentElement;
  while (ancestor) {
    if (/^H[1-6]$/i.test(ancestor.tagName)) {
      return ancestor.textContent?.trim() || undefined;
    }
    ancestor = ancestor.parentElement;
  }

  const headings = Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6'));
  const PRECEDING = Node.DOCUMENT_POSITION_PRECEDING;
  let best: Element | undefined;
  for (const h of headings) {
    // h 出现在 node 之前，取最后一个即为最近的上一主题
    if (node.compareDocumentPosition(h) & PRECEDING) {
      best = h;
    } else {
      break;
    }
  }
  return best?.textContent?.trim() || undefined;
}

/** Fisher–Yates 洗牌（就地，返回新数组），保证随机性可预期 */
export function shuffle<T>(input: readonly T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 构建抽背题目队列：提取重点及其上下文 → 打乱 → 组装 QuizItem。
 * maxItems 可限制出题数量（<=0 表示不限制）。
 */
export function buildQuizQueue(html: string, docId: string, maxItems = 0): QuizItem[] {
  const items = extractHighlightContexts(html, docId);
  const picked = shuffle(items);
  const limited = maxItems > 0 ? picked.slice(0, maxItems) : picked;
  return limited;
}

/**
 * 从 currentIndex 开始（含当前位置）查找下一个未作答的索引；
 * 全部作答后返回 -1。
 */
export function nextUnansweredIndex(answers: boolean[], currentIndex: number): number {
  const n = answers.length;
  if (n === 0) return -1;
  for (let offset = 0; offset < n; offset++) {
    const idx = (currentIndex + offset) % n;
    if (answers[idx] === undefined) return idx;
  }
  return -1;
}

/** 统计答题结果 */
export function summarizeResults(items: QuizItem[], answers: boolean[]): QuizResult {
  const mastered: QuizItem[] = [];
  const unmastered: QuizItem[] = [];
  items.forEach((item, index) => {
    if (answers[index]) {
      mastered.push(item);
    } else {
      unmastered.push(item);
    }
  });
  return { mastered, unmastered, total: items.length };
}

/**
 * 从抽背题目生成没掌握清单条目。
 * 携带完整原句、题干、主题、分类标签与抽背时间，供清单展示与针对性复习。
 */
export function toUnmasteredItem(
  item: QuizItem,
  docTitle: string,
  categoryId: string | null,
  categoryName: string
): UnmasteredItem {
  return {
    id: `${item.docId}:${item.text}`,
    docId: item.docId,
    docTitle,
    text: item.text,
    prompt: item.prompt,
    sentence: item.sentence,
    heading: item.heading,
    categoryId,
    categoryName,
    quizzedAt: Date.now(),
  };
}

/** 从没掌握清单条目构建针对性复习队列 */
export function buildReviewQueue(items: UnmasteredItem[]): QuizItem[] {
  return items.map((item) => ({
    id: item.id,
    docId: item.docId,
    text: item.text,
    prompt: item.prompt,
    sentence: item.sentence,
    heading: item.heading,
  }));
}
