#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Args, HELP, UsageError, parseArgs } from './args.ts';
import { BUILTIN_RULES } from './detect.ts';
import { renderHtml } from './report/html.ts';
import { renderMarkdown } from './report/markdown.ts';
import { makeStyle, renderTerminal } from './report/terminal.ts';
import { blameFile, run } from './run.ts';

function toUnix(s: string, flag: string): number {
  const t = Date.parse(s);
  if (Number.isNaN(t)) throw new UsageError(`${flag}: cannot parse date "${s}"`);
  return Math.floor(t / 1000);
}

function version(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const p of [join(here, '..', 'package.json'), join(here, '..', '..', 'package.json')]) {
    try {
      return (JSON.parse(readFileSync(p, 'utf8')) as { version: string }).version;
    } catch {}
  }
  return 'unknown';
}

async function main(): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2), process.env, Boolean(process.stdout.isTTY));
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    if (e.message === '__version__') {
      console.log(version());
      return 0;
    }
    if (e.message === '') {
      process.stdout.write(HELP);
      return 0;
    }
    process.stderr.write(`error: ${e.message}\n\n${HELP}`);
    return 2;
  }
  const style = makeStyle(args.color);

  if (args.command === 'rules') {
    for (const r of BUILTIN_RULES)
      console.log(`${r.agent.padEnd(12)} ${r.field.padEnd(8)} /${r.pattern}/${r.flags ?? ''}`);
    return 0;
  }

  try {
    const base = {
      cwd: args.command === 'blame' ? process.cwd() : args.target,
      since: args.since,
      asOf: args.asOf ? toUnix(args.asOf, '--as-of') : undefined,
      ignore: args.ignore,
      maxCommitLines: args.maxCommitLines,
      configPath: args.config,
      top: args.top,
    };
    if (args.command === 'blame') {
      for (const l of await blameFile(base, args.target)) {
        const tag =
          l.kind === 'agent'
            ? style.cyan(l.group.padEnd(12))
            : style.dim((l.kind === 'bot' ? 'bot' : '').padEnd(12));
        console.log(
          `${tag} ${style.dim(l.sha.slice(0, 7))} ${String(l.line).padStart(4)}  ${l.text}`,
        );
      }
      return 0;
    }
    const showProgress = Boolean(process.stderr.isTTY) && !args.json && !args.md;
    const analysis = await run({
      ...base,
      onProgress: showProgress
        ? (d, t) => process.stderr.write(`\r${style.dim(`blaming ${d}/${t} files`)}  `)
        : undefined,
    });
    if (showProgress) process.stderr.write('\r\x1b[K');
    if (args.html) {
      writeFileSync(args.html, renderHtml(analysis));
      process.stderr.write(`wrote ${args.html}\n`);
    }
    if (args.json) console.log(JSON.stringify(analysis, null, 2));
    else if (args.md) process.stdout.write(renderMarkdown(analysis));
    else process.stdout.write(renderTerminal(analysis, style));
    return 0;
  } catch (e) {
    if (e instanceof UsageError) {
      process.stderr.write(`error: ${e.message}\n`);
      return 2;
    }
    process.stderr.write(`error: ${(e as Error).message}\n`);
    return 1;
  }
}

process.exitCode = await main();
