# Security policy

git-halflife is a read-only analysis tool. It runs `git` (never through a shell), reads your repository, and prints a report. It makes no network requests and collects no telemetry.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting: **Security → Report a vulnerability** on this repository. Do not open a public issue for security problems. You can expect an acknowledgement within a few days.

Of particular interest: command or argument injection through repository content (commit messages, author names, file names), ReDoS in rule patterns, and path handling bugs in `--html` / `--config`.

## Scope notes

- `.halflife.json` is read from the analyzed repository and may contain regular expressions. Treat it like any other config file in a repo you do not trust.
- HTML reports escape all repository-derived text and contain no scripts.
