/**
 * 分类树纯逻辑层：负责分类树构建、子分类聚合、删除策略与输入校验。
 * 本模块不依赖 DOM 与存储，便于单元测试与复用。
 */

import type { ReciteCategory } from '@/utils/storage';

/** 带 children 的树节点 */
export interface CategoryNode extends ReciteCategory {
  children: CategoryNode[];
}

/**
 * 将扁平分类列表构建为树形结构（按 sortOrder 升序）。
 * 无父级或父级缺失的节点归为顶层。
 */
export function buildCategoryTree(categories: ReciteCategory[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  // 先建节点，保持引用一致
  categories.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [] });
  });

  const roots: CategoryNode[] = [];
  const sorted = [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder);

  sorted.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      const parent = map.get(node.parentId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

/**
 * 获取某分类自身及其所有后代分类 id（含自身）。
 * 用于“选中父分类时同时展示子分类文档”。
 */
export function getCategorySubtreeIds(categories: ReciteCategory[], id: string): string[] {
  const result: string[] = [id];
  const childIds = categories
    .filter((cat) => cat.parentId === id)
    .map((cat) => cat.id);

  childIds.forEach((childId) => {
    result.push(...getCategorySubtreeIds(categories, childId));
  });
  return result;
}

/**
 * 获取某分类的所有直接子分类 id（不含自身）。
 * 用于删除策略与树展开控制。
 */
export function getChildCategoryIds(categories: ReciteCategory[], id: string): string[] {
  return categories.filter((cat) => cat.parentId === id).map((cat) => cat.id);
}

/** 从分类 id 反查分类对象 */
export function getCategoryById(categories: ReciteCategory[], id: string | null): ReciteCategory | null {
  if (!id) return null;
  return categories.find((cat) => cat.id === id) ?? null;
}

/** 判断 parentId 是否会引起循环引用（不能把分类移动到自身或其后代下） */
export function wouldCreateCycle(
  categories: ReciteCategory[],
  targetId: string,
  newParentId: string | null
): boolean {
  if (newParentId === null || newParentId === targetId) return newParentId === targetId;
  return getCategorySubtreeIds(categories, targetId).includes(newParentId);
}

/** 校验分类名称：非空且长度不超过 30 字符，返回错误信息或 null */
export function validateCategoryName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return '分类名称不能为空';
  if (trimmed.length > 30) return '分类名称不能超过 30 个字符';
  return null;
}

/** 校验分类描述：长度不超过 200 字符，返回错误信息或 null */
export function validateCategoryDescription(description: string): string | null {
  if (description.length > 200) return '描述不能超过 200 个字符';
  return null;
}

/** 生成下一个可用排序号（max + 1） */
export function nextSortOrder(categories: ReciteCategory[]): number {
  return categories.reduce((max, cat) => Math.max(max, cat.sortOrder), -1) + 1;
}
