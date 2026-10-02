export const HELP = `git-halflife - how long does AI-written code survive in your repo?

Usage
  git-halflife [path]              analyze the repo containing path (default: .)
  git-halflife blame <file>        per-line attribution for one file
  git-halflife rules               list the built-in agent signatures

Options
  --since <date>          only count commits since this date (e.g. 2026-01-01, "6 months ago")
  --as-of <date>          measure ages relative to this date instead of today
  --ignore <glob>         extra glob to skip (repeatable)
  --max-commit-lines <n>  leave out bulk commits adding more lines than this (default 5000)
  --config <file>         use this config instead of <repo>/.halflife.json
  --top <n>               files to list in the report (default 10)
  --json                  machine-readable output
  --md                    markdown summary, handy for PR comments
  --html <file>           write a self-contained HTML report
  --color / --no-color    force or disable colors (NO_COLOR is honored)
  -v, --version           print the version
  -h, --help              show this help

Everything runs locally: only git is invoked, nothing is sent anywhere.
`;

export interface Args {
  command: 'report' | 'blame' | 'rules';
  target: string;
  since?: string;
  asOf?: string;
  ignore: string[];
  maxCommitLines?: number;
  config?: string;
  top?: number;
  json: boolean;
  md: boolean;
  html?: string;
  color: boolean;
}

export class UsageError extends Error {}

export function parseArgs(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  isTTY = false,
): Args {
  const a: Args = {
    command: 'report',
    target: '.',
    ignore: [],
    json: false,
    md: false,
    color: isTTY && !env.NO_COLOR,
  };
  const rest = [...argv];
  const value = (flag: string): string => {
    const v = rest.shift();
    if (v === undefined || v.startsWith('--')) throw new UsageError(`${flag} needs a value`);
    return v;
  };
  const number = (flag: string): number => {
    const n = Number(value(flag));
    if (!Number.isFinite(n) || n < 1) throw new UsageError(`${flag} must be a positive number`);
    return n;
  };
  let first = true;
  while (rest.length > 0) {
    const arg = rest.shift() as string;
    const [flag, inline] =
      arg.startsWith('--') && arg.includes('=')
        ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]
        : [arg, undefined];
    if (inline !== undefined) rest.unshift(inline);
    switch (flag) {
      case '--since':
        a.since = value(flag);
        break;
      case '--as-of':
        a.asOf = value(flag);
        break;
      case '--ignore':
        a.ignore.push(value(flag));
        break;
      case '--max-commit-lines':
        a.maxCommitLines = number(flag);
        break;
      case '--config':
        a.config = value(flag);
        break;
      case '--top':
        a.top = number(flag);
        break;
      case '--json':
        a.json = true;
        break;
      case '--md':
        a.md = true;
        break;
      case '--html':
        a.html = value(flag);
        break;
      case '--color':
        a.color = true;
        break;
      case '--no-color':
        a.color = false;
        break;
      case '-h':
      case '--help':
        throw new UsageError('');
      case '-v':
      case '--version':
        throw new UsageError('__version__');
      default:
        if (flag.startsWith('-')) throw new UsageError(`unknown option ${flag}`);
        if (first && (flag === 'blame' || flag === 'rules')) a.command = flag;
        else a.target = flag;
    }
    first = false;
  }
  if (a.command === 'blame' && a.target === '.')
    throw new UsageError('blame needs a file: git-halflife blame <file>');
  return a;
}
