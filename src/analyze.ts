import type {
  AgeAdjusted,
  Analysis,
  BlameMap,
  BucketStats,
  CommitStats,
  FileStat,
  GroupStats,
  Kind,
} from './types.ts';

const DAY = 86400;

export const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: 'under 1 week', min: 0, max: 7 },
  { label: '1 - 4 weeks', min: 7, max: 30 },
  { label: '1 - 3 months', min: 30, max: 90 },
  { label: '3 - 12 months', min: 90, max: 365 },
  { label: 'over 1 year', min: 365, max: Number.POSITIVE_INFINITY },
];

/** Minimum lines on each side of a bucket before it counts toward the age-adjusted comparison. */
const MIN_BUCKET_LINES = 50;
const MIN_FIT_LINES = 100;
const MIN_LAMBDA = 1e-5;
/** Oldest observation must span at least this long before a half-life means anything. */
const MIN_SPAN_DAYS = 30;
const MAX_EXTRAPOLATION = 4;

export interface Observation {
  added: number;
  surviving: number;
  ageDays: number;
}

/**
 * Fit exponential decay S(t) = exp(-lambda t) by maximum likelihood, treating each surviving
 * line as an independent Bernoulli trial. This is a deliberately crude model (real code has
 * a mix of throwaway and permanent lines), so the result is reported as "approximate".
 */
export function fitHalfLife(obs: Observation[]): { halfLifeDays: number | null; stable: boolean } {
  const total = obs.reduce((n, o) => n + o.added, 0);
  const maxAge = Math.max(0, ...obs.map((o) => o.ageDays));
  if (total < MIN_FIT_LINES || maxAge < MIN_SPAN_DAYS) return { halfLifeDays: null, stable: false };
  const ll = (lambda: number): number => {
    let sum = 0;
    for (const o of obs) {
      const p = Math.min(1 - 1e-12, Math.max(1e-12, Math.exp(-lambda * o.ageDays)));
      sum += o.surviving * Math.log(p) + (o.added - o.surviving) * Math.log(1 - p);
    }
    return sum;
  };
  let best = MIN_LAMBDA;
  let bestLL = ll(best);
  const steps = 600;
  for (let i = 1; i <= steps; i++) {
    const lambda = MIN_LAMBDA * 10 ** ((i / steps) * 5); // 1e-5 .. 1 per day
    const v = ll(lambda);
    if (v > bestLL) {
      bestLL = v;
      best = lambda;
    }
  }
  const halfLifeDays = Math.LN2 / best;
  // Extrapolating far beyond the oldest observation is guesswork, so call it "no decay seen".
  if (best <= MIN_LAMBDA * 1.05 || halfLifeDays > MAX_EXTRAPOLATION * maxAge) {
    return { halfLifeDays: null, stable: true };
  }
  return { halfLifeDays, stable: false };
}

interface Acc {
  key: string;
  kind: Kind;
  commits: number;
  added: number;
  surviving: number;
  currentLines: number;
  obs: Observation[];
}

function acc(key: string, kind: Kind): Acc {
  return { key, kind, commits: 0, added: 0, surviving: 0, currentLines: 0, obs: [] };
}

function finish(a: Acc, totalCurrent: number): GroupStats {
  const fit = fitHalfLife(a.obs);
  return {
    key: a.key,
    kind: a.kind,
    commits: a.commits,
    added: a.added,
    surviving: a.surviving,
    survival: a.added > 0 ? a.surviving / a.added : null,
    halfLifeDays: fit.halfLifeDays,
    stable: fit.stable,
    currentLines: a.currentLines,
    currentShare: totalCurrent > 0 ? a.currentLines / totalCurrent : 0,
  };
}

export interface AnalyzeInput {
  repo: string;
  head: string;
  stats: CommitStats[];
  blame: BlameMap;
  /** Reference time in unix seconds. */
  asOf: number;
  maxCommitLines: number;
  shallow?: boolean;
  skippedFiles?: number;
  topFiles?: number;
}

