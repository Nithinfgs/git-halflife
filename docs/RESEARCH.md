# Research notes (2 October 2026)

How this project was chosen. Sources: GitHub Trending (weekly and monthly), GitHub search, Hacker News (Algolia and web search), web search over Reddit/dev blogs, and the READMEs of several trending repos. Star counts are as shown on 2026-10-02. Where something is my inference rather than something I read, it says so.

**Depth caveat:** I read four READMEs in full (worktrunk, context-mode, clash, SkillSpector). The other rows rest on the trending-page description plus search results, so "why it spreads" for them is inference. Reddit and X were reachable only through search snippets, not directly.

## What is moving right now

| Repo | Stars | What it is | Why it appears to spread (inference unless noted) |
|---|--:|---|---|
| affaan-m/ECC | 271k | Agent harness optimization: skills, memory, security for Claude Code/Codex | Rides the skills/harness wave; broad scope |
| DietrichGebert/ponytail | 151k | Makes agents write less unnecessary code | One clear behavior change, instantly understood |
| MoneyPrinterTurbo | 128k | Topic-to-video generation | Visual output, easy demo |
| paperclipai/paperclip | 96k (+14k/wk) | App to manage agents at work | Agent orchestration UI |
| tt-a1i/archify | 76k (+35k/mo) | Skill that makes architecture diagrams as HTML | Visible artifact per use, shareable output |
| pbakaus/impeccable | 74k | Design language for AI harnesses | Taste/quality positioning |
| rohitg00/ai-engineering-from-scratch | 62k | Learning curriculum | Education, evergreen |
| heygen-com/hyperframes | 56k | HTML to video "built for agents" | Agent-native framing |
| ayghri/i-have-adhd | 53k | Skill: stop agents burying the answer | Relatable pain, one-line pitch |
| debpalash/VoiceStudio | 52k | Fully local ElevenLabs alternative | Local-first, replaces a paid service |
| bilawalsidhu/gods-eye-view | 46k | Real-data spy-satellite sim on a 3D globe | Pure visual wow |
| vectorize-io/hindsight | 45k | Agent memory that learns | Memory is a hot agent topic |
| alibaba/open-code-review | 43k | Hybrid deterministic + LLM code review | Review of agent output |
| NVIDIA/SkillSpector | 19k | Security scanner for agent skills (read in full) | 26.1% of analyzed skills had vulnerabilities (their stat); strong problem statement |
| mksglu/context-mode | 25k | Cuts MCP tool output in context (read in full) | Concrete number in the pitch ("98%"), HN badge (570+ points) in its README; the "98%" is illustrated, not linked to a benchmark |
| max-sixty/worktrunk | 8.7k | Git worktree CLI for parallel agents (read in full) | Two GIFs above the fold, brew/cargo install, "context" section for newcomers |
| clash-sh/clash | 65 | Merge-conflict early warning across worktrees (read in full) | Clean problem/solution/3-step quick start; still small |

## Patterns

1. **Almost everything is agent-adjacent.** Skills, harnesses, memory, orchestration, review, security.
2. **The pitch fits in one line and the first screen shows output.** GIFs (worktrunk, clash) or a concrete example report (SkillSpector).
3. **Install is one command.** brew, cargo, npx, uv tool, curl.
4. **Micro-tool slots fill within weeks.** Searching for any obvious "scanner/linter/recorder for agent X" returned five to ten near-identical repos (see below). The unfilled space is *measurement*, not tooling.
5. **Credibility gaps are visible.** Round percentages without a linked benchmark, logo walls without evidence. A tool that states its method and limits stands out.

## Ideas considered

| # | Idea | Verdict |
|--:|---|---|
| 1 | Linter for AGENTS.md / CLAUDE.md drift | Rejected. At least 7 existing tools (driftlint, agents-lint, agents-md-doctor, herdr-llm-lint, claude-drift, ...), and one is already on this GitHub account (agentrot) |
| 2 | MCP server record/replay and snapshot testing | Rejected. 7+ existing (mcp-recorder, mcp-vcr, snapgauge, agent-vcr, mcp-replay, mcprec, ...) |
| 3 | MCP tool-description token-cost auditor | Rejected. mcp-context-budget and several blog-post scripts exist |
| 4 | Static scanner for malicious repo agent config (`.claude/`, `.mcp.json`) | Rejected. promptwarden, dotclaude-security, mcpscan, aisecscan, SkillSpector |
| 5 | Cross-worktree conflict early warning | Rejected. clash, DriftWatch |
| 6 | Lockfile-diff supply-chain summary for PRs | Rejected. npq, Socket, osv-scanner cover most of it; needs network |
| 7 | Git-history bus-factor / knowledge-risk map | Passed over. Mature (code-maat, git-truck), weak link to the current moment |
| 8 | Agent transcript to shareable HTML | Passed over. Many transcript viewers; privacy-sensitive to share |
| 9 | Flaky-test detector from CI logs | Passed over. Needs CI integration per provider; large maintenance surface |
| 10 | **Retroactive AI-authorship and survival analysis from git history** | **Chosen** |

Why #10: the question ("does the agent code stick?") is being asked in blog posts and HN threads, and the existing answers are one-off scripts counting `Co-Authored-By` trailers per commit, or tools that need hooks installed up front (so no history). Nothing I found does retroactive, line-level survival with an age-matched human baseline. It needs no API, no network and no daemon; it is verifiable on any repo; and the output is something people want to paste into a PR, a retro or a post.

Honest risk: commit markers undercount agent use, so the headline numbers are a lower bound. The tool says so in its first line of output and in the README.
