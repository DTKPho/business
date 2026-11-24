import { CALENDAR, raceDate } from '../../data/calendar';
import { DRIVERS_BY_ID } from '../../data/drivers';
import { ACTIVITIES_BY_ID, ASSETS_BY_ID, BRANDS, BUSINESSES_BY_ID, INVESTMENTS_BY_ID, RESIDENCES_BY_ID } from '../../data/lifestyle';
import { TEAMS, TEAMS_BY_ID } from '../../data/teams';
import type { ChatMessage, Conversation, DriverState, GameState, LogEntry, MailItem, Relationship, WeekendResult } from '../types';
import { PLAYER_ID } from '../types';
import { ageOf, gridIds, identity, lastNameOf, nameOf, overall, statsOf, teamDrivers, teammateOf, teamOf } from '../people';
import { chance, clamp, gauss, pick, pickN, rand, randInt, uid } from '../rng';
import { driverStandings, teamStandings } from '../standings';
import { groupAfterRace, groupRandom } from '../social/group';
import { driverPostsAfterRace, fanComments, makePost, paddockRumour, raceNews, news } from '../social/press';
import { spontaneousDM, tpText } from '../social/voice';
import { buildOffer, generateOffers, offerToContract } from './contracts';
import { addDays, money } from '../format';
import { daysUntilWeekend, START_SEASON } from '../init';
import { expectedFinish, expectedMap, isBad, isGood, verdictFor } from '../expectations';

export function log(s: GameState, text: string, tone: LogEntry['tone'] = 'neutral') {
  s.log.unshift({ id: uid('l'), day: s.day, text, tone });
  if (s.log.length > 120) s.log.length = 120;
}

export function applyRel(s: GameState, id: string, d: Partial<Relationship>) {
  const dr = s.drivers[id];
  if (!dr) return;
  dr.rel.friendship = clamp(dr.rel.friendship + (d.friendship ?? 0), -100, 100);
  dr.rel.respect = clamp(dr.rel.respect + (d.respect ?? 0), 0, 100);
  dr.rel.rivalry = clamp(dr.rel.rivalry + (d.rivalry ?? 0), 0, 100);
}

export function pushDM(s: GameState, from: string, text: string, convId = from) {
  const c: Conversation = (s.conversations[convId] ??= { id: convId, messages: [], unread: 0 });
  c.messages.push({ id: uid('dm'), from, text, day: s.day });
  if (c.messages.length > 200) c.messages.splice(0, c.messages.length - 200);
  if (from !== PLAYER_ID) c.unread++;
  if (s.drivers[from]) s.drivers[from].lastMessageDay = s.day;
}

export function pushGroup(s: GameState, msgs: ChatMessage[]) {
  if (!msgs.length) return;
  s.group.messages.push(...msgs);
  if (s.group.messages.length > 300) s.group.messages.splice(0, s.group.messages.length - 300);
  s.group.unread += msgs.filter((m) => m.from !== PLAYER_ID).length;
}

export function pushMail(s: GameState, m: Omit<MailItem, 'id' | 'day' | 'read'>) {
  s.mail.unshift({ ...m, id: uid('m'), day: s.day, read: false });
  if (s.mail.length > 150) s.mail.length = 150;
}

export function addFollowers(s: GameState, delta: number) {
  s.player.followers = Math.max(1000, Math.round(s.player.followers + delta));
}

export function changeImage(s: GameState, d: Partial<GameState['player']['image']>) {
  const im = s.player.image;
  im.likeability = clamp(im.likeability + (d.likeability ?? 0), 0, 100);
  im.professionalism = clamp(im.professionalism + (d.professionalism ?? 0), 0, 100);
  im.controversy = clamp(im.controversy + (d.controversy ?? 0), 0, 100);
}

export function changeTrust(s: GameState, delta: number) {
  const t = teamOf(s, PLAYER_ID);
  if (t) s.teams[t].trust = clamp(s.teams[t].trust + delta, 0, 100);
}

export function gainXp(s: GameState, stat: keyof GameState['player']['stats'], amount: number) {
  const p = s.player;
  const coach = p.staff.find((m) => m.role === 'coach')?.level ?? 0;
  const trainer = p.staff.find((m) => m.role === 'trainer')?.level ?? 0;
  let mul = 1 + (['fitness'].includes(stat) ? trainer * 0.12 : coach * 0.08);
  if (stat === 'fitness' && p.assets.some((a) => a.id === 'gym-home')) mul += 0.2;
  if (['pace', 'feedback', 'racecraft'].includes(stat) && p.assets.some((a) => a.id === 'sim-home')) mul += 0.15;
  const cur = p.stats[stat];
  // Plus on est haut, plus c'est dur de progresser ; l'âge ralentit aussi
  const age = s.season - p.birthYear;
  const ageF = age < 24 ? 1.2 : age < 30 ? 1 : age < 34 ? 0.6 : 0.3;
  const difficulty = Math.pow((100 - cur) / 25, 1.3);
  const x = (p.xp[stat] ?? 0) + amount * mul * ageF * difficulty * 0.3;
  if (x >= 1) {
    const gained = Math.floor(x);
    p.stats[stat] = clamp(cur + gained, 40, 99);
    p.xp[stat] = x - gained;
    log(s, `📈 ${statName(stat)} progresse (+${gained}) → ${p.stats[stat]}`, 'good');
  } else p.xp[stat] = x;
}

