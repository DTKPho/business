import type { CarState, TeamId } from '../game/types';

export interface TeamDef {
  id: TeamId;
  name: string;
  fullName: string;
  short: string;
  color: string;
  secondary: string;
  textOnColor: string;
  principal: string;
  principalTitle: string;
  engine: string;
  base: string;
  country: string;
  founded: number;
  titles: { drivers: number; constructors: number };
  /** Slug utilisé par le CDN officiel formula1.com. */
  f1Slug: string;
  car: CarState;
  budget: number; // M€ (plafond budgétaire en pratique, mais moyens annexes)
  prestige: number; // 0..100 attractivité
  engineerName: string; // ingénieur de course (fictif) attribué au joueur
  personality: string; // culture d'équipe (prompt + textes)
  rival: TeamId;
}

export const TEAMS: TeamDef[] = [
  {
    id: 'mercedes',
    name: 'Mercedes',
    fullName: 'Mercedes-AMG PETRONAS F1 Team',
    short: 'MER',
    color: '#00D7B6',
    secondary: '#0b0b0b',
    textOnColor: '#000',
    principal: 'Toto Wolff',
    principalTitle: 'Team Principal & CEO',
    engine: 'Mercedes',
    base: 'Brackley (GB)',
    country: 'DE',
    founded: 2010,
    titles: { drivers: 9, constructors: 8 },
    f1Slug: 'mercedes',
    car: { aero: 92, power: 95, chassis: 90, reliability: 90, devPoints: 0 },
    budget: 470,
    prestige: 96,
    engineerName: 'Marcus Dudley',
    personality: 'Exigeante, analytique, culture de la gagne. Toto Wolff est direct, émotif en course, protecteur de ses pilotes mais impitoyable sur la performance.',
    rival: 'redbull',
  },
  {
    id: 'ferrari',
    name: 'Ferrari',
    fullName: 'Scuderia Ferrari HP',
    short: 'FER',
    color: '#ED1131',
    secondary: '#FFEB00',
    textOnColor: '#fff',
    principal: 'Frédéric Vasseur',
    principalTitle: 'Team Principal',
    engine: 'Ferrari',
    base: 'Maranello (IT)',
    country: 'IT',
    founded: 1950,
    titles: { drivers: 15, constructors: 16 },
    f1Slug: 'ferrari',
    car: { aero: 90, power: 92, chassis: 88, reliability: 86, devPoints: 0 },
    budget: 480,
    prestige: 100,
    engineerName: 'Matteo Rinaldi',
    personality: 'Passion, pression médiatique italienne énorme, les tifosi. Vasseur est pragmatique, bon vivant et protège le groupe.',
    rival: 'mclaren',
  },
  {
    id: 'mclaren',
    name: 'McLaren',
    fullName: 'McLaren Formula 1 Team',
    short: 'MCL',
    color: '#FF8000',
    secondary: '#47C7FC',
    textOnColor: '#000',
    principal: 'Andrea Stella',
    principalTitle: 'Team Principal',
    engine: 'Mercedes',
    base: 'Woking (GB)',
    country: 'GB',
    founded: 1966,
    titles: { drivers: 13, constructors: 10 },
    f1Slug: 'mclaren',
    car: { aero: 91, power: 93, chassis: 89, reliability: 88, devPoints: 0 },
    budget: 460,
    prestige: 92,
    engineerName: 'Oliver Barnes',
    personality: 'Calme, méthodique, « papaya rules » : équité entre pilotes. Andrea Stella est un ingénieur posé et bienveillant.',
    rival: 'ferrari',
  },
  {
    id: 'redbull',
    name: 'Red Bull Racing',
    fullName: 'Oracle Red Bull Racing',
    short: 'RBR',
    color: '#4781D7',
    secondary: '#E0B400',
    textOnColor: '#fff',
    principal: 'Laurent Mekies',
    principalTitle: 'Team Principal & CEO',
    engine: 'Red Bull Ford',
    base: 'Milton Keynes (GB)',
    country: 'AT',
    founded: 2005,
    titles: { drivers: 8, constructors: 6 },
    f1Slug: 'redbullracing',
    car: { aero: 88, power: 86, chassis: 88, reliability: 84, devPoints: 0 },
    budget: 450,
    prestige: 93,
    engineerName: 'Jamie Corbett',
    personality: 'Culture du résultat brut, pression énorme sur le second pilote. Mekies est un ingénieur français diplomate et rigoureux.',
    rival: 'mercedes',
  },
  {
    id: 'astonmartin',
    name: 'Aston Martin',
    fullName: 'Aston Martin Aramco F1 Team',
    short: 'AMR',
    color: '#229971',
    secondary: '#CEDC00',
    textOnColor: '#fff',
    principal: 'Adrian Newey',
    principalTitle: 'Managing Technical Partner & Team Principal',
    engine: 'Honda',
    base: 'Silverstone (GB)',
    country: 'GB',
    founded: 2018,
    titles: { drivers: 0, constructors: 0 },
    f1Slug: 'astonmartin',
    car: { aero: 80, power: 74, chassis: 80, reliability: 72, devPoints: 0 },
    budget: 470,
    prestige: 82,
    engineerName: 'Henry Walsh',
    personality: 'Projet ambitieux à long terme financé par Lawrence Stroll, génie technique de Newey, attente immense.',
    rival: 'alpine',
  },
  {
    id: 'alpine',
    name: 'Alpine',
    fullName: 'BWT Alpine F1 Team',
    short: 'ALP',
    color: '#00A1E8',
    secondary: '#FF87BC',
    textOnColor: '#fff',
    principal: 'Flavio Briatore',
    principalTitle: 'Executive Advisor',
    engine: 'Mercedes',
    base: 'Enstone (GB)',
    country: 'FR',
    founded: 2021,
    titles: { drivers: 2, constructors: 2 },
    f1Slug: 'alpine',
    car: { aero: 82, power: 93, chassis: 80, reliability: 85, devPoints: 0 },
    budget: 400,
    prestige: 74,
    engineerName: 'Julien Mercier',
    personality: 'Équipe française sous tension, décisions rapides et radicales de Briatore, pilotes sous pression permanente.',
    rival: 'astonmartin',
  },
  {
    id: 'williams',
    name: 'Williams',
    fullName: 'Atlassian Williams Racing',
    short: 'WIL',
    color: '#1868DB',
    secondary: '#00A0DE',
    textOnColor: '#fff',
    principal: 'James Vowles',
    principalTitle: 'Team Principal',
    engine: 'Mercedes',
    base: 'Grove (GB)',
    country: 'GB',
    founded: 1977,
    titles: { drivers: 7, constructors: 9 },
    f1Slug: 'williams',
    car: { aero: 81, power: 93, chassis: 81, reliability: 85, devPoints: 0 },
    budget: 380,
    prestige: 76,
    engineerName: 'Tom Ashworth',
    personality: 'Reconstruction d’une légende, transparence et vision long terme de James Vowles, ambiance positive.',
    rival: 'haas',
  },
  {
    id: 'racingbulls',
    name: 'Racing Bulls',
    fullName: 'Visa Cash App Racing Bulls F1 Team',
    short: 'RB',
    color: '#6C98FF',
    secondary: '#ffffff',
    textOnColor: '#000',
    principal: 'Alan Permane',
    principalTitle: 'Team Principal',
    engine: 'Red Bull Ford',
    base: 'Faenza (IT)',
    country: 'IT',
    founded: 2006,
    titles: { drivers: 0, constructors: 0 },
    f1Slug: 'racingbulls',
    car: { aero: 82, power: 86, chassis: 82, reliability: 83, devPoints: 0 },
    budget: 350,
    prestige: 70,
    engineerName: 'Luca Benedetti',
    personality: 'École de pilotes Red Bull : tremplin vers la maison mère, sélection impitoyable, Helmut-style.',
    rival: 'audi',
  },
  {
    id: 'haas',
    name: 'Haas',
    fullName: 'MoneyGram Haas F1 Team',
    short: 'HAA',
    color: '#9C9FA2',
    secondary: '#E10600',
    textOnColor: '#000',
    principal: 'Ayao Komatsu',
    principalTitle: 'Team Principal',
    engine: 'Ferrari',
    base: 'Kannapolis (US) / Banbury (GB)',
    country: 'US',
    founded: 2016,
    titles: { drivers: 0, constructors: 0 },
    f1Slug: 'haasf1team',
    car: { aero: 81, power: 90, chassis: 80, reliability: 82, devPoints: 0 },
    budget: 320,
    prestige: 62,
    engineerName: 'Kenji Mori',
    personality: 'Petite structure efficace, partenariat Toyota, Ayao Komatsu est un ingénieur calme et très honnête.',
    rival: 'williams',
  },
  {
    id: 'audi',
    name: 'Audi',
    fullName: 'Audi Revolut F1 Team',
    short: 'AUD',
    color: '#F50537',
    secondary: '#c0c0c0',
    textOnColor: '#fff',
    principal: 'Jonathan Wheatley',
    principalTitle: 'Team Principal',
    engine: 'Audi',
    base: 'Hinwil (CH) / Neuburg (DE)',
    country: 'DE',
    founded: 2026,
    titles: { drivers: 0, constructors: 0 },
    f1Slug: 'audi',
    car: { aero: 80, power: 80, chassis: 81, reliability: 78, devPoints: 0 },
    budget: 420,
    prestige: 78,
    engineerName: 'Stefan Krüger',
    personality: 'Constructeur allemand qui découvre la F1, rigueur, processus, ambitions de titre à horizon 2030. Mattia Binotto supervise le projet.',
    rival: 'racingbulls',
  },
  {
    id: 'cadillac',
    name: 'Cadillac',
    fullName: 'Cadillac Formula 1 Team',
    short: 'CAD',
    color: '#AAAAAD',
    secondary: '#000000',
    textOnColor: '#000',
    principal: 'Graeme Lowdon',
    principalTitle: 'Team Principal',
    engine: 'Ferrari',
    base: 'Fishers (US) / Silverstone (GB)',
    country: 'US',
    founded: 2026,
    titles: { drivers: 0, constructors: 0 },
    f1Slug: 'cadillac',
    car: { aero: 76, power: 88, chassis: 75, reliability: 77, devPoints: 0 },
    budget: 380,
    prestige: 66,
    engineerName: 'Ryan Mitchell',
    personality: 'Nouvelle équipe américaine (TWG / General Motors), tout est à construire, énorme exposition médiatique aux USA.',
    rival: 'audi',
  },
];

