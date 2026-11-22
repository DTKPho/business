import { DRIVERS } from '../data/drivers';
import { TEAMS } from '../data/teams';
import type { Background, DriverStats, DriverState, GameState, Player, ResidenceId, TeamId, TeamState } from './types';
import { PLAYER_ID } from './types';
import { DEFAULT_CLAUDE_MODEL } from './social/claude';
import { clamp, uid } from './rng';
import { addDays } from './format';
import { raceDate } from '../data/calendar';

export const START_SEASON = 2027;
export const SAVE_VERSION = 3;

export const BACKGROUNDS: Record<Background, { name: string; desc: string; base: number; bonus: Partial<DriverStats>; money: number; followers: number }> = {
  f2champ: { name: 'Champion de F2', desc: 'Titre en F2, tout le monde attend tes débuts. Pression maximale.', base: 77, bonus: { pace: 4, racecraft: 2, mental: 1 }, money: 1_200_000, followers: 650_000 },
  f2runner: { name: 'Vice-champion de F2', desc: 'Rapide et régulier, tu as quelque chose à prouver.', base: 76, bonus: { consistency: 4, tyreManagement: 3 }, money: 900_000, followers: 380_000 },
  superformula: { name: 'Champion de Super Formula', desc: 'Passé par le Japon : technique, pluie et réglages.', base: 76, bonus: { feedback: 5, wet: 5, pace: 1 }, money: 1_000_000, followers: 300_000 },
  indycar: { name: 'Transfuge d’IndyCar', desc: 'Les ovales t’ont appris le combat roue contre roue.', base: 75, bonus: { racecraft: 4, overtaking: 5, defending: 3, mental: 2 }, money: 2_500_000, followers: 900_000 },
  rich: { name: 'Héritier fortuné', desc: 'Un nom, une fortune familiale et des sponsors qui suivent… mais le paddock doute.', base: 73, bonus: { fitness: 3, starts: 2 }, money: 28_000_000, followers: 1_200_000 },
};

export interface NewPlayerInput {
  firstName: string;
  lastName: string;
  code: string;
  nationality: string;
  number: number;
  birthYear: number;
  background: Background;
  helmet: { primary: string; secondary: string };
  photo: string | null;
  bonus: Partial<DriverStats>;
  teamId: TeamId;
  replaceId: string;
  residence: ResidenceId;
  difficulty: 'easy' | 'normal' | 'hard';
}

export const STAT_KEYS: (keyof DriverStats)[] = ['pace', 'racecraft', 'overtaking', 'defending', 'consistency', 'tyreManagement', 'wet', 'starts', 'feedback', 'fitness', 'mental'];

export const STAT_LABELS: Record<keyof DriverStats, string> = {
  pace: 'Vitesse pure',
  racecraft: 'Intelligence de course',
  overtaking: 'Dépassement',
  defending: 'Défense',
  consistency: 'Régularité',
  tyreManagement: 'Gestion des pneus',
  wet: 'Pluie',
  starts: 'Départs',
  feedback: 'Retour technique',
  fitness: 'Condition physique',
  mental: 'Mental',
};

function fullStats(partial: Partial<DriverStats>, base: number): DriverStats {
  const o = {} as DriverStats;
  for (const k of STAT_KEYS) o[k] = clamp(partial[k] ?? base, 40, 99);
  return o;
}

export function playerBaseStats(bg: Background, bonus: Partial<DriverStats>): DriverStats {
  const b = BACKGROUNDS[bg];
  const o = {} as DriverStats;
  for (const k of STAT_KEYS) o[k] = clamp(b.base + (b.bonus[k] ?? 0) + (bonus[k] ?? 0), 40, 92);
  return o;
}

