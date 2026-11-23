/** Presse, réseaux sociaux et rumeurs du paddock. */
import { CALENDAR } from '../../data/calendar';
import { DRIVERS_BY_ID } from '../../data/drivers';
import { FAN_NAMES, OUTLETS } from '../../data/media';
import { TEAMS_BY_ID } from '../../data/teams';
import type { GameState, NewsItem, SocialPost, WeekendResult } from '../types';
import { PLAYER_ID } from '../types';
import { lastNameOf, nameOf, teamOf } from '../people';
import { chance, pick, pickN, randInt, uid, rand } from '../rng';
import { driverStandings } from '../standings';

export function news(s: GameState, tag: NewsItem['tag'], title: string, body: string, outlet?: string): NewsItem {
  return { id: uid('n'), day: s.day, outlet: outlet ?? pick(OUTLETS).name, title, body, tag };
}

export function raceNews(s: GameState, res: WeekendResult): NewsItem[] {
  const c = CALENDAR.find((x) => x.id === res.raceId)!;
  const out: NewsItem[] = [];
  const podium = res.race.filter((e) => e.position >= 1 && e.position <= 3);
  const w = podium[0];
  if (w) {
    out.push(
      news(
        s,
        'race',
        `${c.short} : ${nameOf(s, w.driverId)} s’impose${w.grid > 5 ? ` après être parti ${w.grid}e` : ''} !`,
        `${nameOf(s, w.driverId)} (${TEAMS_BY_ID[w.teamId].name}) remporte le ${c.name} devant ${podium[1] ? nameOf(s, podium[1].driverId) : '—'} et ${podium[2] ? nameOf(s, podium[2].driverId) : '—'}. ${res.race.filter((e) => e.dnf).length} abandons au total.`,
      ),
    );
  }
  const me = res.race.find((e) => e.driverId === PLAYER_ID);
  if (me) {
    const n = `${s.player.firstName} ${s.player.lastName}`;
    let t = '';
    let b = '';
    if (me.position === 1) {
      t = pick([`${n} triomphe à ${c.city} !`, `Masterclass de ${n} au ${c.short}`, `${n}, le nouveau visage de la victoire`]);
      b = 'Une performance de très haut niveau qui fait déjà parler tout le paddock.';
    } else if (me.position > 0 && me.position <= 3) {
      t = `Podium pour ${n} au ${c.short}`;
      b = `P${me.position} pour ${n}, qui confirme sa montée en puissance.`;
    } else if (me.dnf) {
      t = pick([`Week-end noir pour ${n}`, `${n} contraint à l’abandon`]);
      b = `Abandon (${me.dnf}). ${me.dnf.includes('accrochage') || me.dnf.includes('mur') ? 'Une erreur qui risque de coûter cher.' : 'La malchance s’acharne.'}`;
    } else if (me.position > me.grid + 4) {
      t = `${n} recule au ${c.short}`;
      b = `Parti ${me.grid}e, arrivé ${me.position}e : un dimanche difficile.`;
    } else if (me.grid - me.position >= 5) {
      t = `La remontée fantastique de ${n}`;
      b = `De la ${me.grid}e à la ${me.position}e place, ${n} a régalé le public.`;
    }
    if (t) out.push(news(s, 'player', t, b));
  }
  const st = driverStandings(s);
  if (st.length > 1 && res.round > 3 && chance(0.6)) {
    const gap = st[0].points - st[1].points;
    out.push(news(s, 'race', `Championnat : ${lastNameOf(s, st[0].driverId)} ${gap > 40 ? 's’envole' : 'garde la main'}`, `${nameOf(s, st[0].driverId)} compte ${gap} points d’avance sur ${nameOf(s, st[1].driverId)} après ${res.round + 1} manches.`));
  }
  return out;
}

export function paddockRumour(s: GameState): NewsItem | null {
  const drivers = Object.values(s.drivers).filter((d) => d.teamId && !d.retired);
  const roll = Math.random();
  const outlet = pick(OUTLETS.filter((o) => o.tone !== 'tv')).name;
  if (roll < 0.35) {
    const d = pick(drivers);
    const other = pick(Object.keys(TEAMS_BY_ID).filter((t) => t !== d.teamId));
    return news(s, 'rumour', `Rumeur : ${nameOf(s, d.id)} approché par ${TEAMS_BY_ID[other as keyof typeof TEAMS_BY_ID].name} ?`, `Selon nos informations, des discussions préliminaires auraient eu lieu. Le clan de ${lastNameOf(s, d.id)} dément… mollement.`, outlet);
  }
  if (roll < 0.55) {
    const t = pick(Object.values(TEAMS_BY_ID));
    return news(s, 'paddock', `${t.name} prépare une grosse évolution`, `${t.principal} promet « un pas en avant significatif » avec un nouveau fond plat attendu d’ici quelques courses.`, outlet);
  }
  if (roll < 0.7) {
    const team = teamOf(s, PLAYER_ID);
    if (team && s.player.contract && s.player.contract.endSeason <= s.season) {
      return news(s, 'rumour', `Mercato : l’avenir de ${s.player.lastName} au cœur des discussions`, `Plusieurs équipes surveilleraient la situation contractuelle de ${s.player.firstName} ${s.player.lastName}.`, outlet);
    }
  }
  if (roll < 0.85) {
    return news(s, 'paddock', pick(['La FIA précise les règles sur l’énergie électrique', 'Le calendrier de la saison prochaine dévoilé bientôt', 'Débat sur les limites de piste : les pilotes montent au créneau', 'Les budgets plafonnés au cœur d’une nouvelle polémique', 'Pirelli annonce des composés plus tendres']), 'Le paddock bruisse de discussions à l’approche du prochain Grand Prix.', outlet);
  }
  return null;
}

