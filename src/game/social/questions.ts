/**
 * Banque de questions d'interview (en anglais, comme dans le vrai paddock).
 * Chaque question n'est éligible que si le contexte s'y prête, et son poids
 * dépend de la situation (résultat comparé aux attentes, championnat, coéquipier,
 * rivalités, contrat, vie privée…) et du ton du média. Les questions déjà posées
 * récemment sont évitées.
 */
import { CALENDAR } from '../../data/calendar';
import { TEAMS_BY_ID } from '../../data/teams';
import { DRIVERS_BY_ID } from '../../data/drivers';
import { ASSETS_BY_ID, BRANDS_BY_ID } from '../../data/lifestyle';
import type { GameState, InterviewQuestion, PendingInterview, RaceResultEntry } from '../types';
import { PLAYER_ID } from '../types';
import { lastNameOf, nameOf, teammateOf, teamOf } from '../people';
import { driverStandings } from '../standings';
import { expectedFinish, verdictFor, type Verdict } from '../expectations';
import { circuitName } from './voice';
import { pick } from '../rng';

type Ctx = PendingInterview['context'];
type Tone = 'serious' | 'tabloid' | 'tech' | 'fan' | 'tv';

export interface QInfo {
  s: GameState;
  ctx: Ctx;
  tone: Tone;
  race?: RaceResultEntry;
  quali?: number;
  raceId: string;
  verdict?: Verdict;
  qVerdict?: Verdict;
  expected: number;
  team: string;
  principal: string;
  mate: string | null;
  mateRace?: RaceResultEntry;
  mateQuali?: number;
  pos: number;
  pts: number;
  leader: string | null;
  gapLeader: number;
  circuit: string;
  next: string;
  home: boolean;
  collision: { other: string; blame: string } | null;
  orderRefused: boolean;
  rival: string | null;
  friend: string | null;
  contractEnding: boolean;
  offers: number;
  rookie: boolean;
  rain: boolean;
  gained: number;
  dnf: string | null;
  carRankBad: boolean;
  carRankTop: boolean;
}

interface QT {
  id: string;
  ctx: Ctx[];
  topic: InterviewQuestion['topic'];
  w: (i: QInfo) => number;
  t: (i: QInfo) => string;
  subject?: (i: QInfo) => string | undefined;
}

const ALL: Ctx[] = ['thursday', 'feature', 'tv', 'podcast'];
const RACE: Ctx[] = ['postRace'];
const QUALI: Ctx[] = ['postQuali'];
const ln = (i: QInfo, id: string) => lastNameOf(i.s, id);

const DNF_EN: [RegExp, string][] = [
  [/moteur/, 'an engine failure'],
  [/hydraulique/, 'a hydraulic failure'],
  [/boîte/, 'a gearbox problem'],
  [/électrique/, 'an electrical issue'],
  [/freins/, 'brake failure'],
  [/eau/, 'a water leak'],
  [/accrochage|contact/, 'a collision'],
  [/mur|graviers|sortie|tête/, 'a crash'],
  [/disqualifié/, 'a disqualification'],
];
const dnfEn = (d: string | null) => (d ? (DNF_EN.find(([re]) => re.test(d))?.[1] ?? 'a technical problem') : 'a problem');

