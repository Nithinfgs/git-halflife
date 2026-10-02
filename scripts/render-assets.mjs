// Regenerates docs/assets/demo.svg and examples/report.html from the synthetic demo repo.
// Usage: npm run build && npm run assets
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDemoRepo } from './demo-repo.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'dist/cli.js');
const dir = buildDemoRepo(join(mkdtempSync(join(tmpdir(), 'halflife-assets-')), 'acme-api'));
const exec = (...args) =>
  spawnSync(process.execPath, [cli, dir, '--as-of', '2026-10-01', ...args], { encoding: 'utf8' });

mkdirSync(join(root, 'docs/assets'), { recursive: true });
mkdirSync(join(root, 'examples'), { recursive: true });
exec('--html', join(root, 'examples/report.html'));

// --- ANSI -> SVG ------------------------------------------------------------
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[(\\d+)m`, 'g');
const COLORS = { 31: '#ff7b72', 32: '#56d364', 33: '#e3b341', 36: '#79c0ff' };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function parseLine(line) {
  const spans = [];
  let bold = false;
  let dim = false;
  let color = null;
  let pos = 0;
  for (const m of line.matchAll(ANSI)) {
    if (m.index > pos) spans.push({ text: line.slice(pos, m.index), bold, dim, color });
    pos = m.index + m[0].length;
    const c = Number(m[1]);
    if (c === 1) bold = true;
    else if (c === 2) dim = true;
    else if (c === 22) bold = dim = false;
    else if (c === 39) color = null;
    else if (COLORS[c]) color = COLORS[c];
  }
  if (pos < line.length) spans.push({ text: line.slice(pos), bold, dim, color });
  return spans;
}

const cmd = 'git halflife ~/code/acme-api';
const lines = exec('--color').stdout.replace(/\n$/, '').split('\n').slice(0, -2);
const cw = 8.4;
const lh = 19;
const padX = 20;
const top = 56;
const cols = Math.max(...lines.map((l) => l.replace(ANSI, '').length), cmd.length + 2);
const width = Math.ceil(cols * cw + padX * 2);
const height = top + (lines.length + 1) * lh + 24;

let body = `<text x="${padX}" y="${top}" fill="#8b949e" xml:space="preserve">$ <tspan fill="#e6edf3">${esc(cmd)}</tspan></text>`;
lines.forEach((line, i) => {
  const y = top + (i + 1) * lh + 6;
  const spans = parseLine(line)
    .map((s) => {
      const fill = s.color ?? (s.dim ? '#8b949e' : '#e6edf3');
      return `<tspan fill="${fill}"${s.bold ? ' font-weight="700"' : ''}>${esc(s.text)}</tspan>`;
    })
    .join('');
  body += `<text x="${padX}" y="${y}" xml:space="preserve">${spans}</text>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="git-halflife terminal output on a synthetic demo repo">
<rect width="${width}" height="${height}" rx="10" fill="#0d1117"/>
<rect width="${width}" height="34" rx="10" fill="#161b22"/><rect y="24" width="${width}" height="10" fill="#161b22"/>
<circle cx="20" cy="17" r="6" fill="#ff5f56"/><circle cx="40" cy="17" r="6" fill="#ffbd2e"/><circle cx="60" cy="17" r="6" fill="#27c93f"/>
<g font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="14">${body}</g>
</svg>
`;
writeFileSync(join(root, 'docs/assets/demo.svg'), svg);
console.log(
  `wrote docs/assets/demo.svg (${(svg.length / 1024).toFixed(1)} KB) and examples/report.html`,
);
