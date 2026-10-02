import type { Analysis } from '../types.ts';
import { dateStr, halfLife, label, num, pct } from './format.ts';

const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

const PALETTE = [
  '#4f8cff',
  '#e8833a',
  '#9b6bff',
  '#2bb3a3',
  '#e05a7a',
  '#c9a227',
  '#6a8f3a',
  '#8a8f98',
];

/** A single self-contained HTML file: no scripts, no network, safe to attach to a PR or CI run. */
export function renderHtml(a: Analysis): string {
  const repo = a.repo.split('/').pop() ?? a.repo;
  const present = a.groups.filter((g) => g.currentLines > 0);
  const colorOf = (key: string): string => {
    if (key === 'human') return '#3fa66b';
    if (key === 'bot') return '#8a8f98';
    const i = a.groups.filter((g) => g.kind === 'agent').findIndex((g) => g.key === key);
    return PALETTE[i % PALETTE.length] as string;
  };
  const stack = present
    .map(
      (g) =>
        `<span style="width:${(g.currentShare * 100).toFixed(2)}%;background:${colorOf(g.key)}" title="${esc(label(g.key))} ${pct(g.currentShare)}"></span>`,
    )
    .join('');
  const legend = present
    .map(
      (g) =>
        `<li><i style="background:${colorOf(g.key)}"></i>${esc(label(g.key))} <b>${pct(g.currentShare)}</b> <small>${num(g.currentLines)} lines</small></li>`,
    )
    .join('');
  const rows = a.groups
    .filter((g) => g.added > 0)
    .map(
      (g) =>
        `<tr><td><i style="background:${colorOf(g.key)}"></i>${esc(label(g.key))}</td><td>${num(g.commits)}</td><td>${num(g.added)}</td><td>${num(g.surviving)}</td><td>${pct(g.survival)}</td><td>${esc(halfLife(g))}</td></tr>`,
    )
    .join('');
  const buckets = a.buckets
    .filter((b) => b.agent.added > 0 || b.human.added > 0)
    .map((b) => {
      const cell = (x: { added: number; surviving: number }, color: string) =>
        x.added === 0
          ? '<td class="mute">-</td>'
          : `<td><div class="meter"><span style="width:${((x.surviving / x.added) * 100).toFixed(1)}%;background:${color}"></span></div>${pct(x.surviving / x.added)} <small>of ${num(x.added)}</small></td>`;
      return `<tr><td>${esc(b.label)}</td>${cell(b.agent, '#4f8cff')}${cell(b.human, '#3fa66b')}</tr>`;
    })
    .join('');
  const files = a.files
    .map(
      (f) =>
        `<tr><td class="mono">${esc(f.path)}</td><td>${num(f.agentLines)} / ${num(f.lines)}</td><td>${pct(f.share, 0)}</td><td>${esc(f.topAgent)}</td></tr>`,
    )
    .join('');
  let adjusted = '';
  if (a.ageAdjusted) {
    const d = a.ageAdjusted.deltaPoints;
    adjusted = `<p class="callout">Age-adjusted: agent lines survive at <b>${pct(a.ageAdjusted.agentActual)}</b> versus <b>${pct(a.ageAdjusted.agentExpected)}</b> expected from human lines of the same ages (${d >= 0 ? '+' : ''}${d.toFixed(1)} pp over ${num(a.ageAdjusted.linesCompared)} lines).</p>`;
  }
  const notes = a.notes.map((n) => `<li>${esc(n)}</li>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>git-halflife: ${esc(repo)}</title>
<style>
:root{--bg:#fff;--fg:#1c2128;--mute:#6b7280;--line:#e5e7eb;--card:#f6f8fa}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--mute:#8b949e;--line:#30363d;--card:#161b22}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:22px;margin:0}h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute);margin:32px 0 8px}
.sub{color:var(--mute);margin:4px 0 0}
.stack{display:flex;height:22px;border-radius:6px;overflow:hidden;background:var(--line);margin:8px 0}
.stack span{display:block;height:100%}
ul.legend{list-style:none;padding:0;margin:8px 0;display:flex;flex-wrap:wrap;gap:6px 18px}
i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th,td{text-align:right;padding:6px 8px;border-bottom:1px solid var(--line)}th:first-child,td:first-child{text-align:left}
th{font-size:12px;color:var(--mute);font-weight:600}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;word-break:break-all}
.meter{height:6px;background:var(--line);border-radius:3px;overflow:hidden;margin-bottom:3px}.meter span{display:block;height:100%}
small,.mute{color:var(--mute)}
.callout{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.wrap{overflow-x:auto}
</style></head><body><main>
<h1>git-halflife: ${esc(repo)}</h1>
<p class="sub">@ ${esc(a.head.slice(0, 7))} &middot; as of ${dateStr(a.asOf)} &middot; ${num(a.detection.agentCommits)} of ${num(a.detection.totalCommits)} commits (${pct(a.detection.share)}) carry an AI-agent signature (a lower bound)</p>
<h2>Now on HEAD &middot; ${num(a.totals.currentLines)} lines</h2>
<div class="stack">${stack}</div><ul class="legend">${legend}</ul>
<h2>Survival of lines each author added</h2>
<div class="wrap"><table><thead><tr><th>Author</th><th>Commits</th><th>Lines added</th><th>Alive now</th><th>Survival</th><th>Half-life</th></tr></thead><tbody>${rows}</tbody></table></div>
<h2>Survival by age of the lines</h2>
<div class="wrap"><table><thead><tr><th>Lines written</th><th>Agent</th><th>Human</th></tr></thead><tbody>${buckets}</tbody></table></div>
${adjusted}
${files ? `<h2>Most agent-authored files</h2><div class="wrap"><table><thead><tr><th>File</th><th>Agent / total lines</th><th>Share</th><th>Top agent</th></tr></thead><tbody>${files}</tbody></table></div>` : ''}
${notes ? `<h2>Notes</h2><ul>${notes}</ul>` : ''}
<p class="sub" style="margin-top:32px">Survival = lines a commit added that git blame still attributes to it on HEAD (whitespace and in-file moves ignored). Generated by git-halflife.</p>
</main></body></html>
`;
}