export function createGame(input: NewPlayerInput): GameState {
  const season = START_SEASON;
  const teams = Object.fromEntries(
    TEAMS.map((t) => [t.id, { id: t.id, car: { ...t.car }, trust: 55, devFocus: 'balanced', budget: t.budget, morale: 60 } satisfies TeamState]),
  ) as Record<TeamId, TeamState>;
  const drivers: Record<string, DriverState> = {};
  for (const d of DRIVERS) {
    const rel = { friendship: 0, respect: 40, rivalry: 5 };
    const replaced = d.id === input.replaceId;
    drivers[d.id] = {
      id: d.id,
      teamId: replaced ? null : d.teamId,
      stats: fullStats(d.stats, d.rating),
      form: 0,
      morale: 65,
      contract: replaced
        ? null
        : {
            teamId: d.teamId,
            salary: d.salary,
            endSeason: Math.max(season, d.contractEnd),
            status: 'equal',
            winBonus: 0,
            podiumBonus: 0,
            pointBonus: 0,
            titleBonus: 0,
            releaseClause: null,
          },
      retired: false,
      rel,
      lastMessageDay: -99,
      unread: 0,
    };
  }
  // Statuts n°1 connus
  for (const id of ['verstappen', 'leclerc', 'alonso', 'gasly', 'russell']) if (drivers[id].contract) drivers[id].contract!.status = 'first';
  for (const id of ['hadjar', 'stroll', 'colapinto']) if (drivers[id].contract) drivers[id].contract!.status = 'second';

  const bg = BACKGROUNDS[input.background];
  const stats = playerBaseStats(input.background, input.bonus);
  const team = TEAMS.find((t) => t.id === input.teamId)!;
  const replacedDef = DRIVERS.find((d) => d.id === input.replaceId);
  const salary = Math.round(Math.max(800_000, (replacedDef?.salary ?? 2_000_000) * 0.35) / 50_000) * 50_000;
  const player: Player = {
    firstName: input.firstName.trim() || 'Alex',
    lastName: input.lastName.trim() || 'Martin',
    code: (input.code || input.lastName.slice(0, 3)).toUpperCase().slice(0, 3),
    nationality: input.nationality,
    number: input.number,
    birthYear: input.birthYear,
    photo: input.photo,
    helmet: input.helmet,
    background: input.background,
    stats,
    xp: {},
    morale: 75,
    energy: 90,
    stress: 25,
    followers: bg.followers,
    image: { likeability: 55, professionalism: 55, controversy: input.background === 'rich' ? 30 : 10 },
    money: bg.money,
    residence: input.residence,
    contract: {
      teamId: input.teamId,
      salary,
      endSeason: season + 1,
      status: 'second',
      winBonus: 200_000,
      podiumBonus: 60_000,
      pointBonus: 4_000,
      titleBonus: 3_000_000,
      releaseClause: null,
    },
    staff: [],
    assets: [],
    sponsors: [],
    penaltyPoints: [],
    career: { starts: 0, wins: 0, podiums: 0, poles: 0, points: 0, fastestLaps: 0, dnfs: 0, titles: 0, sprintWins: 0 },
    seasonHistory: [],
    partner: null,
    foundation: null,
    businesses: [],
    investments: [],
    achievements: [],
  };
  const mate = DRIVERS.find((d) => d.teamId === input.teamId && d.id !== input.replaceId);
  if (mate && drivers[mate.id].contract) {
    drivers[mate.id].contract!.status = drivers[mate.id].contract!.status === 'second' ? 'equal' : drivers[mate.id].contract!.status;
    drivers[mate.id].rel = { friendship: 10, respect: 35, rivalry: 20 };
  }
  // Affinités : compatriotes un peu plus proches
  for (const d of DRIVERS) if (d.nationality === input.nationality && drivers[d.id]) drivers[d.id].rel.friendship += 12;

  const date = `${season}-02-18`;
  const state: GameState = {
    version: SAVE_VERSION,
    started: true,
    season,
    day: 0,
    date,
    round: 0,
    phase: 'preseason',
    player,
    drivers,
    teams,
    results: [],
    allResults: [],
    weekend: null,
    conversations: {},
    group: { messages: [], unread: 0, muted: false },
    feed: [],
    news: [],
    mail: [],
    offers: [],
    interviews: [],
    plannedDays: {},
    actionsLeft: 0,
    log: [],
    settings: {
      claude: { enabled: false, apiKey: '', model: DEFAULT_CLAUDE_MODEL },
      imageOverrides: {},
      simSpeed: 1,
      difficulty: input.difficulty,
      driverLanguage: 'fr',
    },
    teammateId: mate?.id ?? null,
    rookies: [],
    generatedDrivers: {},
    seenEvents: [],
    flags: {},
  };
  state.actionsLeft = Math.max(0, daysUntilWeekend(state));
  // Message de bienvenue
  state.mail.push({
    id: uid('m'),
    day: 0,
    from: `${team.principal} — ${team.name}`,
    subject: `Bienvenue chez ${team.name} !`,
    body: `${player.firstName},\n\nToute l’équipe est ravie de t’accueillir. Ta mission pour ${season} : apprendre vite, marquer des points réguliers et ${team.prestige > 85 ? 'te battre pour les podiums' : 'aider l’équipe à remonter au classement constructeurs'}.\n\nTon ingénieur de course sera ${team.engineerName}. Passe à l’usine, travaille au simulateur et sois prêt pour Melbourne.\n\n${team.principal}\n${team.principalTitle}`,
    read: false,
    action: { kind: 'info' },
  });
  state.mail.push({
    id: uid('m'),
    day: 0,
    from: 'GPDA — Grand Prix Drivers’ Association',
    subject: 'Ajout au groupe WhatsApp des pilotes',
    body: 'Bienvenue sur la grille ! Tu as été ajouté au groupe privé des pilotes. Merci de rester respectueux… ou au moins drôle.',
    read: false,
    action: { kind: 'info' },
  });
  return state;
}

/** Jours restants avant le jeudi du prochain GP. */
export function daysUntilWeekend(s: GameState): number {
  if (s.round >= 24) return 0;
  const thursday = addDays(raceDate(s.season, s.round), -3);
  const diff = Math.round((new Date(thursday + 'T12:00:00Z').getTime() - new Date(s.date + 'T12:00:00Z').getTime()) / 86400000);
  return Math.max(0, diff);
}

export function newId(): string {
  return uid('x');
}

export { PLAYER_ID };