function statName(k: string): string {
  return (
    { pace: 'Vitesse', racecraft: 'Intelligence de course', overtaking: 'Dépassement', defending: 'Défense', consistency: 'Régularité', tyreManagement: 'Gestion pneus', wet: 'Pluie', starts: 'Départs', feedback: 'Retour technique', fitness: 'Physique', mental: 'Mental' } as Record<string, string>
  )[k];
}

// ───────────── Finances ─────────────

export interface FinanceLine {
  label: string;
  amount: number;
}

export function seasonlyCosts(s: GameState): FinanceLine[] {
  const p = s.player;
  const lines: FinanceLine[] = [];
  lines.push({ label: `Vie courante (${RESIDENCES_BY_ID[p.residence].name})`, amount: -RESIDENCES_BY_ID[p.residence].livingCost });
  for (const st of p.staff) lines.push({ label: `Staff : ${st.name}`, amount: -st.salary });
  for (const a of p.assets) {
    const def = ASSETS_BY_ID[a.id];
    if (def && def.upkeep) lines.push({ label: `Entretien : ${def.name}`, amount: -def.upkeep });
  }
  return lines;
}

/** Revenus/dépenses liés à une course (1/24e des montants annuels + bonus). */
export function raceFinances(s: GameState, res: WeekendResult): FinanceLine[] {
  const p = s.player;
  const lines: FinanceLine[] = [];
  const c = p.contract;
  const tax = RESIDENCES_BY_ID[p.residence].taxRate;
  let taxable = 0;
  if (c) {
    const sal = c.salary / 24;
    lines.push({ label: 'Salaire (1/24e)', amount: sal });
    taxable += sal;
    const me = res.race.find((e) => e.driverId === PLAYER_ID);
    const sp = res.sprint?.find((e) => e.driverId === PLAYER_ID);
    const pts = (me?.points ?? 0) + (sp?.points ?? 0);
    if (pts) {
      lines.push({ label: `Prime aux points (${pts} pts)`, amount: pts * c.pointBonus });
      taxable += pts * c.pointBonus;
    }
    if (me?.position === 1) {
      lines.push({ label: 'Prime de victoire', amount: c.winBonus });
      taxable += c.winBonus;
    } else if (me && me.position > 0 && me.position <= 3) {
      lines.push({ label: 'Prime de podium', amount: c.podiumBonus });
      taxable += c.podiumBonus;
    }
  }
  for (const sp of p.sponsors) {
    const v = sp.perSeason / 24;
    lines.push({ label: `Sponsor ${BRANDS.find((b) => b.id === sp.brandId)?.name}`, amount: v });
    taxable += v;
  }
  for (const b of p.businesses) {
    const def = BUSINESSES_BY_ID[b.id];
    const pop = 0.6 + Math.log10(Math.max(1e4, p.followers)) / 10;
    const v = ((def.income * b.level) / 24) * pop * (1 + gauss(0, def.risk));
    lines.push({ label: `Business : ${def.name}`, amount: Math.round(v) });
    taxable += Math.max(0, v);
  }
  for (const l of seasonlyCosts(s)) lines.push({ label: l.label, amount: l.amount / 24 });
  if (tax > 0 && taxable > 0) lines.push({ label: `Impôts (${Math.round(tax * 100)} %)`, amount: -taxable * tax });
  return lines.map((l) => ({ ...l, amount: Math.round(l.amount) }));
}

// ───────────── Après-course ─────────────

/** Position attendue d'un pilote (voiture + pilote) sur ce circuit. */
export function expectedPosition(s: GameState, driverId: string, raceId: string): number {
  return expectedFinish(s, driverId, raceId);
}

export function playerRating(s: GameState, res: WeekendResult): number {
  const me = res.race.find((e) => e.driverId === PLAYER_ID);
  const q = res.quali.find((e) => e.driverId === PLAYER_ID);
  if (!me) return 5;
  const exp = res.playerExpected ?? expectedPosition(s, PLAYER_ID, res.raceId);
  let r = 6.2;
  if (me.dnf) r = me.dnf.includes('accrochage') || me.dnf.includes('mur') || me.dnf.includes('sortie') || me.dnf.includes('tête') ? 3.5 : 5.5;
  else r += (exp - me.position) * 0.38 + (me.grid - me.position) * 0.06;
  if (q) r += (exp - q.position) * 0.1;
  const mate = teammateOf(s, PLAYER_ID);
  const mr = mate ? res.race.find((e) => e.driverId === mate) : null;
  if (mr && !me.dnf && (mr.dnf || mr.position > me.position)) r += 0.4;
  if (me.position === 1) r += 0.8;
  if (!me.dnf && me.position <= 10 && exp > 10) r += 0.5; // points avec une voiture qui n'en vaut pas
  return Math.round(clamp(r, 1, 10) * 10) / 10;
}