// ───────────────────────── Questions sur le résultat de course ─────────────────────────
const RACE_RESULT: QT[] = [
  { id: 'r-win', ctx: RACE, topic: 'result', w: (i) => (i.race?.position === 1 ? 10 : 0), t: (i) => pick([`You've won the ${i.circuit} Grand Prix! What's going through your head right now?`, 'A Grand Prix winner! Talk us through those final laps.', `Victory in ${i.circuit}. Did you ever think this day would come so soon?`]) },
  { id: 'r-win-underdog', ctx: RACE, topic: 'result', w: (i) => (i.race?.position === 1 && i.expected >= 5 ? 12 : 0), t: (i) => `Nobody expected a ${i.team} to win today. How on earth did you pull that off?` },
  { id: 'r-podium', ctx: RACE, topic: 'result', w: (i) => (i.race && i.race.position >= 2 && i.race.position <= 3 ? 8 : 0), t: (i) => pick([`P${i.race!.position} and on the podium. Happy, or was there more out there?`, `A podium in ${i.circuit}! How does the champagne taste?`]) },
  { id: 'r-exceptional', ctx: RACE, topic: 'result', w: (i) => (i.verdict === 'exceptional' && (i.race?.position ?? 0) > 3 ? 12 : 0), t: (i) => pick([`P${i.race!.position} in a car that was expected around P${i.expected}. Is this the best drive of your career?`, `You dragged that ${i.team} to P${i.race!.position}. Where did that pace come from?`, `P${i.race!.position} might not look huge on paper, but for ${i.team} it's massive. How proud are you?`]) },
  { id: 'r-great', ctx: RACE, topic: 'result', w: (i) => (i.verdict === 'great' && (i.race?.position ?? 0) > 3 ? 10 : 0), t: (i) => pick([`P${i.race!.position} — well above what the car was showing this weekend. What made the difference?`, `A strong P${i.race!.position}. Did you surprise yourself today?`]) },
  { id: 'r-good-points', ctx: RACE, topic: 'result', w: (i) => (i.verdict === 'good' && (i.race?.position ?? 99) <= 10 ? 9 : 0), t: (i) => `P${i.race!.position} and valuable points for ${i.team}. A satisfying afternoon?` },
  { id: 'r-good-nopoints', ctx: RACE, topic: 'result', w: (i) => ((i.verdict === 'good' || i.verdict === 'great') && (i.race?.position ?? 0) > 10 ? 10 : 0), t: (i) => pick([`P${i.race!.position} — just outside the points, but ahead of where the car should be. Frustrating or encouraging?`, `So close to the top 10 today. How much did you have to squeeze out of the car?`]) },
  { id: 'r-par', ctx: RACE, topic: 'result', w: (i) => (i.verdict === 'par' ? 8 : 0), t: (i) => pick([`P${i.race!.position}, more or less where the car is right now. Is that the realistic ceiling at the moment?`, `A quiet P${i.race!.position}. Was it a lonely race out there?`, `P${i.race!.position}. Maximum result, or is there something to analyse?`]) },
  { id: 'r-poor', ctx: RACE, topic: 'result', w: (i) => (i.verdict === 'poor' ? 9 : 0), t: (i) => pick([`P${i.race!.position} looks below what the car can do. What went wrong?`, `Your pace faded today. Tyres, setup, or something else?`]) },
  { id: 'r-disaster', ctx: RACE, topic: 'result', w: (i) => (i.verdict === 'disaster' ? 11 : 0), t: (i) => pick([`P${i.race!.position} with a car capable of around P${i.expected}. Honestly — what happened?`, `A tough Sunday. Is there something you need to look at in your own performance?`]) },
  { id: 'r-dnf-unlucky', ctx: RACE, topic: 'result', w: (i) => (i.verdict === 'unlucky' ? 10 : 0), t: (i) => pick([`Retirement with ${dnfEn(i.dnf)}. How frustrating is it to lose a result like that?`, `Reliability let you down again. Is your patience being tested?`]) },
  { id: 'r-dnf-crash', ctx: RACE, topic: 'result', w: (i) => (i.verdict === 'crash' ? 11 : 0), t: () => pick([`Your race ended in the barriers. Do you take responsibility for that one?`, `A costly mistake today. What will you say to your mechanics tonight?`]) },
  { id: 'r-comeback', ctx: RACE, topic: 'result', w: (i) => (i.gained >= 5 ? 9 : 0), t: (i) => `From P${i.race!.grid} to P${i.race!.position}. Talk us through that comeback.` },
  { id: 'r-start', ctx: RACE, topic: 'result', w: (i) => (i.race && !i.race.dnf ? 2 : 0), t: () => pick(['How was your start? It looked like a lot happened into Turn 1.', 'Take us through the opening lap.']) },
  { id: 'r-strategy', ctx: RACE, topic: 'team', w: (i) => (i.race && !i.race.dnf ? 3 : 0), t: (i) => pick([`You made ${i.race!.pits} stop${i.race!.pits > 1 ? 's' : ''}. Was the strategy right today?`, 'Did the team get the pit wall calls right?']) },
  { id: 'r-rain', ctx: RACE, topic: 'result', w: (i) => (i.rain ? 7 : 0), t: () => pick(['Those conditions were treacherous. How tricky was it on the wrong tyres?', 'The weather turned the race upside down. Did you enjoy the chaos?']) },
  { id: 'r-collision', ctx: RACE, topic: 'rival', w: (i) => (i.collision ? 10 : 0), t: (i) => (i.collision!.blame === PLAYER_ID ? `The stewards blamed you for the contact with ${ln(i, i.collision!.other)}. Do you accept that?` : `${ln(i, i.collision!.other)} hit you today. What would you like to say to him?`), subject: (i) => i.collision?.other },
  { id: 'r-teamorder', ctx: RACE, topic: 'controversy', w: (i) => (i.orderRefused ? 12 : 0), t: () => pick(['You ignored a team order on the radio. Why?', 'The team asked you to let your teammate by and you refused. Will there be consequences?']) },
  { id: 'r-mate', ctx: RACE, topic: 'teammate', w: (i) => (i.mate && i.mateRace ? 5 : 0), t: (i) => (i.race?.dnf && !i.mateRace!.dnf ? `${ln(i, i.mate!)} brought the car home in P${i.mateRace!.position} while your race ended early. Does that hurt?` : i.mateRace!.dnf ? `${ln(i, i.mate!)} retired today. Does that change the dynamic in the team?` : (i.race?.position ?? 99) < i.mateRace!.position ? `You beat ${ln(i, i.mate!)} today. How important is it to win that battle?` : `${ln(i, i.mate!)} finished ahead of you. What did he do better?`), subject: (i) => i.mate ?? undefined },
  { id: 'r-champ', ctx: RACE, topic: 'championship', w: (i) => (i.pos <= 3 ? 7 : 0), t: (i) => `You're P${i.pos} in the championship, ${i.gapLeader} points off the lead. Is the title a real target now?` },
  { id: 'r-next', ctx: RACE, topic: 'future', w: () => 3, t: (i) => `Next up is ${i.next}. What are you expecting there?` },
  { id: 'r-fans', ctx: RACE, topic: 'fans', w: (i) => (i.home ? 8 : 1), t: (i) => (i.home ? 'A home race and the crowd was incredible. What did their support mean today?' : 'Any message for the fans who stayed until the end?') },
  { id: 'r-car-progress', ctx: RACE, topic: 'team', w: (i) => (i.carRankBad ? 4 : 2), t: (i) => `Is ${i.team} making progress, or is it still a long way back?` },
];

