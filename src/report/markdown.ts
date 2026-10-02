import type { Analysis } from '../types.ts';
import { dateStr, halfLife, label, num, pct } from './format.ts';

export function renderMarkdown(a: Analysis): string {
  const repo = a.repo.split('/').pop() ?? a.repo;
  const L: string[] = [];
  L.push(`## git-halflife: ${repo} @ \`${a.head.slice(0, 7)}\` (as of ${dateStr(a.asOf)})`);
  L.push('');
  L.push(
    `${num(a.detection.agentCommits)} of ${num(a.detection.totalCommits)} commits (${pct(a.detection.share)}) carry an AI-agent signature (a lower bound).`,
  );
  L.push('');
  L.push('| Author | Commits | Lines added | Alive now | Survival | Half-life |');
  L.push('|---|--:|--:|--:|--:|--:|');
  for (const g of a.groups.filter((x) => x.added > 0)) {
    L.push(
      `| ${label(g.key)} | ${num(g.commits)} | ${num(g.added)} | ${num(g.surviving)} | ${pct(g.survival)} | ${halfLife(g)} |`,
    );
  }
  L.push('');
  L.push(
    `**On HEAD:** ${a.groups
      .filter((g) => g.currentLines > 0)
      .map((g) => `${label(g.key)} ${pct(g.currentShare)}`)
      .join(', ')} (${num(a.totals.currentLines)} lines)`,
  );
  if (a.ageAdjusted) {
    const d = a.ageAdjusted.deltaPoints;
    L.push('');
    L.push(
      `**Age-adjusted:** agent lines survive at ${pct(a.ageAdjusted.agentActual)} vs ${pct(a.ageAdjusted.agentExpected)} expected from human lines of the same ages (${d >= 0 ? '+' : ''}${d.toFixed(1)} pp).`,
    );
  }
  for (const n of a.notes) L.push('', `> ${n}`);
  L.push('');
  return L.join('\n');
}