export function postRace(s: GameState, res: WeekendResult, collisions: { a: string; b: string; lap: number; blame: string }[], teamOrderAnswer: 'accepted' | 'refused' | null) {
  const p = s.player;
  const me = res.race.find((e) => e.driverId === PLAYER_ID);
  const sp = res.sprint?.find((e) => e.driverId === PLAYER_ID);
  const circuit = CALENDAR.find((c) => c.id === res.raceId)!;
  const team = teamOf(s, PLAYER_ID)!;
  const tdef = TEAMS_BY_ID[team];

  // Carrière
  if (me) {
    p.career.starts++;
    p.career.points += me.points + (sp?.points ?? 0);
    if (me.position === 1) p.career.wins++;
    if (me.position >= 1 && me.position <= 3) p.career.podiums++;
    if (me.dnf) p.career.dnfs++;
    if (me.fastestLap) p.career.fastestLaps++;
    if (sp?.position === 1) p.career.sprintWins++;
  }
  if (res.quali.find((e) => e.position === 1)?.driverId === PLAYER_ID) p.career.poles++;

  // Finances
  const fin = raceFinances(s, res);
  const total = fin.reduce((a, l) => a + l.amount, 0);
  p.money += total;
  s.flags['lastFinance'] = JSON.stringify(fin);
  log(s, `💶 Bilan financier du week-end : ${total >= 0 ? '+' : ''}${money(total)}`, total >= 0 ? 'good' : 'bad');

  // Investissements
  for (const inv of p.investments) {
    const def = INVESTMENTS_BY_ID[inv.id];
    inv.value = Math.max(0, inv.value * (1 + def.drift + gauss(0, def.volatility)));
  }

  // Confiance de l'équipe
  const rating = res.playerRating;
  const exp = res.playerExpected ?? expectedPosition(s, PLAYER_ID, res.raceId);
  const verdict = verdictFor(me?.position ?? 0, exp, me?.dnf);
  if (me) {
    let dt = me.dnf ? (rating < 4 ? -6 : -1) : clamp((exp - me.position) * 0.9, -6, 8);
    if (teamOrderAnswer === 'refused') {
      dt -= 10;
      changeImage(s, { controversy: 6 });
      s.flags['teamOrderRefused'] = true;
    } else if (teamOrderAnswer === 'accepted') {
      dt += 4;
      const mate = teammateOf(s, PLAYER_ID);
      if (mate) applyRel(s, mate, { friendship: 6, respect: 3 });
    } else delete s.flags['teamOrderRefused'];
    changeTrust(s, dt);
  }

  // Moral, énergie, stress
  if (me) {
    const vm: Record<string, number> = { exceptional: 14, great: 9, good: 4, par: 0, poor: -5, disaster: -10, unlucky: -6, crash: -12 };
    const mDelta = (vm[verdict] ?? 0) + (me.position === 1 ? 8 : me.position > 0 && me.position <= 3 ? 4 : 0);
    p.morale = clamp(p.morale + mDelta + (rating - 6) * 2, 0, 100);
    p.stress = clamp(p.stress + (isGood(verdict) ? -6 : isBad(verdict) ? 8 : 1), 0, 100);
  }
  const jet = p.assets.some((a) => a.id === 'jet' || a.id === 'jet2') && p.staff.some((x) => x.role === 'pilot');
  const physio = p.staff.find((x) => x.role === 'physio')?.level ?? 0;
  p.energy = clamp(p.energy - 25 + (jet ? 12 : 0) + physio * 3 + (p.stats.fitness - 75) * 0.3, 5, 100);

  // XP d'expérience en course
  gainXp(s, 'racecraft', 0.8);
  gainXp(s, 'consistency', 0.5);
  gainXp(s, 'tyreManagement', 0.5);
  if (circuit && res.race.length) gainXp(s, 'mental', 0.3);

  // Followers
  const base = p.followers;
  let fGrowth = base * 0.004;
  if (me) {
    if (me.position === 1) fGrowth += base * 0.06 + 150_000;
    else if (me.position > 0 && me.position <= 3) fGrowth += base * 0.025 + 40_000;
    else if (me.points > 0) fGrowth += base * 0.006;
    if (me.grid - me.position >= 6) fGrowth += base * 0.01;
    if (verdict === 'exceptional') fGrowth += base * 0.02 + 30_000;
    else if (verdict === 'great') fGrowth += base * 0.008;
  }
  const pr = p.staff.find((x) => x.role === 'pr')?.level ?? 0;
  addFollowers(s, fGrowth * (1 + pr * 0.1));

  // Relations : collisions
  delete s.flags['lastCollision'];
  for (const col of collisions) {
    if (col.a !== PLAYER_ID && col.b !== PLAYER_ID) {
      // collision entre IA : tension entre eux, sans effet joueur
      continue;
    }
    const other = col.a === PLAYER_ID ? col.b : col.a;
    s.flags['lastCollision'] = `${other}|${col.blame}`;
    if (col.blame === PLAYER_ID) {
      applyRel(s, other, { friendship: -12, rivalry: 14, respect: -4 });
      p.penaltyPoints.push({ points: 2, season: s.season, race: res.round });
      changeImage(s, { professionalism: -2 });
      if (chance(0.85)) pushDM(s, other, spontaneousDM(s, other, 'collision'));
    } else {
      applyRel(s, other, { rivalry: 6 });
      if (DRIVERS_BY_ID[other] && DRIVERS_BY_ID[other].persona.traits.warmth > 70 && chance(0.6)) pushDM(s, other, 'Désolé pour le contact. Ma faute, j’ai mal jugé le freinage. 🙏');
    }
  }
  // Points de pénalité : suspension si ≥ 12 sur 12 mois glissants (simplifié : saison)
  const pp = p.penaltyPoints.filter((x) => x.season === s.season).reduce((a, x) => a + x.points, 0);
  if (pp >= 12 && !s.flags['banned']) {
    s.flags['banned'] = res.round + 1;
    pushMail(s, { from: 'FIA — Commissaires sportifs', subject: 'Sanction : 12 points de pénalité', body: `Vous avez atteint ${pp} points de pénalité sur votre super-licence. Sanction : départ depuis la voie des stands au prochain Grand Prix, et vos points sont remis à zéro.`, action: { kind: 'info' } });
    log(s, '🚫 12 points de pénalité : départ des stands au prochain GP !', 'bad');
    p.penaltyPoints = [];
  }

  // Coéquipier : rivalité interne
  const mate = teammateOf(s, PLAYER_ID);
  if (mate && me) {
    const mr = res.race.find((e) => e.driverId === mate);
    if (mr && !me.dnf && !mr.dnf) {
      if (me.position < mr.position) applyRel(s, mate, { rivalry: 2, respect: 2 });
      else applyRel(s, mate, { rivalry: 1 });
    }
  }

  // Forme des IA
  const expMap = expectedMap(s, res.raceId);
  for (const e of res.race) {
    if (e.driverId === PLAYER_ID) continue;
    const d = s.drivers[e.driverId];
    if (!d) continue;
    const exp2 = expMap[e.driverId] ?? 11;
    d.form = clamp(d.form * 0.6 + (e.dnf ? -1 : (exp2 - e.position) * 0.4) + gauss(0, 1), -8, 8);
    d.morale = clamp(d.morale + (e.position === 1 ? 10 : e.dnf ? -6 : 0), 0, 100);
  }

  // Respect gagné par les résultats
  if (me && me.position > 0 && me.position <= 3) for (const id of Object.keys(s.drivers)) applyRel(s, id, { respect: me.position === 1 ? 2 : 1 });

  // Social : groupe, DMs, posts, news
  pushGroup(s, groupAfterRace(s, res, collisions));
  if (me && me.position >= 1 && me.position <= 3) {
    const friends = Object.values(s.drivers)
      .filter((d) => d.teamId && d.rel.friendship > 15)
      .map((d) => d.id);
    for (const id of pickN(friends, me.position === 1 ? 3 : 1)) if (DRIVERS_BY_ID[id]) pushDM(s, id, spontaneousDM(s, id, 'congrats', { position: me.position }));
  }
  if (me && (me.dnf || verdict === 'disaster')) {
    const friends = Object.values(s.drivers).filter((d) => d.rel.friendship > 30 && DRIVERS_BY_ID[d.id]);
    if (friends.length && chance(0.6)) pushDM(s, pick(friends).id, spontaneousDM(s, pick(friends).id, 'support'));
  }
  // Message du Team Principal
  if (me) {
    const tp = `tp:${team}`;
    let txt = '';
    const X = (en: string, fr: string) => tpText(s, team, en, fr);
    if (me.position === 1) txt = pick([X('What a race! The whole factory is on fire. Enjoy it, you earned it.', 'Quelle course ! Toute l’usine est en feu. Profite, tu l’as méritée.'), X('Magnificent win. Thank you for your commitment.', 'Victoire magnifique. Merci pour ton engagement.')]);
    else if (teamOrderAnswer === 'refused') txt = X('I won\'t say it twice: when the team gives an instruction, you follow it. We talk tomorrow at the factory.', 'Je ne vais pas le répéter deux fois : quand l’équipe donne une consigne, tu l’appliques. On en parle demain à l’usine.');
    else if (me.dnf && rating < 4) txt = X('We left points on the table today. Go through it with your engineer, I want a reaction.', 'On a laissé des points sur la table aujourd’hui. Analyse ça avec ton ingénieur, je veux une réaction.');
    else if (verdict === 'exceptional') txt = X(`P${me.position} with this car? That's a fantastic drive. The whole factory saw it.`, `P${me.position} avec cette voiture ? C’est une course fantastique. Toute l’usine l’a vue.`);
    else if (verdict === 'great') txt = X('Well above expectations. Keep it up.', 'Bien au-dessus des attentes. Continue comme ça.');
    else if (verdict === 'disaster') txt = X(`P${me.position} is not where this car should be. Let's understand why.`, `P${me.position}, ce n’est pas la place de cette voiture. Il faut comprendre pourquoi.`);
    if (txt) txt = `${tdef.principal}: ${txt}`;
    if (txt) pushDM(s, tp, txt, tp);
  }
  for (const n of raceNews(s, res)) s.news.unshift(n);
  s.feed.unshift(...driverPostsAfterRace(s, res));
  // Posts automatiques de l'équipe
  if (me && me.position > 0 && me.position <= 3) {
    const post = makePost(s, team, 'race', `${me.position === 1 ? 'RACE WIN' : 'PODIUM'} for ${p.firstName} ${p.lastName} in ${circuit.city}! 🏆 #${tdef.short}`, randInt(300_000, 1_500_000));
    post.comments = fanComments(s, post, 0.8);
    s.feed.unshift(post);
  }
  if (s.feed.length > 120) s.feed.length = 120;
  if (s.news.length > 120) s.news.length = 120;

  // Objectifs sponsors : boost image
  if (me?.position === 1 && !p.achievements.includes('first-win')) {
    p.achievements.push('first-win');
    log(s, '🏆 Succès débloqué : première victoire en F1 !', 'good');
  }
  if (me && me.position > 0 && me.position <= 3 && !p.achievements.includes('first-podium')) {
    p.achievements.push('first-podium');
    log(s, '🍾 Succès débloqué : premier podium !', 'good');
  }

  // Développement des voitures
  developCars(s);

  // Offres de contrat
  for (const off of generateOffers(s)) {
    s.offers.push(off);
    const t = TEAMS_BY_ID[off.teamId];
    pushMail(s, {
      from: `${t.principal} — ${t.name}`,
      subject: off.teamId === team ? 'Prolongation de contrat' : `Proposition de contrat pour ${off.fromSeason}`,
      body: `${p.firstName},\n\n${off.teamId === team ? 'Nous aimerions prolonger notre collaboration.' : `${t.name} suit tes performances de près et souhaiterait t’intégrer à partir de ${off.fromSeason}.`} Les détails sont dans l’onglet Carrière. Cette offre est valable un mois.\n\n${t.principal}`,
      action: { kind: 'contractOffer', offerId: off.id },
    });
    log(s, `📨 Offre de contrat reçue de ${t.name} !`, 'good');
    s.news.unshift(news(s, 'transfer', `Mercato : ${t.name} s’intéresse à ${p.lastName}`, `Selon nos sources, ${t.name} aurait fait une offre à ${p.firstName} ${p.lastName}.`));
  }
  // Offres expirées
  for (const o of s.offers) if ((o.state === 'open' || o.state === 'negotiating') && s.day > o.expiresDay) o.state = 'expired';

  // Sponsors personnels : offres
  maybeSponsorOffer(s);
  // Rumeurs
  const rum = paddockRumour(s);
  if (rum) s.news.unshift(rum);
}

