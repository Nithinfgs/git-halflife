// `npm run demo`: build the synthetic demo repo and analyze it.
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDemoRepo } from './demo-repo.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = buildDemoRepo(join(mkdtempSync(join(tmpdir(), 'halflife-demo-')), 'acme-api'));
console.error(`synthetic demo repo: ${dir}\n`);
const r = spawnSync(
  process.execPath,
  [join(root, 'dist/cli.js'), dir, '--as-of', '2026-10-01', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
  },
);
process.exit(r.status ?? 1);