// ───────────────────────── Questions après les qualifications ─────────────────────────
const QUALI_RESULT: QT[] = [
  { id: 'q-pole', ctx: QUALI, topic: 'result', w: (i) => (i.quali === 1 ? 12 : 0), t: () => pick(['Pole position! How did that final lap feel?', 'Nobody could touch you today. Was that the perfect lap?']) },
  { id: 'q-frontrow', ctx: QUALI, topic: 'result', w: (i) => (i.quali === 2 ? 10 : 0), t: () => 'Front row. Is that the best spot to attack into Turn 1 tomorrow?' },
  { id: 'q-exceptional', ctx: QUALI, topic: 'result', w: (i) => (i.qVerdict === 'exceptional' || i.qVerdict === 'great' ? 11 : 0), t: (i) => pick([`P${i.quali} with this car is a superb effort. Where did you find the time?`, `P${i.quali} — the ${i.team} looked much further back in practice. What changed?`]) },
  { id: 'q-good', ctx: QUALI, topic: 'result', w: (i) => (i.qVerdict === 'good' ? 9 : 0), t: (i) => `P${i.quali}, a bit better than expected. Happy with the lap?` },
  { id: 'q-par', ctx: QUALI, topic: 'result', w: (i) => (i.qVerdict === 'par' ? 9 : 0), t: (i) => pick([`P${i.quali} — is that where the car belongs this weekend?`, `P${i.quali}. Did you get everything out of it?`]) },
  { id: 'q-poor', ctx: QUALI, topic: 'result', w: (i) => (i.qVerdict === 'poor' || i.qVerdict === 'disaster' ? 11 : 0), t: (i) => pick([`Only P${i.quali} when the car looked capable of more. What was missing?`, `P${i.quali} is below expectations. Traffic, balance, or your lap?`]) },
  { id: 'q-q1out', ctx: QUALI, topic: 'result', w: (i) => ((i.quali ?? 0) > 16 && i.expected <= 14 ? 12 : 0), t: () => 'Out in Q1. That must hurt. What happened?' },
  { id: 'q-mate', ctx: QUALI, topic: 'teammate', w: (i) => (i.mate && i.mateQuali ? 5 : 0), t: (i) => ((i.quali ?? 99) < (i.mateQuali ?? 99) ? `You out-qualified ${ln(i, i.mate!)} again. Is that becoming a habit?` : `${ln(i, i.mate!)} was quicker today. Where did you lose time to him?`), subject: (i) => i.mate ?? undefined },
  { id: 'q-plan', ctx: QUALI, topic: 'team', w: () => 5, t: () => pick(['What\'s the plan for tomorrow? One stop or two?', 'Where can you overtake tomorrow on this track?', 'Tyres or track position — what matters most tomorrow?']) },
  { id: 'q-rain', ctx: QUALI, topic: 'result', w: (i) => (i.rain ? 6 : 1), t: () => 'Rain is in the forecast. Would you welcome it tomorrow?' },
  { id: 'q-start', ctx: QUALI, topic: 'result', w: (i) => ((i.quali ?? 0) > 1 && (i.quali ?? 0) <= 6 ? 4 : 0), t: (i) => `Who are you watching out for at the start from P${i.quali}?` },
];