function maybeSponsorOffer(s: GameState) {
  const p = s.player;
  const eligible = BRANDS.filter((b) => b.minFollowers <= p.followers && !p.sponsors.some((x) => x.brandId === b.id));
  if (!eligible.length || !chance(0.35)) return;
  if (s.mail.some((m) => m.action?.kind === 'sponsorOffer' && !m.resolved && s.day - m.day < 20)) return;
  const b = pick(eligible);
  const mgr = p.staff.find((x) => x.role === 'manager')?.level ?? 0;
  const value = Math.round((b.basePerSeason * (0.8 + Math.log10(p.followers / b.minFollowers + 1) * 0.6) * (1 + mgr * 0.08)) / 10_000) * 10_000;
  pushMail(s, {
    from: `${b.name} — Partenariats`,
    subject: `Proposition de partenariat personnel (${b.sector})`,
    body: `Bonjour ${p.firstName},\n\n${b.desc} Nous souhaitons faire de toi l’un de nos ambassadeurs : ${money(value)} par saison pendant 2 saisons, contre ${b.image === 'premium' ? 3 : 4} activations par saison (événements, posts).\n${b.image === 'risky' ? '\nNB : certains médias critiquent notre secteur.\n' : ''}\nL’équipe ${b.name}`,
    action: { kind: 'sponsorOffer', brandId: b.id, perSeason: value, seasons: 2, obligations: b.image === 'premium' ? 3 : 4 },
  });
}

