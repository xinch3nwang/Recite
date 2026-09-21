# -*- coding: utf-8 -*-
"""把周年考点学习资料 HTML 转为忆读 Mubu 大纲 HTML。"""
import re, html as ihtml, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SRC = r'd:\Code\Recite\.tmp-src\anniversary.html'
OUT = r'd:\Code\Recite\src\data\builtin-anniversary-2026-2027.html'

raw = open(SRC, encoding='utf-8').read()
body = re.search(r'<body>(.*?)</body>', raw, re.S).group(1)

AMBER = '#b45309'
BLUE = '#1a5f8a'
RED = '#dc2626'

def cspan(color, inner):
    return f'<span style="color:{color}" data-fmt-color="{color}">{inner}</span>'

def norm(s):
    s = s.replace('<b>', '<strong>').replace('</b>', '</strong>')
    # 折叠多余空白
    s = re.sub(r'[ \t]*\n[ \t]*', '', s)
    s = re.sub(r'[ \t]{2,}', ' ', s)
    return s.strip()

def warn_inner(s):
    """辨析段：琥珀色标签 + 其余内容"""
    s = norm(s)
    s = re.sub(r'^<strong>辨析：</strong>', '', s)
    return cspan(AMBER, '<strong>辨析：</strong>') + s

class N:
    __slots__ = ('h', 'kids')
    def __init__(self, h, kids=None):
        self.h = h
        self.kids = kids or []

def node(h):
    return N(h)

def ser(ns, depth=0):
    out = []
    pad = '  ' * depth
    for n in ns:
        out.append(f'{pad}<li class="node">')
        out.append(f'{pad}    <div class="bullet">')
        out.append(f'{pad}    <div class="bullet-dot"></div>')
        out.append(f'{pad}  </div>')
        out.append(f'{pad}    <div class="content mm-editor">{n.h}</div>')
        if n.kids:
            out.append(f'{pad}    <div class="children"><ul class="node-list">')
            out.append(ser(n.kids, depth + 1))
            out.append(f'{pad}    </ul></div>')
        out.append(f'{pad}</li>')
    return '\n'.join(out)

# ---------- 解析 body 顶层块 ----------
BLOCK = re.compile(
    r'<h2>(.*?)</h2>|<h3>(.*?)</h3>|<h4>(.*?)</h4>'
    r'|<p([^>]*)>(.*?)</p>|<table>(.*?)</table>', re.S)

