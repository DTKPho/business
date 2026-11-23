/** Fonds graphiques par défaut (sans image fournie). */
import { TEAMS_BY_ID } from '../../data/teams';
import { CALENDAR } from '../../data/calendar';
import type { TeamId } from '../../game/types';

const FLAG_COLORS: Record<string, [string, string, string?]> = {
  AU: ['#012169', '#e4002b', '#ffffff'], CN: ['#de2910', '#ffde00'], JP: ['#bc002d', '#ffffff'], BH: ['#ce1126', '#ffffff'], SA: ['#006c35', '#ffffff'],
  US: ['#0a3161', '#b31942', '#ffffff'], CA: ['#d80621', '#ffffff'], MC: ['#ce1126', '#ffffff'], ES: ['#aa151b', '#f1bf00'], AT: ['#c8102e', '#ffffff'],
  GB: ['#012169', '#c8102e', '#ffffff'], BE: ['#2d2926', '#fdda24', '#ef3340'], HU: ['#ce2939', '#477050', '#ffffff'], NL: ['#ff6c00', '#21468b', '#ffffff'],
  IT: ['#009246', '#ce2b37', '#ffffff'], AZ: ['#00b5e2', '#ef3340', '#509e2f'], SG: ['#ef3340', '#ffffff'], MX: ['#006847', '#ce1126', '#ffffff'],
  BR: ['#009c3b', '#ffdf00', '#002776'], QA: ['#8a1538', '#ffffff'], AE: ['#00732f', '#ff0000', '#000000'],
};

export function teamFallback(teamId: TeamId): string {
  const t = TEAMS_BY_ID[teamId];
  return `repeating-linear-gradient(115deg, transparent 0 46px, ${t.secondary}14 46px 50px), linear-gradient(115deg, ${t.color}ee 0%, ${t.color}66 38%, #0d0d13 70%), radial-gradient(900px 400px at 85% 20%, ${t.secondary}55, transparent 70%), #0d0d13`;
}

export function circuitFallback(circuitId: string): string {
  const c = CALENDAR.find((x) => x.id === circuitId);
  const [a, b, d] = FLAG_COLORS[c?.country ?? ''] ?? ['#e10600', '#222'];
  const sky = c?.night ? 'linear-gradient(180deg, #050816 0%, #0d1330 60%, #111 100%)' : 'linear-gradient(180deg, #11223a 0%, #1b2b40 55%, #0d0d13 100%)';
  return `radial-gradient(700px 300px at 15% 110%, ${a}aa, transparent 70%), radial-gradient(600px 280px at 85% 110%, ${b}99, transparent 70%), radial-gradient(500px 200px at 50% -20%, ${d ?? b}44, transparent 70%), ${sky}`;
}

