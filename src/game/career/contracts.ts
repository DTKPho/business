import { TEAMS, TEAMS_BY_ID } from '../../data/teams';
import type { Contract, ContractOffer, GameState, TeamId } from '../types';
import { PLAYER_ID } from '../types';
import { marketValue, overall, statsOf, teamDrivers, nameOf } from '../people';
import { chance, clamp, rand, uid } from '../rng';
import { driverStandings } from '../standings';

export function hasManager(s: GameState): number {
  return s.player.staff.find((m) => m.role === 'manager')?.level ?? 0;
}

/** Intérêt (0..1) d'une équipe pour le joueur. */
export function teamInterest(s: GameState, teamId: TeamId): number {
  const myOv = overall(s.player.stats);
  const drivers = teamDrivers(s, teamId).filter((d) => d !== PLAYER_ID);
  const theirBest = Math.max(70, ...drivers.map((d) => overall(statsOf(s, d))));
  const theirWorst = Math.min(99, ...drivers.map((d) => overall(statsOf(s, d))));
  const expiring = drivers.filter((d) => (s.drivers[d].contract?.endSeason ?? 0) <= s.season).length;
  const st = driverStandings(s);
  const pos = st.findIndex((d) => d.driverId === PLAYER_ID) + 1 || st.length;
  const perf = clamp(1 - (pos - 1) / 20, 0, 1);
  const team = TEAMS_BY_ID[teamId];
  let interest = 0.15 + (myOv - theirWorst) * 0.04 + perf * 0.35 + expiring * 0.25 - (team.prestige - 70) * 0.006;
  if (myOv > theirBest) interest += 0.2;
  interest += Math.log10(Math.max(1e4, s.player.followers)) * 0.02;
  interest += s.player.image.professionalism * 0.002 - s.player.image.controversy * 0.002;
  return clamp(interest, 0, 1);
}

export function buildOffer(s: GameState, teamId: TeamId, fromSeason: number, generous = 1): ContractOffer {
  const team = TEAMS_BY_ID[teamId];
  const value = marketValue(s, PLAYER_ID);
  const budgetF = 0.7 + team.budget / 1000;
  const mgr = hasManager(s);
  const base = value * budgetF * rand(0.75, 0.95) * generous;
  const maxSalary = value * budgetF * (1.15 + mgr * 0.05) * rand(0.95, 1.15);
  const mates = teamDrivers(s, teamId).filter((d) => d !== PLAYER_ID);
  const strongestMate = Math.max(0, ...mates.map((d) => overall(statsOf(s, d))));
  const status: Contract['status'] = overall(s.player.stats) > strongestMate + 4 ? 'first' : overall(s.player.stats) + 6 < strongestMate ? 'second' : 'equal';
  return {
    id: uid('off'),
    teamId,
    salary: Math.round(base / 50_000) * 50_000,
    years: chance(0.5) ? 2 : chance(0.5) ? 1 : 3,
    status,
    winBonus: Math.round((value * 0.02) / 10_000) * 10_000,
    podiumBonus: Math.round((value * 0.008) / 10_000) * 10_000,
    pointBonus: Math.round((value * 0.0008) / 1000) * 1000,
    titleBonus: Math.round((value * 0.25) / 100_000) * 100_000,
    releaseClause: null,
    expiresDay: s.day + 30,
    fromSeason,
    state: 'open',
    patience: 60 + mgr * 8,
    minSalary: Math.round(base * 0.85),
    maxSalary: Math.round(maxSalary),
    rounds: 0,
    history: [{ by: 'team', text: `${team.principal} : « Nous croyons en ton potentiel. Voici notre proposition. »` }],
  };
}

/** Génère des offres pendant le mercato. */
export function generateOffers(s: GameState): ContractOffer[] {
  const out: ContractOffer[] = [];
  const myTeam = s.player.contract?.teamId;
  const contractEnds = s.player.contract?.endSeason ?? s.season;
  const silly = s.round >= 7;
  if (!silly) return out;
  for (const t of TEAMS) {
    if (s.offers.some((o) => o.teamId === t.id && (o.state === 'open' || o.state === 'negotiating'))) continue;
    if (s.offers.some((o) => o.teamId === t.id && o.fromSeason === s.season + 1 && o.state === 'rejected' && s.day - o.expiresDay < 40)) continue;
    let p: number;
    if (t.id === myTeam) {
      if (contractEnds > s.season) continue;
      p = s.teams[t.id].trust > 35 ? 0.35 : 0.08;
    } else {
      p = teamInterest(s, t.id) * 0.07;
      if (contractEnds > s.season) p *= 0.4; // il faudrait racheter le contrat
    }
    if (chance(p)) {
      const from = contractEnds > s.season ? contractEnds + 1 : s.season + 1;
      const off = buildOffer(s, t.id, from, t.id === myTeam ? 1.05 : 1);
      out.push(off);
    }
  }
  return out.slice(0, 2);
}

export interface CounterProposal {
  salary: number;
  years: number;
  status: Contract['status'];
  winBonus: number;
  releaseClause: number | null;
}

