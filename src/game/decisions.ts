/**
 * Décisions à prendre pendant le week-end (essais, qualifs, course).
 * Chaque scénario propose des choix qui influencent ta course… ou celle des autres.
 */
import { CALENDAR, type CircuitDef } from '../data/calendar';
import { DRIVERS_BY_ID } from '../data/drivers';
import type { GameState, PendingDecision, RaceCar, RaceState, TyreCompound, WeekendState } from './types';
import { PLAYER_ID } from './types';
import { lastNameOf, statsOf, teammateOf } from './people';
import { chance, clamp, pick, rand } from './rng';
import { applyRel, changeImage, changeTrust } from './career/season';
import { TYRE_INFO } from './sim/pace';

// ───────────────────────── Outils ─────────────────────────

function running(r: RaceState): RaceCar[] {
  return r.cars.filter((c) => c.status !== 'out').sort((a, b) => a.totalTime - b.totalTime);
}

function me(r: RaceState): RaceCar | undefined {
  return r.cars.find((c) => c.driverId === PLAYER_ID);
}

/** Fait gagner n places au pilote (en passant devant les n voitures qui le précèdent). */
function gainPlaces(r: RaceState, car: RaceCar, n: number) {
  const order = running(r);
  const i = order.indexOf(car);
  const target = order[Math.max(0, i - n)];
  if (target && target !== car) car.totalTime = target.totalTime - rand(0.15, 0.5);
}

function losePlaces(r: RaceState, car: RaceCar, n: number) {
  const order = running(r);
  const i = order.indexOf(car);
  const target = order[Math.min(order.length - 1, i + n)];
  if (target && target !== car) car.totalTime = target.totalTime + rand(0.2, 0.6);
}

function mod(r: RaceState, id: string, perLap: number, laps: number) {
  r.mods ??= {};
  r.modLaps ??= {};
  r.mods[id] = perLap;
  r.modLaps[id] = laps;
}

function ev(r: RaceState, text: string, involvesPlayer = true) {
  r.events.push({ lap: r.lap, kind: 'incident', text, involvesPlayer });
}

function retireCar(r: RaceState, car: RaceCar, reason: string, s?: GameState) {
  car.dnf = reason;
  car.status = 'out';
  ev(r, `❌ Abandon de ${car.driverId === PLAYER_ID ? 'ta voiture' : s ? lastNameOf(s, car.driverId) : car.driverId} (${reason}).`, car.driverId === PLAYER_ID);
}

const n = (s: GameState, id: string) => lastNameOf(s, id);

// ───────────────────────── Course ─────────────────────────

interface RaceDef {
  id: string;
  weight: number;
  when: (s: GameState, r: RaceState, c: CircuitDef) => boolean;
  build: (s: GameState, r: RaceState, c: CircuitDef) => Omit<PendingDecision, 'defId' | 'stage'>;
  resolve: (s: GameState, r: RaceState, choice: number, data: PendingDecision['data']) => string;
}