export function developCars(s: GameState) {
  for (const t of TEAMS) {
    const st = s.teams[t.id];
    let pts = (st.budget / 470) * rand(0.6, 1.4);
    if (teamOf(s, PLAYER_ID) === t.id) pts *= 0.85 + s.player.stats.feedback / 300;
    st.car.devPoints += pts;
    while (st.car.devPoints >= 3) {
      st.car.devPoints -= 3;
      const focus = st.devFocus === 'balanced' ? pick(['aero', 'power', 'chassis', 'reliability'] as const) : st.devFocus;
      const cap = 99;
      st.car[focus] = clamp(st.car[focus] + (chance(0.15) ? -0.5 : rand(0.3, 1.0)), 60, cap);
    }
  }
}

// ───────────── Jours libres ─────────────

/** Événements aléatoires d'une journée hors course. */
export function dailyTick(s: GameState) {
  const p = s.player;
  const physio = p.staff.find((x) => x.role === 'physio')?.level ?? 0;
  const chef = p.staff.find((x) => x.role === 'chef')?.level ?? 0;
  p.energy = clamp(p.energy + 3 + physio + chef * 0.5, 0, 100);
  p.stress = clamp(p.stress - 1 - physio * 0.5, 0, 100);
  if (chef) p.morale = clamp(p.morale + 0.3 * chef, 0, 100);
  // Groupe WhatsApp
  if (chance(0.45)) pushGroup(s, groupRandom(s));
  // DMs spontanés
  if (chance(0.3)) {
    const cands = Object.values(s.drivers).filter((d) => d.teamId && DRIVERS_BY_ID[d.id] && s.day - d.lastMessageDay > 6);
    const d = cands.length ? pick(cands) : null;
    if (d) {
      if (d.rel.friendship > 20 && chance(0.6)) {
        const act = pick(DRIVERS_BY_ID[d.id].persona.likes.filter((a) => ACTIVITIES_BY_ID[a]) as string[]);
        if (act) {
          pushDM(s, d.id, spontaneousDM(s, d.id, 'invite', { activityId: act }));
          s.flags[`invite:${d.id}`] = `${act}|${s.day}`;
        }
      } else if (d.rel.friendship > -10 && chance(0.4)) pushDM(s, d.id, spontaneousDM(s, d.id, 'banter'));
    }
  }
  // Anniversaire du joueur
  const [, m, dd] = s.date.split('-');
  if (s.flags['bday'] !== s.season && Number(m) === 6 && Number(dd) === 15) {
    s.flags['bday'] = s.season;
    for (const d of Object.values(s.drivers).filter((x) => x.rel.friendship > 10 && DRIVERS_BY_ID[x.id]).slice(0, 5)) pushDM(s, d.id, spontaneousDM(s, d.id, 'birthday'));
  }
  // Rumeurs & news
  if (chance(0.2)) {
    const r = paddockRumour(s);
    if (r) s.news.unshift(r);
  }
  // Invitations à des événements
  if (chance(0.08)) {
    const ev = pick([
      { name: 'Soirée de lancement d’une montre', reward: 50_000 },
      { name: 'Gala de charité à Monaco', reward: 0 },
      { name: 'Défilé de mode à Paris', reward: 80_000 },
      { name: 'Apparition dans un clip musical', reward: 120_000 },
      { name: 'Match de foot des célébrités', reward: 20_000 },
      { name: 'Masterclass dans une école de karting', reward: 10_000 },
    ]);
    pushMail(s, { from: 'Agence d’événementiel', subject: `Invitation : ${ev.name}`, body: `Nous serions honorés de votre présence. Cachet proposé : ${money(ev.reward)}. Participer coûte de l’énergie mais rapporte visibilité et image.`, action: { kind: 'event', eventId: ev.name, reward: ev.reward } });
  }
  // Polémique qui retombe
  changeImage(s, { controversy: -0.4 });
  // Partenaire
  if (p.partner) {
    p.partner.affection = clamp(p.partner.affection - 0.5, 0, 100);
    if (p.partner.affection < 25) p.morale = clamp(p.morale - 0.6, 0, 100);
    else if (p.partner.affection > 70) p.morale = clamp(p.morale + 0.3, 0, 100);
  }
}

