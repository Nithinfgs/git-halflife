# Design

## Spec

- **Name:** git-halflife (`git halflife` works because the binary is `git-halflife`)
- **Pitch:** How long does AI-written code actually survive in your repo?
- **Problem:** Teams measure agent output by volume. Nobody can cheaply see how much of it is still there months later.
- **Users:** engineers and tech leads on repos with agent-assisted history; people writing retros, adoption reports, or just curious.
- **Core workflow:** `npx github:Nithinfgs/git-halflife` in a repo, read one screen.
- **Killer feature:** age-adjusted survival of agent vs human lines, computed retroactively.
- **Non-goals:** ranking people, judging code quality, detecting unmarked AI code by style, any network or LLM calls, GitHub API integration.

## Architecture

```
cli.ts -> args.ts (flags) -> run.ts (orchestrates)
run.ts -> history.ts  (git log --numstat, classify via detect.ts, ignore via ignore.ts)
       -> blame.ts    (git ls-files, git blame --incremental, 6 in parallel)
       -> analyze.ts  (pure: survival, buckets, age adjustment, half-life MLE)
       -> report/*    (pure: terminal, markdown, html)
```

`analyze.ts` and `report/*` are pure functions over plain data, so they are tested without git. `test/integration.test.ts` builds small real repositories with exact expected survival numbers.

## Decisions

- **Zero runtime dependencies**, only the `git` binary. Keeps `npx` fast and the supply-chain surface empty for a tool people run on private repos.
- **`git blame --incremental`** instead of `--line-porcelain`: one header per run of lines, far less output on large files.
- **`-w -M`, no `-C`**: reformatting and in-file moves are not rewrites; cross-file copy detection is slow and muddies per-file attribution.
- **Capping survival per commit at lines added**: `-M` can attribute more lines to a commit than it added.
- **Bulk-commit exclusion** (default 5,000 lines): initial imports and vendored drops would dominate every statistic.
- **Bots are a separate class** so dependency bumps do not flatter the human baseline.
- **Message rules anchored to trailers/boilerplate**: "docs: explain how Claude works" must not count as an agent commit.
- **Half-life guard rails**: refuse to extrapolate from young data; say "no decay seen" instead of printing a number nobody can support.
- **TypeScript with `.ts` import specifiers** and `rewriteRelativeImportExtensions`: tests run TypeScript directly on Node 22.18+, and the build emits plain JS for Node 18+.