const RACE_DEFS: RaceDef[] = [
  {
    id: 'crashAhead',
    weight: 3,
    when: (_s, r) => {
      const m = me(r);
      return !!m && m.pos > 2 && r.safetyCar === 'none' && r.lap < r.totalLaps - 3;
    },
    build: (s, r) => {
      const order = running(r);
      const i = order.indexOf(me(r)!);
      const a = order[Math.max(0, i - 2)];
      const b = order[Math.max(0, i - 1)];
      const turn = Math.ceil(rand(1, 16));
      return {
        emoji: '💥',
        title: `Crash juste devant toi au virage ${turn} !`,
        text: `${n(s, a.driverId)} et ${n(s, b.driverId)} s’accrochent devant toi. Débris partout, une voiture en travers de la piste. Tu as une fraction de seconde.`,
        options: [
          { label: '🛑 Lever le pied et éviter', desc: 'Sûr : tu perds environ 1,5 s.' },
          { label: '🎯 Passer dans le trou à l’intérieur', desc: 'Tu peux gagner 2 places… ou ramasser des débris.' },
          { label: '↪️ Prendre l’échappatoire', desc: 'Aucun risque de contact, mais 3 s perdues et enquête possible.' },
        ],
        data: { a: a.driverId, b: b.driverId },
      };
    },
    resolve: (s, r, choice, data) => {
      const m = me(r)!;
      const a = r.cars.find((c) => c.driverId === data.a)!;
      const b = r.cars.find((c) => c.driverId === data.b)!;
      const victim = chance(0.5) ? a : b;
      retireCar(r, victim, `accrochage avec ${n(s, (victim === a ? b : a).driverId)}`, s);
      (victim === a ? b : a).damage = clamp((victim === a ? b : a).damage + 0.12, 0, 1);
      if (chance(0.55)) {
        r.safetyCar = 'sc';
        r.scLaps = 4;
        r.events.push({ lap: r.lap, kind: 'sc', text: '🟨 SAFETY CAR déployée !' });
      }
      if (choice === 0) {
        m.totalTime += 1.5;
        return `Tu évites le chaos proprement. ${n(s, victim.driverId)} est out.`;
      }
      if (choice === 1) {
        if (chance(0.6 + statsOf(s, PLAYER_ID).racecraft / 500)) {
          gainPlaces(r, m, 2);
          return `Passage magique dans le trou ! Tu gagnes deux places pendant que ${n(s, victim.driverId)} abandonne.`;
        }
        m.damage = clamp(m.damage + 0.15, 0, 1);
        m.totalTime += 4;
        return 'Tu roules sur des débris : aileron avant abîmé, tu perds 4 s et du rythme.';
      }
      m.totalTime += 3;
      if (chance(0.2)) {
        m.penalties += 5;
        return 'Les commissaires estiment que tu as gagné un avantage par l’échappatoire : 5 s de pénalité.';
      }
      return 'Tu passes par l’échappatoire, sans dommage.';
    },
  },
  {
    id: 'diveBomb',
    weight: 3,
    when: (_s, r) => {
      const m = me(r);
      if (!m || r.safetyCar !== 'none') return false;
      const behind = running(r).find((c) => c.pos === m.pos + 1);
      return !!behind && behind.gapAhead < 0.8;
    },
    build: (s, r) => {
      const m = me(r)!;
      const behind = running(r).find((c) => c.pos === m.pos + 1)!;
      return {
        emoji: '⚔️',
        title: `${n(s, behind.driverId)} tente un plongeon à l’intérieur !`,
        text: `${n(s, behind.driverId)} plonge très tard au freinage, il est à moitié à ta hauteur. Comment tu réagis ?`,
        options: [
          { label: '🧱 Fermer la porte, défense agressive', desc: 'Tu gardes la place… si ça ne finit pas en contact.' },
          { label: '🤝 Laisser de la place', desc: 'Tu perds la position mais gagnes son respect.' },
          { label: '🔄 Croiser la trajectoire en sortie', desc: 'Contre-attaque : dépend de ton intelligence de course.' },
        ],
        data: { rival: behind.driverId },
      };
    },
    resolve: (s, r, choice, data) => {
      const m = me(r)!;
      const rival = r.cars.find((c) => c.driverId === data.rival)!;
      const st = statsOf(s, PLAYER_ID);
      if (choice === 0) {
        const roll = Math.random();
        if (roll < 0.5 + (st.defending - 80) / 100) {
          rival.totalTime = m.totalTime + 0.6;
          applyRel(s, rival.driverId, { rivalry: 4 });
          return `Porte fermée ! ${n(s, rival.driverId)} doit renoncer.`;
        }
        if (roll < 0.8) {
          m.damage = clamp(m.damage + 0.1, 0, 1);
          rival.damage = clamp(rival.damage + 0.1, 0, 1);
          m.totalTime += 2;
          rival.totalTime += 2.5;
          r.collisions.push({ a: rival.driverId, b: PLAYER_ID, lap: r.lap, blame: PLAYER_ID });
          applyRel(s, rival.driverId, { friendship: -8, rivalry: 10 });
          return 'Contact ! Les deux voitures sont abîmées et la direction de course enquête.';
        }
        losePlaces(r, m, 1);
        m.totalTime += 1;
        return `Il te pousse au large : tu perds la position et du temps.`;
      }
      if (choice === 1) {
        losePlaces(r, m, 1);
        applyRel(s, rival.driverId, { respect: 6, friendship: 3 });
        return `Tu laisses de la place. ${n(s, rival.driverId)} passe, mais il appréciera ton fair-play.`;
      }
      if (chance(0.4 + st.racecraft / 250)) {
        rival.totalTime = m.totalTime + 0.4;
        applyRel(s, rival.driverId, { respect: 4, rivalry: 3 });
        return `Croisement parfait en sortie ! Tu reprends la position. Magnifique.`;
      }
      losePlaces(r, m, 1);
      return 'Ton croisement échoue, il garde la position.';
    },
  },
  {
    id: 'overtakeChance',
    weight: 3,
    when: (_s, r) => {
      const m = me(r);
      return !!m && m.pos > 1 && m.gapAhead > 0 && m.gapAhead < 0.9 && r.safetyCar === 'none';
    },
    build: (s, r) => {
      const m = me(r)!;
      const ahead = running(r).find((c) => c.pos === m.pos - 1)!;
      return {
        emoji: '🏎️',
        title: `Tu es dans l’aileron de ${n(s, ahead.driverId)}`,
        text: `${m.gapAhead.toFixed(2)} s d’écart, batterie à ${Math.round(m.battery)} %. C’est le moment ?`,
        options: [
          { label: '🌀 Par l’extérieur au virage 1', desc: 'Spectaculaire et risqué.' },
          { label: '⚡ Attendre la ligne droite avec l’overtake mode', desc: 'Plus sûr, mais vide la batterie.' },
          { label: '🧠 Feinte à gauche, attaque à droite', desc: 'Dépend de ton talent de dépassement.' },
          { label: '⏳ Rester derrière et gérer les pneus', desc: 'Tu économises tes gommes pour plus tard.' },
        ],
        data: { rival: ahead.driverId },
      };
    },
    resolve: (s, r, choice, data) => {
      const m = me(r)!;
      const rival = r.cars.find((c) => c.driverId === data.rival)!;
      const st = statsOf(s, PLAYER_ID);
      if (choice === 0) {
        if (chance(0.45 + (st.overtaking - 80) / 120)) {
          m.totalTime = rival.totalTime - 0.3;
          return `Dépassement de folie par l’extérieur sur ${n(s, rival.driverId)} ! La foule se lève.`;
        }
        if (chance(0.35)) {
          m.damage = clamp(m.damage + 0.12, 0, 1);
          m.totalTime += 3;
          r.collisions.push({ a: PLAYER_ID, b: rival.driverId, lap: r.lap, blame: PLAYER_ID });
          applyRel(s, rival.driverId, { friendship: -6, rivalry: 8 });
          return 'Contact roue contre roue ! Tu abîmes ton aileron.';
        }
        m.totalTime += 1;
        return 'Trop large, tu dois renoncer et tu perds un peu de temps.';
      }
      if (choice === 1) {
        m.battery = clamp(m.battery - 45, 0, 100);
        if (chance(0.55 + m.battery / 400 + (st.overtaking - 80) / 200)) {
          m.totalTime = rival.totalTime - 0.25;
          return `Overtake mode, aspiration, et ça passe ! Devant ${n(s, rival.driverId)}.`;
        }
        return `${n(s, rival.driverId)} se défend bien, batterie vidée pour rien.`;
      }
      if (choice === 2) {
        if (chance(0.35 + st.overtaking / 300)) {
          m.totalTime = rival.totalTime - 0.2;
          applyRel(s, rival.driverId, { respect: 3 });
          return 'La feinte marche à la perfection. Joli.';
        }
        m.totalTime += 0.6;
        return 'Il ne mord pas à la feinte.';
      }
      m.tyreWear = clamp(m.tyreWear - 6, 0, 100);
      mod(r, PLAYER_ID, -0.15, 6);
      return 'Tu temporises : pneus préservés, tu seras plus fort en fin de relais.';
    },
  },
  {
    id: 'undercut',
    weight: 2,
    when: (_s, r) => {
      const m = me(r);
      return !!m && r.kind === 'race' && m.tyreAge > 12 && m.tyreWear > 35 && r.lap < r.totalLaps - 10 && !r.pendingPit;
    },
    build: (s, r) => {
      const m = me(r)!;
      const ahead = running(r).find((c) => c.pos === m.pos - 1);
      const comp: TyreCompound = r.totalLaps - r.lap > 25 ? 'H' : 'M';
      return {
        emoji: '📻',
        title: 'Ton ingénieur propose l’undercut',
        text: `« ${ahead ? `${n(s, ahead.driverId)} est à ${m.gapAhead.toFixed(1)} s.` : 'Fenêtre ouverte.'} Si on rentre maintenant en ${TYRE_INFO[comp].name.toLowerCase()}, on peut passer devant. Ton appel. »`,
        options: [
          { label: '✅ Box, box ! Undercut', desc: 'Arrêt ce tour-ci, gros rythme en pneus neufs.' },
          { label: '🧮 Overcut : rester dehors', desc: 'Tu pousses en piste libre pendant qu’ils s’arrêtent.' },
        ],
        data: { comp },
      };
    },
    resolve: (_s, r, choice, data) => {
      if (choice === 0) {
        r.pendingPit = String(data.comp) as TyreCompound;
        mod(r, PLAYER_ID, -0.45, 3);
        return 'Box confirmé. Les mécanos sont prêts, push en sortie !';
      }
      mod(r, PLAYER_ID, -0.2, 4);
      return 'On reste dehors. Tours qualif en piste libre, à toi de jouer.';
    },
  },
  {
    id: 'debris',
    weight: 2,
    when: (_s, r) => !!me(r) && r.safetyCar === 'none',
    build: () => ({
      emoji: '🔩',
      title: 'Débris sur la trajectoire',
      text: 'Un morceau de fibre de carbone traîne au milieu de la trajectoire idéale dans le virage rapide.',
      options: [
        { label: '🏁 Garder la trajectoire', desc: 'Aucune perte… sauf crevaison.' },
        { label: '↔️ Éviter en sortant de la ligne', desc: 'Moins de grip : environ 0,8 s perdue.' },
      ],
      data: {},
    }),
    resolve: (_s, r, choice) => {
      const m = me(r)!;
      if (choice === 1) {
        m.totalTime += 0.8;
        return 'Tu contournes les débris. Sage.';
      }
      if (chance(0.22)) {
        m.totalTime += 14;
        r.pendingPit = r.totalLaps - r.lap > 20 ? 'H' : 'M';
        return '💥 CREVAISON ! Tu rentres au ralenti aux stands.';
      }
      return 'Ça passe, pneus intacts.';
    },
  },
  {
    id: 'brakes',
    weight: 1.5,
    when: (_s, r) => !!me(r) && r.lap > 5,
    build: () => ({
      emoji: '🔥',
      title: 'Surchauffe des freins',
      text: '« Les températures de freins arrière montent dangereusement. On doit faire quelque chose. »',
      options: [
        { label: '🧊 Gérer : lift & coast', desc: 'Environ +0,5 s par tour pendant 5 tours.' },
        { label: '😤 Ignorer et attaquer', desc: 'Risque de casse.' },
        { label: '🎛️ Décaler la répartition vers l’avant', desc: 'Compromis : un peu de temps perdu, un peu de risque.' },
      ],
      data: {},
    }),
    resolve: (s, r, choice) => {
      const m = me(r)!;
      if (choice === 0) {
        mod(r, PLAYER_ID, 0.5, 5);
        return 'Freins refroidis. Crise évitée.';
      }
      if (choice === 1) {
        if (chance(0.14)) {
          retireCar(r, m, 'casse des freins');
          return 'Les freins lâchent… Abandon. 😔';
        }
        if (chance(0.3)) {
          m.damage = clamp(m.damage + 0.08, 0, 1);
          return 'Les freins tiennent, mais l’efficacité baisse.';
        }
        return 'Pari gagné : les températures redescendent toutes seules.';
      }
      mod(r, PLAYER_ID, 0.2, 4);
      if (chance(0.05 + (100 - statsOf(s, PLAYER_ID).feedback) / 800)) m.damage = clamp(m.damage + 0.05, 0, 1);
      return 'Réglage ajusté au volant. Ça se stabilise.';
    },
  },
  {
    id: 'rainGamble',
    weight: 3,
    when: (_s, r) => {
      const m = me(r);
      return !!m && (m.tyre === 'S' || m.tyre === 'M' || m.tyre === 'H') && r.weather.rain > 0.08 && r.weather.rain < 0.3 && (r.weather.trend ?? 0) > 0;
    },
    build: (_s, r) => ({
      emoji: '🌦️',
      title: 'Les premières gouttes…',
      text: `La pluie arrive sur la moitié du circuit (humidité ${Math.round(r.weather.rain * 100)} %). Personne n’a encore bougé.`,
      options: [
        { label: '🎲 Coup de poker : intermédiaires maintenant', desc: 'Énorme gain si la pluie s’intensifie, désastre sinon.' },
        { label: '⏱️ Attendre un tour', desc: 'Tu suis la météo de plus près.' },
        { label: '🏎️ Rester en slicks jusqu’au bout', desc: 'Le pari inverse.' },
      ],
      data: {},
    }),
    resolve: (_s, r, choice) => {
      if (choice === 0) {
        r.pendingPit = 'I';
        r.weather.target = chance(0.6) ? rand(0.45, 0.75) : 0.1;
        return r.weather.target > 0.3 ? 'Box pour des inters ! Le ciel s’assombrit : ça sent le coup de génie.' : 'Box pour des inters… mais le radar annonce une éclaircie. Aïe.';
      }
      if (choice === 1) return 'On attend un tour. Ingénieur : « On surveille le radar. »';
      r.weather.target = chance(0.5) ? 0 : rand(0.3, 0.6);
      return r.weather.target > 0.25 ? 'Tu restes en slicks… et la pluie redouble. Ça va glisser.' : 'Tu restes en slicks et l’averse passe : bien joué !';
    },
  },
  {
    id: 'reportRival',
    weight: 1.5,
    when: (_s, r) => {
      const m = me(r);
      return !!m && m.pos > 1 && running(r).some((c) => c.pos === m.pos - 1);
    },
    build: (s, r) => {
      const m = me(r)!;
      const ahead = running(r).find((c) => c.pos === m.pos - 1)!;
      return {
        emoji: '🧑‍⚖️',
        title: `${n(s, ahead.driverId)} coupe les virages`,
        text: `Tu as l’impression que ${n(s, ahead.driverId)} dépasse les limites de piste au virage 4 à chaque tour.`,
        options: [
          { label: '📢 Le signaler à la radio', desc: 'Il peut prendre 5 s… et il ne va pas aimer.' },
          { label: '🤐 Laisser couler', desc: 'Tu te concentres sur ta course.' },
        ],
        data: { rival: ahead.driverId },
      };
    },
    resolve: (s, r, choice, data) => {
      if (choice === 1) return 'Tu restes concentré sur ton pilotage.';
      const rival = r.cars.find((c) => c.driverId === data.rival)!;
      applyRel(s, rival.driverId, { friendship: -6, rivalry: 6 });
      if (chance(0.55)) {
        rival.penalties += 5;
        r.events.push({ lap: r.lap, kind: 'penalty', text: `⚖️ ${n(s, rival.driverId)} : 5 s de pénalité (limites de piste).`, involvesPlayer: true });
        return `La direction de course confirme : 5 s de pénalité pour ${n(s, rival.driverId)} !`;
      }
      changeImage(s, { likeability: -1 });
      return 'Les commissaires ne trouvent rien. Et la radio a fuité sur les réseaux…';
    },
  },
  {
    id: 'helpFriend',
    weight: 1.2,
    when: (s, r) => {
      const m = me(r);
      if (!m) return false;
      const behind = running(r).find((c) => c.pos === m.pos + 1);
      return !!behind && behind.driverId !== PLAYER_ID && (s.drivers[behind.driverId]?.rel.friendship ?? 0) > 25 && behind.gapAhead < 1.2;
    },
    build: (s, r) => {
      const m = me(r)!;
      const behind = running(r).find((c) => c.pos === m.pos + 1)!;
      return {
        emoji: '🤝',
        title: `Ton ami ${n(s, behind.driverId)} est juste derrière`,
        text: `${n(s, behind.driverId)} est plus rapide et se bat pour le championnat de son côté. Tu pourrais lui faciliter la vie…`,
        options: [
          { label: '🫶 Ne pas résister', desc: 'Tu perds une place, il s’en souviendra.' },
          { label: '🏁 Pas de cadeau en piste', desc: 'Tu te bats normalement.' },
        ],
        data: { friend: behind.driverId },
      };
    },
    resolve: (s, r, choice, data) => {
      const m = me(r)!;
      if (choice === 0) {
        losePlaces(r, m, 1);
        applyRel(s, String(data.friend), { friendship: 10, respect: 3 });
        if (teammateOf(s, PLAYER_ID) !== data.friend) changeTrust(s, -3);
        return `${n(s, String(data.friend))} passe et lève la main pour te remercier. Ton équipe, elle, grince des dents.`;
      }
      applyRel(s, String(data.friend), { respect: 2 });
      return 'Pas de cadeau. Il respecte, c’est la course.';
    },
  },
  {
    id: 'restart',
    weight: 4,
    when: (_s, r) => !!me(r) && r.safetyCar === 'sc' && r.scLaps <= 1,
    build: () => ({
      emoji: '🚦',
      title: 'Relance après safety car',
      text: 'La safety car rentre ce tour-ci. Le leader contrôle le rythme… tu sens le moment.',
      options: [
        { label: '🚀 Anticiper la relance', desc: 'Tu peux gagner 2 places, ou être sanctionné.' },
        { label: '🎯 Relance classique, bien placé dans l’aspiration', desc: 'Petite chance de gagner une place.' },
        { label: '🛡️ Protéger ta position', desc: 'Pas de risque.' },
      ],
      data: {},
    }),
    resolve: (s, r, choice) => {
      const m = me(r)!;
      const st = statsOf(s, PLAYER_ID);
      if (choice === 0) {
        if (chance(0.25)) {
          m.penalties += 5;
          return 'Tu as dépassé avant la ligne de contrôle : 5 s de pénalité !';
        }
        if (chance(0.55 + (st.starts - 80) / 150)) {
          gainPlaces(r, m, 2);
          return 'Relance parfaite, deux places gagnées !';
        }
        return 'Bonne tentative, mais les autres étaient prêts.';
      }
      if (choice === 1 && chance(0.4)) {
        gainPlaces(r, m, 1);
        return 'Aspiration parfaite : une place gagnée.';
      }
      return 'Relance propre, position conservée.';
    },
  },
  {
    id: 'lateTyres',
    weight: 2,
    when: (_s, r) => {
      const m = me(r);
      return !!m && r.kind === 'race' && r.totalLaps - r.lap <= 10 && r.totalLaps - r.lap >= 5 && m.tyreWear > 60 && !r.pendingPit;
    },
    build: (_s, r) => ({
      emoji: '🛞',
      title: 'Pneus en fin de vie',
      text: `Il reste ${r.totalLaps - r.lap} tours. Tes pneus sont à ${Math.round(me(r)!.tyreWear)} % d’usure et ceux de derrière reviennent.`,
      options: [
        { label: '🔴 Arrêt pour des tendres et attaque finale', desc: 'Tu perds des places aux stands, mais tu seras le plus rapide en piste.' },
        { label: '🧱 Tenir jusqu’au drapeau', desc: 'Tu défends avec des pneus morts.' },
      ],
      data: {},
    }),
    resolve: (_s, r, choice) => {
      if (choice === 0) {
        r.pendingPit = 'S';
        mod(r, PLAYER_ID, -0.6, 6);
        return 'Box pour des tendres ! Mode qualif jusqu’à l’arrivée.';
      }
      mod(r, PLAYER_ID, 0.25, 5);
      return 'Tu tiens bon. Chaque virage compte.';
    },
  },
];