blocks = []
for m in BLOCK.finditer(body):
    if m.group(1) is not None:
        blocks.append(('h2', norm(m.group(1))))
    elif m.group(2) is not None:
        blocks.append(('h3', norm(m.group(2))))
    elif m.group(3) is not None:
        blocks.append(('h4', norm(m.group(3))))
    elif m.group(5) is not None:
        cls = m.group(4) or ''
        kind = 'warn' if 'warn' in cls else 'p'
        blocks.append((kind, norm(m.group(5))))
    else:
        rows = []
        for tr in re.findall(r'<tr>(.*?)</tr>', m.group(6), re.S):
            cells = [norm(c) for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', tr, re.S)]
            rows.append(cells)
        blocks.append(('table', rows))

# ---------- 构建大纲 ----------
roots = []

# 使用说明
intro = node('<strong>资料说明与使用方法</strong>')
intro.kids = [
    node('本资料为内置示例文档，梳理 2026—2027 年重要周年考点（时政常识），配合“隐藏重点—回忆—自查”的背诵流程使用。'),
    node(cspan(RED, '<strong>红色下划线</strong>') + '为须精准记忆的填空点，阅读时默认隐藏，可点工具栏“显示重点”自查；' + cspan(AMBER, '琥珀色“辨析：”') + '标出高频易错点。'),
    node('核心条目写三层：时间节点、官方规范表述、易错辨析；逢五逢十周年以一览表承载，保证广度。'),
    node('<strong>资料构成</strong>'),
]
intro.kids[-1].kids = [
    node('一、2026 年核心条目（19 条 + 逢五逢十周年一览表）。'),
    node('二、2027 年核心条目（以建军百年为重点，9 条 + 一览表）。'),
    node('三、精神谱系速记；四、高频易错辨析；五、自测题示例。'),
]
roots.append(intro)

# 遍历：h2 为顶层；h3 为二层条目；其下 p/warn 为三层；h4 为三层、表格行挂其下；
# 直接挂在 h2 下的表格：按列数判断语义（精神谱系 / 易错辨析 / 通用三列）。
i = 0
cur2 = None  # h2
cur3 = None  # h3
cur4 = None  # h4

def table_nodes(rows):
    """表格行 → 节点列表（首行表头跳过）"""
    out = []
    for r in rows[1:]:
        if len(r) == 2:
            n = node(f'<strong>{r[0]}</strong>')
            n.kids.append(node(r[1]))
            out.append(n)
        elif len(r) == 3:
            n = node(f'{cspan(BLUE, "【" + r[0] + "】")}{r[1]}')
            n.kids.append(node(cspan(RED, '常见错法：') + r[2]))
            out.append(n)
        else:
            out.append(node('　'.join(r)))
    return out

# h1 之前可能先出现 lead p —— 已被忽略（intro 重写）。找到首个 h2 开始
start = next(k for k, b in enumerate(blocks) if b[0] == 'h2')

for kind, val in blocks[start:]:
    if kind == 'h2':
        cur2 = node(f'<strong>{val}</strong>')
        roots.append(cur2)
        cur3 = cur4 = None
    elif kind == 'h3':
        cur3 = node(f'<strong>{val}</strong>')
        cur2.kids.append(cur3)
        cur4 = None
    elif kind == 'h4':
        cur4 = node(f'<strong>{val}</strong>')
        (cur3.kids if cur3 else cur2.kids).append(cur4)
    elif kind in ('p', 'warn'):
        h = warn_inner(val) if kind == 'warn' else val
        target = cur3 if cur3 is not None else cur2
        target.kids.append(node(h))
    elif kind == 'table':
        if cur4 is not None:
            for r in val[1:]:
                rn = node(f'<strong>{r[0]}</strong>　{r[1]}')
                rn.kids.append(node(r[2]))
                cur4.kids.append(rn)
        else:
            # h2 直属表格（精神谱系两列 / 易错辨析三列）
            cur2.kids.extend(table_nodes(val))

# ---------- 第五部分自测题后处理：把题干 p 与其 <br> 拆成题干+选项+答案 ----------
# 原结构：h2「五、自测题示例」下 p 节点交替（题干段含 A-D 选项行，下一个 p 是答案）
def split_quiz(sec):
    newkids = []
    ps = sec.kids
    qno = 0
    k = 0
    while k < len(ps):
        n = ps[k]
        if '<br' in n.h or '<br/>' in n.h:
            qno += 1
            lines = [x.strip() for x in re.split(r'<br\s*/?>', n.h) if x.strip()]
            stem = re.sub(r'^\d+[.、]\s*', '', lines[0])
            qn = node(f'<strong>第 {qno} 题（单选）</strong>　{stem}')
            for opt in lines[1:]:
                qn.kids.append(node(opt))
            # 下一个 p 为答案
            if k + 1 < len(ps) and ('参考答案' in ps[k + 1].h):
                ans = ps[k + 1].h.strip('（）()')
                ans = re.sub(r'^参考答案：', '', ans)
                qn.kids.append(node(cspan(AMBER, '参考答案：') + ans))
                k += 1
            newkids.append(qn)
        else:
            newkids.append(n)
        k += 1
    sec.kids = newkids

quiz_sec = roots[-1]  # 第五部分是最后一个 h2
split_quiz(quiz_sec)

# ---------- 序列化 ----------
title = '国考常识·2026—2027年重要周年考点'
parts = [f'<div class="title">{title}</div>', '<ul class="node-list">', ser(roots), '</ul>', '']
open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(parts))

# 统计
nnode = sum(1 for _ in re.finditer(r'<li class="node">', '\n'.join(parts)))
nul = sum(1 for _ in re.finditer(r'class="underline"', '\n'.join(parts)))
print('nodes:', nnode, 'underlines:', nul)
