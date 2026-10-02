export type Kind = 'human' | 'agent' | 'bot';

export interface Commit {
  sha: string;
  authorName: string;
  authorEmail: string;
  /** Author date, unix seconds. */
  date: number;
  message: string;
  /** Group key: "human", "bot", or an agent name such as "Claude Code". */
  group: string;
  kind: Kind;
}

export interface FileAdd {
  path: string;
  added: number;
}

export interface CommitStats {
  commit: Commit;
  files: FileAdd[];
  /** Lines added across all non-ignored files. */
  added: number;
}

export interface Rule {
  agent: string;
  kind?: Kind;
  field: 'message' | 'author' | 'email';
  pattern: string;
  flags?: string;
}

export interface Config {
  rules: Rule[];
  ignore: string[];
  maxCommitLines: number;
}

/** sha -> number of lines currently attributed to it, per file at HEAD. */
export type BlameMap = Map<string, Map<string, number>>;

export interface GroupStats {
  key: string;
  kind: Kind;
  commits: number;
  added: number;
  surviving: number;
  survival: number | null;
  /** Approximate half-life in days; null when it cannot be estimated. */
  halfLifeDays: number | null;
  /** True when (almost) no decay was observed, so the half-life is unbounded. */
  stable: boolean;
  currentLines: number;
  currentShare: number;
}

export interface BucketSide {
  added: number;
  surviving: number;
}

export interface BucketStats {
  label: string;
  agent: BucketSide;
  human: BucketSide;
}

export interface AgeAdjusted {
  agentActual: number;
  agentExpected: number;
  deltaPoints: number;
  linesCompared: number;
}

export interface FileStat {
  path: string;
  lines: number;
  agentLines: number;
  share: number;
  topAgent: string;
}

export interface Analysis {
  repo: string;
  head: string;
  asOf: number;
  detection: { agentCommits: number; totalCommits: number; share: number };
  totals: {
    commitsAnalyzed: number;
    commitsExcluded: number;
    linesExcluded: number;
    filesBlamed: number;
    currentLines: number;
    outOfScopeLines: number;
  };
  groups: GroupStats[];
  agents: GroupStats;
  human: GroupStats;
  buckets: BucketStats[];
  ageAdjusted: AgeAdjusted | null;
  files: FileStat[];
  notes: string[];
}
