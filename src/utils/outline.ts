/**
 * 文档大纲（结构保持式）纯逻辑层。
 *
 * 大纲编辑的本质是对原始 HTML 结构进行就地修改：解析时把文档拆成可编辑的
 * 节点树（保留原始嵌套层级关系与包裹结构），编辑只修改节点文本，序列化时
 * 逐字还原原始结构（含幕布导出的 <li class="node">、<div class="bullet">、
 * <div class="content mm-editor">、<div class="children"><ul class="node-list">），
 * 不改变内容的逻辑结构与显示样式。
 *
 * 不依赖 React，便于单元测试。
 */

/** 单个大纲节点：Mubu 列表项 或 通用块 */
export interface OutlineNode {
  id: string;
  /** 可编辑内容（Mubu：.content.mm-editor 内部；通用块：标签内部），保留 .underline 等标记 */
  html: string;
  /** 备注（Mubu：.note.mm-editor 内部），可选 */
  note?: string;
  /** Mubu 列表项 class（如 'node'、'node collapsed'）；存在则按 Mubu 结构序列化 */
  liClass?: string;
  /** 通用块标签（h1/p/div/blockquote...）；存在则按原始标签序列化 */
  tag?: string;
  /** 通用块原始属性（如 class="foo"），可选 */
  attrs?: string;
  /** 子节点（保持原始嵌套层级关系） */
  children: OutlineNode[];
}

/** 整篇文档大纲：标题 + 顶层节点树 */
export interface OutlineDoc {
  /** 标题 div（Mubu .title）内部 html，无则为 null */
  titleHtml: string | null;
  /** 顶层节点 */
  nodes: OutlineNode[];
}