export function maybeRaceDecision(s: GameState, r: RaceState): PendingDecision | null {
  const m = me(r);
  if (!m || m.status === 'out' || r.finished || r.decision) return null;
  const max = r.kind === 'sprint' ? 2 : 4;
  if ((r.decisionsTaken ?? 0) >= max) return null;
  if (r.lap < 2 || !chance(r.kind === 'sprint' ? 0.09 : 0.075)) return null;
  const c = CALENDAR.find((x) => x.id === s.weekend?.raceId) ?? CALENDAR[0];
  const pool = RACE_DEFS.filter((d) => d.when(s, r, c));
  if (!pool.length) return null;
  const total = pool.reduce((a, d) => a + d.weight, 0);
  let roll = Math.random() * total;
  const def = pool.find((d) => (roll -= d.weight) <= 0) ?? pool[0];
  return { defId: def.id, stage: 'race', ...def.build(s, r, c) };
}

export function resolveRaceDecision(s: GameState, r: RaceState, choice: number): string {
  const d = r.decision;
  if (!d) return '';
  const def = RACE_DEFS.find((x) => x.id === d.defId)!;
  const out = def.resolve(s, r, choice, d.data);
  r.decisionsTaken = (r.decisionsTaken ?? 0) + 1;
  r.radio.push(`T${r.lap} — ${d.emoji} ${out}`);
  r.decision = null;
  return out;
}

