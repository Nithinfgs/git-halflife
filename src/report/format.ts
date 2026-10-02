import type { GroupStats } from '../types.ts';

export const num = (n: number): string => n.toLocaleString('en-US');

export function pct(x: number | null, digits = 1): string {
  return x === null ? 'n/a' : `${(x * 100).toFixed(digits)}%`;
}

export function days(d: number): string {
  if (d < 14) return `${Math.round(d)} days`;
  if (d < 90) return `${Math.round(d / 7)} weeks`;
  if (d < 700) return `${Math.round(d / 30.4)} months`;
  return `${(d / 365).toFixed(1)} years`;
}

export function halfLife(g: GroupStats): string {
  if (g.halfLifeDays !== null) return `~${days(g.halfLifeDays)}`;
  return g.stable ? 'no decay seen' : 'not enough history';
}

export function dateStr(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

export function label(key: string): string {
  return key === 'human' ? 'Humans' : key === 'bot' ? 'Bots' : key;
}
