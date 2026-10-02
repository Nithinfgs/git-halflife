import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildDemoRepo } from '../scripts/demo-repo.mjs';
import { blameFile, run } from '../src/run.ts';
import { lines, makeRepo } from './helpers.ts';

const CLAUDE = '\n\nCo-Authored-By: Claude <noreply@anthropic.com>';
const asOf = Date.parse('2026-03-01T00:00:00Z') / 1000;

test('survival is exact on a hand-built history', async () => {
  const r = makeRepo();
  r.write('app.ts', lines('human', 10));
  r.commit('init', { date: '2026-01-01T00:00:00Z' });
  r.write('app.ts', lines('human', 10) + lines('claude', 10));
  r.commit(`add claude block${CLAUDE}`, { date: '2026-01-10T00:00:00Z' });
  // A human rewrites 4 of the 10 Claude lines.
  r.write('app.ts', lines('human', 10) + lines('claude', 6) + lines('rewritten', 4));
  r.commit('rewrite tail', { date: '2026-02-01T00:00:00Z' });

  const a = await run({ cwd: r.dir, asOf });
  const claude = a.groups.find((g) => g.key === 'Claude Code');
  assert.ok(claude);
  assert.equal(claude.added, 10);
  assert.equal(claude.surviving, 6);
  assert.equal(claude.survival, 0.6);
  const human = a.groups.find((g) => g.key === 'human');
  assert.equal(human?.currentLines, 14);
  assert.equal(a.detection.agentCommits, 1);
  assert.equal(a.totals.currentLines, 20);
});

test('whitespace-only reformatting does not count as rewriting', async () => {
  const r = makeRepo();
  r.write('a.ts', 'function f() {\nreturn 1;\n}\n');
  r.commit(`add${CLAUDE}`, { date: '2026-01-01T00:00:00Z' });
  r.write('a.ts', 'function f() {\n    return 1;\n}\n');
  r.commit('reindent', { date: '2026-01-05T00:00:00Z' });
  const a = await run({ cwd: r.dir, asOf });
  assert.equal(a.groups.find((g) => g.key === 'Claude Code')?.survival, 1);
});

test('renames keep attribution; lockfiles and bulk commits are excluded', async () => {
  const r = makeRepo();
  r.write('old.ts', lines('x', 8));
  r.write('package-lock.json', lines('lock', 500));
  r.commit(`add${CLAUDE}`, { date: '2026-01-01T00:00:00Z' });
  r.git('mv', 'old.ts', 'src_new.ts');
  r.commit('move', { date: '2026-01-02T00:00:00Z' });
  r.write('big.ts', lines('bulk', 50));
  r.commit('bulk import', { date: '2026-01-03T00:00:00Z' });

  const a = await run({ cwd: r.dir, asOf, maxCommitLines: 20 });
  const claude = a.groups.find((g) => g.key === 'Claude Code');
  assert.equal(claude?.added, 8);
  assert.equal(claude?.surviving, 8);
  assert.equal(a.totals.commitsExcluded, 1);
  assert.equal(a.totals.currentLines, 58);
});

test('.halflife.json rules and ignores are honored', async () => {
  const r = makeRepo();
  r.write(
    '.halflife.json',
    JSON.stringify({
      rules: [{ agent: 'House', field: 'message', pattern: 'AI-Assisted: yes' }],
      ignore: ['docs/'],
    }),
  );
  r.write('a.ts', lines('a', 5));
  r.write('docs/x.md', lines('d', 5));
  r.commit('feat\n\nAI-Assisted: yes');
  const a = await run({ cwd: r.dir, asOf });
  assert.equal(a.groups.find((g) => g.key === 'House')?.added, 5 + 1 /* .halflife.json */);
  assert.equal(
    a.files.some((f) => f.path.startsWith('docs/')),
    false,
  );
});

test('blameFile tags each line with its author class', async () => {
  const r = makeRepo();
  r.write('f.ts', lines('h', 2));
  r.commit('human');
  r.write('f.ts', lines('h', 2) + lines('c', 1));
  r.commit(`agent${CLAUDE}`);
  const out = await blameFile({ cwd: r.dir }, 'f.ts');
  assert.deepEqual(
    out.map((l) => l.kind),
    ['human', 'human', 'agent'],
  );
  assert.equal(out[2]?.group, 'Claude Code');
});

test('errors are friendly outside a repo and in an empty repo', async () => {
  await assert.rejects(
    run({ cwd: mkdtempSync(join(tmpdir(), 'not-a-repo-')) }),
    /not a git repository/,
  );
  await assert.rejects(run({ cwd: makeRepo().dir }), /no commits yet/);
});

test('CLI: demo repo end to end (json, markdown, html)', () => {
  const dir = buildDemoRepo(join(mkdtempSync(join(tmpdir(), 'halflife-cli-')), 'demo'), {
    commits: 60,
  });
  const cli = (...args: string[]) =>
    execFileSync(process.execPath, ['src/cli.ts', dir, '--as-of', '2026-10-01', ...args], {
      encoding: 'utf8',
    });
  const json = JSON.parse(cli('--json'));
  assert.equal(json.detection.totalCommits, 60);
  assert.ok(json.agents.added > 0 && json.human.added > 0);
  assert.match(cli('--md'), /\| Author \| Commits/);
  const html = join(dir, '..', 'report.html');
  cli('--html', html);
  const text = readFileSync(html, 'utf8');
  assert.match(text, /<title>git-halflife: demo<\/title>/);
  assert.doesNotMatch(text, /<script/);
  assert.match(
    execFileSync(process.execPath, ['src/cli.ts', '--version'], { encoding: 'utf8' }),
    /^\d+\.\d+\.\d+/,
  );
});