// ───────────── Fin de saison ─────────────

export function finalizeSeason(s: GameState): void {
  const st = driverStandings(s);
  const ct = teamStandings(s, s.results);
  const p = s.player;
  const myIdx = st.findIndex((d) => d.driverId === PLAYER_ID);
  const team = teamOf(s, PLAYER_ID);
  if (team) {
    const mine = st[myIdx];
    p.seasonHistory.push({ season: s.season, teamId: team, position: myIdx + 1, points: mine?.points ?? 0, wins: mine?.wins ?? 0, podiums: mine?.podiums ?? 0, champion: st[0]?.driverId ?? '', constructorsChampion: ct[0].teamId });
  }
  if (st[0]?.driverId === PLAYER_ID) {
    p.career.titles++;
    p.achievements.push(`champion-${s.season}`);
    if (p.contract) p.money += p.contract.titleBonus * (1 - RESIDENCES_BY_ID[p.residence].taxRate);
    addFollowers(s, p.followers * 0.4 + 2_000_000);
    s.news.unshift(news(s, 'player', `${p.firstName} ${p.lastName} CHAMPION DU MONDE ${s.season} !`, 'Une saison historique couronnée par le titre suprême.'));
  }
  s.allResults.push(...s.results);
  s.phase = 'offseason';
}

