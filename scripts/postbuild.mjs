import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, '..', 'dist', 'index.html');

let html = readFileSync(htmlPath, 'utf-8');

// Make the Vite-injected CSS <link rel="stylesheet"> async so it no longer
// blocks the first paint. The splash in index.html is fully styled with inline
// CSS and needs no external stylesheet to render, so FCP drops to near-zero.
// CSS at ~7.75 KB gzip always finishes downloading well before React (~59 KB),
// so the auth form is fully styled by the time the splash is removed.
html = html.replace(
  /<link rel="stylesheet" crossorigin href="([^"]+\.css)">/g,
  `<link rel="preload" as="style" crossorigin href="$1" onload="this.onload=null;this.rel='stylesheet'">\n    <noscript><link rel="stylesheet" crossorigin href="$1"></noscript>`
);

writeFileSync(htmlPath, html);
console.log('✓ CSS made async in dist/index.html');
