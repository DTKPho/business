/**
 * Moteur de réponses « hors-ligne » des pilotes.
 *
 * Chaque réponse est COMPOSÉE à partir de ce que le joueur a écrit (intentions,
 * activité et moment proposés, pilotes/équipes cités, sujet, type de question)
 * et de l'état réel du jeu (résultats, classement, prochain circuit, contrats,
 * relation), puis passée au filtre de la personnalité du pilote.
 *
 * Langue : anglais dans le groupe et en privé, sauf pilotes francophones qui
 * écrivent en français à un joueur francophone.
 */
import { DRIVERS_BY_ID, type Persona } from '../../data/drivers';
import { ACTIVITIES_BY_ID } from '../../data/lifestyle';
import { CALENDAR } from '../../data/calendar';
import { TEAMS_BY_ID } from '../../data/teams';
import type { GameState, Relationship, RaceResultEntry, TeamId } from '../types';
import { PLAYER_ID } from '../types';
import { chance, pick } from '../rng';
import { analyze, detectActivity, detectIntents, normalize, type Intent, type TextAnalysis } from './nlp';
import { lastNameOf, teamOf, teammateOf } from '../people';
import { driverStandings } from '../standings';
import { carScore } from '../sim/pace';

export type Lang = 'en' | 'fr';

const FRANCOPHONE = new Set(['FR', 'BE', 'CH', 'MC', 'CA', 'LU', 'SN', 'CI', 'MA', 'DZ', 'TN', 'RE', 'GP']);

export function playerIsFrancophone(s: GameState): boolean {
  return FRANCOPHONE.has(s.player.nationality);
}

/** Langue d'un pilote : anglais en groupe ; en privé, français seulement entre francophones. */
export function driverLang(s: GameState, driverId: string, channel: 'dm' | 'group' = 'dm'): Lang {
  if (channel === 'group') return 'en';
  const def = DRIVERS_BY_ID[driverId];
  return def?.persona.speaksFrench && playerIsFrancophone(s) ? 'fr' : 'en';
}

const TP_FRENCH = new Set<TeamId>(['ferrari', 'redbull']); // Vasseur, Mekies
export function tpLang(s: GameState, teamId: TeamId): Lang {
  return TP_FRENCH.has(teamId) && playerIsFrancophone(s) ? 'fr' : 'en';
}

/** Message d'un team principal dans sa langue. */
export function tpText(s: GameState, teamId: TeamId, en: string, fr: string): string {
  return tpLang(s, teamId) === 'fr' ? fr : en;
}

const T = (lang: Lang, en: string[], fr: string[]) => pick(lang === 'fr' ? fr : en);

function buddyOf(p: Persona, lang: Lang): string {
  if (lang === 'fr') return p.buddy;
  const map: Record<string, string> = { frérot: 'bro', 'mon ami': 'mate', 'mon pote': 'mate' };
  return map[p.buddy] ?? p.buddy;
}

function laughOf(p: Persona, lang: Lang): string {
  if (lang === 'en' && ['ptdr', 'ahah', 'ahahah'].includes(p.laugh)) return 'haha';
  return p.laugh;
}

export function styleText(p: Persona, text: string, lang: Lang, emojiChance = 0.3): string {
  let out = text.replace(/\{buddy\}/g, buddyOf(p, lang)).replace(/\{laugh\}/g, laughOf(p, lang));
  out = out.replace(/\s+/g, ' ').trim();
  if (p.lowercase) out = out.toLowerCase();
  if (p.emojis.length && chance(emojiChance) && !/\p{Extended_Pictographic}/u.test(out)) out += ' ' + pick(p.emojis);
  return out;
}

// ───────────────────────── Contexte ─────────────────────────

interface Facts {
  theirLast?: RaceResultEntry;
  playerLast?: RaceResultEntry;
  lastRace?: string;
  nextRace?: string;
  nextCircuitId?: string;
  theirPos: number;
  playerPos: number;
  leader?: string;
  theirTeam?: string;
  carRank?: number;
  contractEnd?: number;
  sameTeam: boolean;
}

function facts(s: GameState, id: string, lang: Lang = 'en'): Facts {
  const last = s.results[s.results.length - 1];
  const st = driverStandings(s);
  const next = CALENDAR[Math.min(23, s.round)];
  const team = s.drivers[id]?.teamId ?? null;
  let carRank: number | undefined;
  if (team) {
    const ranks = Object.keys(s.teams)
      .map((t) => ({ t, v: carScore(s.teams[t as TeamId], next) }))
      .sort((a, b) => b.v - a.v);
    carRank = ranks.findIndex((x) => x.t === team) + 1;
  }
  return {
    theirLast: last?.race.find((e) => e.driverId === id),
    playerLast: last?.race.find((e) => e.driverId === PLAYER_ID),
    lastRace: last ? circuitName(last.raceId, lang) : undefined,
    nextRace: next ? circuitName(next.id, lang) : undefined,
    nextCircuitId: next?.id,
    theirPos: st.findIndex((d) => d.driverId === id) + 1,
    playerPos: st.findIndex((d) => d.driverId === PLAYER_ID) + 1,
    leader: st[0]?.driverId,
    theirTeam: team ? TEAMS_BY_ID[team].name : undefined,
    carRank,
    contractEnd: s.drivers[id]?.contract?.endSeason,
    sameTeam: !!team && team === teamOf(s, PLAYER_ID),
  };
}

