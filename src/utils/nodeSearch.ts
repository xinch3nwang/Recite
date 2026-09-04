/**
 * 节点级全文检索纯逻辑层。
 *
 * 基于大纲树（OutlineDoc）遍历每个节点，按关键词（大小写不敏感、包含匹配）
 * 收集所有命中节点及其层级路径，供全局搜索页展示「命中的节点内容」。
 * 不依赖存储与 React，便于单元测试。
 */

import type { OutlineDoc, OutlineNode } from '@/utils/outline';

/** 单个命中的节点 */
export interface MatchingNode {
  /** 节点纯文本（去除标签，保留 .underline 等重点内容文字） */
  text: string;
  /** 祖先链文本（不含自身，自顶向下），用于展示层级路径 */
  path: string[];
  /** 深度（顶层节点为 0） */
  depth: number;
}

/** 层级路径单项的最大长度（超出截断加省略号） */
const MAX_PATH_SEGMENT_LEN = 24;

/** 将节点内部 HTML 转为纯文本（压缩空白） */
function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * 遍历大纲树，返回所有文本命中关键词的节点。
 * 顶层节点逐个遍历；命中节点的 path 记录其各级祖先的文本（截断）。
 */
export function collectMatchingNodes(doc: OutlineDoc, keyword: string): MatchingNode[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return [];
  const results: MatchingNode[] = [];

  const visit = (node: OutlineNode, ancestors: string[]): void => {
    const text = stripHtml(node.html);
    if (text && text.toLowerCase().includes(kw)) {
      results.push({ text, path: ancestors, depth: ancestors.length });
    }
    const next = text
      ? [
          ...ancestors,
          text.length > MAX_PATH_SEGMENT_LEN ? `${text.slice(0, MAX_PATH_SEGMENT_LEN)}…` : text,
        ]
      : ancestors;
    node.children.forEach((child) => visit(child, next));
  };

  doc.nodes.forEach((node) => visit(node, []));
  return results;
}
