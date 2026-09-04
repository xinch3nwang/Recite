import { describe, it, expect } from 'vitest';
import {
  parseHtmlToOutline,
  serializeOutline,
  createOutlineNode,
  createNodeLike,
  countNodes,
  updateNodeHtml,
  updateNodeNote,
  ensureNodeNote,
  removeNode,
  addChild,
  addSibling,
  indentNode,
  outdentNode,
  moveNode,
  type OutlineDoc,
  type OutlineNode,
} from '@/utils/outline';

/** 基于真实幕布导出结构的样例 */
const MUBU = [
  '<div class="title">1 求是前期</div>',
  '<ul class="node-list">',
  '<li class="node">',
  '<div class="bullet"><div class="bullet-dot"></div></div>',
  '<div class="content mm-editor" ><span>4.16 推动全民阅读，建设书香社会<span class="underline">重点</span></span></div>',
  '<div class="children"><ul class="node-list">',
  '<li class="node"><div class="bullet"><div class="bullet-dot"></div></div><div class="content mm-editor" ><span>要建设全民终身学习的学习型社会、学习型大国</span></div></li>',
  '</ul></div>',
  '</li>',
  '<li class="node collapsed">',
  '<div class="bullet"><div class="bullet-dot"></div></div>',
  '<div class="content mm-editor" ><span>3.31 树立和践行正确政绩观</span></div>',
  '<div class="note mm-editor"><span>管党治党越有效 经济社会发展的保障就越有力</span></div>',
  '</li>',
  '</ul>',
].join('');

function mubuDoc(): OutlineDoc {
  return parseHtmlToOutline(MUBU);
}

describe('解析：结构保持式树模型', () => {
  it('解析标题 div 为 titleHtml，顶层列表为根节点', () => {
    const doc = mubuDoc();
    expect(doc.titleHtml).toBe('1 求是前期');
    expect(doc.nodes).toHaveLength(2);
  });

  it('内容取自 .content.mm-editor，原样保留内部标记', () => {
    const doc = mubuDoc();
    expect(doc.nodes[0].html).toBe(
      '<span>4.16 推动全民阅读，建设书香社会<span class="underline">重点</span></span>'
    );
  });

  it('嵌套 .children > ul.node-list 解析为子节点', () => {
    const doc = mubuDoc();
    expect(doc.nodes[0].children).toHaveLength(1);
    expect(doc.nodes[0].children[0].html).toBe(
      '<span>要建设全民终身学习的学习型社会、学习型大国</span>'
    );
    expect(doc.nodes[1].children).toHaveLength(0);
  });

  it('保留 li class 与 note 备注', () => {
    const doc = mubuDoc();
    expect(doc.nodes[1].liClass).toBe('node collapsed');
    expect(doc.nodes[1].note).toBe('<span>管党治党越有效 经济社会发展的保障就越有力</span>');
  });

  it('通用块（h1/p）按原始标签解析，无标题 div', () => {
    const doc = parseHtmlToOutline(
      '<h1>中国历史朝代</h1><p>第一个朝代是<span class="underline">夏朝</span>，由禹建立。</p>'
    );
    expect(doc.titleHtml).toBeNull();
    expect(doc.nodes[0]).toMatchObject({ tag: 'h1', html: '中国历史朝代', children: [] });
    expect(doc.nodes[1]).toMatchObject({ tag: 'p' });
    expect(doc.nodes[1].html).toContain('<span class="underline">夏朝</span>');
  });
});

describe('序列化：逐字还原原始结构', () => {
  it('Mubu roundtrip：保留 li.node/bullet/content/children/ul.node-list', () => {
    const doc = mubuDoc();
    const html = serializeOutline(doc);
    expect(html).toContain('<div class="title">1 求是前期</div>');
    expect(html).toContain('<ul class="node-list">');
    expect(html).toContain('<li class="node">');
    expect(html).toContain('<div class="bullet">');
    expect(html).toContain('<div class="bullet-dot"></div>');
    expect(html).toContain('<div class="content mm-editor">');
    expect(html).toContain('<div class="children"><ul class="node-list">');
    expect(html).toContain('<li class="node collapsed">');
    expect(html).toContain('<div class="note mm-editor">');
    expect(html).toContain('<span class="underline">重点</span>');
  });

  it('通用块 roundtrip：按原标签输出', () => {
    const doc = parseHtmlToOutline('<h1>中国历史朝代</h1><p>正文<span class="underline">夏朝</span>。</p>');
    expect(serializeOutline(doc)).toBe(
      '<h1>中国历史朝代</h1><p>正文<span class="underline">夏朝</span>。</p>'
    );
  });

  it('编辑文本后序列化，结构保持不变', () => {
    const doc = mubuDoc();
    const edited = updateNodeHtml(doc.nodes, doc.nodes[0].id, '<span>4.16 阅读推广（已改）</span>');
    const html = serializeOutline({ ...doc, nodes: edited });
    expect(html).toContain('<div class="content mm-editor"><span>4.16 阅读推广（已改）</span></div>');
    expect(html).toContain('<li class="node">');
    expect(html).toContain('<div class="children"><ul class="node-list">');
  });
});