// ───────────────────────── Questions générales (jeudi, médias, podcasts) ─────────────────────────
const GENERAL: QT[] = [
  { id: 'g-track', ctx: ALL, topic: 'result', w: () => 4, t: (i) => pick([`Welcome to ${i.circuit}. Does this track suit your style?`, `What's the key corner at ${i.circuit}?`, `${i.circuit}: what makes a quick lap here?`]) },
  { id: 'g-home', ctx: ALL, topic: 'fans', w: (i) => (i.home ? 12 : 0), t: () => pick(['It\'s your home race! How special is this weekend?', 'Your home crowd is expecting a lot. Pressure or motivation?']) },
  { id: 'g-objective', ctx: ['thursday', 'tv'], topic: 'team', w: () => 4, t: (i) => (i.expected <= 3 ? 'Is anything less than a win a disappointment for you here?' : i.expected <= 10 ? 'Points are the realistic target this weekend?' : `Where can ${i.team} realistically finish this weekend?`) },
  { id: 'g-last-good', ctx: ALL, topic: 'result', w: (i) => (i.verdict === 'exceptional' || i.verdict === 'great' ? 8 : 0), t: () => 'Last weekend was one of your best. Can you repeat it here?' },
  { id: 'g-last-bad', ctx: ALL, topic: 'personal', w: (i) => (i.verdict === 'disaster' || i.verdict === 'crash' ? 8 : 0), t: () => pick(['How did you bounce back after a difficult last weekend?', 'Did you sleep well after last Sunday?']) },
  { id: 'g-last-dnf', ctx: ALL, topic: 'team', w: (i) => (i.verdict === 'unlucky' ? 7 : 0), t: () => 'After last week\'s retirement, are you worried about reliability?' },
  { id: 'g-mate-atmos', ctx: ALL, topic: 'teammate', w: (i) => (i.mate ? 4 : 0), t: (i) => pick([`People say the atmosphere with ${nameOf(i.s, i.mate!)} is ${Math.random() < 0.5 ? 'tense' : 'great'}. What's the truth?`, `What have you learned from ${nameOf(i.s, i.mate!)} so far?`, `Do you and ${ln(i, i.mate!)} share data openly?`]), subject: (i) => i.mate ?? undefined },
  { id: 'g-leader', ctx: ALL, topic: 'rival', w: (i) => (i.leader && i.leader !== PLAYER_ID ? 3 : 0), t: (i) => `${nameOf(i.s, i.leader!)} leads the championship. Can he be beaten this year?`, subject: (i) => i.leader ?? undefined },
  { id: 'g-title', ctx: ALL, topic: 'championship', w: (i) => (i.pos <= 3 && i.pos > 0 ? 7 : 0), t: (i) => (i.leader === PLAYER_ID ? 'You lead the championship. How do you handle being the hunted?' : `${i.gapLeader} points off the lead. Can you still win the title?`) },
  { id: 'g-principal', ctx: ALL, topic: 'team', w: () => 2, t: (i) => `What do you think of ${i.principal}'s leadership?` },
  { id: 'g-car', ctx: ALL, topic: 'team', w: (i) => (i.carRankBad ? 5 : 2), t: (i) => pick([`What does ${i.team} need most from the next upgrade?`, 'What\'s the car\'s biggest weakness right now?', 'Are you happy with the direction of the car\'s development?']) },
  { id: 'g-topcar', ctx: ALL, topic: 'team', w: (i) => (i.carRankTop ? 5 : 0), t: () => 'You have one of the fastest cars. Does that add pressure?' },
  { id: 'g-contract', ctx: ALL, topic: 'contract', w: (i) => (i.contractEnding ? 8 : 0), t: (i) => pick([`Your contract with ${i.team} ends this season. Any talks? Other teams?`, 'Have you started discussing next year?', 'Is your future your priority right now, or just results?']) },
  { id: 'g-offers', ctx: ALL, topic: 'contract', w: (i) => (i.offers > 0 ? 9 : 0), t: () => pick(['Rumours say other teams are chasing you. Are you listening?', 'We hear you have offers on the table. Can you confirm?']) },
  { id: 'g-rival', ctx: ALL, topic: 'rival', w: (i) => (i.rival ? 6 : 0), t: (i) => pick([`Things seem tense between you and ${nameOf(i.s, i.rival!)}. Is there a problem?`, `${ln(i, i.rival!)} said you race too aggressively. Your response?`]), subject: (i) => i.rival ?? undefined },
  { id: 'g-friend', ctx: ALL, topic: 'personal', w: (i) => (i.friend ? 3 : 0), t: (i) => `You seem very close to ${nameOf(i.s, i.friend!)}. Can friendship survive wheel-to-wheel racing?`, subject: (i) => i.friend ?? undefined },
  { id: 'g-rookie', ctx: ALL, topic: 'personal', w: (i) => (i.rookie ? 4 : 0), t: () => pick(['How different is F1 from what you expected as a rookie?', 'What has surprised you most in your first season?', 'Which veteran on the grid has impressed you most?']) },
  { id: 'g-verstappen', ctx: ALL, topic: 'rival', w: () => 1.5, t: () => 'If you could race any driver in equal cars, who would it be?' },
  { id: 'g-regs', ctx: ALL, topic: 'regulations', w: (i) => (i.tone === 'tech' ? 4 : 1.5), t: () => pick(['What\'s your view on the 2026 rules and the electric energy management?', 'Do you like racing without DRS, with overtake mode instead?', 'Are the cars too heavy?']) },
  { id: 'g-swearing', ctx: ALL, topic: 'regulations', w: () => 1.5, t: () => 'What do you think of the FIA\'s fines for swearing on the radio?' },
  { id: 'g-calendar', ctx: ALL, topic: 'regulations', w: () => 1, t: () => 'Twenty-four races a season: too many?' },
  { id: 'g-safety', ctx: ALL, topic: 'regulations', w: () => 1, t: (i) => `Any safety concerns about ${i.circuit}?` },
  { id: 'g-penalties', ctx: ALL, topic: 'controversy', w: (i) => (i.s.player.penaltyPoints.length ? 5 : 0), t: () => 'You\'re collecting penalty points. Do you need to calm down on track?' },
  { id: 'g-nights', ctx: ALL, topic: 'lifestyle', w: (i) => (i.s.player.image.controversy > 35 ? 7 * (i.tone === 'tabloid' ? 2 : 1) : 0), t: () => pick(['Your nights out make headlines. Is that compatible with elite sport?', 'Photos of you leaving a club at 4am went viral. Any regrets?']) },
  { id: 'g-purchase', ctx: ALL, topic: 'lifestyle', w: (i) => (i.s.player.assets.length ? 3 * (i.tone === 'tabloid' ? 2 : 1) : 0), t: (i) => `We saw your new ${(ASSETS_BY_ID[i.s.player.assets[i.s.player.assets.length - 1].id]?.name ?? 'toy').toLowerCase()}. Enjoying the F1 lifestyle?` },
  { id: 'g-partner', ctx: ALL, topic: 'personal', w: (i) => (i.s.player.partner ? 2 * (i.tone === 'tabloid' ? 2 : 1) : 0), t: () => 'How do you balance a relationship with this crazy schedule?' },
  { id: 'g-foundation', ctx: ALL, topic: 'fans', w: (i) => (i.s.player.foundation ? 4 : 0), t: (i) => `Tell us about your foundation, ${i.s.player.foundation!.name}. Why does it matter to you?` },
  { id: 'g-sponsor', ctx: ALL, topic: 'lifestyle', w: (i) => (i.s.player.sponsors.length ? 2 : 0), t: (i) => `You're now an ambassador for ${BRANDS_BY_ID[i.s.player.sponsors[0].brandId]?.name}. Why that partnership?` },
  { id: 'g-social', ctx: ALL, topic: 'fans', w: (i) => (i.s.player.followers > 2_000_000 ? 4 : 2), t: (i) => `You have ${(i.s.player.followers / 1e6).toFixed(1)} million followers now. How do you handle the attention?` },
  { id: 'g-mental', ctx: ALL, topic: 'personal', w: (i) => (i.s.player.stress > 60 ? 6 : 1.5), t: () => pick(['How do you look after your mental health in such a demanding sport?', 'You look tired. Is the season taking its toll?']) },
  { id: 'g-fitness', ctx: ALL, topic: 'personal', w: () => 1.5, t: () => 'What does a typical training week look like for you?' },
  { id: 'g-idol', ctx: ['podcast', 'feature', 'tv'], topic: 'personal', w: () => 3, t: () => 'Who was your racing idol growing up?' },
  { id: 'g-karting', ctx: ['podcast', 'feature'], topic: 'personal', w: () => 4, t: () => 'Tell us about your childhood. How did it all start in karting?' },
  { id: 'g-funny', ctx: ['podcast', 'tv'], topic: 'rival', w: () => 4, t: () => 'Who is the funniest driver in the paddock, and who is the most annoying on track?' },
  { id: 'g-whatsapp', ctx: ['podcast', 'tv'], topic: 'personal', w: () => 3, t: () => 'Is the drivers\' WhatsApp group as chaotic as people say?' },
  { id: 'g-dream', ctx: ['podcast', 'feature'], topic: 'future', w: () => 3, t: () => 'Which team would you dream of driving for one day?' },
  { id: 'g-5years', ctx: ['feature', 'podcast'], topic: 'future', w: () => 3, t: () => 'Where do you see yourself in five years?' },
  { id: 'g-worst', ctx: ['podcast', 'feature'], topic: 'personal', w: () => 2.5, t: () => 'What\'s the worst moment of your career so far?' },
  { id: 'g-advice', ctx: ['podcast', 'feature'], topic: 'fans', w: () => 2.5, t: () => 'What advice would you give a kid who dreams of F1?' },
  { id: 'g-superstition', ctx: ['podcast', 'tv'], topic: 'personal', w: () => 2, t: () => 'Any superstitions or pre-race rituals?' },
  { id: 'g-music', ctx: ['podcast', 'tv'], topic: 'personal', w: () => 2, t: () => 'What\'s on your pre-race playlist?' },
  { id: 'g-simracing', ctx: ['podcast', 'tv', 'feature'], topic: 'personal', w: () => 1.5, t: () => 'Do you sim race in your free time? Who\'s the best on the grid at it?' },
  { id: 'g-legacy', ctx: ['feature'], topic: 'future', w: () => 2, t: () => 'How would you like to be remembered when you retire?' },
  { id: 'g-message', ctx: ALL, topic: 'fans', w: () => 1.5, t: () => 'Any message for your growing fanbase?' },
];

