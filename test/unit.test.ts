import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ageAdjust, fitHalfLife } from '../src/analyze.ts';
import { parseArgs } from '../src/args.ts';
import { parseIncremental } from '../src/blame.ts';
import { parseConfig } from '../src/config.ts';
import { makeClassifier } from '../src/detect.ts';
import { parseHistory, renamedPath } from '../src/history.ts';
import { DEFAULT_IGNORE, globToRegExp, makeIgnore } from '../src/ignore.ts';

const classify = makeClassifier();
const subject = (message: string, authorName = 'Ava', authorEmail = 'ava@example.com') => ({
  authorName,
  authorEmail,
  message,
});

test('detect: trailers and boilerplate map to agents', () => {
  assert.equal(
    classify(subject('fix\n\nCo-Authored-By: Claude <noreply@anthropic.com>')).group,
    'Claude Code',
  );
  assert.equal(
    classify(subject('x\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)')).group,
    'Claude Code',
  );
  assert.equal(classify(subject('x\n\nCo-authored-by: Copilot <c@github.com>')).group, 'Copilot');
  assert.equal(classify(subject('x', 'Ava (aider)')).group, 'Aider');
  assert.equal(classify(subject('x', 'cursor', 'cursoragent@cursor.com')).group, 'Cursor');
});

test('detect: merely mentioning an agent is not a signature', () => {
  assert.equal(classify(subject('docs: explain how Claude and Copilot differ')).kind, 'human');
  assert.equal(classify(subject('feat: add Gemini provider')).kind, 'human');
});

test('detect: bots are separate from humans and agents', () => {
  assert.deepEqual(classify(subject('bump', 'dependabot[bot]')), { group: 'bot', kind: 'bot' });
  assert.equal(classify(subject('x', 'copilot-swe-agent[bot]')).kind, 'agent');
});

test('detect: custom rules win over built-ins', () => {
  const c = makeClassifier([
    { agent: 'InHouse', field: 'message', pattern: '^AI-Assisted: yes$', flags: 'm' },
  ]);
  assert.equal(c(subject('x\n\nAI-Assisted: yes')).group, 'InHouse');
  assert.throws(
    () => makeClassifier([{ agent: 'Bad', field: 'message', pattern: '(' }]),
    /invalid rule/,
  );
});

test('ignore: globs behave like gitignore-ish patterns', () => {
  const ig = makeIgnore(DEFAULT_IGNORE);
  for (const p of [
    'package-lock.json',
    'a/b/yarn.lock',
    'node_modules/x/index.js',
    'logo.PNG'.toLowerCase(),
    'app.min.js',
  ]) {
    assert.ok(ig(p), p);
  }
  for (const p of ['src/index.ts', 'README.md', 'src/distance.ts']) assert.ok(!ig(p), p);
  assert.ok(globToRegExp('/docs/').test('docs/a/b.md'));
  assert.ok(!globToRegExp('/docs/').test('src/docs/a.md'));
  assert.ok(globToRegExp('*.gen.ts').test('src/deep/x.gen.ts'));
  assert.ok(!globToRegExp('src/*.ts').test('src/a/b.ts'));
});

test('history: parses numstat, renames, binaries and ignores', () => {
  const raw = [
    '\x1eaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\x1fAva\x1fa@x\x1f1700000000\x1ffeat\n\nCo-Authored-By: Claude <n@anthropic.com>\n\x1f\n',
    '10\t2\tsrc/a.ts\n',
    '-\t-\tlogo.png\n',
    '0\t5\tsrc/gone.ts\n',
    '7\t0\tsrc/{old => new}/b.ts\n',
    '3\t0\tpackage-lock.json\n',
  ].join('');
  const [c] = parseHistory(raw, classify, makeIgnore(DEFAULT_IGNORE));
  assert.ok(c);
  assert.equal(c.commit.group, 'Claude Code');
  assert.equal(c.added, 17);
  assert.deepEqual(
    c.files.map((f) => f.path),
    ['src/a.ts', 'src/new/b.ts'],
  );
  assert.equal(renamedPath('{a => b}/c.ts'), 'b/c.ts');
  assert.equal(renamedPath('old.ts => new.ts'), 'new.ts');
});

