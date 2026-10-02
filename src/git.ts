import { spawn } from 'node:child_process';

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitError';
  }
}

/** Run git in `cwd` and resolve with stdout. Never goes through a shell. */
export function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-c', 'core.quotepath=off', ...args], {
      cwd,
      env: { ...process.env, LC_ALL: 'C', GIT_OPTIONAL_LOCKS: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (b: Buffer) => out.push(b));
    child.stderr.on('data', (b: Buffer) => err.push(b));
    child.on('error', (e: NodeJS.ErrnoException) => {
      reject(
        new GitError(
          e.code === 'ENOENT' ? 'git was not found on PATH' : `failed to run git: ${e.message}`,
        ),
      );
    });
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out).toString('utf8'));
      else {
        const msg = Buffer.concat(err).toString('utf8').trim();
        reject(new GitError(msg || `git ${args[0]} exited with code ${code}`));
      }
    });
  });
}

export async function repoRoot(cwd: string): Promise<string> {
  try {
    return (await git(cwd, ['rev-parse', '--show-toplevel'])).trim();
  } catch {
    throw new GitError(`not a git repository: ${cwd}`);
  }
}

export async function headSha(root: string): Promise<string> {
  try {
    return (await git(root, ['rev-parse', 'HEAD'])).trim();
  } catch {
    throw new GitError('this repository has no commits yet');
  }
}

export async function isShallow(root: string): Promise<boolean> {
  try {
    return (await git(root, ['rev-parse', '--is-shallow-repository'])).trim() === 'true';
  } catch {
    return false;
  }
}
