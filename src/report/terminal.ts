import type { Analysis } from '../types.ts';
import { dateStr, halfLife, label, num, pct } from './format.ts';

export interface Style {
  bold(s: string): string;
  dim(s: string): string;
  cyan(s: string): string;
  green(s: string): string;
  red(s: string): string;
  yellow(s: string): string;
}

export function makeStyle(color: boolean): Style {
  const wrap = (open: number, close: number) => (s: string) =>
    color ? `\x1b[${open}m${s}\x1b[${close}m` : s;
  return {
    bold: wrap(1, 22),
    dim: wrap(2, 22),
    cyan: wrap(36, 39),
    green: wrap(32, 39),
    red: wrap(31, 39),
    yellow: wrap(33, 39),
  };
}

const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));
const lpad = (s: string, n: number) => ' '.repeat(Math.max(0, n - s.length)) + s;

function bar(frac: number, width: number): string {
  const f = Math.max(0, Math.min(1, frac));
  const filled = Math.round(f * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export function renderTerminal(a: Analysis, style: Style): string {
  const s = style;
  const out: string[] = [];
  const repoName = a.repo.split('/').pop() ?? a.repo;
  out.push(
    `${s.bold('git-halflife')}  ${repoName} @ ${a.head.slice(0, 7)}  ${s.dim(`as of ${dateStr(a.asOf)}`)}`,
  );
  out.push('');
  out.push(
    `${num(a.detection.agentCommits)} of ${num(a.detection.totalCommits)} commits (${pct(a.detection.share)}) carry an AI-agent signature. ${s.dim('Treat this as a lower bound.')}`,
  );
  out.push('');

  const rows = [...a.groups.filter((g) => g.added > 0 || g.currentLines > 0)];
  const nameW = Math.max(14, ...rows.map((g) => label(g.key).length));
  out.push(
    s.bold(
      `${pad('WHO WROTE IT', nameW)}  ${lpad('commits', 7)}  ${lpad('lines added', 11)}  ${lpad('alive now', 9)}  ${lpad('survival', 8)}  half-life`,
    ),
  );
  for (const g of rows) {
    const tint = g.kind === 'agent' ? s.cyan : g.kind === 'human' ? s.green : s.dim;
    out.push(
      `${tint(pad(label(g.key), nameW))}  ${lpad(num(g.commits), 7)}  ${lpad(num(g.added), 11)}  ${lpad(num(g.surviving), 9)}  ${lpad(pct(g.survival), 8)}  ${halfLife(g)}`,
    );
  }
  out.push('');

  out.push(
    s.bold(
      `NOW ON HEAD  ${s.dim(`${num(a.totals.currentLines)} lines in ${num(a.totals.filesBlamed)} files`)}`,
    ),
  );
  const shown = a.groups.filter((g) => g.currentLines > 0);
  for (const g of shown) {
    const tint = g.kind === 'agent' ? s.cyan : g.kind === 'human' ? s.green : s.dim;
    out.push(
      `${tint(pad(label(g.key), nameW))}  ${tint(bar(g.currentShare, 30))}  ${lpad(pct(g.currentShare), 6)}`,
    );
  }
  if (a.totals.outOfScopeLines > 0) {
    out.push(
      s.dim(
        `${pad('(older history)', nameW)}  ${' '.repeat(30)}  ${lpad(pct(a.totals.outOfScopeLines / a.totals.currentLines), 6)}`,
      ),
    );
  }
  out.push('');

  const withData = a.buckets.filter((b) => b.agent.added > 0 || b.human.added > 0);
  if (withData.length > 0 && a.agents.added > 0) {
    out.push(
      s.bold('SURVIVAL BY AGE  ') +
        s.dim('(share of lines still alive, grouped by how old the lines are)'),
    );
    out.push(s.bold(`${pad('lines written', 15)}  ${lpad('agent', 14)}  ${lpad('human', 14)}`));
    for (const b of withData) {
      const cell = (x: { added: number; surviving: number }) =>
        x.added > 0 ? `${pct(x.surviving / x.added)} ${s.dim(`/${num(x.added)}`)}` : s.dim('-');
      const plain = (x: { added: number; surviving: number }) =>
        x.added > 0 ? `${pct(x.surviving / x.added)} /${num(x.added)}` : '-';
      out.push(
        `${pad(b.label, 15)}  ${' '.repeat(Math.max(0, 14 - plain(b.agent).length))}${cell(b.agent)}  ${' '.repeat(Math.max(0, 14 - plain(b.human).length))}${cell(b.human)}`,
      );
    }
    if (a.ageAdjusted) {
      const d = a.ageAdjusted.deltaPoints;
      const verdict =
        Math.abs(d) < 1
          ? 'about the same as'
          : d > 0
            ? s.green('better than')
            : s.red('worse than');
      out.push('');
      out.push(
        `Age-adjusted: agent lines survive at ${s.bold(pct(a.ageAdjusted.agentActual))}, ${verdict} the ${pct(a.ageAdjusted.agentExpected)}`,
      );
      out.push(
        `that human lines of the same ages achieve (${d >= 0 ? '+' : ''}${d.toFixed(1)} pp over ${num(a.ageAdjusted.linesCompared)} lines).`,
      );
      out.push(
        s.dim('A correlation, not a verdict: agents and humans tend to work on different code.'),
      );
    }
    out.push('');
  }

  if (a.files.length > 0) {
    out.push(s.bold('MOST AGENT-AUTHORED FILES'));
    const w = Math.min(52, Math.max(...a.files.map((f) => f.path.length)));
    for (const f of a.files) {
      const p = f.path.length > w ? `…${f.path.slice(f.path.length - w + 1)}` : f.path;
      out.push(
        `${pad(p, w)}  ${lpad(num(f.agentLines), 6)} / ${lpad(num(f.lines), 6)} lines  ${lpad(pct(f.share, 0), 4)}  ${s.dim(f.topAgent)}`,
      );
    }
    out.push('');
  }

  for (const n of a.notes) out.push(s.yellow(`note: ${n}`));
  if (a.notes.length > 0) out.push('');
  out.push(
    s.dim(
      'Survival = lines a commit added that git blame still attributes to it on HEAD (whitespace and in-file moves ignored).',
    ),
  );
  return `${out.join('\n')}\n`;
}