function timeExpr(text: string, lang: Lang): string | null {
  const t = normalize(text);
  const map: [RegExp, string, string][] = [
    [/(tomorrow|demain)/, 'tomorrow', 'demain'],
    [/(tonight|ce soir)/, 'tonight', 'ce soir'],
    [/(this weekend|ce week-?end|weekend)/, 'this weekend', 'ce week-end'],
    [/(monday|lundi)/, 'Monday', 'lundi'],
    [/(tuesday|mardi)/, 'Tuesday', 'mardi'],
    [/(wednesday|mercredi)/, 'Wednesday', 'mercredi'],
    [/(thursday|jeudi)/, 'Thursday', 'jeudi'],
    [/(friday|vendredi)/, 'Friday', 'vendredi'],
    [/(next week|semaine prochaine)/, 'next week', 'la semaine prochaine'],
    [/(now|maintenant|right now|tout de suite)/, 'now', 'maintenant'],
  ];
  for (const [re, en, fr] of map) if (re.test(t)) return lang === 'fr' ? fr : en;
  return null;
}

const STOP = new Set(
  'yesterday tomorrow tonight today really actually honestly basically literally aujourd hier demain soir matin the and you your are for with that this have what just like about from they will would there their when where which into then than been were also very really some more much only even sure think know want need come going gonna wanna youre dont cant isnt les des une pour avec dans que qui est pas tu te ton ta tes vous nous mais plus tout bien fait faire etre avoir cest jai moi toi lui elle sur par aux ces cet cette mon mes son ses leur alors donc comme quand trop tres aussi encore deja hello salut coucou merci thanks'.split(' '),
);

function salientWord(text: string, a: TextAnalysis): string | null {
  const words = normalize(text)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !STOP.has(w));
  if (!words.length || a.mentionsDrivers.length) return null;
  return words.sort((x, y) => y.length - x.length)[0];
}

function tauntWord(text: string): string | null {
  const t = normalize(text);
  const words = ['slow', 'lent', 'papy', 'grandpa', 'loser', 'perdant', 'clown', 'noob', 'escargot', 'tortue', 'nul', 'bouffon', 'retire', 'retraite', 'overrated', 'surcote'];
  return words.find((w) => t.includes(w)) ?? null;
}

// ───────────────────────── Morceaux de réponse ─────────────────────────

interface Ctx {
  s: GameState;
  id: string;
  p: Persona;
  rel: Relationship;
  lang: Lang;
  text: string;
  a: TextAnalysis;
  f: Facts;
  act: string | null;
  when: string | null;
  channel: 'dm' | 'group';
}

function posStr(e?: RaceResultEntry): string {
  if (!e) return '';
  return e.dnf ? 'DNF' : `P${e.position}`;
}

function congratsPart(c: Ctx): string {
  const { lang, f } = c;
  const e = f.theirLast;
  if (!e) return T(lang, ['Thanks {buddy}!', 'Cheers, appreciate it.'], ['Merci {buddy} !', 'Merci, ça fait plaisir.']);
  const race = f.lastRace ?? '';
  if (e.position === 1) return T(lang, [`Thanks {buddy}! ${race} was special, still buzzing.`, `Cheers! Winning in ${race} never gets old.`, `Thank you! What a day in ${race}.`], [`Merci {buddy} ! ${race}, c’était spécial, je plane encore.`, `Merci ! Gagner à ${race}, ça ne lasse jamais.`]);
  if (e.position > 0 && e.position <= 3) return T(lang, [`Thanks! P${e.position} in ${race}, I'll take it.`, `Cheers {buddy}, good podium, the team deserved it.`], [`Merci ! P${e.position} à ${race}, je prends.`, `Merci {buddy}, beau podium pour l’équipe.`]);
  if (e.dnf) return T(lang, [`Thanks, but ${race} was a disaster honestly. ${e.dnf}…`, `Appreciate it, even if my ${race} ended early.`], [`Merci, mais ${race} c’était une catastrophe. ${e.dnf}…`, `Merci, même si mon ${race} s’est fini trop tôt.`]);
  if (e.position <= 10) return T(lang, [`Thanks! P${e.position}, solid points, nothing crazy.`, `Cheers, P${e.position} was the max today.`], [`Merci ! P${e.position}, des points, rien de fou.`, `Merci, P${e.position} c’était le max.`]);
  return T(lang, [`Ha, thanks, but P${e.position} is nothing to celebrate.`, `Kind of you, but ${race} was a tough one for us.`], [`Merci, mais P${e.position} y’a pas de quoi fêter.`, `Sympa, mais ${race} c’était dur pour nous.`]);
}

