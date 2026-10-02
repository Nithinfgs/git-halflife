# Changelog

## 0.1.0 - 2026-10-02

Initial release.

- Retroactive attribution of commits to AI agents (Claude Code, Copilot, Codex, Cursor, Gemini, Jules, Aider, Devin, Amp, OpenCode) from trailers, boilerplate and bot identities; custom rules via `.halflife.json`.
- Line-level survival from `git blame` (whitespace and in-file moves ignored), per author class and per age bucket.
- Age-adjusted comparison of agent lines against human lines of the same age.
- Approximate half-life estimate with guards against extrapolating from young data.
- Terminal, JSON, Markdown and self-contained HTML reports; `blame` and `rules` subcommands.
