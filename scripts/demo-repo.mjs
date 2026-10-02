// Builds a deterministic, SYNTHETIC git history for demos and tests.
// The authorship mix and rewrite rates below are made-up parameters, not measurements:
// the numbers git-halflife prints for this repo say nothing about real-world AI code.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FILES = [
  'src/server.ts',
  'src/router.ts',
  'src/auth.ts',
  'src/db/queries.ts',
  'src/db/migrate.ts',
  'src/billing.ts',
  'src/ui/table.tsx',
  'src/ui/form.tsx',
  'src/utils/dates.ts',
  'src/utils/retry.ts',
  'test/auth.test.ts',
  'test/billing.test.ts',
];

const HUMANS = [
  ['Ava Chen', 'ava@example.com'],
  ['Ben Okafor', 'ben@example.com'],
  ['Priya Nair', 'priya@example.com'],
];

// [weight, label, trailer-or-null, linesPerCommit range, rewriteEagerness]
const ACTORS = [
  { w: 52, id: 'human', add: [6, 30], rewrite: 0.5 },
  {
    w: 30,
    id: 'claude',
    add: [25, 90],
    rewrite: 0.55,
    trailer: 'Co-Authored-By: Claude <noreply@anthropic.com>',
  },
  {
    w: 8,
    id: 'copilot',
    add: [10, 45],
    rewrite: 0.5,
    trailer: 'Co-authored-by: Copilot <copilot@github.com>',
  },
  { w: 6, id: 'aider', add: [15, 60], rewrite: 0.5, aider: true },
  { w: 4, id: 'bot', add: [2, 6], rewrite: 0.1, bot: true },
];

function git(dir, args, env = {}) {
  return execFileSync('git', args, {
    cwd: dir,
    env: { ...process.env, ...env },
    stdio: 'pipe',
  }).toString();
}

export function buildDemoRepo(
  dir,
  { commits = 220, seed = 7, start = '2025-09-01', end = '2026-09-30' } = {},
) {
  mkdirSync(dir, { recursive: true });
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.name', 'Demo']);
  git(dir, ['config', 'user.email', 'demo@example.com']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  const rand = rng(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = ([lo, hi]) => lo + Math.floor(rand() * (hi - lo + 1));
  const files = new Map(FILES.map((f) => [f, []]));
  let counter = 0;
  const fresh = (f) =>
    `  const ${f.split('/').pop().split('.')[0]}_${(counter++).toString(36)} = step(${counter});`;
  const t0 = Date.parse(`${start}T09:00:00Z`);
  const t1 = Date.parse(`${end}T17:00:00Z`);
  const total = ACTORS.reduce((n, a) => n + a.w, 0);

  for (let i = 0; i < commits; i++) {
    const roll = rand() * total;
    let acc = 0;
    let actor = ACTORS[0];
    for (const a of ACTORS) {
      acc += a.w;
      if (roll < acc) {
        actor = a;
        break;
      }
    }
    const file = actor.bot ? 'package-deps.txt' : pick(FILES);
    if (!files.has(file)) files.set(file, []);
    const lines = files.get(file);
    if (lines.length > 20 && rand() < actor.rewrite) {
      // Rewrite a few lines, biased toward recently added ones (the tail of the file).
      const n = Math.min(lines.length, between([6, 40]));
      for (let k = 0; k < n; k++) {
        const idx =
          rand() < 0.6
            ? lines.length - 1 - Math.floor(rand() * Math.min(lines.length, 25))
            : Math.floor(rand() * lines.length);
        lines[idx] = fresh(file);
      }
    } else {
      const n = between(actor.add);
      for (let k = 0; k < n; k++)
        lines.splice(Math.floor(rand() * (lines.length + 1)), 0, fresh(file));
    }
    const path = join(dir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${lines.join('\n')}\n`);

    const when = new Date(
      t0 + ((t1 - t0) * i) / commits + Math.floor(rand() * 3600e3),
    ).toISOString();
    let [name, email] = pick(HUMANS);
    if (actor.aider) name = `${name} (aider)`;
    if (actor.bot)
      [name, email] = ['dependabot[bot]', '49699333+dependabot[bot]@users.noreply.github.com'];
    const subject = `${actor.bot ? 'chore(deps): bump' : pick(['feat', 'fix', 'refactor'])} ${file.split('/').pop()}`;
    const message = actor.trailer ? `${subject}\n\n${actor.trailer}\n` : `${subject}\n`;
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', message], {
      GIT_AUTHOR_NAME: name,
      GIT_AUTHOR_EMAIL: email,
      GIT_COMMITTER_NAME: name,
      GIT_COMMITTER_EMAIL: email,
      GIT_AUTHOR_DATE: when,
      GIT_COMMITTER_DATE: when,
    });
  }
  return dir;
}