test('blame: sums run lengths per commit', () => {
  const a = 'a'.repeat(40);
  const b = 'b'.repeat(40);
  const raw = `${a} 1 1 3\nauthor X\n${b} 1 4 2\nauthor Y\n${a} 4 6 4\nfilename f\n`;
  const m = parseIncremental(raw);
  assert.equal(m.get(a), 7);
  assert.equal(m.get(b), 2);
});

test('fitHalfLife: recovers a known half-life', () => {
  const obs = [30, 90, 180, 300, 400].map((age) => ({
    added: 4000,
    ageDays: age,
    surviving: Math.round(4000 * 0.5 ** (age / 120)),
  }));
  const fit = fitHalfLife(obs);
  assert.ok(
    fit.halfLifeDays !== null && Math.abs(fit.halfLifeDays - 120) < 8,
    String(fit.halfLifeDays),
  );
});

test('fitHalfLife: no decay is "stable", tiny samples are refused', () => {
  assert.deepEqual(fitHalfLife([{ added: 1000, surviving: 1000, ageDays: 200 }]), {
    halfLifeDays: null,
    stable: true,
  });
  assert.deepEqual(fitHalfLife([{ added: 20, surviving: 5, ageDays: 10 }]), {
    halfLifeDays: null,
    stable: false,
  });
});

test('fitHalfLife: refuses to extrapolate from young or barely-decayed data', () => {
  // 99% survival after 3 days says nothing about months.
  assert.deepEqual(fitHalfLife([{ added: 3000, surviving: 2970, ageDays: 3 }]), {
    halfLifeDays: null,
    stable: false,
  });
  // 95% survival at 60 days implies a half-life far beyond what was observed.
  assert.deepEqual(fitHalfLife([{ added: 3000, surviving: 2850, ageDays: 60 }]), {
    halfLifeDays: null,
    stable: true,
  });
});

test('ageAdjust: compares against human lines of the same age and skips thin buckets', () => {
  const bucket = (a: [number, number], h: [number, number]) => ({
    label: 'x',
    agent: { added: a[0], surviving: a[1] },
    human: { added: h[0], surviving: h[1] },
  });
  const r = ageAdjust([bucket([100, 50], [100, 80]), bucket([10, 1], [500, 500])]);
  assert.ok(r);
  assert.equal(r.linesCompared, 100);
  assert.equal(r.agentActual, 0.5);
  assert.equal(r.agentExpected, 0.8);
  assert.ok(Math.abs(r.deltaPoints + 30) < 1e-9);
  assert.equal(ageAdjust([bucket([10, 1], [10, 1])]), null);
});

test('config: validates shape', () => {
  assert.deepEqual(parseConfig({ ignore: ['a'], maxCommitLines: 10 }, 'c'), {
    ignore: ['a'],
    maxCommitLines: 10,
  });
  assert.throws(() => parseConfig([], 'c'), /object/);
  assert.throws(
    () => parseConfig({ rules: [{ agent: 'x', field: 'nope', pattern: '.' }] }, 'c'),
    /field/,
  );
  assert.throws(() => parseConfig({ maxCommitLines: 0 }, 'c'), /positive/);
});

test('args: parses flags, inline values and subcommands', () => {
  const a = parseArgs(
    ['--since=2026-01-01', '--ignore', 'a', '--ignore', 'b', '--json', 'repo'],
    {},
    true,
  );
  assert.equal(a.since, '2026-01-01');
  assert.deepEqual(a.ignore, ['a', 'b']);
  assert.equal(a.target, 'repo');
  assert.equal(a.color, true);
  assert.equal(parseArgs(['--no-color'], {}, true).color, false);
  assert.equal(parseArgs([], { NO_COLOR: '1' }, true).color, false);
  assert.equal(parseArgs(['blame', 'src/a.ts']).command, 'blame');
  assert.throws(() => parseArgs(['--bogus']), /unknown option/);
  assert.throws(() => parseArgs(['--top']), /needs a value/);
  assert.throws(() => parseArgs(['blame']), /needs a file/);
});