function complaintPart(c: Ctx): string {
  const { lang, f } = c;
  const e = f.playerLast;
  if (e?.dnf) return T(lang, [`Retiring in ${f.lastRace} is brutal, I know the feeling. Reset and go again.`, `That DNF wasn't your weekend. Next one, {buddy}.`], [`Abandonner à ${f.lastRace}, c’est dur, je connais. On reset et on repart.`, `Cet abandon, c’était pas ton week-end. Le prochain, {buddy}.`]);
  if (e && e.position > 10) return T(lang, [`P${e.position} hurts, but you had pace in places. Don't overthink it.`, `Tough one. Look at the data, not the comments.`], [`P${e.position} ça pique, mais t’avais du rythme par moments. Réfléchis pas trop.`, `Dur. Regarde la data, pas les commentaires.`]);
  return T(lang, ['Head up, {buddy}. Everyone has those days.', 'It happens to all of us, honestly.', 'Breathe, analyse, go again.'], ['Garde la tête haute, {buddy}. Tout le monde a ces journées.', 'Ça arrive à tout le monde, vraiment.', 'Respire, analyse, recommence.']);
}

function tauntPart(c: Ctx): string {
  const { lang, p, f } = c;
  const w = tauntWord(c.text);
  const t = p.traits;
  const myPts = f.theirPos && f.playerPos ? (f.theirPos < f.playerPos ? 'ahead' : 'behind') : 'n/a';
  if (t.ego > 85) return T(lang, [`${w ? `${w[0].toUpperCase() + w.slice(1)}? ` : ''}Check the standings, amigo. I'm P${f.theirPos}, you're P${f.playerPos} 😉`, 'Karma has a good memory 😉', 'Talk is cheap. Sunday will answer.'], [`${w ? `${w} ? ` : ''}Regarde le classement, amigo. Je suis P${f.theirPos}, toi P${f.playerPos} 😉`, 'Le karma a bonne mémoire 😉']);
  if (t.temper > 70) return T(lang, [`${w ? `${w[0].toUpperCase() + w.slice(1)}?` : 'Really?'} Say that again on track.`, 'Come find me in turn 1 then.', 'Keep talking. I\'ll see you Sunday.'], [`${w ? `${w} ?` : 'Sérieux ?'} Redis-le en piste.`, 'Viens me chercher au premier virage alors.', 'Continue de parler. On se voit dimanche.']);
  if (t.humor > 75) return T(lang, [`${w ? `${w}?? ` : ''}{laugh} bold words from someone ${myPts === 'ahead' ? 'behind me in the championship' : 'who still owes me a coffee'}`, '{laugh} ok ok, screenshotting this for later', 'ratio + you wish'], [`${w ? `${w} ?? ` : ''}{laugh} gonflé de la part de quelqu’un ${myPts === 'ahead' ? 'derrière moi au championnat' : 'qui me doit encore un café'}`, '{laugh} ok je fais une capture pour plus tard']);
  return T(lang, ['Ok. We\'ll see on track.', 'Noted.', 'Interesting choice of words.'], ['Ok. On verra en piste.', 'Noté.', 'Intéressant comme choix de mots.']);
}

function apologyPart(c: Ctx): string {
  const { lang, p, rel, s, id } = c;
  const col = String(s.flags['lastCollision'] ?? '');
  const involved = col.startsWith(id + '|');
  if (rel.friendship < -30 && p.traits.temper > 60) return T(lang, ['Words are easy. Show me on track.', 'Fine. But I won\'t forget it.'], ['Les mots c’est facile. Montre-le en piste.', 'Ok. Mais j’oublierai pas.']);
  if (involved) return T(lang, ['Thanks for saying it. That contact cost me a lot, but it\'s racing.', 'Appreciate the message. Just leave a car\'s width next time.', 'Ok, respect for owning it. Let\'s move on.'], ['Merci de le dire. Ce contact m’a coûté cher, mais c’est la course.', 'J’apprécie le message. Laisse juste une largeur de voiture la prochaine fois.', 'Ok, respect de l’assumer. On passe à autre chose.']);
  return T(lang, ['All good {buddy}, no stress.', 'No worries, honestly.', 'Forget it, it\'s fine.'], ['T’inquiète {buddy}, aucun souci.', 'Pas grave du tout.', 'Oublie, c’est rien.']);
}

export function inviteAcceptance(s: GameState, driverId: string, activityId: string | null): number {
  const def = DRIVERS_BY_ID[driverId];
  if (!def) return 0.3;
  const rel = s.drivers[driverId]?.rel;
  let p = 0.3 + (rel ? rel.friendship / 200 : 0) + def.persona.traits.warmth / 400;
  if (activityId && def.persona.likes.includes(activityId)) p += 0.3;
  if (rel && rel.rivalry > 60) p -= 0.2;
  if (teamOf(s, driverId) === teamOf(s, PLAYER_ID)) p += 0.1;
  return Math.max(0.05, Math.min(0.95, p));
}

