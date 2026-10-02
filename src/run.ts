import { analyze } from './analyze.ts';
import { blameFiles, listFiles } from './blame.ts';
import { DEFAULT_MAX_COMMIT_LINES, loadConfig } from './config.ts';
import { makeClassifier } from './detect.ts';
import { git, headSha, isShallow, repoRoot } from './git.ts';
import { readHistory } from './history.ts';
import { DEFAULT_IGNORE, makeIgnore } from './ignore.ts';
import type { Analysis, Commit } from './types.ts';

export interface RunOptions {
  cwd: string;
  since?: string;
  /** Reference time, unix seconds. Defaults to now. */
  asOf?: number;
  ignore?: string[];
  maxCommitLines?: number;
  configPath?: string;
  top?: number;
  onProgress?: (done: number, total: number) => void;
}

async function setup(opts: RunOptions) {
  const root = await repoRoot(opts.cwd);
  const config = await loadConfig(root, opts.configPath);
  const ignore = makeIgnore([...DEFAULT_IGNORE, ...(config.ignore ?? []), ...(opts.ignore ?? [])]);
  const classify = makeClassifier(config.rules ?? []);
  return { root, config, ignore, classify };
}

export async function run(opts: RunOptions): Promise<Analysis> {
  const { root, config, ignore, classify } = await setup(opts);
  const head = await headSha(root);
  const [stats, files, shallow] = await Promise.all([
    readHistory(root, classify, ignore, opts.since),
    listFiles(root),
    isShallow(root),
  ]);
  const wanted = files.filter((f) => !ignore(f));
  const { blame, skipped } = await blameFiles(root, wanted, { onProgress: opts.onProgress });
  return analyze({
    repo: root,
    head,
    stats,
    blame,
    asOf: opts.asOf ?? Math.floor(Date.now() / 1000),
    maxCommitLines: opts.maxCommitLines ?? config.maxCommitLines ?? DEFAULT_MAX_COMMIT_LINES,
    shallow,
    skippedFiles: skipped.length,
    topFiles: opts.top,
  });
}

export interface BlameLine {
  line: number;
  sha: string;
  group: string;
  kind: Commit['kind'];
  text: string;
}

/** Per-line attribution for one file at HEAD, for `git-halflife blame`. */
export async function blameFile(opts: RunOptions, file: string): Promise<BlameLine[]> {
  const { root, classify } = await setup(opts);
  await headSha(root);
  const raw = await git(root, ['blame', '--porcelain', '-w', '-M', 'HEAD', '--', file]);
  const cache = new Map<string, { group: string; kind: Commit['kind'] }>();
  const out: BlameLine[] = [];
  let sha = '';
  let line = 0;
  for (const l of raw.split('\n')) {
    const h = /^([0-9a-f]{40}) \d+ (\d+)/.exec(l);
    if (h) {
      sha = h[1] as string;
      line = Number(h[2]);
      if (!cache.has(sha)) {
        const msg = await git(root, ['show', '-s', '--format=%an%x1f%ae%x1f%B', sha]);
        const [authorName = '', authorEmail = '', ...rest] = msg.split('\x1f');
        cache.set(sha, classify({ authorName, authorEmail, message: rest.join('\x1f') }));
      }
    } else if (l.startsWith('\t')) {
      const c = cache.get(sha) ?? { group: 'human', kind: 'human' as const };
      out.push({ line, sha, group: c.group, kind: c.kind, text: l.slice(1) });
    }
  }
  return out;
}
