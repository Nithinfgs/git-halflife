# Launch drafts

Nothing here has been posted. Replace `<...>` with numbers from **your own** repos before posting; do not post the synthetic demo numbers as findings. Post when you can answer comments for a few hours.

## Hacker News (Show HN)

**Title:** Show HN: git-halflife, how long does AI-written code survive in your repo?

**URL:** https://github.com/Nithinfgs/git-halflife

**First comment:**

> I kept seeing teams measure AI coding by volume (commits, lines, acceptance rate) and nobody asking whether the code was still there six months later, so I built a retroactive measurement.
>
> It reads your git history, recognizes agent commits from the markers tools already leave (Co-Authored-By trailers, "Generated with Claude Code", Copilot/Codex/Cursor/Gemini/Aider/Devin identities, plus custom rules), runs `git blame` at HEAD, and reports for each author class how many of the lines they added still exist. The part I care about is the age adjustment: agent code is usually newer, which alone makes it look short-lived, so it compares agent lines against human lines of the same age.
>
> Zero dependencies besides git, offline, no hooks. `npx github:Nithinfgs/git-halflife` in any repo (npm release to follow).
>
> Limitations, up front: detection is a lower bound (unmarked AI commits count as human), survival is not quality, and agents and humans work on different code, so the age adjustment removes one confounder, not all. I ran it on a few repos with thousands of commits; the results differed a lot between repos, which is partly why I'd like to see yours.
>
> What I'd most like feedback on: commit markers I'm missing, and whether last-touch blame attribution is the right definition of "survived".

## Reddit (r/programming-style, r/ClaudeAI, r/ExperiencedDevs where self-promo rules allow; read each sub's rules first)

**Title:** I built a tool to see whether AI-written code actually survives in a repo (offline, from git history)

> A lot of the conversation about AI coding is about how much gets written. I wanted to know what happens afterwards, so I wrote git-halflife.
>
> How it works: it finds agent commits via trailers and bot identities, runs blame on HEAD, and shows per author class how many added lines are still alive, plus a comparison against human lines of the same age (otherwise "newer code" explains everything).
>
> Why I think it's useful: it's a retro tool. "Which parts of the codebase are mostly agent-written, and does that code stick?" is a question you can answer in one command, without installing hooks or sending code anywhere.
>
> Honest caveats are in the README: detection is a lower bound, survival isn't quality, and the comparison is correlational.
>
> Repo: https://github.com/Nithinfgs/git-halflife
>
> Feedback I want: agent markers I should detect, repos where the numbers look wrong, and whether the report answers a question you actually have.

## X / Twitter

**Short:**
> How long does AI-written code actually survive in your repo?
>
> git-halflife answers it from git history alone: offline, no hooks, no API keys. Age-adjusted against human lines.
>
> npx github:Nithinfgs/git-halflife
> https://github.com/Nithinfgs/git-halflife

**Technical:**
> git-halflife: detect agent commits (trailers, bot identities, custom rules) -> `git blame --incremental -w -M` at HEAD -> per-commit line survival -> compare agent vs human survival within age buckets -> exponential half-life fit, with guards against extrapolating from young data. Zero deps, TS, ~1.5k lines. https://github.com/Nithinfgs/git-halflife

**Thread:**
> 1/ Teams measure AI coding by volume. I wanted to measure what sticks. Built git-halflife.
>
> 2/ It recognizes agent commits from markers tools already leave (Co-Authored-By, "Generated with Claude Code", Copilot/Codex/Cursor/Aider identities) and runs blame at HEAD to see which of their lines still exist.
>
> 3/ The trap: agent code is newer, so it looks short-lived. It compares against human lines of the same age instead.
>
> 4/ Caveats I put in the README on purpose: detection is a lower bound, survival isn't quality, comparison is correlational. Don't use it to rank people.
>
> 5/ No network, no hooks, no deps beyond git. `npx github:Nithinfgs/git-halflife` in any repo. Missing a tool's marker? There's an issue template; it's a one-line PR.

## LinkedIn

> There's a lot of data on how much code AI tools generate and very little on how long it lasts.
>
> I built git-halflife, a small open-source CLI that answers it retroactively from git history. It identifies commits from AI agents (Claude Code, Copilot, Codex, Cursor, Aider and others) via the markers they leave, runs git blame on HEAD, and shows how many of the lines each author class added are still there, compared against human lines of the same age.
>
> Two things I learned building it: agent attribution through commit trailers undercounts, so every number is a lower bound; and the age adjustment matters more than the headline figure, because newer code always looks more fragile.
>
> It runs fully offline with no dependencies beyond git. If you maintain a repo with agent-assisted history, I'd like to hear whether the report matches your intuition.
>
> https://github.com/Nithinfgs/git-halflife

## GitHub

- **Description:** How long does AI-written code survive in your repo? Retroactive, offline, line-level survival analysis from git history.
- **Topics:** git, ai-code, developer-tools, cli, claude-code, code-quality, git-blame, typescript, ai-agents, developer-productivity
- **Release notes:** see the v0.1.0 release.
