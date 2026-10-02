import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export interface TestRepo {
  dir: string;
  write(path: string, content: string): void;
  commit(message: string, opts?: { name?: string; email?: string; date?: string }): string;
  git(...args: string[]): string;
}

export function makeRepo(): TestRepo {
  const dir = mkdtempSync(join(tmpdir(), 'halflife-test-'));
  const run = (args: string[], env: Record<string, string> = {}): string =>
    execFileSync('git', args, {
      cwd: dir,
      env: { ...process.env, ...env },
      stdio: 'pipe',
    }).toString();
  run(['init', '-q', '-b', 'main']);
  run(['config', 'commit.gpgsign', 'false']);
  return {
    dir,
    write(path, content) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), content);
    },
    commit(
      message,
      { name = 'Dev', email = 'dev@example.com', date = '2026-01-01T12:00:00Z' } = {},
    ) {
      run(['add', '-A']);
      run(['commit', '-q', '-m', message], {
        GIT_AUTHOR_NAME: name,
        GIT_AUTHOR_EMAIL: email,
        GIT_COMMITTER_NAME: name,
        GIT_COMMITTER_EMAIL: email,
        GIT_AUTHOR_DATE: date,
        GIT_COMMITTER_DATE: date,
      });
      return run(['rev-parse', 'HEAD']).trim();
    },
    git: (...args) => run(args),
  };
}

export const lines = (prefix: string, n: number): string =>
  `${Array.from({ length: n }, (_, i) => `${prefix} ${i}`).join('\n')}\n`;