// ───────────────────────── Qualifs & essais ─────────────────────────

interface WkDef {
  id: string;
  stage: 'quali' | 'fp';
  when: (s: GameState, w: WeekendState) => boolean;
  build: (s: GameState, w: WeekendState) => Omit<PendingDecision, 'defId' | 'stage'>;
  resolve: (s: GameState, w: WeekendState, choice: number, data: PendingDecision['data']) => string;
}

function extra(w: WeekendState, k: string, v: number) {
  w.extra ??= {};
  w.extra[k] = (w.extra[k] ?? 0) + v;
}

function rivalNear(s: GameState): string {
  const ids = Object.values(s.drivers).filter((d) => d.teamId && DRIVERS_BY_ID[d.id] && d.id !== teammateOf(s, PLAYER_ID));
  return pick(ids).id;
}

const WK_DEFS: WkDef[] = [
  {
    id: 'traffic',
    stage: 'quali',
    when: () => true,
    build: (s) => {
      const r = rivalNear(s);
      return {
        emoji: '🚧',
        title: 'Trafic dans ton tour lancé',
        text: `${n(s, r)} roule lentement en préparation de son tour, pile sur ta trajectoire dans le dernier secteur.`,
        options: [
          { label: '↩️ Avorter et refaire un tour', desc: 'Moins de pneus pour la suite (+0,15 %).' },
          { label: '💨 Passer quand même à fond', desc: '50/50 : tour parfait ou tour gâché.' },
          { label: '📣 Se plaindre aux commissaires', desc: `${n(s, r)} peut prendre 3 places de pénalité.` },
        ],
        data: { rival: r },
      };
    },
    resolve: (s, w, choice, data) => {
      const r = String(data.rival);
      if (choice === 0) {
        extra(w, 'qmod', 0.0015);
        return 'Tour avorté. Tu repars avec un pneu un peu moins frais.';
      }
      if (choice === 1) {
        if (chance(0.5)) return 'Tu le doubles dans l’aspiration sans perdre une miette. Tour intact !';
        extra(w, 'qmod', 0.005);
        return 'Air sale et freinage compromis : ton tour est gâché.';
      }
      applyRel(s, r, { friendship: -5, rivalry: 5 });
      if (chance(0.5)) {
        extra(w, `gpen:${r}`, 3);
        return `Les commissaires sanctionnent ${n(s, r)} : 3 places de pénalité sur la grille !`;
      }
      return 'Pas de sanction. Et tu as perdu ton temps.';
    },
  },
  {
    id: 'yellow',
    stage: 'quali',
    when: () => true,
    build: () => ({
      emoji: '🟨',
      title: 'Drapeau jaune dans le secteur 2',
      text: 'Une voiture est arrêtée sur le bas-côté. Le panneau jaune s’allume juste devant toi.',
      options: [
        { label: '🦶 Lever franchement le pied', desc: 'Règlementaire : +0,3 % sur ce tour.' },
        { label: '🙈 Lever à peine', desc: 'Tu gardes le chrono… si personne ne regarde la télémétrie.' },
      ],
      data: {},
    }),
    resolve: (s, w, choice) => {
      if (choice === 0) {
        extra(w, 'qmod', 0.003);
        changeImage(s, { professionalism: 1 });
        return 'Tu lèves le pied comme il faut.';
      }
      if (chance(0.45)) {
        extra(w, 'gridPen', 3);
        changeImage(s, { professionalism: -2 });
        return 'La télémétrie te trahit : 3 places de pénalité sur la grille !';
      }
      extra(w, 'qmod', -0.001);
      return 'Personne n’a rien vu. Chrono préservé.';
    },
  },
  {
    id: 'tow',
    stage: 'quali',
    when: (s) => !!teammateOf(s, PLAYER_ID),
    build: (s) => {
      const mate = teammateOf(s, PLAYER_ID)!;
      return {
        emoji: '🪁',
        title: 'Jeu d’aspiration avec ton coéquipier',
        text: `Sur ce circuit, une aspiration vaut deux dixièmes. ${n(s, mate)} et toi sortez des stands en même temps.`,
        options: [
          { label: '🙏 Demander l’aspiration à ton coéquipier', desc: 'Tu gagnes du temps, lui en perd.' },
          { label: '🎁 Lui offrir l’aspiration', desc: 'Lui va plus vite, et ça renforce votre relation.' },
          { label: '🙅 Chacun pour soi', desc: 'Aucun effet.' },
        ],
        data: { mate },
      };
    },
    resolve: (s, w, choice, data) => {
      const mate = String(data.mate);
      if (choice === 0) {
        extra(w, 'qmod', -0.0022);
        extra(w, `qmod:${mate}`, 0.001);
        applyRel(s, mate, { friendship: -3 });
        return `${n(s, mate)} te sert d’aspiration. Il n’est pas ravi.`;
      }
      if (choice === 1) {
        extra(w, `qmod:${mate}`, -0.0022);
        applyRel(s, mate, { friendship: 8, respect: 3 });
        changeTrust(s, 2);
        return `Tu offres l’aspiration à ${n(s, mate)}. L’équipe apprécie l’esprit d’équipe.`;
      }
      return 'Chacun son tour, pas d’aspiration.';
    },
  },
  {
    id: 'impede',
    stage: 'quali',
    when: () => true,
    build: (s) => {
      const r = rivalNear(s);
      return {
        emoji: '😈',
        title: `${n(s, r)} arrive derrière toi`,
        text: `Tu es dans ton tour de refroidissement. ${n(s, r)}, un concurrent direct, arrive lancé derrière toi.`,
        options: [
          { label: '🚪 Se ranger proprement', desc: 'Fair-play.' },
          { label: '🐢 « Ne pas le voir » et rester sur la trajectoire', desc: 'Son tour sera gâché… enquête probable.' },
        ],
        data: { rival: r },
      };
    },
    resolve: (s, w, choice, data) => {
      const r = String(data.rival);
      if (choice === 0) {
        applyRel(s, r, { respect: 3 });
        return 'Tu te ranges proprement.';
      }
      extra(w, `qmod:${r}`, 0.005);
      applyRel(s, r, { friendship: -10, rivalry: 10 });
      if (chance(0.4)) {
        extra(w, 'gridPen', 3);
        return `${n(s, r)} est furieux et les commissaires te sanctionnent : 3 places de pénalité !`;
      }
      return `${n(s, r)} perd son tour… et lance des gestes très explicites dans ta direction.`;
    },
  },
  {
    id: 'timing',
    stage: 'quali',
    when: () => true,
    build: (_s, w) => ({
      emoji: '⏱️',
      title: 'Quand sortir pour le dernier run ?',
      text: `La piste se gomme de plus en plus, mais ${w.rain.quali > 0 ? 'des nuages approchent' : 'un drapeau rouge est toujours possible'}.`,
      options: [
        { label: '🕐 Sortir en dernier', desc: 'Meilleure piste… si rien ne vient tout gâcher.' },
        { label: '🕘 Sortir tôt', desc: 'Sécurité.' },
      ],
      data: {},
    }),
    resolve: (_s, w, choice) => {
      if (choice === 1) return 'Tu sors tôt, tour bouclé sans surprise.';
      if (chance(w.rain.quali > 0 ? 0.4 : 0.18)) {
        extra(w, 'qmod', 0.008);
        return w.rain.quali > 0 ? 'La pluie tombe pendant ton dernier tour !' : 'Drapeau rouge pendant ton tour : impossible d’améliorer !';
      }
      extra(w, 'qmod', -0.002);
      return 'Piste parfaite en fin de séance : chrono amélioré !';
    },
  },
  // Essais libres
  {
    id: 'upgrade',
    stage: 'fp',
    when: () => true,
    build: () => ({
      emoji: '📦',
      title: 'Nouveau fond plat arrivé de l’usine',
      text: 'L’usine a envoyé une évolution du fond plat en avance. Elle n’a jamais roulé.',
      options: [
        { label: '🧪 La tester maintenant', desc: 'Gain de performance possible, ou bonne journée perdue.' },
        { label: '🔒 Garder la configuration connue', desc: 'Sûr.' },
      ],
      data: {},
    }),
    resolve: (s, w, choice) => {
      if (choice === 1) return 'On garde la base connue.';
      if (chance(0.6 + s.player.stats.feedback / 500)) {
        w.setupConfidence = clamp(w.setupConfidence + 0.07, 0, 1);
        changeTrust(s, 2);
        return 'Corrélation parfaite avec la soufflerie : la voiture est plus rapide !';
      }
      w.setupConfidence = clamp(w.setupConfidence - 0.04, 0, 1);
      return 'Le fond plat marsouine, on démonte… la séance est un peu gâchée.';
    },
  },
  {
    id: 'gearbox',
    stage: 'fp',
    when: () => true,
    build: () => ({
      emoji: '⚙️',
      title: 'Fissure sur la boîte de vitesses',
      text: 'Les mécaniciens repèrent une microfissure sur le carter de boîte. La changer entraîne une pénalité de 5 places.',
      options: [
        { label: '🔧 Changer la boîte', desc: '5 places de pénalité, aucun risque.' },
        { label: '🎲 Rouler avec', desc: 'Risque d’abandon en course.' },
      ],
      data: {},
    }),
    resolve: (_s, w, choice) => {
      if (choice === 0) {
        extra(w, 'gridPen', 5);
        return 'Boîte changée. Tu partiras 5 places plus loin.';
      }
      extra(w, 'dnfRisk', 0.18);
      return 'On croise les doigts pour dimanche…';
    },
  },
  {
    id: 'shareData',
    stage: 'fp',
    when: (s) => !!teammateOf(s, PLAYER_ID),
    build: (s) => {
      const mate = teammateOf(s, PLAYER_ID)!;
      return {
        emoji: '📊',
        title: `${n(s, mate)} veut voir tes données`,
        text: `${n(s, mate)} a du mal avec l’équilibre de la voiture et demande à voir ta télémétrie et tes réglages.`,
        options: [
          { label: '🤝 Partager', desc: 'Il progresse, votre relation aussi.' },
          { label: '🙅 Refuser', desc: 'Ton avantage reste à toi.' },
        ],
        data: { mate },
      };
    },
    resolve: (s, w, choice, data) => {
      const mate = String(data.mate);
      if (choice === 0) {
        applyRel(s, mate, { friendship: 7, respect: 3 });
        extra(w, `qmod:${mate}`, -0.0015);
        changeTrust(s, 2);
        return `${n(s, mate)} te remercie. L’équipe adore cet état d’esprit.`;
      }
      applyRel(s, mate, { friendship: -5, rivalry: 5 });
      return 'Tu gardes tes secrets. L’ambiance dans le garage se refroidit.';
    },
  },
  {
    id: 'journalist',
    stage: 'fp',
    when: () => true,
    build: () => ({
      emoji: '🎥',
      title: 'Une équipe TV dans ton garage',
      text: 'Une équipe de tournage d’un documentaire veut filmer ton débrief entre deux relais.',
      options: [
        { label: '🎬 Accepter', desc: 'Visibilité énorme, mais moins de concentration.' },
        { label: '🚪 Refuser poliment', desc: 'Tu restes concentré.' },
      ],
      data: {},
    }),
    resolve: (s, w, choice) => {
      if (choice === 0) {
        s.player.followers = Math.round(s.player.followers * 1.03 + 20_000);
        w.setupConfidence = clamp(w.setupConfidence - 0.02, 0, 1);
        return 'Les images vont faire le tour du monde. +3 % d’abonnés.';
      }
      w.setupConfidence = clamp(w.setupConfidence + 0.01, 0, 1);
      return 'Débrief au calme, bonne concentration.';
    },
  },
  {
    id: 'practiceStart',
    stage: 'fp',
    when: () => true,
    build: () => ({
      emoji: '🚥',
      title: 'Fin de séance : simulation de départ ?',
      text: 'Il reste 3 minutes. Tu peux faire un essai de départ en bout de voie des stands.',
      options: [
        { label: '🟢 Oui, simulation de départ', desc: 'Meilleur départ dimanche.' },
        { label: '🔁 Plutôt un tour de plus sur les réglages', desc: 'Un peu plus de confiance dans la voiture.' },
      ],
      data: {},
    }),
    resolve: (_s, w, choice) => {
      if (choice === 0) {
        extra(w, 'startBonus', 1);
        return 'Départ calé au millimètre. Point de patinage trouvé.';
      }
      w.setupConfidence = clamp(w.setupConfidence + 0.025, 0, 1);
      return 'Encore un tour d’affinage : la voiture est un peu mieux.';
    },
  },
];

