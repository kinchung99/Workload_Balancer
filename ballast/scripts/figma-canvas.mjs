#!/usr/bin/env node
/**
 * Builds figma/canvas.html — every screen on one page, each in a box exactly the
 * size of the Figma artboard.
 *
 * This is the conversion path. Serve the file, point the html.to.design plugin
 * at it, and Figma receives every screen as a named 390x844 frame full of real
 * text and vector layers - not a screenshot. Run: `npm run figma:canvas`.
 *
 * It works because of the four rules in src/design/figma.ts: auto-layout only,
 * tokens only, one name per component, one frame size. Every <Stack> arrives as
 * a frame with the padding and gap it had in code.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = mkdtempSync(join(tmpdir(), 'ballast-canvas-'));

// The frame list lives in the TS bridge; read it rather than duplicating it here.
const bridge = readFileSync(join(root, 'src/design/figma.ts'), 'utf8');
const frames = [...bridge.matchAll(/\{\s*route:\s*'([^']+)',\s*frame:\s*'([^']+)',\s*page:\s*(\d+),\s*note:\s*'([^']*)'/g)]
  .map(([, route, frame, page, note]) => ({ route, frame, page: Number(page), note }));

const tokens = JSON.parse(readFileSync(join(root, 'figma/tokens.json'), 'utf8'));
const W = parseInt(tokens.dimension.frame.width.$value, 10);
const H = parseInt(tokens.dimension.frame.height.$value, 10);

console.log(`  exporting ${frames.length} routes...`);
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', out], { stdio: 'pipe' });

const cssDir = join(out, '_expo/static/css');
const css = readdirSync(cssDir).filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(cssDir, f), 'utf8')).join('\n');

/** Static export writes "/plan" as plan.html and "/" as index.html. */
const fileFor = (route) => join(out, route === '/' ? 'index.html' : `${route.replace(/^\//, '')}.html`);

const sections = frames.map(({ route, frame, page, note }) => {
  let html;
  try {
    html = readFileSync(fileFor(route), 'utf8');
  } catch {
    console.warn(`  skipped ${route} (no static output)`);
    return null;
  }
  // Everything React rendered, minus the hydration script and its markers.
  const body = html
    .slice(html.indexOf('<div id="root">') + '<div id="root">'.length, html.lastIndexOf('</div><script'))
    .replace(/<!--\$-->|<!--\/\$-->/g, '');

  return `
    <figure class="frame">
      <figcaption>
        <b>${frame}</b>
        <span>${route} &middot; ${page ? `study p.${page}` : 'new in merge'} &middot; ${note}</span>
      </figcaption>
      <div class="artboard" data-name="${frame}">${body}</div>
    </figure>`;
}).filter(Boolean);

writeFileSync(
  join(root, 'figma/canvas.html'),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Ballast — Figma canvas</title>
<style>
${css}

/* Canvas chrome only. Nothing below this line is part of a frame, and the
   .artboard boxes are exactly one Figma artboard each. */
body { margin: 0; background: #E9E7E2; font-family: system-ui, sans-serif; }
.sheet { display: flex; flex-wrap: wrap; gap: 64px; padding: 64px; align-items: flex-start; }
.frame { margin: 0; display: flex; flex-direction: column; gap: 12px; }
figcaption { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #4A4A46; max-width: ${W}px; }
figcaption b { font-size: 14px; color: #14161A; }
figcaption span { color: #6B7079; }
.artboard {
  width: ${W}px; height: ${H}px;
  overflow: hidden; position: relative;
  background: #fff; border-radius: 28px;
  box-shadow: 0 1px 2px rgba(0,0,0,.14), 0 12px 32px rgba(0,0,0,.10);
}
.artboard > * { width: 100%; height: 100%; }
h1 { font: 600 18px system-ui; margin: 0; color: #14161A; }
header { padding: 48px 64px 0; }
header p { color: #565A62; font-size: 13px; max-width: 60ch; line-height: 1.6; }
</style>
</head>
<body>
<header>
  <h1>Ballast — ${sections.length} frames at ${W}&times;${H}</h1>
  <p>Import with the html.to.design plugin. Each .artboard becomes one Figma frame;
     every Stack arrives as an auto-layout frame with its real padding and gap, and
     all text stays editable. Import figma/tokens.json with Tokens Studio first so
     the colours land on variables rather than as loose hex values.</p>
</header>
<div class="sheet">${sections.join('\n')}</div>
</body>
</html>`,
);

rmSync(out, { recursive: true, force: true });
console.log(`  wrote figma/canvas.html — ${sections.length} frames at ${W}x${H}`);