function invitePart(c: Ctx, ok: boolean): string {
  const { lang, p, act, when } = c;
  const a = act ? ACTIVITIES_BY_ID[act] : null;
  const name = a ? (lang === 'fr' ? a.name.toLowerCase() : ACT_EN[a.id] ?? a.name.toLowerCase()) : lang === 'fr' ? 'ça' : 'that';
  const w = when ?? (lang === 'fr' ? 'quand tu veux' : 'whenever');
  const likes = !!act && p.likes.includes(act);
  if (ok) {
    if (likes)
      return T(lang, [`${cap(name)} ${w}? Say less, I'm in ${a?.emoji ?? ''}`, `Yes! I love ${name}. ${cap(w)} works.`, `Count me in for ${name} ${w}. Don't cry when I win {laugh}`], [`${cap(name)} ${w} ? Grave, je suis chaud ${a?.emoji ?? ''}`, `Oui ! J’adore ça. ${cap(w)}, ça marche.`, `Compte sur moi ${w}. Pleure pas quand je gagne {laugh}`]);
    return T(lang, [`${cap(name)}? Not really my thing but ok, ${w} works {laugh}`, `Sure, why not. ${cap(w)}?`, `Ok I'm in. Send me the time.`], [`${cap(name)} ? Pas trop mon truc mais ok, ${w} ça marche {laugh}`, `Ok pourquoi pas. ${cap(w)} ?`, 'Ok je viens. Envoie l’heure.']);
  }
  const busy = T(lang, ['sim day at the factory', 'a sponsor event', 'media day', 'family stuff', 'a training block'], ['journée simu à l’usine', 'un event sponsor', 'une journée médias', 'des trucs de famille', 'un bloc d’entraînement']);
  return T(lang, [`Can't ${w}, I've got ${busy}. Another time?`, `Ah, ${w} is impossible for me, ${busy}.`, `Not ${w}, sorry {buddy}.`], [`Pas possible ${w}, j’ai ${busy}. Une autre fois ?`, `Ah, ${w} c’est mort, ${busy}.`, `Pas ${w}, désolé {buddy}.`]);
}

const CIRCUIT_EN: Record<string, string> = {
  aus: 'Melbourne', chn: 'China', jpn: 'Suzuka', bhr: 'Bahrain', sau: 'Jeddah', mia: 'Miami', can: 'Montreal', mon: 'Monaco', esp: 'Barcelona', aut: 'Austria', gbr: 'Silverstone', bel: 'Spa',
  hun: 'Hungary', ned: 'Zandvoort', ita: 'Monza', mad: 'Madrid', aze: 'Baku', sgp: 'Singapore', usa: 'Austin', mex: 'Mexico', bra: 'Interlagos', lvg: 'Vegas', qat: 'Qatar', abu: 'Abu Dhabi',
};

export function circuitName(id: string, lang: Lang): string {
  return lang === 'en' ? (CIRCUIT_EN[id] ?? id) : (CALENDAR.find((c) => c.id === id)?.short ?? id);
}

/** Circuit cité dans un message (FR ou EN). */
function mentionedCircuit(text: string): string | null {
  const t = normalize(text);
  for (const c of CALENDAR) {
    const names = [c.short, c.city, CIRCUIT_EN[c.id] ?? '', c.circuit].map((x) => normalize(x)).filter((x) => x.length > 3);
    if (names.some((nm) => t.includes(nm))) return c.id;
  }
  return null;
}

const ACT_EN: Record<string, string> = {
  golf: 'golf', padel: 'padel', simracing: 'sim racing', cycling: 'a bike ride', dinner: 'dinner', party: 'a night out', yacht: 'a boat day', football: 'football',
  karting: 'karting', ski: 'skiing', surf: 'surfing', poker: 'poker', coffee: 'a coffee', gym: 'the gym', piano: 'a music session', fishing: 'fishing', stream: 'a stream',
  sauna: 'the sauna', fashion: 'fashion week', charity: 'the gala', gt3: 'a GT race', vacation: 'a trip',
};

function cap(x: string): string {
  return x ? x[0].toUpperCase() + x.slice(1) : x;
}

