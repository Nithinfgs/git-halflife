import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config, Kind, Rule } from './types.ts';

export const DEFAULT_MAX_COMMIT_LINES = 5000;

const FIELDS = new Set(['message', 'author', 'email']);
const KINDS = new Set(['human', 'agent', 'bot']);

export function parseConfig(raw: unknown, source: string): Partial<Config> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`${source}: expected a JSON object`);
  }
  const o = raw as Record<string, unknown>;
  const out: Partial<Config> = {};
  if (o.rules !== undefined) {
    if (!Array.isArray(o.rules)) throw new Error(`${source}: "rules" must be an array`);
    out.rules = o.rules.map((r, i): Rule => {
      const x = r as Record<string, unknown>;
      if (typeof x?.agent !== 'string' || !x.agent)
        throw new Error(`${source}: rules[${i}].agent must be a string`);
      if (typeof x.pattern !== 'string')
        throw new Error(`${source}: rules[${i}].pattern must be a string`);
      if (typeof x.field !== 'string' || !FIELDS.has(x.field)) {
        throw new Error(`${source}: rules[${i}].field must be one of message, author, email`);
      }
      if (x.kind !== undefined && (typeof x.kind !== 'string' || !KINDS.has(x.kind))) {
        throw new Error(`${source}: rules[${i}].kind must be human, agent or bot`);
      }
      const rule: Rule = { agent: x.agent, field: x.field as Rule['field'], pattern: x.pattern };
      if (typeof x.flags === 'string') rule.flags = x.flags;
      if (typeof x.kind === 'string') rule.kind = x.kind as Kind;
      return rule;
    });
  }
  if (o.ignore !== undefined) {
    if (!Array.isArray(o.ignore) || o.ignore.some((g) => typeof g !== 'string')) {
      throw new Error(`${source}: "ignore" must be an array of strings`);
    }
    out.ignore = o.ignore as string[];
  }
  if (o.maxCommitLines !== undefined) {
    if (typeof o.maxCommitLines !== 'number' || o.maxCommitLines < 1) {
      throw new Error(`${source}: "maxCommitLines" must be a positive number`);
    }
    out.maxCommitLines = o.maxCommitLines;
  }
  return out;
}

/** Load `.halflife.json` from the repo root (or an explicit path). Missing default file is fine. */
export async function loadConfig(root: string, explicit?: string): Promise<Partial<Config>> {
  const path = explicit ?? join(root, '.halflife.json');
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (e) {
    if (!explicit && (e as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new Error(`cannot read config ${path}: ${(e as Error).message}`);
  }
  try {
    return parseConfig(JSON.parse(text), path);
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error(`${path}: invalid JSON (${e.message})`);
    throw e;
  }
}
