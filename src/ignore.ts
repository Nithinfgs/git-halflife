/** Built-in ignore globs: generated, vendored, binary and lock files are not "authored" code. */
export const DEFAULT_IGNORE: string[] = [
  '**/node_modules/**',
  '**/vendor/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/__snapshots__/**',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/bun.lock',
  '**/Cargo.lock',
  '**/poetry.lock',
  '**/uv.lock',
  '**/Gemfile.lock',
  '**/composer.lock',
  '**/go.sum',
  '**/*.min.js',
  '**/*.min.css',
  '**/*.map',
  '**/*.snap',
  '**/*.{png,jpg,jpeg,gif,webp,ico,svg,pdf,zip,gz,tgz,woff,woff2,ttf,eot,mp3,mp4,mov,wasm}',
];

function escapeRe(ch: string): string {
  return ch.replace(/[.+^$()|[\]\\]/g, '\\$&');
}

/**
 * Convert a small glob dialect to a RegExp: `**` spans directories, `*` and `?` do not,
 * `{a,b}` alternates, a leading `/` anchors to the repo root, a trailing `/` matches a directory.
 */
export function globToRegExp(glob: string): RegExp {
  let g = glob.trim();
  const anchored = g.startsWith('/');
  if (anchored) g = g.slice(1);
  if (g.endsWith('/')) g = `${g}**`;
  let re = '';
  let inBraces = false;
  for (let i = 0; i < g.length; i++) {
    const c = g[i] as string;
    if (c === '*') {
      if (g[i + 1] === '*') {
        i++;
        if (g[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') {
      inBraces = true;
      re += '(?:';
    } else if (c === '}' && inBraces) {
      inBraces = false;
      re += ')';
    } else if (c === ',' && inBraces) re += '|';
    else re += escapeRe(c);
  }
  // Patterns without a slash match at any depth, like .gitignore.
  const prefix = anchored || glob.includes('/') ? '^' : '^(?:.*/)?';
  return new RegExp(`${prefix}${re}$`);
}

export function makeIgnore(globs: string[]): (path: string) => boolean {
  const res = globs.map(globToRegExp);
  return (path) => res.some((r) => r.test(path));
}
