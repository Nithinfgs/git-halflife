import type { Kind, Rule } from './types.ts';

/**
 * Built-in signatures. Message rules are anchored to trailer lines or the exact boilerplate
 * each tool appends, so a commit that merely *mentions* "Claude" is not misclassified.
 */
export const BUILTIN_RULES: Rule[] = [
  {
    agent: 'Claude Code',
    field: 'message',
    pattern: '^co-authored-by:.*\\bclaude\\b',
    flags: 'im',
  },
  { agent: 'Claude Code', field: 'message', pattern: 'generated with \\[?claude code', flags: 'i' },
  { agent: 'Claude Code', field: 'email', pattern: '@anthropic\\.com$', flags: 'i' },
  { agent: 'Copilot', field: 'message', pattern: '^co-authored-by:.*\\bcopilot\\b', flags: 'im' },
  { agent: 'Copilot', field: 'author', pattern: '^copilot(-swe-agent)?(\\[bot\\])?$', flags: 'i' },
  { agent: 'Codex', field: 'message', pattern: '^co-authored-by:.*\\bcodex\\b', flags: 'im' },
  { agent: 'Codex', field: 'author', pattern: 'chatgpt-codex-connector', flags: 'i' },
  {
    agent: 'Cursor',
    field: 'message',
    pattern: '^co-authored-by:.*\\bcursor(\\s?agent)?\\b',
    flags: 'im',
  },
  { agent: 'Cursor', field: 'email', pattern: '^cursoragent@cursor\\.com$', flags: 'i' },
  { agent: 'Gemini', field: 'message', pattern: '^co-authored-by:.*\\bgemini\\b', flags: 'im' },
  { agent: 'Gemini', field: 'message', pattern: 'generated with gemini', flags: 'i' },
  { agent: 'Jules', field: 'author', pattern: 'google-labs-jules', flags: 'i' },
  { agent: 'Aider', field: 'author', pattern: '\\(aider\\)', flags: 'i' },
  { agent: 'Aider', field: 'message', pattern: '^co-authored-by:\\s*aider\\b', flags: 'im' },
  { agent: 'Devin', field: 'author', pattern: 'devin-ai-integration', flags: 'i' },
  { agent: 'Amp', field: 'message', pattern: '^co-authored-by:.*<amp@ampcode\\.com>', flags: 'im' },
  { agent: 'OpenCode', field: 'message', pattern: '^co-authored-by:.*\\bopencode\\b', flags: 'im' },
];

/** Dependency and CI bots are tracked separately so they do not pollute the human baseline. */
const BOT_RULES: Rule[] = [
  { agent: 'bot', kind: 'bot', field: 'author', pattern: '\\[bot\\]$', flags: 'i' },
  {
    agent: 'bot',
    kind: 'bot',
    field: 'email',
    pattern: '\\[bot\\]@users\\.noreply\\.github\\.com$',
    flags: 'i',
  },
  {
    agent: 'bot',
    kind: 'bot',
    field: 'author',
    pattern: '^(dependabot|renovate|github-actions)\\b',
    flags: 'i',
  },
];

interface Compiled {
  agent: string;
  kind: Kind;
  field: Rule['field'];
  re: RegExp;
}

export interface Subject {
  authorName: string;
  authorEmail: string;
  message: string;
}

export type Classifier = (s: Subject) => { group: string; kind: Kind };

function compile(rules: Rule[]): Compiled[] {
  return rules.map((r) => {
    try {
      return {
        agent: r.agent,
        kind: r.kind ?? 'agent',
        field: r.field,
        re: new RegExp(r.pattern, r.flags),
      };
    } catch (e) {
      throw new Error(`invalid rule pattern for "${r.agent}": ${(e as Error).message}`);
    }
  });
}

/** Custom rules win over built-ins; agents win over generic bot rules. */
export function makeClassifier(custom: Rule[] = []): Classifier {
  const rules = compile([...custom, ...BUILTIN_RULES, ...BOT_RULES]);
  return (s) => {
    for (const r of rules) {
      const hay =
        r.field === 'message' ? s.message : r.field === 'author' ? s.authorName : s.authorEmail;
      if (r.re.test(hay)) return { group: r.agent, kind: r.kind };
    }
    return { group: 'human', kind: 'human' };
  };
}
