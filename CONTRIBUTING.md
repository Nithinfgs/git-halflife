# Contributing

Thanks for helping. The project is small on purpose: zero runtime dependencies, one job.

## Setup

```bash
git clone https://github.com/Nithinfgs/git-halflife && cd git-halflife
npm install        # also builds
npm run ci         # typecheck + lint + build + tests
npm run demo       # try it on a synthetic repo
```

Requires Node 22.18+ for development (tests run TypeScript directly); the published CLI supports Node 18+.

## Where things live

| Path | Purpose |
|---|---|
| `src/detect.ts` | agent signatures (the most common contribution) |
| `src/history.ts`, `src/blame.ts` | reading git |
| `src/analyze.ts` | survival, age adjustment, half-life fit |
| `src/report/` | terminal, markdown, HTML renderers |
| `scripts/demo-repo.mjs` | deterministic synthetic repo for tests and demos |

## Adding an agent signature

1. Add a rule to `BUILTIN_RULES` in `src/detect.ts`. Anchor message rules to a trailer line (`^co-authored-by:`) or exact boilerplate. A commit that merely mentions an agent must not match.
2. Add a positive case and, if the name is a common word, a negative case in `test/unit.test.ts`.
3. Link to the tool's documentation of its commit marker in the PR.

## Guidelines

- Every behavior change needs a test. Survival math should be tested on hand-built histories (see `test/integration.test.ts`).
- Do not add runtime dependencies without discussion.
- Claims in docs must be reproducible. No benchmark numbers without a script that produces them.
- Run `npm run format` before committing. Commit messages follow Conventional Commits.
