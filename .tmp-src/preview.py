# -*- coding: utf-8
import re, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
s = open(r'd:\Code\Recite\src\data\builtin-anniversary-2026-2027.html', encoding='utf-8').read()
depth = 0
lines = []
for line in s.splitlines():
    t = line.strip()
    if t.startswith('</ul>'):
        depth -= 1
    m = re.match(r'<div class="content mm-editor">(.*)</div>$', t)
    if m:
        txt = re.sub(r'<[^>]+>', '', m.group(1))
        lines.append('  ' * depth + txt[:90])
    if t.startswith('<div class="children">'):
        depth += 1
open(r'd:\Code\Recite\.tmp-src\preview.txt', 'w', encoding='utf-8').write('\n'.join(lines))
print(len(lines))
