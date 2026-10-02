import { git } from './git.ts';
import type { BlameMap } from './types.ts';

const HEADER = /^([0-9a-f]{40}) \d+ \d+ (\d+)$/;

/** Parse `git blame --incremental`: one header per run of lines, with the run length last. */
export function parseIncremental(raw: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of raw.split('\n')) {
    const m = HEADER.exec(line);
    if (m) counts.set(m[1] as string, (counts.get(m[1] as string) ?? 0) + Number(m[2]));
  }
  return counts;
}

export async function listFiles(root: string): Promise<string[]> {
  const out = await git(root, ['ls-files', '-z', '--cached']);
  return out.split('\0').filter(Boolean);
}

/**
 * Blame every file at HEAD. `-w` ignores whitespace-only edits and `-M` follows lines moved
 * within a file, so reformatting does not count as "rewriting" agent code.
 */
export async function blameFiles(
  root: string,
  files: string[],
  opts: { concurrency?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<{ blame: BlameMap; skipped: string[] }> {
  const blame: BlameMap = new Map();
  const skipped: string[] = [];
  const limit = Math.max(1, opts.concurrency ?? 6);
  let next = 0;
  let done = 0;
  async function worker(): Promise<void> {
    while (next < files.length) {
      const file = files[next++] as string;
      try {
        const raw = await git(root, ['blame', '--incremental', '-w', '-M', 'HEAD', '--', file]);
        blame.set(file, parseIncremental(raw));
      } catch {
        skipped.push(file); // submodules, files deleted from the index, etc.
      }
      opts.onProgress?.(++done, files.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, files.length) }, worker));
  return { blame, skipped };
}