export function queueWeekendDecisions(stage: 'quali' | 'fp', count: number, s: GameState, w: WeekendState): string[] {
  const pool = WK_DEFS.filter((d) => d.stage === stage && d.when(s, w)).map((d) => d.id);
  const out: string[] = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

export function buildWeekendDecision(s: GameState, w: WeekendState, id: string): PendingDecision | null {
  const def = WK_DEFS.find((d) => d.id === id);
  if (!def) return null;
  return { defId: id, stage: def.stage, ...def.build(s, w) };
}

export function resolveWeekendDecision(s: GameState, w: WeekendState, choice: number): string {
  const d = w.decision;
  if (!d) return '';
  const def = WK_DEFS.find((x) => x.id === d.defId)!;
  const out = def.resolve(s, w, choice, d.data);
  w.decisionLog ??= [];
  w.decisionLog.push(`${d.emoji} ${d.title} → ${d.options[choice]?.label} : ${out}`);
  w.notes.push(`${d.emoji} ${out}`);
  return out;
}

/** Modificateurs de qualif issus des décisions. */
export function qualiModsFromWeekend(w: WeekendState): { time: Record<string, number> } {
  const time: Record<string, number> = {};
  for (const [k, v] of Object.entries(w.extra ?? {})) {
    if (k === 'qmod') time[PLAYER_ID] = (time[PLAYER_ID] ?? 0) + v;
    else if (k.startsWith('qmod:')) time[k.slice(5)] = (time[k.slice(5)] ?? 0) + v;
  }
  return { time };
}

/** Pénalités de grille issues des décisions. */
export function gridPenaltiesFromWeekend(w: WeekendState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(w.extra ?? {})) {
    if (k === 'gridPen') out[PLAYER_ID] = (out[PLAYER_ID] ?? 0) + v;
    else if (k.startsWith('gpen:')) out[k.slice(5)] = (out[k.slice(5)] ?? 0) + v;
  }
  return out;
}

