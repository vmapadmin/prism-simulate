"""Concatenate src/ into a single self-contained HTML file.

Outputs:
  dist/prism-simulate.html  - standalone build
  docs/index.html           - same build, served by GitHub Pages
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Load order matters.
JS = ['engine', 'data', 'core', 'views1', 'views2', 'views3a', 'views3b', 'events']


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


css = read('src/styles.css')
js = ''.join(read(f'src/{name}.js') for name in JS)
html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>ValueMap Prism Simulate — POC</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>{css}</style></head>
<body><div id="app"></div><div id="modal"></div><div id="toasts" aria-live="polite"></div>
<script>{js}</script></body></html>'''

for rel in ('dist/prism-simulate.html', 'docs/index.html'):
    out = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    print(rel, len(html))
