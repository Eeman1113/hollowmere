#!/usr/bin/env node
// Builds the static export with relative asset paths and zips it for itch.io.
// Usage: node scripts/package-itch.mjs  ->  dist/hollowmere-itch.zip
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const zip = path.join(dist, 'hollowmere-itch.zip');

fs.rmSync(path.join(root, 'out'), { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

console.log('> building static export (relative asset paths)…');
execSync('npx next build', { stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_ASSET_MODE: 'relative', NEXT_PUBLIC_BASE_PATH: '' } });

const out = path.join(root, 'out');
if (!fs.existsSync(path.join(out, 'index.html'))) {
  console.error('! out/index.html missing — did the export fail?');
  process.exit(1);
}

// itch serves the zip from an opaque path, so no absolute /_next references may survive.
const bad = [];
const walk = d => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(html|js|css|json)$/.test(e.name)) continue;
    const txt = fs.readFileSync(p, 'utf8');
    if (/["'(]\/_next\//.test(txt)) bad.push(path.relative(out, p));
  }
};
walk(out);
// Only the HTML is safe to rewrite: Next's runtime chunks verify their own
// publicPath against the configured assetPrefix, so touching them breaks boot.
const htmlFiles = [];
const walkHtml = d => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walkHtml(p);
    else if (e.name.endsWith('.html')) htmlFiles.push(p);
  }
};
walkHtml(out);
for (const p of htmlFiles) {
  // every root-relative href/src must become document-relative
  const src = fs.readFileSync(p, 'utf8');
  const fixed = src.replace(/(href|src)="\/(?!\/)/g, '$1="./').replace(/(href|src)='\/(?!\/)/g, "$1='./");
  if (fixed !== src) fs.writeFileSync(p, fixed);
}
const stillBad = bad.filter(f => !f.endsWith('.html'));
if (stillBad.length) console.warn(`  note: ${stillBad.length} runtime chunk(s) mention /_next/ internally (expected).`);

fs.rmSync(zip, { force: true });
console.log('> zipping…');
execSync(`cd "${out}" && zip -qr "${zip}" .`, { stdio: 'inherit', shell: '/bin/bash' });
const mb = (fs.statSync(zip).size / 1048576).toFixed(2);
console.log(`\n✓ ${path.relative(root, zip)}  (${mb} MB)`);
console.log('  Upload to itch.io, tick "This file will be played in the browser",');
console.log('  and set the viewport to 1280×720 with "Fullscreen button" enabled.');