function advicePart(c: Ctx): string {
  const { lang, text, id } = c;
  const t = normalize(text);
  if (/(rain|pluie|wet|mouill)/.test(t)) return T(lang, ['In the wet, stay off the racing line where the rubber is. Look for grip, not the usual line.', 'Rain: be smooth on the throttle, brake earlier than your ego says.'], ['Sous la pluie, sors de la trajectoire gommée. Cherche le grip, pas la ligne habituelle.', 'Pluie : en douceur sur l’accélérateur, freine plus tôt que ce que ton ego dit.']);
  if (/(tyre|tire|pneu|deg|gomme)/.test(t)) return T(lang, ['Tyres: protect the rears in traction, the fronts will look after themselves.', 'Manage the first 5 laps of a stint, that\'s where you kill tyres.'], ['Les pneus : protège l’arrière en traction, l’avant suivra.', 'Gère les 5 premiers tours d’un relais, c’est là qu’on tue les pneus.']);
  if (/(quali|qualif|one lap|tour lance)/.test(t)) return T(lang, ['Quali is about building up. 80%, 95%, then send it on the last run.', 'Don\'t try to find all the time in one corner. Small gains everywhere.'], ['La qualif, c’est progressif. 80 %, 95 %, puis tu envoies au dernier run.', 'Cherche pas tout le temps dans un virage. Des petits gains partout.']);
  if (/(start|depart|launch)/.test(t)) return T(lang, ['Starts: focus on the clutch bite point in the formation lap, then just react.'], ['Départs : concentre-toi sur le point de patinage au tour de formation, après tu réagis.']);
  if (/(media|press|journalist|presse|interview)/.test(t)) return T(lang, ['Media: say less. Every sentence becomes a headline.', 'Be honest but boring with journalists {laugh}'], ['Les médias : parle moins. Chaque phrase devient un titre.', 'Sois honnête mais ennuyeux avec les journalistes {laugh}']);
  if (/(mental|pressure|pression|stress|confidence|confiance)/.test(t)) return T(lang, ['Pressure is a privilege. Control what you can, ignore the rest.', 'Sleep, train, debrief. Repeat. Confidence comes from routine.'], ['La pression, c’est un privilège. Contrôle ce que tu peux, ignore le reste.', 'Dors, entraîne-toi, débriefe. Recommence. La confiance vient de la routine.']);
  const own: Record<string, string[]> = {
    verstappen: ['Do more sim, less social media. Simple.', 'Trust your feeling more than the data sometimes.'],
    hamilton: ['Believe in yourself even when nobody else does. And protect your energy, bro 🙏🏾'],
    alonso: ['Always think three moves ahead. On track and off track 😉'],
    piastri: ['Don\'t overthink it. Drive fast, keep it clean.'],
    norris: ['honestly? be kinder to yourself. we\'re all our worst critics'],
    russell: ['Treat every weekend like a project. Data, sleep, nutrition. No detail too small.'],
  };
  if (own[id] && lang === 'en') return pick(own[id]);
  return T(lang, ['Spend time with your engineers. They\'ll give it back to you on Sunday.', 'Learn from every onboard of the guys ahead. Steal everything.'], ['Passe du temps avec tes ingénieurs. Ils te le rendront le dimanche.', 'Regarde les onboards de ceux devant. Vole tout ce que tu peux.']);
}

function rumorPart(c: Ctx): string {
  const { lang, f, s, p } = c;
  if (p.traits.ego > 85) return T(lang, ['Maybe I know things… maybe not 😉', 'The plan is the plan 😉'], ['Peut-être que je sais des choses… ou pas 😉']);
  if (f.contractEnd && f.contractEnd > s.season) return T(lang, [`I'm locked in until ${f.contractEnd}, so no drama from me.`, `Contract runs to ${f.contractEnd}. Happy where I am.`], [`Je suis sous contrat jusqu’en ${f.contractEnd}, donc pas de drama.`, `Contrat jusqu’en ${f.contractEnd}. Je suis bien ici.`]);
  return T(lang, ['Honestly my manager deals with that. Nothing signed.', 'Lots of talk in the paddock. I just drive {laugh}'], ['Honnêtement c’est mon manager qui gère. Rien de signé.', 'Beaucoup de bruit dans le paddock. Moi je roule {laugh}']);
}

function opinionOfDriver(c: Ctx, other: string): string {
  const { lang, p, s, f } = c;
  const name = lastNameOf(s, other);
  if (other === c.id) return '';
  if (p.friends.includes(other)) return T(lang, [`${name}? That's my guy, don't start {laugh}`, `${name} is a good mate. Fast too, annoyingly.`], [`${name} ? C’est mon pote, commence pas {laugh}`, `${name}, c’est un bon ami. Rapide en plus, c’est agaçant.`]);
  if (p.tensions.includes(other)) return T(lang, [`${name}… let's say we're not having dinner together.`, `${name} is quick, but he knows what I think of some of his moves.`], [`${name}… disons qu’on dîne pas ensemble.`, `${name} est rapide, mais il sait ce que je pense de certains de ses moves.`]);
  if (other === f.leader) return T(lang, [`${name} is the benchmark right now. But nobody is unbeatable.`, `${name} leads, fair. The season is long.`], [`${name} est la référence en ce moment. Mais personne n’est imbattable.`, `${name} mène, normal. La saison est longue.`]);
  if (teammateOf(s, c.id) === other) return T(lang, [`${name}? Good teammate. I still want to beat him every weekend.`], [`${name} ? Bon coéquipier. Mais je veux le battre chaque week-end.`]);
  return T(lang, [`${name}? Solid driver. Respect.`, `${name} is fine. Don't know him that well.`], [`${name} ? Pilote solide. Respect.`, `${name}, ça va. Je le connais pas tant que ça.`]);
}