describe('树操作', () => {
  it('countNodes 统计含嵌套总数', () => {
    expect(countNodes(mubuDoc().nodes)).toBe(3);
  });

  it('addChild 追加子节点', () => {
    const doc = mubuDoc();
    const next = addChild(doc.nodes, doc.nodes[0].id, createOutlineNode('<span>新子节点</span>'));
    expect(next[0].children).toHaveLength(2);
    expect(countNodes(next)).toBe(4);
  });

  it('addSibling 在同层插入', () => {
    const doc = mubuDoc();
    const next = addSibling(doc.nodes, doc.nodes[0].id, createOutlineNode('<span>新同级</span>'));
    expect(next).toHaveLength(3);
    expect(next[1].html).toBe('<span>新同级</span>');

    // 嵌套层级的 addSibling
    const childId = doc.nodes[0].children[0].id;
    const next2 = addSibling(doc.nodes, childId, createOutlineNode('<span>子级同级</span>'));
    expect(next2[0].children).toHaveLength(2);
  });

  it('removeNode 删除子树', () => {
    const doc = mubuDoc();
    const next = removeNode(doc.nodes, doc.nodes[0].id);
    expect(next).toHaveLength(1);
    expect(countNodes(next)).toBe(1);
  });

  it('updateNodeHtml / updateNodeNote 仅更新目标', () => {
    const doc = mubuDoc();
    const childId = doc.nodes[0].children[0].id;
    const nextHtml = updateNodeHtml(doc.nodes, childId, '<span>改后</span>');
    expect(nextHtml[0].children[0].html).toBe('<span>改后</span>');
    expect(nextHtml[0].html).toBe(doc.nodes[0].html);

    const nextNote = updateNodeNote(doc.nodes, doc.nodes[1].id, '<span>新备注</span>');
    expect(nextNote[1].note).toBe('<span>新备注</span>');
    expect(nextNote[1].html).toBe(doc.nodes[1].html);
  });

  it('ensureNodeNote 为无解释节点添加空解释（进入编辑态），已有则保持不变', () => {
    const doc = mubuDoc();
    // 节点0无 note → 初始化为空串
    const added = ensureNodeNote(doc.nodes, doc.nodes[0].id);
    expect(added[0].note).toBe('');
    expect(added[0].html).toBe(doc.nodes[0].html);
    // 已有 note 的节点保持不变
    const unchanged = ensureNodeNote(doc.nodes, doc.nodes[1].id);
    expect(unchanged[1].note).toBe(doc.nodes[1].note);
    // 不影响其他节点
    expect(added[1].note).toBe(doc.nodes[1].note);
  });

  it('ensureNodeNote 支持深层节点', () => {
    const doc = mubuDoc();
    const childId = doc.nodes[0].children[0].id;
    const next = ensureNodeNote(doc.nodes, childId);
    expect(next[0].children[0].note).toBe('');
  });

  it('indentNode 提升为前一兄弟的子节点', () => {
    const doc = mubuDoc();
    const next = indentNode(doc.nodes, doc.nodes[1].id);
    // 第二个节点成为第一个节点的子节点
    expect(next).toHaveLength(1);
    expect(next[0].children.map((n) => n.id)).toEqual([doc.nodes[0].children[0].id, doc.nodes[1].id]);
  });

  it('outdentNode 移出父节点成为父所在层新兄弟', () => {
    const doc = mubuDoc();
    const childId = doc.nodes[0].children[0].id;
    const next = outdentNode(doc.nodes, childId);
    expect(next).toHaveLength(3);
    expect(next[0].children).toHaveLength(0);
    expect(next[1].id).toBe(childId);
  });

  it('createNodeLike 依据参考节点风格创建', () => {
    const generic = { id: 'g', html: '', tag: 'p', children: [] } as OutlineNode;
    const mubu = createOutlineNode();
    expect(createNodeLike(generic).tag).toBe('p');
    expect(createNodeLike(mubu).liClass).toBe('node');
    expect(createNodeLike(mubu).tag).toBeUndefined();
  });
});

describe('拖拽移动 moveNode', () => {
  it('顶层节点移动到顶层指定位置', () => {
    const doc = mubuDoc();
    // 把第一个顶层节点移动到索引 1（即其后一位） → 顺序对调
    const next = moveNode(doc.nodes, doc.nodes[0].id, null, 1);
    expect(next).toHaveLength(2);
    expect(next[0].id).toBe(doc.nodes[1].id);
    expect(next[1].id).toBe(doc.nodes[0].id);
  });

  it('移动到其他节点之下形成层级（成为其子节点）', () => {
    const doc = mubuDoc();
    const target = doc.nodes[1].id;
    const moved = doc.nodes[0].id;
    const next = moveNode(doc.nodes, moved, target, 0);
    // 顶层只剩 1 个节点，moved 成为 target 的第一个子节点
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe(target);
    expect(next[0].children[0].id).toBe(moved);
  });

  it('同层向下拖动时索引自动修正（去掉已移除节点导致的偏移）', () => {
    // 构造 3 个顶层节点
    const a = createOutlineNode('A');
    const b = createOutlineNode('B');
    const c = createOutlineNode('C');
    const nodes = [a, b, c];
    // 把 a 移动到 index 2（c 之后）；由于 a 原本在 0 < 2，去掉后 targetIndex-1=1
    const moved = moveNode(nodes, a.id, null, 2);
    expect(moved.map((n) => n.html)).toEqual(['B', 'C', 'A']);
  });

  it('阻止将节点拖入自身或后代之下', () => {
    const doc = mubuDoc();
    const parent = doc.nodes[0];
    const child = parent.children[0];
    // 尝试把孩子拖入其自身之下 → 不变
    expect(moveNode(doc.nodes, child.id, child.id, 0)).toEqual(doc.nodes);
    // 尝试把父节点拖到其子节点之下 → 不变
    expect(moveNode(doc.nodes, parent.id, child.id, 0)).toEqual(doc.nodes);
  });

  it('移动后保持子树结构完整', () => {
    const doc = mubuDoc();
    const moved = doc.nodes[0]; // 含 1 个子节点
    const next = moveNode(doc.nodes, moved.id, null, 2);
    expect(next[1].id).toBe(moved.id);
    expect(next[1].children).toHaveLength(1);
    expect(next[1].children[0].id).toBe(doc.nodes[0].children[0].id);
  });
});