export interface NegotiationOutcome {
  result: 'accept' | 'counter' | 'walk';
  message: string;
  offer: ContractOffer;
}

export function negotiate(s: GameState, offer: ContractOffer, ask: CounterProposal, pitch: string): NegotiationOutcome {
  const team = TEAMS_BY_ID[offer.teamId];
  const o: ContractOffer = { ...offer, rounds: offer.rounds + 1, history: [...offer.history] };
  o.history.push({ by: 'player', text: `Demande : ${Math.round(ask.salary / 1e5) / 10} M€/an, ${ask.years} an(s), statut ${statusLabel(ask.status)}${ask.releaseClause ? `, clause de sortie si hors top ${ask.releaseClause}` : ''}.${pitch ? ` « ${pitch} »` : ''}` });
  let greed = ask.salary / o.maxSalary;
  const mates = teamDrivers(s, offer.teamId).filter((d) => d !== PLAYER_ID);
  const mateOv = Math.max(0, ...mates.map((d) => overall(statsOf(s, d))));
  const myOv = overall(s.player.stats);
  let statusPenalty = 0;
  if (ask.status === 'first' && myOv < mateOv + 2) statusPenalty = 25;
  else if (ask.status === 'first' && o.status !== 'first') statusPenalty = 8;
  if (ask.status === 'equal' && o.status === 'second') statusPenalty = myOv + 2 >= mateOv ? 4 : 12;
  const clausePenalty = ask.releaseClause ? (11 - Math.min(10, ask.releaseClause)) * 1.5 : 0;
  const bonusGreed = ask.winBonus > o.winBonus * 1.5 ? 6 : 0;
  // Argumentaire (texte libre)
  const t = pitch.toLowerCase();
  let charm = 0;
  if (/(engag|loyal|fidel|projet|long terme|croire|ensemble|titre|champion)/.test(t)) charm += 4;
  if (/(autre|offre|ferrari|mercedes|mclaren|red bull|ailleurs|partir|concurr)/.test(t)) charm += hasManager(s) ? 3 : -2;
  if (/(exige|sinon|ridicule|insult|nul)/.test(t)) charm -= 8;
  greed -= charm / 100;
  const patienceCost = Math.max(0, (greed - 0.85) * 60) + statusPenalty + clausePenalty + bonusGreed + 6;
  o.patience = clamp(o.patience - patienceCost, 0, 100);
  if (o.patience <= 0) {
    o.state = 'withdrawn';
    o.history.push({ by: 'team', text: `${team.principal} : « Nous ne sommes manifestement pas alignés. Nous allons regarder d’autres options. Bonne continuation. »` });
    return { result: 'walk', message: 'L’équipe retire son offre.', offer: o };
  }
  if (greed <= 1 && statusPenalty < 10 && clausePenalty < 10) {
    o.salary = ask.salary;
    o.years = ask.years;
    o.status = ask.status;
    o.winBonus = Math.max(o.winBonus, ask.winBonus);
    o.releaseClause = ask.releaseClause;
    o.history.push({ by: 'team', text: `${team.principal} : « Marché conclu sur ces bases. On prépare les documents. »` });
    return { result: 'accept', message: 'L’équipe accepte vos conditions !', offer: o };
  }
  // Contre-proposition
  const newSalary = Math.round(Math.min(o.maxSalary, (o.salary + Math.min(ask.salary, o.maxSalary)) / 2) / 50_000) * 50_000;
  o.salary = Math.max(o.salary, newSalary);
  if (statusPenalty < 10) o.status = ask.status;
  if (clausePenalty < 8) o.releaseClause = ask.releaseClause;
  o.years = ask.years;
  o.state = 'negotiating';
  const mood = o.patience > 60 ? 'Nous pouvons faire un effort' : o.patience > 30 ? 'Nous arrivons à notre limite' : 'C’est notre dernière proposition';
  o.history.push({ by: 'team', text: `${team.principal} : « ${mood} : ${Math.round(o.salary / 1e5) / 10} M€ par saison, statut ${statusLabel(o.status)}${statusPenalty >= 10 ? ' — le statut de n°1 n’est pas négociable à ce stade' : ''}. »` });
  return { result: 'counter', message: 'L’équipe fait une contre-proposition.', offer: o };
}

export function statusLabel(st: Contract['status']): string {
  return st === 'first' ? 'premier pilote' : st === 'second' ? 'second pilote' : 'égalité de traitement';
}

export function offerToContract(o: ContractOffer): Contract {
  return {
    teamId: o.teamId,
    salary: o.salary,
    endSeason: o.fromSeason + o.years - 1,
    status: o.status,
    winBonus: o.winBonus,
    podiumBonus: o.podiumBonus,
    pointBonus: o.pointBonus,
    titleBonus: o.titleBonus,
    releaseClause: o.releaseClause,
  };
}

export function describeTeamSituation(s: GameState, teamId: TeamId): string {
  const ds = teamDrivers(s, teamId).filter((d) => d !== PLAYER_ID);
  return ds.map((d) => `${nameOf(s, d)} (fin ${s.drivers[d].contract?.endSeason ?? '?'})`).join(', ');
}