function nextRacePart(c: Ctx): string {
  const { lang, f, s } = c;
  const cid = mentionedCircuit(c.text) ?? f.nextCircuitId;
  const circ0 = CALENDAR.find((x) => x.id === cid);
  const circ = circ0 ? { ...circ0, short: circuitName(circ0.id, lang) } : undefined;
  const team = s.drivers[c.id]?.teamId;
  if (circ0 && team) {
    const ranks = Object.keys(s.teams).map((t) => ({ t, v: carScore(s.teams[t as TeamId], circ0) })).sort((a, b) => b.v - a.v);
    f.carRank = ranks.findIndex((x) => x.t === team) + 1;
  }
  if (!circ) return '';
  const strong = (f.carRank ?? 6) <= 3;
  const weak = (f.carRank ?? 6) >= 8;
  const trait = circ.powerSens > 0.7 ? (lang === 'fr' ? 'les lignes droites' : 'the straights') : circ.aeroSens > 0.8 ? (lang === 'fr' ? 'les virages rapides' : 'the high-speed corners') : lang === 'fr' ? 'un peu de tout' : 'a bit of everything';
  if (strong) return T(lang, [`${circ.short} should suit us, the car is good in ${trait}. Expect us at the front.`, `Feeling good about ${circ.short}. Car is quick there on paper.`], [`${circ.short} devrait nous aller, la voiture est bonne dans ${trait}. Attends-toi à nous voir devant.`, `Confiant pour ${circ.short}. Sur le papier, la voiture est rapide là-bas.`]);
  if (weak) return T(lang, [`${circ.short}… honestly we'll suffer in ${trait}. Damage limitation.`, `Not our track, ${circ.short}. We'll try to steal some points.`], [`${circ.short}… honnêtement on va souffrir dans ${trait}. Limiter la casse.`, `Pas notre circuit, ${circ.short}. On va essayer de grappiller des points.`]);
  return T(lang, [`${circ.short} is a big unknown for us. Depends on setup in FP1.`, `${circ.short}? Love the track. Let's see where we are.`], [`${circ.short}, grosse inconnue pour nous. Tout dépendra des réglages en EL1.`, `${circ.short} ? J’adore ce circuit. On verra où on en est.`]);
}

function howAreYouPart(c: Ctx): string {
  const { lang, f, s, id } = c;
  const mood = s.drivers[id]?.morale ?? 60;
  const e = f.theirLast;
  if (e && e.position === 1) return T(lang, ['Living the dream after that win {laugh}', 'Great, still on a high.'], ['Au top depuis cette victoire {laugh}', 'Super, je plane encore.']);
  if (mood < 45) return T(lang, ['Bit frustrated honestly. Results aren\'t coming.', 'Could be better. Working hard to turn it around.'], ['Un peu frustré honnêtement. Les résultats viennent pas.', 'Ça pourrait aller mieux. Je bosse pour inverser la tendance.']);
  return T(lang, ['Good! Busy week, sim and sponsors. You?', 'All good, just landed. Jet lag is real.', 'Not bad, training a lot. And you?'], ['Bien ! Semaine chargée, simu et sponsors. Et toi ?', 'Ça va, je viens d’atterrir. Le jet lag est réel.', 'Pas mal, je m’entraîne beaucoup. Et toi ?']);
}

function echoPart(c: Ctx): string {
  const w = salientWord(c.text, c.a);
  const { lang } = c;
  if (!w) return T(lang, ['Haha true.', 'Fair enough.', 'Facts.', 'Mood.', 'Yeah, agreed.'], ['Ahah vrai.', 'C’est clair.', 'Grave.', 'Pas faux.']);
  const sent = c.a.sentiment;
  if (sent > 0.2) return T(lang, [`${cap(w)}? Love that.`, `${cap(w)}, nice. Tell me more.`], [`${cap(w)} ? J’adore.`, `${cap(w)}, cool. Raconte.`]);
  if (sent < -0.2) return T(lang, [`${cap(w)}… yeah that's annoying.`, `Ugh, ${w}. I feel you.`], [`${cap(w)}… ouais c’est relou.`, `Ah, ${w}. Je comprends.`]);
  return T(lang, [`${cap(w)}? Interesting {laugh}`, `${cap(w)}, haha, fair.`, `Wait, ${w}? Explain.`], [`${cap(w)} ? Intéressant {laugh}`, `${cap(w)}, ahah, pas faux.`, `Attends, ${w} ? Explique.`]);
}

export interface LocalReply {
  text: string;
  rel: Partial<Relationship>;
  acceptedActivity?: string;
}

