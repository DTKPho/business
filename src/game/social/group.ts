/** Générateur du groupe WhatsApp « F1 Drivers 🏎️ ». */
import { DRIVERS_BY_ID } from '../../data/drivers';
import { CALENDAR } from '../../data/calendar';
import type { ChatMessage, GameState, WeekendResult } from '../types';
import { PLAYER_ID } from '../types';
import { chance, pick, pickN, uid, weightedPick } from '../rng';
import { lastNameOf } from '../people';
import { analyze, detectActivity, detectIntent } from './nlp';
import { localReply, voiceLine } from './voice';

function msg(s: GameState, from: string, text: string): ChatMessage {
  return { id: uid('g'), from, text, day: s.day };
}

function activeDrivers(s: GameState): string[] {
  return Object.values(s.drivers)
    .filter((d) => !d.retired && d.teamId && DRIVERS_BY_ID[d.id])
    .map((d) => d.id);
}

function lc(id: string, t: string): string {
  return DRIVERS_BY_ID[id]?.persona.lowercase ? t.toLowerCase() : t;
}

export function groupAfterRace(s: GameState, res: WeekendResult, collisions: { a: string; b: string; blame: string }[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  const circuit = CALENDAR.find((c) => c.id === res.raceId)!;
  const winner = res.race.find((e) => e.position === 1);
  const pl = res.race.find((e) => e.driverId === PLAYER_ID);
  const drivers = activeDrivers(s);
  if (winner && winner.driverId !== PLAYER_ID && DRIVERS_BY_ID[winner.driverId]) {
    const w = winner.driverId;
    const per = DRIVERS_BY_ID[w].persona;
    const wl = per.style === 'dry' ? 'Bonne course tout le monde. 👍' : per.style === 'cocky' ? 'Merci merci. L’expérience 😎' : per.style === 'banter' ? 'je suis toujours sous le choc lol merci les gars 🧡' : `Quelle course ! Merci à tous pour la bagarre propre 🙏`;
    out.push(msg(s, w, lc(w, wl)));
    for (const id of pickN(drivers.filter((d) => d !== w), 2)) {
      const p = DRIVERS_BY_ID[id].persona;
      const line =
        p.friends.includes(w)
          ? pick(['GG 🔥', 'Bravo mon pote !', 'Énorme 👏', `${p.laugh} trop fort`])
          : p.tensions.includes(w)
            ? pick(['Bien joué. Voiture rapide.', 'gg. on verra la prochaine', '👏'])
            : pick(['gg', 'Bravo 👏', 'Bien joué', 'congrats']);
      out.push(msg(s, id, lc(id, line)));
    }
  }
  if (pl) {
    if (pl.position === 1) {
      for (const id of pickN(drivers, 3)) {
        const rel = s.drivers[id].rel;
        const p = DRIVERS_BY_ID[id].persona;
        const line = rel.friendship > 30 ? pick([`ENORME ${s.player.firstName} 🔥🔥`, `t’as été monstrueux aujourd’hui ${p.laugh}`, 'quelle masterclass 👏']) : rel.rivalry > 60 ? pick(['bien joué. profite tant que ça dure 😉', 'gg. chanceux avec la SC non ?']) : pick(['gg 👏', 'bravo pour la victoire', 'congrats !']);
        out.push(msg(s, id, lc(id, line)));
      }
    } else if (pl.dnf && chance(0.6)) {
      const id = pick(drivers);
      const p = DRIVERS_BY_ID[id].persona;
      out.push(msg(s, id, lc(id, p.traits.humor > 75 ? `${s.player.firstName} t’as vu le mur de près aujourd’hui ${p.laugh}` : `Dur aujourd’hui ${s.player.firstName}, courage 💪`)));
    }
  }
  for (const col of collisions.slice(0, 2)) {
    const victim = col.blame === col.a ? col.b : col.a;
    if (victim === PLAYER_ID || !DRIVERS_BY_ID[victim]) continue;
    const blamed = col.blame;
    const p = DRIVERS_BY_ID[victim].persona;
    if (p.traits.temper > 60 && chance(0.7)) out.push(msg(s, victim, lc(victim, `${blamed === PLAYER_ID ? s.player.firstName : lastNameOf(s, blamed)}, on en parle au briefing de la prochaine course.`)));
    else if (chance(0.4)) out.push(msg(s, victim, lc(victim, 'Course gâchée au contact… c’est la vie.')));
    if (blamed !== PLAYER_ID && DRIVERS_BY_ID[blamed] && chance(0.6)) out.push(msg(s, blamed, lc(blamed, DRIVERS_BY_ID[blamed].persona.traits.ego > 70 ? 'Il a fermé la porte trop tard. Commissaires d’accord avec moi ? Non ? Ok 🤷' : 'Désolé pour le contact, j’ai bloqué les roues.')));
  }
  // Mème / banter post-course
  if (chance(0.6)) {
    const id = weightedPick(drivers, (d) => DRIVERS_BY_ID[d].persona.traits.humor);
    const lines = [
      `qui a vu le pit stop de ${pick(drivers.map((d) => lastNameOf(s, d)))} 💀`,
      `prochain arrêt : ${CALENDAR[Math.min(CALENDAR.length - 1, res.round + 1)]?.city ?? 'les vacances'}. qui prend le même vol ?`,
      `${circuit.city} c’était dingue niveau ambiance`,
      'quelqu’un a encore des cuisses ? moi non',
      'cooldown room = meilleure partie du week-end',
    ];
    out.push(msg(s, id, lc(id, pick(lines))));
  }
  return out;
}

export function groupRandom(s: GameState): ChatMessage[] {
  const drivers = activeDrivers(s);
  const out: ChatMessage[] = [];
  const roll = Math.random();
  if (roll < 0.25) {
    const organizer = weightedPick(drivers, (d) => DRIVERS_BY_ID[d].persona.traits.warmth);
    const act = pick(DRIVERS_BY_ID[organizer].persona.likes);
    const labels: Record<string, string> = {
      golf: 'Golf jeudi à Monaco-Mont Agel, qui est chaud ? ⛳', padel: 'Padel demain 18h, il manque 2 joueurs 🎾', simracing: 'Endurance iRacing ce soir, il nous faut un 4e pilote 🎮',
      cycling: 'Sortie vélo dimanche matin, 120 km, rythme cool (promis) 🚴', party: 'Soirée vendredi, qui est en ville ? 🪩', football: 'Five de foot entre pilotes la semaine pro ⚽',
      karting: 'Session karting entre nous, comme au bon vieux temps 🏎️', yacht: 'Bateau ce week-end, j’ai de la place 🛥️', coffee: 'Coffee ride ☕🚴', sauna: 'Sauna + bain froid, qui ose ? 🧖',
      fashion: 'Qui va à la Fashion Week ?', surf: 'Surf trip entre deux courses ? 🏄', ski: 'Ski cet hiver, chalet dispo ⛷️', piano: 'Petit concert privé ce soir 🎹', fishing: 'Pêche en mer samedi 🎣',
      charity: 'Gala de charité le mois prochain, venez nombreux 🙏', gym: 'Séance cardio collective ? 🏃', cricket: 'Cricket ? Personne ? Ok. 🏏', tennis: 'Tennis demain ? 🎾',
      poker: 'Poker night 🃏', rally: 'Qui veut tester un rallye ? 🏁', gt3: 'Qui fait les 24h du Nürburgring avec moi ?', stream: 'Stream ce soir, venez me voir perdre 🎮', business: 'Quelqu’un a des tuyaux sur l’immobilier à Londres ?',
      cats: 'Mon chat a fait une bêtise, photo bientôt 🐱', family: 'Journée en famille, téléphone coupé 👋', music: 'Playlist d’avant-course, envoyez vos sons 🎧',
    };
    out.push(msg(s, organizer, lc(organizer, labels[act] ?? 'Qui est dispo cette semaine ?')));
    for (const id of pickN(drivers.filter((d) => d !== organizer && DRIVERS_BY_ID[d].persona.likes.includes(act)), 2)) out.push(msg(s, id, lc(id, pick(['moi 🙋', 'chaud', 'je viens', 'count me in', 'dispo !']))));
    s.flags['groupInvite'] = `${organizer}|${act}|${s.day}`;
  } else if (roll < 0.4) {
    const gpda = pick(drivers.filter((d) => ['russell', 'sainz', 'verstappen'].includes(d))) ?? pick(drivers);
    const topics = [
      'Rappel GPDA : briefing sur les limites de piste vendredi. Envoyez vos remarques ✍️',
      'La FIA veut encore durcir les sanctions sur les jurons à la radio. On fait un communiqué commun ?',
      'Sujet chaleur au Qatar / Singapour : on demande des systèmes de refroidissement obligatoires ?',
      'Vote : est-ce qu’on demande moins de triple-headers dans le calendrier ? 👍 / 👎',
      'Les vibreurs saucisses de ce circuit sont dangereux, je remonte au directeur de course.',
    ];
    out.push(msg(s, gpda, pick(topics)));
    for (const id of pickN(drivers.filter((d) => d !== gpda), 2)) out.push(msg(s, id, lc(id, voiceLine(id, 'serious'))));
    s.flags['gpdaTopic'] = s.day;
  } else if (roll < 0.55) {
    // Anniversaire réel du jour
    const [, m, dd] = s.date.split('-');
    const bday = drivers.find((d) => DRIVERS_BY_ID[d].birthDate.slice(5) === `${m}-${dd}`);
    if (bday) {
      for (const id of pickN(drivers.filter((d) => d !== bday), 3)) out.push(msg(s, id, lc(id, pick([`Joyeux anniversaire ${DRIVERS_BY_ID[bday].firstName} 🎂`, `HBD ${DRIVERS_BY_ID[bday].firstName} 🎉`, 'Happy birthday 🥳']))));
      out.push(msg(s, bday, lc(bday, 'Merci à tous 🙏')));
    } else {
      const id = weightedPick(drivers, (d) => DRIVERS_BY_ID[d].persona.traits.humor);
      out.push(msg(s, id, lc(id, pick(['qui a la vidéo du karting d’hier 💀', 'le nouveau sim de l’équipe est incroyable', 'jet lag level 1000', `${pick(DRIVERS_BY_ID[id].persona.catchphrases)}`, 'quelqu’un connaît un bon resto à la prochaine destination ?']))));
      if (chance(0.6)) {
        const r = pick(drivers.filter((d) => d !== id));
        out.push(msg(s, r, lc(r, voiceLine(r, 'joke'))));
      }
    }
  } else if (roll < 0.7) {
    const id = weightedPick(drivers, (d) => DRIVERS_BY_ID[d].persona.traits.humor + 20);
    const target = pick(drivers.filter((d) => d !== id));
    out.push(msg(s, id, lc(id, pick([`${DRIVERS_BY_ID[target].firstName} ton nouveau casque est 🔥`, `${DRIVERS_BY_ID[target].firstName} t’as vu ton interview ? ${DRIVERS_BY_ID[id].persona.laugh}`, `qui a mis ${DRIVERS_BY_ID[target].firstName} dans un TikTok ${DRIVERS_BY_ID[id].persona.laugh}`]))));
    out.push(msg(s, target, lc(target, voiceLine(target, 'joke'))));
  }
  return out;
}

/** Réactions du groupe à un message du joueur. */
export function groupReplyTo(s: GameState, text: string): { messages: ChatMessage[]; relChanges: Record<string, { friendship?: number; rivalry?: number; respect?: number }>; accepted: string[] } {
  const a = analyze(text);
  const intent = detectIntent(a, text);
  const act = detectActivity(text);
  const drivers = activeDrivers(s);
  const mentioned = a.mentionsDrivers.filter((d) => drivers.includes(d));
  const responders = new Set<string>(mentioned.slice(0, 2));
  const n = intent === 'invite' ? 4 : intent === 'taunt' ? 3 : 2;
  while (responders.size < Math.min(n, drivers.length)) {
    responders.add(weightedPick(drivers, (d) => 10 + Math.max(0, s.drivers[d].rel.friendship) + DRIVERS_BY_ID[d].persona.traits.media / 3 + (act && DRIVERS_BY_ID[d].persona.likes.includes(act) ? 60 : 0)));
  }
  const messages: ChatMessage[] = [];
  const relChanges: Record<string, { friendship?: number; rivalry?: number; respect?: number }> = {};
  const accepted: string[] = [];
  for (const id of responders) {
    if (intent !== 'invite' && intent !== 'taunt' && !mentioned.includes(id) && chance(0.3)) continue;
    const r = localReply(s, id, intent, text, act);
    // Dans un groupe, une provocation non nominative touche moins
    const scale = mentioned.length && !mentioned.includes(id) && intent === 'taunt' ? 0.3 : 0.6;
    relChanges[id] = { friendship: (r.rel.friendship ?? 0) * scale, rivalry: (r.rel.rivalry ?? 0) * scale, respect: (r.rel.respect ?? 0) * scale };
    if (r.acceptedActivity) accepted.push(id);
    messages.push({ id: uid('g'), from: id, text: r.text, day: s.day });
  }
  if (intent === 'taunt' && chance(0.5)) {
    const id = weightedPick(drivers, (d) => DRIVERS_BY_ID[d].persona.traits.humor);
    messages.push({ id: uid('g'), from: id, text: lc(id, pick(['🍿🍿', 'oh ça chauffe', '👀', 'calmez-vous les gars 😂'])), day: s.day });
  }
  return { messages, relChanges, accepted };
}
