import re
import sys

# The whole stylesheet of J-C's mockup, every rule under `.v2` (a page drawn in the mockup's
# markup), its tokens kept for the whole page, its keyframes as they are, the phone's tab bar global.
mock, target = sys.argv[1], sys.argv[2]
html = open(mock, encoding='utf-8').read()
css = html[html.index('<style>') + len('<style>'):html.index('</style>')]
css = re.sub(r'/[*].*?[*]/', '', css, flags=re.S)

out = []
depth = 0
stack = []  # what each open brace is: 'media', 'keyframes', 'rule', 'root'
i = 0
NL = chr(10)


def scope(selectors):
    parts = []
    for sel in selectors.split(','):
        sel = sel.strip()
        if not sel:
            continue
        if sel.startswith(':root') or sel in ('html', 'body', '*', '*::before', '*::after'):
            parts.append(None)
            continue
        if sel.startswith('.x-tabbar'):
            parts.append(sel)
            continue
        if sel == '.page' or sel.startswith('.page ') or sel.startswith('.page:') or sel.startswith('.page.'):
            parts.append('.page.v2' + sel[len('.page'):])
            continue
        parts.append('.v2 ' + sel)
    return parts


buf = ''
for ch in css:
    if ch == '{':
        head = buf.strip()
        buf = ''
        inside_keyframes = 'keyframes' in stack
        if head.startswith('@keyframes'):
            stack.append('keyframes')
            out.append(head + ' {')
        elif head.startswith('@'):
            stack.append('media')
            out.append(head + ' {')
        elif inside_keyframes:
            stack.append('rule')
            out.append(head + ' {')
        else:
            parts = scope(head)
            if any(p is None for p in parts):
                # Tokens and the page's ground: tokens kept (the brand has the same), the rest dropped.
                if head.startswith(':root'):
                    stack.append('rule')
                    out.append(head + ' {')
                else:
                    stack.append('drop')
                    out.append('/* dropped: ' + head.replace('*/', '') + ' */ .v2-dropped {')
            else:
                stack.append('rule')
                out.append(', '.join(parts) + ' {')
    elif ch == '}':
        decl = buf.strip()
        buf = ''
        if decl:
            out.append('  ' + decl)
        stack.pop()
        out.append('}')
    else:
        buf += ch

text = NL.join(out)
text = text.replace(chr(92), chr(92) * 2).replace('`', chr(92) + '`').replace('${', chr(92) + '${')
head = ("// The screens of plan v2 (section I), in J-C's mockup (`docs/design/jarvis-v2.html`): its whole\n"
        "// stylesheet, every rule under `.v2` so the pages drawn before keep theirs; its tokens; the phone's\n"
        "// tab bar. Generated from the mockup: change the mockup, then generate again.\n\n")
open(target, 'w', encoding='utf-8', newline=NL).write(head + 'export const v2Css = `\n' + text + '\n`;\n')
print(len(text), text.count('{'), text.count('}'))