/** Réponse composée d'un pilote à un message du joueur. */
export function composeReply(s: GameState, driverId: string, text: string, channel: 'dm' | 'group' = 'dm'): LocalReply {
  const def = DRIVERS_BY_ID[driverId];
  const d = s.drivers[driverId];
  if (!def || !d) return { text: '👍', rel: {} };
  const lang = driverLang(s, driverId, channel);
  const a = analyze(text);
  const intents = detectIntents(a, text);
  const c: Ctx = { s, id: driverId, p: def.persona, rel: d.rel, lang, text, a, f: facts(s, driverId, lang), act: detectActivity(text), when: timeExpr(text, lang), channel };
  const t = def.persona.traits;
  const parts: string[] = [];
  const rel: Partial<Relationship> = {};
  const add = (k: keyof Relationship, v: number) => (rel[k] = (rel[k] ?? 0) + v);
  let accepted: string | undefined;

  // Pilote froid si la relation est très mauvaise
  if (d.rel.friendship < -40 && !intents.includes('apology') && chance(0.55)) {
    const cold = T(lang, ['Ok.', '…', 'Not now.', 'What do you want?'], ['Ok.', '…', 'Pas maintenant.', 'Tu veux quoi ?']);
    return { text: styleText(def.persona, cold, lang, 0), rel: intents.includes('taunt') ? { friendship: -4, rivalry: 3 } : {} };
  }

  for (const it of intents.slice(0, 3)) {
    switch (it) {
      case 'greet':
        if (intents.length === 1) parts.push(T(lang, ['Hey {buddy}!', 'Yo! What\'s up?', 'Hey hey'], ['Salut {buddy} !', 'Yo ! Quoi de neuf ?', 'Hey !']));
        add('friendship', 1);
        break;
      case 'congrats':
      case 'compliment':
        parts.push(congratsPart(c));
        add('friendship', 3);
        add('respect', 1);
        break;
      case 'thanks':
        parts.push(T(lang, ['Anytime {buddy}.', 'No worries!'], ['Avec plaisir {buddy}.', 'De rien !']));
        add('friendship', 1);
        break;
      case 'apology':
        parts.push(apologyPart(c));
        add('friendship', 6);
        add('respect', 3);
        add('rivalry', -3);
        break;
      case 'taunt':
        parts.push(tauntPart(c));
        add('friendship', -Math.round(3 + t.temper / 15));
        add('rivalry', Math.round(4 + t.temper / 15));
        break;
      case 'complaint':
        parts.push(complaintPart(c));
        add('friendship', 2);
        break;
      case 'invite': {
        const ok = String(s.flags[`invite:${driverId}`] ?? '').startsWith(c.act ?? '§') || chance(inviteAcceptance(s, driverId, c.act));
        parts.push(invitePart(c, ok));
        if (ok) {
          accepted = c.act ?? 'dinner';
          add('friendship', 2);
        }
        break;
      }
      case 'advice':
        parts.push(advicePart(c));
        add('friendship', 2);
        add('respect', t.ego > 70 ? 2 : 1);
        break;
      case 'rumor':
        parts.push(rumorPart(c));
        break;
      case 'joke':
        parts.push(T(lang, ['{laugh}', '{laugh} stop', '{laugh} that\'s actually good', 'LOL'], ['{laugh}', '{laugh} arrête', '{laugh} pas mal celle-là']));
        add('friendship', t.humor > 60 ? 3 : 1);
        break;
      case 'serious':
        parts.push(T(lang, ['Agreed, we need to raise it at the GPDA briefing.', 'Yes. The FIA has to listen for once.', 'Important topic. I\'m with you.'], ['D’accord, faut le remonter au briefing GPDA.', 'Oui. La FIA doit écouter, pour une fois.', 'Sujet important. Je suis avec toi.']));
        add('respect', 2);
        break;
      case 'flirt':
        parts.push(T(lang, ['Haha… ok? 😅', 'Bro what {laugh}'], ['Ahah… ok ? 😅', 'Frère quoi {laugh}']));
        add('friendship', -1);
        break;
      case 'question': {
        const tt = normalize(text);
        if (/(how are you|how r u|ca va|comment tu vas|you good|tu vas bien)/.test(tt)) parts.push(howAreYouPart(c));
        else if (/(next|prochain|ready|pret|this weekend|ce week)/.test(tt) || mentionedCircuit(text)) parts.push(nextRacePart(c));
        else if (/(race|course|gp|sunday|dimanche|result)/.test(tt) && c.f.theirLast) parts.push(T(lang, [`${posStr(c.f.theirLast)} in ${c.f.lastRace}. ${c.f.theirLast.position > 0 && c.f.theirLast.position <= 5 ? 'Happy with that.' : 'We need more pace.'}`], [`${posStr(c.f.theirLast)} à ${c.f.lastRace}. ${c.f.theirLast.position > 0 && c.f.theirLast.position <= 5 ? 'Content.' : 'Il nous manque du rythme.'}`]));
        else if (!a.mentionsDrivers.length) parts.push(echoPart(c));
        add('friendship', 1);
        break;
      }
      default:
        if (!a.mentionsDrivers.length) parts.push(echoPart(c));
        add('friendship', 0.5);
    }
  }
  // Pilotes cités → avis
  const others = a.mentionsDrivers.filter((x) => x !== driverId && s.drivers[x]).slice(0, 1);
  for (const o of others) {
    const op = opinionOfDriver(c, o);
    if (op) parts.push(op);
  }
  // Relance de conversation (pilotes chaleureux, en privé)
  if (channel === 'dm' && t.warmth > 70 && chance(0.25) && !intents.includes('taunt') && !parts.some((x) => x.trim().endsWith('?'))) parts.push(T(lang, ['What about you?', `You ready for ${c.f.nextRace ?? 'the next one'}?`, 'How\'s the car feeling?'], ['Et toi ?', `Prêt pour ${c.f.nextRace ?? 'le prochain GP'} ?`, 'Et ta voiture, ça donne quoi ?']));
  if (chance(0.12) && !intents.includes('taunt') && (lang === 'fr') === def.persona.speaksFrench) parts.push(pick(def.persona.catchphrases));
  if (!parts.length) parts.push(echoPart(c));
  const out = styleText(def.persona, parts.slice(0, 3).join(' '), lang, channel === 'group' ? 0.35 : 0.25);
  return { text: out, rel, acceptedActivity: accepted };
}

/** Compatibilité : réponse à une intention précise. */
export function localReply(s: GameState, driverId: string, _intent: Intent, text: string): LocalReply {
  return composeReply(s, driverId, text, 'dm');
}

