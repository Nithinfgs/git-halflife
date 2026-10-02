import type { Classifier } from './detect.ts';
import { git } from './git.ts';
import type { CommitStats, FileAdd } from './types.ts';

const RS = '\x1e';
const US = '\x1f';

/** Resolve git's rename notation (`a/{b => c}/d`, `old => new`) to the new path. */
export function renamedPath(p: string): string {
  const brace = p.match(/^(.*)\{(.*) => (.*)\}(.*)$/);
  if (brace) return `${brace[1]}${brace[3]}${brace[4]}`.replace(/\/\//g, '/');
  const plain = p.match(/^.* => (.*)$/);
  return plain ? (plain[1] as string) : p;
}

/** Parse the output of `git log --numstat` produced by readHistory. Exported for tests. */
export function parseHistory(
  raw: string,
  classify: Classifier,
  isIgnored: (path: string) => boolean,
): CommitStats[] {
  const out: CommitStats[] = [];
  for (const rec of raw.split(RS)) {
    if (!rec.trim()) continue;
    const parts = rec.split(US);
    const [sha, authorName, authorEmail, at, message, stat] = parts;
    if (!sha || !at) continue;
    const files: FileAdd[] = [];
    let added = 0;
    for (const line of (stat ?? '').split('\n')) {
      const m = line.match(/^(\d+)\t(\d+)\t(.+)$/);
      if (!m) continue; // binary files show "-\t-\t"
      const path = renamedPath(m[3] as string);
      const n = Number(m[1]);
      if (n === 0 || isIgnored(path)) continue;
      files.push({ path, added: n });
      added += n;
    }
    const msg = message ?? '';
    const { group, kind } = classify({
      authorName: authorName ?? '',
      authorEmail: authorEmail ?? '',
      message: msg,
    });
    out.push({
      commit: {
        sha: sha.trim(),
        authorName: authorName ?? '',
        authorEmail: authorEmail ?? '',
        date: Number(at),
        message: msg,
        group,
        kind,
      },
      files,
      added,
    });
  }
  return out;
}

export async function readHistory(
  root: string,
  classify: Classifier,
  isIgnored: (path: string) => boolean,
  since?: string,
): Promise<CommitStats[]> {
  const args = [
    'log',
    '--no-merges',
    '-M',
    '--numstat',
    `--format=${RS}%H${US}%an${US}%ae${US}%at${US}%B${US}`,
  ];
  if (since) args.push(`--since=${since}`);
  return parseHistory(await git(root, args), classify, isIgnored);
}