/** Mercato IA + vieillissement + passage à la saison suivante. */
export function startNextSeason(s: GameState): string[] {
  const report: string[] = [];
  const next = s.season + 1;
  // Joueur : contrat
  const p = s.player;
  const signed = s.offers.find((o) => o.state === 'accepted' && o.fromSeason === next);
  if (signed) {
    p.contract = offerToContract(signed);
    report.push(`Vous rejoignez ${TEAMS_BY_ID[signed.teamId].name} pour ${next}.`);
  } else if (p.contract && p.contract.endSeason < next) {
    p.contract = null;
  }

  // Vieillissement des IA
  for (const d of Object.values(s.drivers)) {
    if (d.retired) continue;
    const age = next - identity(s, d.id).birthYear;
    for (const k of Object.keys(d.stats) as (keyof typeof d.stats)[]) {
      const delta = age < 23 ? rand(0, 2.5) : age < 28 ? rand(-0.3, 1.2) : age < 33 ? rand(-0.8, 0.6) : age < 37 ? rand(-1.6, 0.2) : rand(-2.5, 0);
      d.stats[k] = clamp(Math.round((d.stats[k] + delta) * 10) / 10, 40, 99);
    }
    d.form = 0;
  }
  // Retraites
  for (const d of Object.values(s.drivers)) {
    if (d.retired) continue;
    const age = next - identity(s, d.id).birthYear;
    const contractOver = !d.contract || d.contract.endSeason < next;
    const p2 = age >= 42 ? 0.9 : age >= 39 ? 0.45 : age >= 36 ? 0.12 : 0;
    if ((contractOver && chance(p2)) || (!d.teamId && age > 32 && chance(0.5))) {
      d.retired = true;
      d.teamId = null;
      d.contract = null;
      report.push(`${nameOf(s, d.id)} prend sa retraite.`);
      s.news.unshift(news(s, 'paddock', `${nameOf(s, d.id)} annonce sa retraite`, `À ${age} ans, ${nameOf(s, d.id)} tire sa révérence. Le paddock lui rend hommage.`));
    }
  }
  // Libérer les baquets expirés (avec reconduction probable)
  for (const d of Object.values(s.drivers)) {
    if (d.retired || !d.teamId || !d.contract) continue;
    if (d.contract.endSeason < next) {
      const team = d.teamId;
      const mates = teamDrivers(s, team).filter((x) => x !== d.id);
      const strong = overall(d.stats) >= Math.max(0, ...mates.map((m) => overall(statsOf(s, m)))) - 2;
      if (chance(strong ? 0.75 : 0.4)) {
        d.contract.endSeason = next + randInt(0, 2);
        d.contract.salary = Math.round(d.contract.salary * rand(0.9, 1.3));
      } else {
        report.push(`${nameOf(s, d.id)} quitte ${TEAMS_BY_ID[team].name}.`);
        d.teamId = null;
        d.contract = null;
      }
    }
  }
  // Le joueur prend un baquet chez sa nouvelle équipe : en excès ? on libère le moins bon
  if (p.contract) {
    const t = p.contract.teamId;
    let ds = teamDrivers(s, t).filter((x) => x !== PLAYER_ID);
    while (ds.length > 1) {
      const worst = ds.sort((a, b) => overall(statsOf(s, a)) - overall(statsOf(s, b)))[0];
      s.drivers[worst].teamId = null;
      s.drivers[worst].contract = null;
      report.push(`${nameOf(s, worst)} perd son baquet chez ${TEAMS_BY_ID[t].name}.`);
      ds = ds.filter((x) => x !== worst);
    }
  }
  // Remplir les baquets libres
  const pool = (): DriverState[] => Object.values(s.drivers).filter((d) => !d.retired && !d.teamId);
  for (const t of [...TEAMS].sort((a, b) => b.prestige - a.prestige)) {
    let seats = 2 - teamDrivers(s, t.id).length;
    while (seats > 0) {
      let cands = pool();
      if (!cands.length || chance(0.25)) {
        const r = createRookie(s);
        cands = [r];
      }
      const best = cands.sort((a, b) => overall(b.stats) - overall(a.stats) + rand(-3, 3))[0];
      best.teamId = t.id;
      best.contract = { teamId: t.id, salary: Math.round(rand(1, 8) * 1e6), endSeason: next + randInt(0, 2), status: 'equal', winBonus: 0, podiumBonus: 0, pointBonus: 0, titleBonus: 0, releaseClause: null };
      report.push(`${nameOf(s, best.id)} signe chez ${t.name}.`);
      s.news.unshift(news(s, 'transfer', `Officiel : ${nameOf(s, best.id)} chez ${t.name} en ${next}`, `${t.principal} se réjouit de cette arrivée.`));
      seats--;
    }
  }
  // Voitures : convergence + aléas réglementaires
  const ct = teamStandings(s, s.results);
  for (const t of TEAMS) {
    const st = s.teams[t.id];
    const rank = ct.findIndex((x) => x.teamId === t.id);
    for (const k of ['aero', 'power', 'chassis', 'reliability'] as const) {
      st.car[k] = clamp(st.car[k] * 0.85 + 85 * 0.15 + (st.budget - 400) / 60 + gauss(0, 1.8) + (rank > 7 ? 0.8 : 0), 65, 98);
    }
    st.car.devPoints = 0;
  }
  // Remise à zéro de la saison
  s.season = next;
  s.round = 0;
  s.results = [];
  s.date = `${next}-02-18`;
  s.phase = 'preseason';
  s.offers = s.offers.filter((o) => o.state === 'open' && o.fromSeason > next);
  s.player.penaltyPoints = s.player.penaltyPoints.filter((x) => x.season >= next - 1);
  delete s.flags['banned'];
  s.teammateId = teammateOf(s, PLAYER_ID);
  // Coûts annuels de résidence déjà pris par course ; anniversaire
  s.actionsLeft = daysUntilWeekend(s);
  // Nouveaux numéros de champion etc.
  log(s, `🗓️ Bienvenue dans la saison ${next} !`, 'info');
  if (!p.contract) {
    pushMail(s, { from: 'Ton manager', subject: 'Sans volant…', body: 'Tu n’as pas de baquet pour cette saison. Va dans l’onglet Carrière pour trouver une équipe : certaines places de réserviste ou de remplaçant peuvent se libérer.', action: { kind: 'info' } });
  }
  return report;
}