/** Message spontané d'un pilote au joueur. */
export function spontaneousDM(s: GameState, driverId: string, context: 'collision' | 'congrats' | 'invite' | 'banter' | 'support' | 'birthday', extra?: { activityId?: string; position?: number }): string {
  const def = DRIVERS_BY_ID[driverId];
  if (!def) return '';
  const p = def.persona;
  const lang = driverLang(s, driverId);
  const pl = s.player.firstName;
  const f = facts(s, driverId, lang);
  let txt = '';
  switch (context) {
    case 'collision':
      txt =
        p.traits.temper > 65
          ? T(lang, [`Seriously ${pl}? You destroyed my race.`, 'What was that move? There was no gap.', `Watch the replay, ${pl}. That was nonsense.`], [`Sérieux ${pl} ? Tu m’as détruit ma course.`, 'C’était quoi ce mouvement ? Y’avait pas l’ouverture.', `Regarde le replay, ${pl}. C’était n’importe quoi.`])
          : p.traits.warmth > 75
            ? T(lang, ['Hey… unlucky contact today. Let\'s talk about it calmly?', 'Not ideal what happened, but no hard feelings. Be careful next time.'], ['Hey… dommage pour le contact. On en parle au calme ?', 'Pas top ce qui s’est passé, mais je t’en veux pas trop. Fais gaffe la prochaine fois.'])
            : T(lang, ['We need to talk about what happened on track.', 'Didn\'t love that contact.'], ['Faut qu’on parle de ce qui s’est passé en piste.', 'J’ai pas trop aimé ce contact.']);
      break;
    case 'congrats':
      txt = (extra?.position ?? 1) === 1 ? T(lang, [`Congrats on the win ${pl}!! Massive 🔥`, 'Well deserved mate. Enjoy tonight.', `P1, nothing to say. Respect ${pl}.`], [`Bravo pour la victoire ${pl} !! Énorme 🔥`, 'Mérité. Profite ce soir.', `P1, rien à dire. Respect ${pl}.`]) : T(lang, [`Nice podium ${pl}!`, 'Great drive today.', 'GG on the podium, solid.'], [`Joli podium ${pl} !`, 'Belle course aujourd’hui.', 'GG pour le podium.']);
      break;
    case 'invite': {
      const a = extra?.activityId ? ACTIVITIES_BY_ID[extra.activityId] : null;
      const nm = a ? (lang === 'fr' ? a.name.toLowerCase() : ACT_EN[a.id] ?? a.name.toLowerCase()) : lang === 'fr' ? 'un dîner' : 'dinner';
      txt = T(lang, [`Hey ${pl}, ${nm} this week? Looking for people.`, `Up for ${nm} before ${f.nextRace ?? 'the next race'}?`, `${cap(nm)} with a few of the guys, you in?`], [`Hey ${pl}, ${nm} cette semaine ? Je cherche du monde.`, `Chaud pour ${nm} avant ${f.nextRace ?? 'le prochain GP'} ?`, `${cap(nm)} avec quelques pilotes, t’es dispo ?`]);
      break;
    }
    case 'support':
      txt = T(lang, [`Tough weekend ${pl}, but keep your head up. It'll come.`, 'Don\'t read the comments. You\'re better than that result.', 'We all have those weekends. Reset.'], [`Week-end compliqué ${pl}, mais garde la tête haute. Ça va venir.`, 'Lis pas les commentaires. Tu vaux mieux que ce résultat.', 'On a tous ces week-ends. Reset.']);
      break;
    case 'birthday':
      txt = T(lang, [`Happy birthday ${pl}!! 🎂`, 'HBD mate 🎉', 'Happy birthday! Enjoy 🥳'], [`Joyeux anniversaire ${pl} !! 🎂`, 'Bon anniv ! 🎉']);
      break;
    default:
      txt = T(
        lang,
        [
          `You ready for ${f.nextRace ?? 'the next one'}?`,
          'Sim race tonight? We need a 4th driver.',
          `Did you see the new radio swearing rule {laugh}`,
          f.theirLast ? `${posStr(f.theirLast)} last weekend… ${f.theirLast.position > 0 && f.theirLast.position <= 5 ? 'not bad huh' : 'need to forget that one'}` : 'Who organises the next drivers dinner?',
        ],
        [`Prêt pour ${f.nextRace ?? 'le prochain'} ?`, 'Simu ce soir ? Il nous manque un 4e pilote.', 'T’as vu la nouvelle règle sur les jurons à la radio {laugh}', 'Qui organise le prochain dîner des pilotes ?'],
      );
  }
  return styleText(p, txt, lang, 0.25);
}

/** Réplique courte générique d'un pilote (groupe). */
export function quickLine(driverId: string, kind: 'gg' | 'yes' | 'lol' | 'serious', lang: Lang = 'en'): string {
  const def = DRIVERS_BY_ID[driverId];
  if (!def) return '👍';
  const banks: Record<typeof kind, string[]> = {
    gg: ['gg', 'Congrats 👏', 'Well done', 'GG 🔥', 'Big result'],
    yes: ['me 🙋', 'in', 'count me in', 'I\'m down', 'yes!'],
    lol: ['{laugh}', '{laugh} stop', 'LMAO', '💀💀'],
    serious: ['Agreed.', '+1', 'Fully support this.', 'About time.'],
  };
  return styleText(def.persona, pick(banks[kind]), lang, 0.2);
}
