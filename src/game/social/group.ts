/** Groupe WhatsApp « F1 Drivers » — tout le monde y écrit en anglais. */
import { DRIVERS_BY_ID } from '../../data/drivers';
import { CALENDAR } from '../../data/calendar';
import { ACTIVITIES_BY_ID } from '../../data/lifestyle';
import type { ChatMessage, GameState, WeekendResult } from '../types';
import { PLAYER_ID } from '../types';
import { chance, pick, pickN, uid, weightedPick } from '../rng';
import { lastNameOf } from '../people';
import { driverStandings } from '../standings';
import { analyze, detectActivity, detectIntent } from './nlp';
import { circuitName, composeReply, quickLine, styleText } from './voice';

function msg(s: GameState, from: string, text: string): ChatMessage {
  return { id: uid('g'), from, text, day: s.day };
}

function activeDrivers(s: GameState): string[] {
  return Object.values(s.drivers)
    .filter((d) => !d.retired && d.teamId && DRIVERS_BY_ID[d.id])
    .map((d) => d.id);
}

function say(id: string, text: string): string {
  return styleText(DRIVERS_BY_ID[id].persona, text, 'en', 0.3);
}

export function groupAfterRace(s: GameState, res: WeekendResult, collisions: { a: string; b: string; blame: string }[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  const circuit = CALENDAR.find((c) => c.id === res.raceId)!;
  const winner = res.race.find((e) => e.position === 1);
  const pl = res.race.find((e) => e.driverId === PLAYER_ID);
  const drivers = activeDrivers(s);
  const st = driverStandings(s);
  if (winner && winner.driverId !== PLAYER_ID && DRIVERS_BY_ID[winner.driverId]) {
    const w = winner.driverId;
    const per = DRIVERS_BY_ID[w].persona;
    const lead = st[0]?.driverId === w;
    const wl =
      per.style === 'dry'
        ? `Good race everyone. ${lead ? 'Nice to lead the championship.' : ''}`
        : per.style === 'cocky'
          ? `Thank you thank you. Experience 😎`
          : per.style === 'banter'
            ? `still can't believe ${circuitName(circuit.id, 'en')} happened {laugh} thanks guys`
            : `What a race in ${circuitName(circuit.id, 'en')}! Thanks for the clean fights 🙏`;
    out.push(msg(s, w, say(w, wl)));
    for (const id of pickN(drivers.filter((d) => d !== w), 2)) {
      const p = DRIVERS_BY_ID[id].persona;
      const line = p.friends.includes(w) ? pick(['GG 🔥', 'Proud of you mate', 'Massive 👏', `{laugh} too good`]) : p.tensions.includes(w) ? pick(['Well done. Fast car.', 'gg. see you next time', '👏']) : pick(['gg', 'Congrats 👏', 'Well done', 'GG']);
      out.push(msg(s, id, say(id, line)));
    }
  }
  if (pl) {
    const pn = s.player.firstName;
    if (pl.position === 1) {
      for (const id of pickN(drivers, 3)) {
        const rel = s.drivers[id].rel;
        const line = rel.friendship > 30 ? pick([`HUGE ${pn} 🔥🔥`, `you were unreal today {laugh}`, `masterclass ${pn} 👏`]) : rel.rivalry > 60 ? pick(['well done. enjoy it while it lasts 😉', 'gg. lucky with the SC no?']) : pick(['gg 👏', 'congrats on the win', 'well deserved']);
        out.push(msg(s, id, say(id, line)));
      }
    } else if (pl.position > 0 && pl.position <= 3) {
      const id = pick(drivers);
      out.push(msg(s, id, say(id, pick([`nice podium ${pn} 👏`, `P${pl.position} ${pn}, let's go`, 'the rookie is coming 👀']))));
    } else if (pl.dnf && chance(0.6)) {
      const id = pick(drivers);
      const p = DRIVERS_BY_ID[id].persona;
      out.push(msg(s, id, say(id, p.traits.humor > 75 ? `${pn} you saw the wall up close today {laugh}` : `Tough one ${pn}, chin up 💪`)));
    }
  }
  for (const col of collisions.slice(0, 2)) {
    const victim = col.blame === col.a ? col.b : col.a;
    if (victim === PLAYER_ID || !DRIVERS_BY_ID[victim]) continue;
    const blamed = col.blame;
    const p = DRIVERS_BY_ID[victim].persona;
    const bn = blamed === PLAYER_ID ? s.player.firstName : lastNameOf(s, blamed);
    if (p.traits.temper > 60 && chance(0.7)) out.push(msg(s, victim, say(victim, `${bn}, we'll talk about it at the next drivers' briefing.`)));
    else if (chance(0.4)) out.push(msg(s, victim, say(victim, 'Race ruined by contact… that\'s racing I guess.')));
    if (blamed !== PLAYER_ID && DRIVERS_BY_ID[blamed] && chance(0.6)) out.push(msg(s, blamed, say(blamed, DRIVERS_BY_ID[blamed].persona.traits.ego > 70 ? 'He closed the door too late. Stewards agree with me? No? Ok 🤷' : 'Sorry for the contact, I locked up.')));
  }
  if (chance(0.6)) {
    const id = weightedPick(drivers, (d) => DRIVERS_BY_ID[d].persona.traits.humor);
    const slowPit = res.race.slice().sort((a, b) => b.pits - a.pits)[0];
    const next = CALENDAR[Math.min(CALENDAR.length - 1, res.round + 1)];
    const lines = [
      slowPit && slowPit.pits >= 3 ? `${lastNameOf(s, slowPit.driverId)} doing ${slowPit.pits} stops like it's a pit stop competition 💀` : `who else is destroyed after ${circuitName(circuit.id, 'en')}`,
      next && res.round < 23 ? `next stop ${next.city}. who's on the same flight?` : 'end of season party where??',
      `${circuit.city} crowd was insane`,
      'cooldown room = best part of the weekend',
    ];
    out.push(msg(s, id, say(id, pick(lines))));
  }
  return out;
}

const ACT_LINES: Record<string, string> = {
  golf: 'Golf Thursday at Monte-Carlo Golf Club, who\'s in? ⛳', padel: 'Padel tomorrow 6pm, need 2 more 🎾', simracing: 'iRacing endurance tonight, need a 4th driver 🎮',
  cycling: 'Bike ride Sunday morning, 120km, easy pace (promise) 🚴', party: 'Who\'s in town Friday night? 🪩', football: 'Five-a-side football between drivers next week ⚽',
  karting: 'Karting session, just us, like the old days 🏎️', yacht: 'Boat day this weekend, I have space 🛥️', coffee: 'Coffee ride anyone ☕🚴', sauna: 'Sauna + ice bath, who dares 🧖',
  fashion: 'Who\'s going to fashion week?', surf: 'Surf trip between two races? 🏄', ski: 'Ski trip this winter, chalet available ⛷️', piano: 'Small private concert tonight 🎹', fishing: 'Fishing Saturday morning 🎣',
  charity: 'Charity gala next month, come please 🙏', gym: 'Group cardio session? 🏃', cricket: 'Cricket anyone? No? Ok. 🏏', tennis: 'Tennis tomorrow? 🎾', poker: 'Poker night 🃏',
  rally: 'Who wants to try a rally stage? 🏁', gt3: 'Who wants to do the Nürburgring 24h with me?', stream: 'Streaming tonight, come watch me lose 🎮', business: 'Anyone got tips on London property?',
  cats: 'My cat just knocked over my trophy. Again 🐱', family: 'Family day, phone off 👋', music: 'Pre-race playlist, send me your songs 🎧',
};

export function groupRandom(s: GameState): ChatMessage[] {
  const drivers = activeDrivers(s);
  const out: ChatMessage[] = [];
  const roll = Math.random();
  const st = driverStandings(s);
  const next = CALENDAR[Math.min(23, s.round)];
  if (roll < 0.25) {
    const organizer = weightedPick(drivers, (d) => DRIVERS_BY_ID[d].persona.traits.warmth);
    const act = pick(DRIVERS_BY_ID[organizer].persona.likes);
    out.push(msg(s, organizer, say(organizer, ACT_LINES[act] ?? 'Who\'s free this week?')));
    for (const id of pickN(drivers.filter((d) => d !== organizer && DRIVERS_BY_ID[d].persona.likes.includes(act)), 2)) out.push(msg(s, id, quickLine(id, 'yes')));
    if (ACTIVITIES_BY_ID[act]) s.flags['groupInvite'] = `${organizer}|${act}|${s.day}`;
  } else if (roll < 0.4) {
    const gpda = pick(drivers.filter((d) => ['russell', 'sainz', 'verstappen'].includes(d))) ?? pick(drivers);
    const topics = [
      'GPDA reminder: track limits briefing on Friday. Send me your feedback ✍️',
      'FIA wants even bigger fines for swearing on the radio. Joint statement?',
      'Heat in Qatar/Singapore: do we push for mandatory driver cooling?',
      'Vote: do we ask for fewer triple-headers next year? 👍 / 👎',
      `The sausage kerbs in ${circuitName(next.id, 'en')} are dangerous, I'll raise it with race control.`,
    ];
    out.push(msg(s, gpda, say(gpda, pick(topics))));
    for (const id of pickN(drivers.filter((d) => d !== gpda), 2)) out.push(msg(s, id, quickLine(id, 'serious')));
    s.flags['gpdaTopic'] = s.day;
  } else if (roll < 0.55) {
    const [, m, dd] = s.date.split('-');
    const bday = drivers.find((d) => DRIVERS_BY_ID[d].birthDate.slice(5) === `${m}-${dd}`);
    if (bday) {
      for (const id of pickN(drivers.filter((d) => d !== bday), 3)) out.push(msg(s, id, say(id, pick([`Happy birthday ${DRIVERS_BY_ID[bday].firstName} 🎂`, `HBD ${DRIVERS_BY_ID[bday].firstName} 🎉`, 'Happy birthday 🥳']))));
      out.push(msg(s, bday, say(bday, 'Thanks everyone 🙏')));
    } else {
      const id = weightedPick(drivers, (d) => DRIVERS_BY_ID[d].persona.traits.humor);
      const leader = st[0]?.driverId;
      out.push(
        msg(
          s,
          id,
          say(
            id,
            pick([
              `who has the video from yesterday's karting 💀`,
              'the new team sim is insane',
              'jet lag level 1000',
              `anyone know a good restaurant in ${next.city}?`,
              leader && leader !== id ? `${lastNameOf(s, leader)} leading the championship, we need a plan 😂` : 'feeling good about the next one',
            ]),
          ),
        ),
      );
      if (chance(0.6)) {
        const r = pick(drivers.filter((d) => d !== id));
        out.push(msg(s, r, quickLine(r, 'lol')));
      }
    }
  } else if (roll < 0.7) {
    const id = weightedPick(drivers, (d) => DRIVERS_BY_ID[d].persona.traits.humor + 20);
    const target = pick(drivers.filter((d) => d !== id));
    out.push(msg(s, id, say(id, pick([`${DRIVERS_BY_ID[target].firstName} your new helmet is 🔥`, `${DRIVERS_BY_ID[target].firstName} did you see your interview {laugh}`, `who put ${DRIVERS_BY_ID[target].firstName} in a TikTok {laugh}`]))));
    out.push(msg(s, target, quickLine(target, 'lol')));
  }
  return out;
}

/** Réactions du groupe à un message du joueur : réponses composées à partir du message. */
export function groupReplyTo(s: GameState, text: string): { messages: ChatMessage[]; relChanges: Record<string, { friendship?: number; rivalry?: number; respect?: number }>; accepted: string[] } {
  const a = analyze(text);
  const intent = detectIntent(a, text);
  const act = detectActivity(text);
  const drivers = activeDrivers(s);
  const mentioned = a.mentionsDrivers.filter((d) => drivers.includes(d));
  const responders = new Set<string>(mentioned.slice(0, 2));
  const n = intent === 'invite' ? 4 : intent === 'taunt' ? 3 : intent === 'question' ? 3 : 2;
  let guard = 0;
  while (responders.size < Math.min(n, drivers.length) && guard++ < 40) {
    responders.add(weightedPick(drivers, (d) => 10 + Math.max(0, s.drivers[d].rel.friendship) + DRIVERS_BY_ID[d].persona.traits.media / 3 + (act && DRIVERS_BY_ID[d].persona.likes.includes(act) ? 60 : 0)));
  }
  const messages: ChatMessage[] = [];
  const relChanges: Record<string, { friendship?: number; rivalry?: number; respect?: number }> = {};
  const accepted: string[] = [];
  for (const id of responders) {
    if (intent !== 'invite' && intent !== 'taunt' && !mentioned.includes(id) && messages.length >= 1 && chance(0.35)) continue;
    const r = composeReply(s, id, text, 'group');
    const scale = mentioned.length && !mentioned.includes(id) && intent === 'taunt' ? 0.3 : 0.6;
    relChanges[id] = { friendship: (r.rel.friendship ?? 0) * scale, rivalry: (r.rel.rivalry ?? 0) * scale, respect: (r.rel.respect ?? 0) * scale };
    if (r.acceptedActivity) accepted.push(id);
    messages.push({ id: uid('g'), from: id, text: r.text, day: s.day });
  }
  if (intent === 'taunt' && chance(0.5)) {
    const id = weightedPick(drivers, (d) => DRIVERS_BY_ID[d].persona.traits.humor);
    messages.push({ id: uid('g'), from: id, text: say(id, pick(['🍿🍿', 'oh it\'s getting spicy', '👀', 'calm down boys 😂'])), day: s.day });
  }
  return { messages, relChanges, accepted };
}