const SCENES: Record<SocialPost['kind'], string[]> = {
  race: ['🏁', '🏆', '🍾', '🏎️💨', '📸🏎️'],
  lifestyle: ['🌅', '🛥️', '🏝️', '☕', '🎹', '🐶', '⛳', '🎾'],
  sponsor: ['⌚', '🕶️', '👟', '⚡'],
  fans: ['🤳', '✍️', '❤️'],
  statement: ['📝'],
  training: ['🏋️', '🚴', '🧠', '🥗'],
  meme: ['😂', '🤡', '💀'],
};

export function makePost(s: GameState, author: string, kind: SocialPost['kind'], text: string, likesBase?: number): SocialPost {
  const followers = author === PLAYER_ID ? s.player.followers : 3_000_000;
  const likes = Math.round((likesBase ?? followers * rand(0.03, 0.09)) * (kind === 'race' ? 1.4 : 1));
  return { id: uid('p'), author, text, kind, day: s.day, likes, comments: [], image: pick(SCENES[kind]) };
}

export function driverPostsAfterRace(s: GameState, res: WeekendResult): SocialPost[] {
  const out: SocialPost[] = [];
  for (const e of res.race.filter((x) => x.driverId !== PLAYER_ID && DRIVERS_BY_ID[x.driverId])) {
    if (!(e.position <= 3 && e.position > 0) && !chance(0.12)) continue;
    const p = DRIVERS_BY_ID[e.driverId].persona;
    const c0 = CALENDAR.find((x) => x.id === res.raceId)!;
    const c = { ...c0, city: c0.city === 'Montréal' ? 'Montreal' : c0.city === 'Djeddah' ? 'Jeddah' : c0.city === 'Bakou' ? 'Baku' : c0.city === 'Abou Dabi' ? 'Abu Dhabi' : c0.city === 'Singapour' ? 'Singapore' : c0.city };
    let text: string;
    if (e.position === 1) text = `${pick(['WHAT. A. DAY.', 'WE WON!', 'P1 🏆', 'Race winner 🏁'])} ${c.city} ❤️ ${pick(p.catchphrases)}`;
    else if (e.position > 0 && e.position <= 3) text = `P${e.position} in ${c.city}. ${pick(['Great job team.', 'We take it!', 'Another step forward.', 'Podium vibes 🍾'])}`;
    else if (e.dnf) text = `Not our day. ${pick(p.catchphrases)}`;
    else text = `P${e.position}. ${pick(['Back to work.', 'On to the next one.', 'Thanks to all the fans here!'])}`;
    if (p.lowercase) text = text.toLowerCase();
    const post = makePost(s, e.driverId, 'race', text, randInt(200_000, 3_000_000) * (e.position === 1 ? 2 : 1));
    out.push(post);
  }
  return out.slice(0, 5);
}

export function fanComments(_s: GameState, _post: SocialPost, tone: number): { author: string; text: string }[] {
  const pos = ['🔥🔥🔥', 'GOAT', 'best on the grid', 'so proud of you', 'future world champion 🏆', 'this made my day', 'massive', 'LET\'S GOOO', 'king 👑', 'deserved!!', 'the helmet 😍', 'icon behaviour', 'we love you ❤️'];
  const neg = ['overrated', 'focus on driving instead', 'another ad…', 'give the seat back', 'ratio', 'arrogant', 'less partying maybe?', 'you ruined my driver\'s race 😡', 'mid'];
  const neu = ['🧡', '❤️', 'so cool', 'who took this pic?', 'we want vlogs', 'where is this?', 'mood', 'first', 'drop the playlist', 'POV: me watching at 3am'];
  const n = randInt(3, 6);
  return pickN(FAN_NAMES, n).map((a) => ({ author: a, text: tone > 0.3 ? pick([...pos, ...neu]) : tone < -0.3 ? pick([...neg, ...neu]) : pick([...pos, ...neg.slice(0, 3), ...neu]) }));
}
