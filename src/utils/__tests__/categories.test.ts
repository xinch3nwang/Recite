import { describe, it, expect } from 'vitest';
import type { ReciteCategory } from '@/utils/storage';
import {
  buildCategoryTree,
  getCategorySubtreeIds,
  getChildCategoryIds,
  getCategoryById,
  wouldCreateCycle,
  validateCategoryName,
  validateCategoryDescription,
  nextSortOrder,
} from '@/utils/categories';

function makeCat(id: string, name: string, parentId: string | null, sortOrder = 0): ReciteCategory {
  return { id, name, description: '', parentId, sortOrder, createdAt: 0 };
}

describe('buildCategoryTree', () => {
  it('构建多级树，父级缺失的节点归为顶层', () => {
    const cats = [
      makeCat('a', 'A', null, 1),
      makeCat('b', 'B', null, 0),
      makeCat('c', 'C', 'a', 0),
      makeCat('d', 'D', 'c', 0),
    ];
    const tree = buildCategoryTree(cats);
    expect(tree.map((n) => n.id)).toEqual(['b', 'a']); // 按 sortOrder 排序
    expect(tree[1].children.map((n) => n.id)).toEqual(['c']);
    expect(tree[1].children[0].children.map((n) => n.id)).toEqual(['d']);
  });

  it('空列表返回空树', () => {
    expect(buildCategoryTree([])).toEqual([]);
  });

  it('循环引用（互为父子）时不会抛错且不产生无限递归', () => {
    const cats = [makeCat('a', 'A', 'b'), makeCat('b', 'B', 'a')];
    // 双方互指导致没有根节点，返回空树；重点是构建过程稳定不崩溃
    expect(() => buildCategoryTree(cats)).not.toThrow();
    expect(buildCategoryTree(cats)).toHaveLength(0);
  });
});

describe('getCategorySubtreeIds', () => {
  it('返回自身及所有后代 id', () => {
    const cats = [
      makeCat('a', 'A', null),
      makeCat('b', 'B', 'a'),
      makeCat('c', 'C', 'b'),
      makeCat('d', 'D', null),
    ];
    const ids = getCategorySubtreeIds(cats, 'a');
    expect(ids.sort()).toEqual(['a', 'b', 'c']);
  });

  it('无后代时只返回自身', () => {
    expect(getCategorySubtreeIds([makeCat('a', 'A', null)], 'a')).toEqual(['a']);
  });
});

describe('getChildCategoryIds', () => {
  it('返回直接子分类 id', () => {
    const cats = [
      makeCat('a', 'A', null),
      makeCat('b', 'B', 'a'),
      makeCat('c', 'C', 'a'),
      makeCat('d', 'D', 'b'),
    ];
    expect(getChildCategoryIds(cats, 'a').sort()).toEqual(['b', 'c']);
  });
});

describe('getCategoryById', () => {
  it('按 id 查找分类', () => {
    const cats = [makeCat('a', 'A', null)];
    expect(getCategoryById(cats, 'a')?.name).toBe('A');
    expect(getCategoryById(cats, null)).toBeNull();
    expect(getCategoryById(cats, 'zz')).toBeNull();
  });
});

describe('wouldCreateCycle', () => {
  it('移动到自身或其后代会产生循环', () => {
    const cats = [makeCat('a', 'A', null), makeCat('b', 'B', 'a'), makeCat('c', 'C', 'b')];
    expect(wouldCreateCycle(cats, 'a', 'a')).toBe(true);
    expect(wouldCreateCycle(cats, 'a', 'b')).toBe(true);
    expect(wouldCreateCycle(cats, 'a', 'c')).toBe(true);
    expect(wouldCreateCycle(cats, 'b', 'a')).toBe(false);
    expect(wouldCreateCycle(cats, 'a', null)).toBe(false);
  });
});

describe('validateCategoryName', () => {
  it('拒绝空名与超长名称', () => {
    expect(validateCategoryName('  ')).not.toBeNull();
    expect(validateCategoryName('')).not.toBeNull();
    expect(validateCategoryName('x'.repeat(31))).not.toBeNull();
    expect(validateCategoryName('英语')).toBeNull();
    expect(validateCategoryName('x'.repeat(30))).toBeNull();
  });
});

describe('validateCategoryDescription', () => {
  it('拒绝超长描述', () => {
    expect(validateCategoryDescription('x'.repeat(201))).not.toBeNull();
    expect(validateCategoryDescription('ok')).toBeNull();
  });
});

describe('nextSortOrder', () => {
  it('返回最大排序号 + 1', () => {
    const cats = [makeCat('a', 'A', null, 3), makeCat('b', 'B', null, 7)];
    expect(nextSortOrder(cats)).toBe(8);
    expect(nextSortOrder([])).toBe(0);
  });
});