const POOL: QT[] = [...RACE_RESULT, ...QUALI_RESULT, ...GENERAL];

const TONE_MUL: Record<Tone, Partial<Record<InterviewQuestion['topic'], number>>> = {
  tabloid: { controversy: 2.5, lifestyle: 2.5, rival: 2, personal: 1.5, regulations: 0.4 },
  tech: { team: 2.5, regulations: 2.5, result: 1.3, lifestyle: 0.3 },
  fan: { fans: 2, personal: 1.8, future: 1.5 },
  serious: { championship: 1.5, contract: 1.5, team: 1.2 },
  tv: {},
};

export function buildInfo(s: GameState, ctx: Ctx, tone: Tone, extra?: { race?: RaceResultEntry; raceId?: string; quali?: number }): QInfo {
  const teamId = teamOf(s, PLAYER_ID);
  const team = teamId ? TEAMS_BY_ID[teamId] : null;
  const st = driverStandings(s);
  const pos = st.findIndex((d) => d.driverId === PLAYER_ID) + 1;
  const pts = st[pos - 1]?.points ?? 0;
  const leader = st[0]?.driverId ?? null;
  const raceId = extra?.raceId ?? s.weekend?.raceId ?? CALENDAR[Math.min(23, s.round)].id;
  const circ = CALENDAR.find((c) => c.id === raceId)!;
  const idx = CALENDAR.findIndex((c) => c.id === raceId);
  const nextC = CALENDAR[idx + 1];
  const last = s.results[s.results.length - 1];
  const lastMe = last?.race.find((e) => e.driverId === PLAYER_ID);
  const expected = s.weekend?.objective?.target ?? expectedFinish(s, PLAYER_ID, raceId);
  const mate = teammateOf(s, PLAYER_ID);
  const col = String(s.flags['lastCollision'] ?? '');
  const rels = Object.values(s.drivers).filter((d) => d.teamId && DRIVERS_BY_ID[d.id]);
  const rival = rels.filter((d) => d.rel.rivalry > 45 || d.rel.friendship < -25).sort((a, b) => b.rel.rivalry - a.rel.rivalry)[0]?.id ?? null;
  const friend = rels.filter((d) => d.rel.friendship > 35).sort((a, b) => b.rel.friendship - a.rel.friendship)[0]?.id ?? null;
  const race = extra?.race;
  // Verdict : course du jour (après-course) ou dernière course (jeudi)
  let verdict: Verdict | undefined;
  if (race) verdict = (s.results.at(-1)?.raceId === raceId ? (s.results.at(-1)!.playerVerdict as Verdict | undefined) : undefined) ?? verdictFor(race.position, expected, race.dnf);
  else if (lastMe && last) verdict = (last.playerVerdict as Verdict | undefined) ?? verdictFor(lastMe.position, last.playerExpected ?? 10, lastMe.dnf);
  const q = extra?.quali;
  const w = s.weekend;
  return {
    s,
    ctx,
    tone,
    race,
    quali: q,
    raceId,
    verdict,
    qVerdict: q ? verdictFor(q, expected, null) : undefined,
    expected,
    team: team?.name ?? 'your team',
    principal: team?.principal ?? 'your boss',
    mate,
    mateRace: mate ? w?.raceResult?.find((e) => e.driverId === mate) : undefined,
    mateQuali: mate ? w?.quali?.find((e) => e.driverId === mate)?.position : undefined,
    pos,
    pts,
    leader,
    gapLeader: Math.max(0, (st[0]?.points ?? 0) - pts),
    circuit: circuitName(raceId, 'en'),
    next: nextC ? circuitName(nextC.id, 'en') : 'the end of the season',
    home: circ.country === s.player.nationality,
    collision: col ? { other: col.split('|')[0], blame: col.split('|')[1] } : null,
    orderRefused: !!s.flags['teamOrderRefused'],
    rival,
    friend,
    contractEnding: !!s.player.contract && s.player.contract.endSeason <= s.season,
    offers: s.offers.filter((o) => o.state === 'open' || o.state === 'negotiating').length,
    rookie: s.player.career.starts < 24,
    rain: ctx === 'postRace' ? (w?.rain.race ?? 0) > 0.2 : ctx === 'postQuali' ? (w?.rain.quali ?? 0) > 0.2 : (w?.weatherForecast?.[2] ?? 0) > 0.4,
    gained: race && race.position > 0 ? race.grid - race.position : 0,
    dnf: race?.dnf ?? null,
    carRankBad: expected >= 12,
    carRankTop: expected <= 4,
  };
}