/** 生成大纲节点唯一 id */
export function createOutlineId(): string {
  return `outline-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 新建 Mubu 风格节点（可指定初始内容） */
export function createOutlineNode(html = '', note = ''): OutlineNode {
  return { id: createOutlineId(), html, note: note || undefined, liClass: 'node', children: [] };
}

/** 依据参考节点风格创建新节点（通用块保持同标签；否则 Mubu 列表项） */
export function createNodeLike(ref: OutlineNode, html = ''): OutlineNode {
  if (ref.tag) {
    return { id: createOutlineId(), html, tag: ref.tag, attrs: ref.attrs, children: [] };
  }
  return { id: createOutlineId(), html, liClass: ref.liClass, children: [] };
}

/* ---------------------------------- 解析 ---------------------------------- */

/**
 * 将文档 HTML 解析为大纲树，保持原始嵌套层级关系：
 * - Mubu 结构（<div class="title"> + <ul class="node-list"> 下的 <li class="node">）
 *   解析为节点树，内容取自 .content.mm-editor，备注取自 .note.mm-editor；
 * - 通用块（h1/p/div/...）按原始标签与属性保留为节点，内部 HTML 原样保留。
 * .underline 重点标记随内容原样保留。
 */
export function parseHtmlToOutline(html: string): OutlineDoc {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;
  const nodes: OutlineNode[] = [];
  let titleHtml: string | null = null;

  /** 解析一个 Mubu 列表项 li.node */
  const parseMubuLi = (li: Element): OutlineNode => {
    const content = li.querySelector(':scope > .content.mm-editor, :scope > .content');
    const note = li.querySelector(':scope > .note.mm-editor, :scope > .note');
    return {
      id: createOutlineId(),
      html: content ? content.innerHTML : li.innerHTML,
      note: note && (note.textContent ?? '').trim() ? note.innerHTML : undefined,
      liClass: li.getAttribute('class') || 'node',
      children: parseMubuChildren(li.querySelector(':scope > .children')),
    };
  };

  /** 解析 .children 容器中的子列表项 */
  const parseMubuChildren = (container: Element | null): OutlineNode[] => {
    if (!container) return [];
    const ul = container.querySelector(':scope > ul');
    const lis = ul
      ? Array.from(ul.children).filter((el) => el.tagName === 'LI')
      : Array.from(container.children).filter((el) => el.tagName === 'LI');
    return lis.map((li) => parseMubuLi(li as Element));
  };

  /** 通用块节点：保留原始标签与属性，内部 HTML 原样保留 */
  const genericNode = (el: Element): OutlineNode => {
    const attrs = Array.from(el.attributes)
      .map((a) => `${a.name}="${a.value}"`)
      .join(' ');
    return {
      id: createOutlineId(),
      html: el.innerHTML,
      tag: el.tagName.toLowerCase(),
      attrs: attrs || undefined,
      children: [],
    };
  };

  Array.from(body.children).forEach((el) => {
    const tag = el.tagName.toLowerCase();

    // Mubu 标题
    if (tag === 'div' && el.classList.contains('title')) {
      if (titleHtml === null) titleHtml = el.innerHTML;
      return;
    }
    // Mubu 顶层列表
    if ((tag === 'ul' || tag === 'ol') && el.classList.contains('node-list')) {
      Array.from(el.children)
        .filter((c) => c.tagName === 'LI')
        .forEach((li) => nodes.push(parseMubuLi(li as Element)));
      return;
    }
    // 其余通用块
    nodes.push(genericNode(el));
  });

  return { titleHtml, nodes };
}

/* ---------------------------------- 序列化 ---------------------------------- */

/**
 * 将大纲树序列化为 HTML 片段，逐字还原原始结构（Mubu li.node/bullet/content/children）。
 */
export function serializeOutline(doc: OutlineDoc): string {
  const title = doc.titleHtml ? `<div class="title">${doc.titleHtml}</div>` : '';
  return title + serializeNodeList(doc.nodes);
}

/** 序列化单个节点 */
function serializeNode(node: OutlineNode): string {
  // 通用块：按原始标签与属性输出，内部保留（含嵌套子节点）
  if (node.tag) {
    const attrs = node.attrs ? ` ${node.attrs}` : '';
    const children = node.children.length ? serializeNodeList(node.children) : '';
    return `<${node.tag}${attrs}>${node.html}${children}</${node.tag}>`;
  }

  // Mubu 列表项：保留 li.node / bullet / content / note / children 结构
  const cls = node.liClass && node.liClass.trim() ? node.liClass : 'node';
  const note = node.note ? `\n    <div class="note mm-editor">${node.note}</div>` : '';
  const children = node.children.length
    ? `\n    <div class="children">${serializeNodeList(node.children)}</div>`
    : '';
  return [
    `<li class="${cls}">`,
    `    <div class="bullet">`,
    `    <div class="bullet-dot"></div>`,
    `  </div>`,
    `    `,
    `    <div class="content mm-editor">${node.html}</div>${note}${children}`,
    `  </li>`,
  ].join('\n');
}

/**
 * 序列化一组兄弟节点：全部为 Mubu 列表项时包裹 <ul class="node-list">，否则直接拼接。
 */
function serializeNodeList(nodes: OutlineNode[]): string {
  if (nodes.length === 0) return '';
  const allMubu = nodes.every((n) => !n.tag);
  const inner = nodes.map(serializeNode).join(allMubu ? '\n' : '');
  return allMubu ? `<ul class="node-list">\n${inner}\n</ul>` : inner;
}

/* ---------------------------------- 树操作（不可变） ---------------------------------- */

/** 统计节点总数（含嵌套） */
export function countNodes(nodes: OutlineNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}

/** 更新节点内容 html */
export function updateNodeHtml(nodes: OutlineNode[], id: string, html: string): OutlineNode[] {
  return nodes.map((n) =>
    n.id === id ? { ...n, html } : { ...n, children: updateNodeHtml(n.children, id, html) }
  );
}

/** 更新节点备注 note */
export function updateNodeNote(nodes: OutlineNode[], id: string, note: string): OutlineNode[] {
  return nodes.map((n) =>
    n.id === id
      ? { ...n, note: note.trim() ? note : undefined }
      : { ...n, children: updateNodeNote(n.children, id, note) }
  );
}

/** 为节点添加解释（note）：无则初始化为空串以进入编辑态，已有则保持不变 */
export function ensureNodeNote(nodes: OutlineNode[], id: string): OutlineNode[] {
  return nodes.map((n) =>
    n.id === id
      ? { ...n, note: n.note ?? '' }
      : { ...n, children: ensureNodeNote(n.children, id) }
  );
}

/** 删除节点（含其子树） */
export function removeNode(nodes: OutlineNode[], id: string): OutlineNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: removeNode(n.children, id) }));
}

/** 为 parentId 节点追加子节点 */
export function addChild(nodes: OutlineNode[], parentId: string, node: OutlineNode): OutlineNode[] {
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...n.children, node] };
    return { ...n, children: addChild(n.children, parentId, node) };
  });
}

/** 在 refId 节点之后（同层）插入新节点 */
export function addSibling(
  nodes: OutlineNode[],
  refId: string,
  node: OutlineNode
): OutlineNode[] {
  const idx = nodes.findIndex((n) => n.id === refId);
  if (idx >= 0) return [...nodes.slice(0, idx + 1), node, ...nodes.slice(idx + 1)];
  return nodes.map((n) => ({ ...n, children: addSibling(n.children, refId, node) }));
}

/**
 * 提升层级：将 refId 节点移动为其紧邻前一个兄弟的最后一个子节点（增强嵌套）。
 * 无前一个兄弟时保持原样。
 */
export function indentNode(nodes: OutlineNode[], refId: string): OutlineNode[] {
  const idx = nodes.findIndex((n) => n.id === refId);
  if (idx > 0) {
    const prev = nodes[idx - 1];
    const node = nodes[idx];
    return [
      ...nodes.slice(0, idx - 1),
      { ...prev, children: [...prev.children, node] },
      ...nodes.slice(idx + 1),
    ];
  }
  return nodes.map((n) => ({ ...n, children: indentNode(n.children, refId) }));
}

/**
 * 降低层级：将 refId 节点移出其父节点，成为父节点之后（父所在层）的新兄弟。
 * 顶层节点保持原样。
 */
export function outdentNode(nodes: OutlineNode[], refId: string): OutlineNode[] {
  let moved: OutlineNode | null = null;
  const next: OutlineNode[] = [];
  for (const n of nodes) {
    const childIdx = n.children.findIndex((c) => c.id === refId);
    if (childIdx >= 0 && !moved) {
      moved = n.children[childIdx];
      next.push({ ...n, children: n.children.filter((c) => c.id !== refId) }, moved);
    } else {
      next.push({ ...n, children: moved ? n.children : outdentNode(n.children, refId) });
    }
  }
  return next;
}

/* ---------------------------------- 拖拽移动 ---------------------------------- */

/** 从树中移除指定节点（含子树），返回新树与移除的节点 */
function extractNode(
  nodes: OutlineNode[],
  id: string
): { nodes: OutlineNode[]; removed: OutlineNode | null } {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.id === id) {
      return { nodes: [...nodes.slice(0, i), ...nodes.slice(i + 1)], removed: n };
    }
    const inner = extractNode(n.children, id);
    if (inner.removed) {
      return {
        nodes: nodes.map((x, xi) => (xi === i ? { ...n, children: inner.nodes } : x)),
        removed: inner.removed,
      };
    }
  }
  return { nodes, removed: null };
}

/** 判断 targetId 是否存在于 node（含其自身）子树内 */
function containsNode(node: OutlineNode, targetId: string): boolean {
  if (node.id === targetId) return true;
  return node.children.some((c) => containsNode(c, targetId));
}

/**
 * 拖拽移动：将 dragId 节点（含子树）移动到 targetParentId 节点的 children 中
 * targetIndex 处（targetParentId 为 null 表示顶层列表）。
 * - 阻止将节点拖入其自身或后代之下（避免形成无效循环）；
 * - targetIndex 会被钳制到目标列表长度范围内。
 */
export function moveNode(
  nodes: OutlineNode[],
  dragId: string,
  targetParentId: string | null,
  targetIndex: number
): OutlineNode[] {
  if (targetParentId === dragId) return nodes;
  const origin = extractNode(nodes, dragId);
  if (!origin.removed) return nodes;
  const moved = origin.removed;
  const rest = origin.nodes;
  // 不能放入自身或后代之下
  if (containsNode(moved, targetParentId)) return nodes;

  const clamp = (list: OutlineNode[], idx: number) =>
    Math.max(0, Math.min(idx, list.length));
  const insertAt = (list: OutlineNode[], node: OutlineNode): OutlineNode[] => {
    const idx = clamp(list, targetIndex);
    return [...list.slice(0, idx), node, ...list.slice(idx)];
  };

  if (targetParentId == null) {
    return insertAt(rest, moved);
  }
  const insertIntoParent = (list: OutlineNode[]): OutlineNode[] =>
    list.map((n) => {
      if (n.id === targetParentId) {
        return { ...n, children: insertAt(n.children, moved) };
      }
      return { ...n, children: insertIntoParent(n.children) };
    });
  return insertIntoParent(rest);
}