const ROOKIE_FIRST = ['Lucas', 'Mateo', 'Noah', 'Oskar', 'Luca', 'Rafael', 'Kai', 'Elias', 'Théo', 'Hugo', 'Kenzo', 'Aarav', 'Leon', 'Tiago', 'Finn', 'Nils', 'Jasper', 'Santiago', 'Yuki', 'Ilya'];
const ROOKIE_LAST = ['Varela', 'Lindqvist', 'Moreau', 'Kowalczyk', 'Bianchi', 'Okoro', 'Hartmann', 'Sato', 'Delgado', 'Fournier', 'van Dijkstra', 'Reyes', 'Novak', 'Castellano', 'Brennan', 'Haugen', 'Duarte', 'Lemaître', 'Achterberg', 'Kimura'];
const ROOKIE_NAT = ['BR', 'SE', 'FR', 'PL', 'IT', 'GB', 'DE', 'JP', 'ES', 'NL', 'MX', 'NO', 'PT', 'US', 'CN', 'AU', 'DK', 'IN'];

export function createRookie(s: GameState): DriverState {
  const id = `rk_${uid('r')}`;
  const firstName = pick(ROOKIE_FIRST);
  const lastName = pick(ROOKIE_LAST);
  const used = new Set([...Object.values(DRIVERS_BY_ID).map((d) => d.number), s.player.number, ...Object.values(s.generatedDrivers).map((g) => g.number)]);
  let number = randInt(2, 99);
  while (used.has(number)) number = randInt(2, 99);
  s.generatedDrivers[id] = { id, firstName, lastName, code: lastName.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(), nationality: pick(ROOKIE_NAT), number, birthYear: s.season - randInt(18, 22) };
  const base = rand(74, 82);
  const stats = {} as DriverState['stats'];
  for (const k of ['pace', 'racecraft', 'overtaking', 'defending', 'consistency', 'tyreManagement', 'wet', 'starts', 'feedback', 'fitness', 'mental'] as const) stats[k] = clamp(Math.round(base + gauss(0, 3)), 60, 92);
  const d: DriverState = { id, teamId: null, stats, form: 0, morale: 70, contract: null, retired: false, rel: { friendship: 0, respect: 30, rivalry: 0 }, lastMessageDay: -99, unread: 0 };
  s.drivers[id] = d;
  s.rookies.push(id);
  return d;
}

/** Offres de secours si le joueur n'a pas de baquet en fin de saison. */
export function emergencyOffers(s: GameState) {
  const next = s.season + 1;
  if (s.offers.some((o) => o.state === 'accepted' && o.fromSeason === next)) return;
  if (s.player.contract && s.player.contract.endSeason >= next) return;
  const teams = [...TEAMS].sort((a, b) => a.prestige - b.prestige).slice(0, 4);
  for (const t of pickN(teams, 2)) {
    if (s.offers.some((o) => o.teamId === t.id && (o.state === 'open' || o.state === 'negotiating'))) continue;
    const o = buildOffer(s, t.id, next, 0.85);
    o.expiresDay = s.day + 60;
    s.offers.push(o);
    pushMail(s, { from: `${t.principal} — ${t.name}`, subject: `Un baquet pour ${next} ?`, body: 'Ton contrat arrive à échéance. Nous avons une place pour toi. Réfléchis vite.', action: { kind: 'contractOffer', offerId: o.id } });
  }
}

export function nextRaceDate(s: GameState): string {
  return raceDate(s.season, s.round);
}

export function weekendThursday(s: GameState): string {
  return addDays(nextRaceDate(s), -3);
}

export function seasonStartYear(): number {
  return START_SEASON;
}

export function driverAge(s: GameState, id: string): number {
  return ageOf(s, id);
}

export function lname(s: GameState, id: string) {
  return lastNameOf(s, id);
}

export function playerGrid(s: GameState) {
  return gridIds(s);
}