const COUNT: Record<Ctx, number> = { thursday: 3, postQuali: 2, postRace: 3, tv: 3, feature: 4, podcast: 5 };

/** Choisit des questions variées, adaptées au contexte, sans répéter les récentes. */
export function pickQuestions(s: GameState, ctx: Ctx, tone: Tone, extra?: { race?: RaceResultEntry; raceId?: string; quali?: number }): InterviewQuestion[] {
  const info = buildInfo(s, ctx, tone, extra);
  const recent = new Set(String(s.flags['itwRecent'] ?? '').split(',').filter(Boolean));
  const out: { q: QT; text: string }[] = [];
  const eligible = POOL.filter((q) => q.ctx.includes(ctx));
  const weight = (q: QT) => {
    let w = 0;
    try {
      w = q.w(info);
    } catch {
      w = 0;
    }
    if (w <= 0) return 0;
    w *= TONE_MUL[tone][q.topic] ?? 1;
    if (recent.has(q.id)) w *= 0.08;
    return w;
  };
  // 1re question : le résultat (après qualif / course)
  if (ctx === 'postRace' || ctx === 'postQuali') {
    const raw = (q: QT) => {
      try {
        return q.w(info);
      } catch {
        return 0;
      }
    };
    const results = eligible.filter((q) => q.topic === 'result' && raw(q) >= 8);
    // la plus pertinente, en évitant si possible celle posée récemment
    const first = results.sort((a, b) => raw(b) - (recent.has(b.id) ? 3 : 0) - (raw(a) - (recent.has(a.id) ? 3 : 0)))[0];
    if (first) out.push({ q: first, text: first.t(info) });
  }
  const n = COUNT[ctx];
  let guard = 0;
  while (out.length < n && guard++ < 50) {
    const cands = eligible.filter((q) => !out.some((o) => o.q.id === q.id) && !out.some((o) => o.q.topic === q.topic && q.topic !== 'personal')).map((q) => ({ q, w: weight(q) })).filter((x) => x.w > 0);
    if (!cands.length) break;
    const total = cands.reduce((a, c) => a + c.w, 0);
    let r = Math.random() * total;
    const chosen = cands.find((c) => (r -= c.w) <= 0) ?? cands[0];
    out.push({ q: chosen.q, text: chosen.q.t(info) });
  }
  // Mémoriser pour éviter les répétitions
  const newRecent = [...out.map((o) => o.q.id), ...recent].slice(0, 40);
  s.flags['itwRecent'] = newRecent.join(',');
  return out.map((o) => ({ text: o.text, topic: o.q.topic, subject: o.q.subject?.(info) }));
}