export function analyze(input: AnalyzeInput): Analysis {
  const { stats, blame, asOf, maxCommitLines } = input;
  const bySha = new Map<string, CommitStats>();
  for (const s of stats) bySha.set(s.commit.sha, s);

  // Lines currently on HEAD, attributed to each commit (all files, uncapped).
  const alive = new Map<string, number>();
  const fileStats: FileStat[] = [];
  let outOfScope = 0;
  let currentLines = 0;
  for (const [path, counts] of blame) {
    let lines = 0;
    let agentLines = 0;
    const perAgent = new Map<string, number>();
    for (const [sha, n] of counts) {
      lines += n;
      const s = bySha.get(sha);
      if (!s) {
        outOfScope += n;
        continue;
      }
      alive.set(sha, (alive.get(sha) ?? 0) + n);
      if (s.commit.kind === 'agent') {
        agentLines += n;
        perAgent.set(s.commit.group, (perAgent.get(s.commit.group) ?? 0) + n);
      }
    }
    currentLines += lines;
    if (agentLines > 0) {
      const top = [...perAgent].sort((a, b) => b[1] - a[1])[0];
      fileStats.push({
        path,
        lines,
        agentLines,
        share: lines > 0 ? agentLines / lines : 0,
        topAgent: top ? top[0] : '',
      });
    }
  }

  const groups = new Map<string, Acc>();
  const agents = acc('all agents', 'agent');
  const human = acc('human', 'human');
  const buckets: BucketStats[] = BUCKETS.map((b) => ({
    label: b.label,
    agent: { added: 0, surviving: 0 },
    human: { added: 0, surviving: 0 },
  }));
  let excluded = 0;
  let linesExcluded = 0;
  let agentCommits = 0;

  for (const s of stats) {
    const { commit } = s;
    if (commit.kind === 'agent') agentCommits++;
    const live = alive.get(commit.sha) ?? 0;
    const g = groups.get(commit.group) ?? acc(commit.group, commit.kind);
    groups.set(commit.group, g);
    g.currentLines += live;
    if (commit.kind === 'agent') agents.currentLines += live;
    if (commit.kind === 'human') human.currentLines += live;

    if (s.added === 0) continue;
    if (s.added > maxCommitLines) {
      excluded++;
      linesExcluded += s.added;
      continue;
    }
    // Blame can attribute more lines than a commit added after -M follows moves; cap at 100%.
    const surviving = Math.min(live, s.added);
    const ageDays = Math.max(0.5, (asOf - commit.date) / DAY);
    const o: Observation = { added: s.added, surviving, ageDays };
    const targets = [g];
    if (commit.kind === 'agent') targets.push(agents);
    if (commit.kind === 'human') targets.push(human);
    for (const t of targets) {
      t.commits++;
      t.added += s.added;
      t.surviving += surviving;
      t.obs.push(o);
    }
    if (commit.kind === 'agent' || commit.kind === 'human') {
      const bi = BUCKETS.findIndex((b) => ageDays >= b.min && ageDays < b.max);
      const side = (buckets[bi] as BucketStats)[commit.kind];
      side.added += s.added;
      side.surviving += surviving;
    }
  }

  const finished = [...groups.values()]
    .map((g) => finish(g, currentLines))
    .sort((a, b) => b.added - a.added);

  const notes: string[] = [];
  if (input.shallow) {
    notes.push(
      'Shallow clone: history before the clone depth is missing, so older lines look like they came from outside the analysis.',
    );
  }
  if (excluded > 0) {
    notes.push(
      `${excluded} commit(s) adding more than ${maxCommitLines} lines (${linesExcluded.toLocaleString('en-US')} lines) were left out of survival stats as bulk imports; they still count toward "now on HEAD".`,
    );
  }
  if (input.skippedFiles)
    notes.push(`${input.skippedFiles} file(s) could not be blamed and were skipped.`);
  if (agentCommits === 0) {
    notes.push(
      'No agent signatures were found. If your tools leave different markers, add rules in .halflife.json.',
    );
  }

  return {
    repo: input.repo,
    head: input.head,
    asOf,
    detection: {
      agentCommits,
      totalCommits: stats.length,
      share: stats.length > 0 ? agentCommits / stats.length : 0,
    },
    totals: {
      commitsAnalyzed: stats.length,
      commitsExcluded: excluded,
      linesExcluded,
      filesBlamed: blame.size,
      currentLines,
      outOfScopeLines: outOfScope,
    },
    groups: finished,
    agents: finish(agents, currentLines),
    human: finish(human, currentLines),
    buckets,
    ageAdjusted: ageAdjust(buckets),
    files: fileStats.sort((a, b) => b.agentLines - a.agentLines).slice(0, input.topFiles ?? 10),
    notes,
  };
}

/**
 * Compare agent survival against what human lines of the *same ages* achieved. Without this,
 * "agent code survives less" often just means "agent code is newer".
 */
export function ageAdjust(buckets: BucketStats[]): AgeAdjusted | null {
  let compared = 0;
  let actual = 0;
  let expected = 0;
  for (const b of buckets) {
    if (b.agent.added < MIN_BUCKET_LINES || b.human.added < MIN_BUCKET_LINES) continue;
    compared += b.agent.added;
    actual += b.agent.surviving;
    expected += b.agent.added * (b.human.surviving / b.human.added);
  }
  if (compared === 0) return null;
  return {
    agentActual: actual / compared,
    agentExpected: expected / compared,
    deltaPoints: ((actual - expected) / compared) * 100,
    linesCompared: compared,
  };
}