// ───────────────────────── Choix automatiques ─────────────────────────

/** Index d'option choisi selon le profil : [prudent, équilibré, agressif]. */
const AUTO_PICK: Record<string, [number, number, number]> = {
  crashAhead: [0, 0, 1],
  diveBomb: [1, 2, 0],
  overtakeChance: [3, 1, 0],
  undercut: [1, 0, 0],
  debris: [1, 1, 0],
  brakes: [0, 2, 1],
  rainGamble: [1, 1, 0],
  reportRival: [1, 1, 0],
  helpFriend: [0, 1, 1],
  restart: [2, 1, 0],
  lateTyres: [1, 0, 0],
  traffic: [0, 0, 1],
  yellow: [0, 0, 1],
  tow: [2, 0, 0],
  impede: [0, 0, 1],
  timing: [1, 1, 0],
  upgrade: [1, 0, 0],
  gearbox: [0, 0, 1],
  shareData: [0, 0, 1],
  journalist: [1, 0, 0],
  practiceStart: [0, 0, 0],
};

export function autoChoice(d: PendingDecision, profile: 'prudent' | 'equilibre' | 'agressif'): number {
  const p = AUTO_PICK[d.defId] ?? [0, 0, 0];
  const i = p[profile === 'prudent' ? 0 : profile === 'equilibre' ? 1 : 2];
  return Math.min(i, d.options.length - 1);
}