export const TEAMS_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<TeamId, TeamDef>;
export const TEAM_IDS = TEAMS.map((t) => t.id);

/**
 * Candidats d'URL pour le logo officiel (CDN formula1.com). Le composant
 * <SmartImage> essaie chaque URL et retombe sur un badge stylisé en cas d'échec.
 */
export function teamLogoCandidates(teamId: TeamId): string[] {
  const s = TEAMS_BY_ID[teamId].f1Slug;
  const out: string[] = [];
  for (const y of [2026, 2025]) {
    if (y === 2025 && (s === 'audi' || s === 'cadillac')) continue;
    out.push(`https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000000/common/f1/${y}/${s}/${y}${s}logowhite.webp`);
  }
  out.push(`https://media.formula1.com/content/dam/fom-website/teams/2025/${s}-logo.png`);
  return out;
}

export function teamCarCandidates(teamId: TeamId): string[] {
  const s = TEAMS_BY_ID[teamId].f1Slug;
  const out: string[] = [];
  for (const y of [2026, 2025]) {
    out.push(`https://media.formula1.com/image/upload/c_lfill,w_640/q_auto/v1740000000/common/f1/${y}/${y === 2025 && s === 'audi' ? 'kicksauber' : s}/${y}${y === 2025 && s === 'audi' ? 'kicksauber' : s}carright.webp`);
  }
  return out;
}
