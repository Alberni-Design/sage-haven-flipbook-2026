# Builds assets/brand/logo-*.svg variants from the official logo SVG.
# Usage: python3 scripts/build-logos.py assets/brand/sage-haven-logo-original.svg
import re, sys
src = open(sys.argv[1], encoding='utf-8').read()
style = re.search(r'<style.*?</style>', src, re.S).group(0)
head = src[:src.index('<g>')]                                        # tree = top-level paths before the first group
tree = ''.join(re.findall(r'<path class="st\d+" d="[^"]*"/>', head))
groups = re.findall(r'<g>.*?</g>', src, re.S)                        # [0]=wordmark, [1]=ground line
text = re.search(r'<text .*?</text>', src, re.S).group(0)
font = ".st9{font-family:'Swiss721BT-Roman','Swiss 721','Helvetica Neue',Helvetica,Arial,sans-serif;}"
style = re.sub(r"\.st9\{[^}]*\}", font, style)
text = text.replace('class="st8 st9 st10"', 'class="st8 st9 st10" textLength="372.6" lengthAdjust="spacingAndGlyphs"')
def svg(vb, body, st=style, title="Sage Haven Society"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{title}"><title>{title}</title>{st}{body}</svg>\n'
def reverse(st): return re.sub(r"fill:#[0-9A-Fa-f]{6}", "fill:#FFFFFF", st)
full = tree + ''.join(groups) + text
out = {
  'logo-full.svg': svg('150 62 390 344', full),
  'logo-full-reverse.svg': svg('150 62 390 344', full, reverse(style)),
  'logo-wordmark.svg': svg('152 306 386 98', groups[0] + text),
  'logo-icon.svg': svg('226 64 238 241', tree + groups[1]),
  'logo-icon-reverse.svg': svg('226 64 238 241', tree + groups[1], reverse(style)),
}
for n, d in out.items(): open(f'assets/brand/{n}', 'w', encoding='utf-8').write(d)
print(tree.count('<path'), 'tree paths')
