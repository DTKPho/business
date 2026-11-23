import type { CircuitDef } from '../../data/calendar';
import { POINTS_RACE, POINTS_SPRINT } from '../../data/calendar';
import type { GameState, QualiEntry, RaceCar, RaceEvent, RaceResultEntry, RaceState, TyreCompound } from '../types';
import { PLAYER_ID } from '../types';
import { lastNameOf, statsOf, teamOf, teammateOf } from '../people';
import { aiSetupQuality, basePace, bestTyreForRain, TYRE_INFO, weatherTyrePenalty } from './pace';
import { chance, clamp, gauss, pick, rand, randInt } from '../rng';
import { applyRaceCheats, racePaceNudge } from '../cheats';

export interface RaceContext {
  s: GameState;
  c: CircuitDef;
  playerSetup: number;
  raceId: string;
}

function planStrategy(c: CircuitDef, laps: number, startTyre: TyreCompound, rainy: boolean): { stops: number[]; compounds: TyreCompound[] } {
  if (rainy) return { stops: [], compounds: [] };
  const twoStop = c.tyreStress > 0.72 ? chance(0.8) : c.tyreStress > 0.5 ? chance(0.35) : chance(0.08);
  if (laps < 30) return { stops: [], compounds: [] };
  if (twoStop) {
    const a = Math.round(laps * rand(0.28, 0.36));
    const b = Math.round(laps * rand(0.62, 0.7));
    return { stops: [a, b], compounds: startTyre === 'H' ? ['M', 'M'] : ['H', startTyre === 'S' ? 'M' : 'H'] };
  }
  const a = Math.round(laps * (startTyre === 'S' ? rand(0.3, 0.4) : startTyre === 'M' ? rand(0.4, 0.55) : rand(0.55, 0.65)));
  return { stops: [a], compounds: [startTyre === 'H' ? 'M' : 'H'] };
}

export function initRace(ctx: RaceContext, grid: QualiEntry[], kind: 'race' | 'sprint', rain: number, playerStartTyre: TyreCompound, playerPlan: TyreCompound[]): RaceState {
  const { s, c } = ctx;
  const totalLaps = kind === 'sprint' ? Math.max(15, Math.round(100 / c.lengthKm)) : c.laps;
  const temp = c.night ? 28 : 42;
  const weather: RaceState['weather'] =
    rain > 0 && chance(0.5)
      ? { rain: 0, trend: 0, trackTemp: temp, target: 0, pendingLap: Math.round(rand(0.15, 0.7) * totalLaps), pendingTarget: rain }
      : { rain, trend: 0, trackTemp: temp, target: rain > 0 && chance(0.5) ? 0 : rain };
  const rainy = weather.rain > 0.2;
  const cars: RaceCar[] = grid.map((g, i) => {
    const id = g.driverId;
    const isP = id === PLAYER_ID;
    const setupQ = isP ? ctx.playerSetup : aiSetupQuality(s, id, ctx.raceId);
    const pace = basePace(s, id, c, { rain: 0, setupQuality: setupQ });
    let tyre: TyreCompound;
    if (rainy) tyre = bestTyreForRain(weather.rain) ?? 'I';
    else if (isP) tyre = playerStartTyre;
    else if (kind === 'sprint') tyre = chance(0.7) ? 'M' : 'S';
    else tyre = i < 10 ? (chance(0.6) ? 'M' : 'S') : chance(0.4) ? 'H' : chance(0.6) ? 'M' : 'S';
    const plan = kind === 'sprint' ? { stops: [], compounds: [] } : planStrategy(c, totalLaps, tyre, rainy);
    return {
      driverId: id,
      teamId: teamOf(s, id)!,
      pos: i + 1,
      totalTime: i * 0.22,
      lastLap: 0,
      bestLap: Infinity,
      tyre,
      tyreAge: 0,
      tyreWear: 0,
      usedCompounds: [tyre],
      pits: 0,
      plannedStops: isP ? [] : plan.stops,
      plannedCompounds: isP ? playerPlan : plan.compounds,
      dnf: null,
      penalties: 0,
      battery: 100,
      pace,
      gapAhead: 0,
      status: 'run',
      damage: 0,
      lapsLed: 0,
      startPos: i + 1,
      positionsGained: 0,
    };
  });
  return {
    kind,
    lap: 0,
    totalLaps,
    cars,
    events: [{ lap: 0, kind: 'flag', text: `🚦 Extinction des feux ! ${kind === 'sprint' ? 'Course sprint' : c.name} — ${totalLaps} tours.` }],
    safetyCar: 'none',
    scLaps: 0,
    weather,
    playerMode: 'normal',
    playerBoost: false,
    pendingPit: null,
    teamOrder: null,
    finished: false,
    fastestLap: null,
    radio: [],
    collisions: [],
    forcedDnf: s.cheats?.enabled ? Object.fromEntries(Object.entries(s.cheats.race).filter(([, v]) => v === 'DNF').map(([id]) => [id, randInt(2, Math.max(3, totalLaps - 2))])) : undefined,
    decision: null,
    decisionsTaken: 0,
    mods: {},
    modLaps: {},
  };
}

const MODE = {
  save: { pace: 0.42, wear: 0.72, mistake: 0.5, battery: 14 },
  normal: { pace: 0, wear: 1, mistake: 1, battery: 9 },
  push: { pace: -0.28, wear: 1.28, mistake: 1.6, battery: 6 },
  attack: { pace: -0.5, wear: 1.6, mistake: 2.6, battery: 4 },
} as const;

function aiMode(car: RaceCar, laps: number, lap: number): keyof typeof MODE {
  if (car.tyreWear > 60) return 'save';
  if (laps - lap < 6) return 'push';
  if (car.gapAhead < 1.2 && car.gapAhead > 0) return 'push';
  return 'normal';
}

function compoundsUsedOk(car: RaceCar): boolean {
  const dry = new Set(car.usedCompounds.filter((t) => t === 'S' || t === 'M' || t === 'H'));
  return dry.size >= 2 || car.usedCompounds.some((t) => t === 'I' || t === 'W');
}

function ev(r: RaceState, kind: RaceEvent['kind'], text: string, involvesPlayer = false) {
  r.events.push({ lap: r.lap, kind, text, involvesPlayer });
}

function radio(r: RaceState, text: string) {
  r.radio.push(`T${r.lap} — ${text}`);
  if (r.radio.length > 30) r.radio.shift();
}

function retire(ctx: RaceContext, r: RaceState, car: RaceCar, reason: string, causeSC: boolean) {
  car.dnf = reason;
  car.status = 'out';
  const isP = car.driverId === PLAYER_ID;
  ev(r, 'dnf', `❌ Abandon de ${lastNameOf(ctx.s, car.driverId)} (${reason}).`, isP);
  if (isP) radio(r, `Ingénieur : « Désolé… on doit s’arrêter. ${reason}. Rentre au garage. »`);
  if (causeSC && r.safetyCar === 'none' && r.lap < r.totalLaps - 1) {
    if (chance(0.62)) {
      r.safetyCar = 'sc';
      r.scLaps = Math.round(rand(3, 5));
      ev(r, 'sc', '🟨 SAFETY CAR déployée !');
    } else {
      r.safetyCar = 'vsc';
      r.scLaps = Math.round(rand(2, 3));
      ev(r, 'vsc', '🟨 Virtual Safety Car.');
    }
  }
}

function pitStop(ctx: RaceContext, r: RaceState, car: RaceCar, compound: TyreCompound) {
  const factor = r.safetyCar === 'sc' ? 0.5 : r.safetyCar === 'vsc' ? 0.68 : 1;
  let stop = gauss(2.45, 0.22);
  let slow = false;
  if (chance(0.035)) {
    stop += rand(2.5, 9);
    slow = true;
  }
  const loss = ctx.c.pitLoss * factor + stop;
  car.totalTime += loss;
  car.pits++;
  car.tyre = compound;
  car.tyreAge = 0;
  car.tyreWear = 0;
  if (!car.usedCompounds.includes(compound)) car.usedCompounds.push(compound);
  car.status = 'pit';
  const isP = car.driverId === PLAYER_ID;
  ev(r, 'pit', `🔧 ${lastNameOf(ctx.s, car.driverId)} aux stands → ${TYRE_INFO[compound].name} (${stop.toFixed(1)} s${slow ? ', arrêt raté !' : ''})`, isP);
  if (isP && slow) radio(r, 'Ingénieur : « Problème sur la roue arrière gauche, désolé, on a perdu du temps. »');
  // risque d'unsafe release
  if (chance(0.006)) {
    car.penalties += 5;
    ev(r, 'penalty', `⚖️ ${lastNameOf(ctx.s, car.driverId)} : 5 s de pénalité (unsafe release).`, isP);
  }
}

function aiPitDecision(_ctx: RaceContext, r: RaceState, car: RaceCar): TyreCompound | null {
  const lapsLeft = r.totalLaps - r.lap;
  const rain = r.weather.rain;
  const slick = car.tyre === 'S' || car.tyre === 'M' || car.tyre === 'H';
  if (car.tyreAge < 3) return null; // pas deux arrêts coup sur coup
  if (slick && rain > 0.28) return rain > 0.68 ? 'W' : 'I';
  if (car.tyre === 'I' && rain > 0.72 && chance(0.6)) return 'W';
  if (car.tyre === 'W' && rain < 0.5 && chance(0.6)) return 'I';
  if (!slick && rain < 0.12) {
    if (chance(0.75)) return lapsLeft > 25 ? 'M' : 'S';
  }
  if (r.kind === 'sprint') return null;
  if (lapsLeft < 3) return null;
  if (r.safetyCar === 'sc' && car.tyreWear > 35 && lapsLeft > 8 && chance(0.7)) return lapsLeft > 28 ? 'H' : lapsLeft > 14 ? 'M' : 'S';
  const next = car.plannedStops[0];
  const needMandatory = !compoundsUsedOk(car) && lapsLeft < 8;
  if (car.tyreWear > 78 || (next !== undefined && r.lap >= next + Math.round(gauss(0, 1.5))) || needMandatory) {
    car.plannedStops.shift();
    const comp = car.plannedCompounds.shift();
    if (comp) return comp;
    return lapsLeft > 30 ? 'H' : lapsLeft > 16 ? 'M' : 'S';
  }
  return null;
}

/** Simule un tour complet. Mute `r` (appelant passe une copie). */
export function simulateLap(ctx: RaceContext, r: RaceState): void {
  if (r.finished) return;
  const { s, c } = ctx;
  r.lap++;
  const lap = r.lap;
  const fuel = (r.totalLaps - lap) * 0.055;

  // Météo : la pluie évolue progressivement vers une cible qui change rarement
  const wx = r.weather;
  if (wx.pendingLap !== undefined && lap >= wx.pendingLap) {
    wx.target = wx.pendingTarget ?? 0.5;
    wx.pendingLap = undefined;
    ev(r, 'rain', '🌦️ Les premières gouttes tombent sur le circuit…');
  }
  if (chance(0.012 * (c.rainChance + 0.05) * 4)) wx.target = wx.rain > 0.2 ? (chance(0.6) ? 0 : rand(0.3, 0.8)) : chance(c.rainChance) ? rand(0.3, 0.8) : 0;
  const tgt = wx.target ?? wx.rain;
  wx.trend = clamp(tgt - wx.rain, -0.035, 0.05);
  wx.rain = clamp(wx.rain + wx.trend, 0, 1);
  if (lap === 1 && r.weather.rain > 0.2) ev(r, 'rain', '🌧️ Départ sous la pluie !');
  const prevRain = r.weather.rain;

  const running = r.cars.filter((car) => car.status !== 'out');
  const order = [...running].sort((a, b) => a.totalTime - b.totalTime);

  // Arrêts aux stands (déclarés au tour précédent)
  for (const car of running) {
    car.status = 'run';
    if (car.driverId === PLAYER_ID) {
      if (r.pendingPit) {
        pitStop(ctx, r, car, r.pendingPit);
        r.pendingPit = null;
      }
    } else {
      const comp = aiPitDecision(ctx, r, car);
      if (comp) pitStop(ctx, r, car, comp);
    }
  }

  const scFactor = r.safetyCar === 'sc' ? 1.42 : r.safetyCar === 'vsc' ? 1.3 : 1;

  // Temps au tour
  for (const car of running) {
    const isP = car.driverId === PLAYER_ID;
    const st = statsOf(s, car.driverId);
    const team = s.teams[car.teamId];
    const mode = isP ? r.playerMode : aiMode(car, r.totalLaps, lap);
    const m = MODE[mode];
    const tyre = TYRE_INFO[car.tyre];
    const wearRate = tyre.wear * (0.55 + c.tyreStress) * m.wear * (1.35 - st.tyreManagement / 100) * (r.weather.rain > 0.2 && (car.tyre === 'S' || car.tyre === 'M' || car.tyre === 'H') ? 0.6 : 1) * (car.tyre === 'I' && r.weather.rain < 0.15 ? 2.5 : 1);
    car.tyreWear = clamp(car.tyreWear + wearRate * (r.safetyCar !== 'none' ? 0.35 : 1), 0, 100);
    car.tyreAge++;
    const wearPen = car.tyreWear * 0.022 + (car.tyreWear > 70 ? (car.tyreWear - 70) * 0.11 : 0);
    let t = car.pace * (1 + r.weather.rain * 0.11) + r.weather.rain * (100 - st.wet) * 0.0011 * car.pace;
    t += tyre.offset + wearPen + fuel + weatherTyrePenalty(car.tyre, r.weather.rain) + m.pace;
    t += car.damage * car.pace * 0.04;
    t += racePaceNudge(s, r, car.driverId, car.pos);
    if (r.mods?.[car.driverId] && (r.modLaps?.[car.driverId] ?? 0) > 0) {
      t += r.mods[car.driverId];
      r.modLaps![car.driverId]--;
    }
    t += gauss(0, 0.1 + (100 - st.consistency) * 0.004);
    // Batterie / mode dépassement (règlement 2026)
    let boost = false;
    if (isP) {
      if (r.playerBoost && car.battery > 18) boost = true;
    } else if (car.gapAhead > 0 && car.gapAhead < 1 && car.battery > 35 && chance(0.7)) boost = true;
    if (boost && r.safetyCar === 'none') {
      t -= 0.38;
      car.battery = clamp(car.battery - 24, 0, 100);
    } else car.battery = clamp(car.battery + m.battery, 0, 100);
    // Air sale
    if (car.gapAhead > 0 && car.gapAhead < 1.0 && r.safetyCar === 'none') t += 0.25 * c.aeroSens;
    // Départ
    if (lap === 1) t += gauss(0, 0.55) - (st.starts - 82) * 0.03 + car.startPos * 0.04;
    // Triche : abandon imposé
    if (r.forcedDnf?.[car.driverId] === lap) {
      retire(ctx, r, car, pick(['problème moteur', 'boîte de vitesses', 'problème hydraulique', 'sortie de piste']), chance(0.5));
      continue;
    }
    // Fiabilité
    const rel = team.car.reliability;
    if (chance((100 - rel) * 0.000055 * (mode === 'attack' ? 1.3 : 1))) {
      retire(ctx, r, car, pick(['problème moteur', 'perte de pression hydraulique', 'boîte de vitesses', 'problème électrique', 'surchauffe des freins', 'fuite d’eau']), chance(0.4));
      continue;
    }
    // Erreur de pilotage
    const mistakeP = 0.0011 * (1.45 - st.consistency / 100) * m.mistake * (1 + r.weather.rain * 3) * (c.street ? 1.5 : 1) * (car.tyreWear > 80 ? 2 : 1) * (lap === 1 ? 6 : 1) * (isP ? 1 + s.player.stress / 120 : 1);
    if (r.safetyCar === 'none' && chance(mistakeP)) {
      if (chance(c.street ? 0.38 : 0.22)) {
        retire(ctx, r, car, lap === 1 ? 'accrochage au départ' : pick(['sortie de piste, voiture dans le mur', 'tête-à-queue dans le bac à graviers', 'contact avec le mur']), true);
        if (isP) radio(r, 'Toi : « Non non non… Désolé les gars. »');
        continue;
      }
      const lost = rand(2, 7);
      t += lost;
      if (chance(0.2)) car.damage = clamp(car.damage + rand(0.05, 0.2), 0, 1);
      ev(r, 'incident', `⚠️ ${lastNameOf(s, car.driverId)} part à la faute (−${lost.toFixed(1)} s).`, isP);
    }
    // Limites de piste
    if (r.safetyCar === 'none' && chance(0.002 * m.mistake)) {
      car.penalties += 5;
      ev(r, 'penalty', `⚖️ ${lastNameOf(s, car.driverId)} : 5 s de pénalité (limites de piste).`, isP);
    }
    t *= scFactor;
    car.lastLap = t;
    car.totalTime += t;
    if (r.safetyCar === 'none' && t < car.bestLap) car.bestLap = t;
  }

  // Dépassements : on traite les paires en partant de l'avant
  const alive = r.cars.filter((car) => car.status !== 'out');
  const prevOrder = order.filter((car) => car.status !== 'out');
  if (r.safetyCar === 'sc') {
    // Peloton regroupé derrière la voiture de sécurité
    prevOrder.forEach((car, i) => {
      if (i === 0) return;
      car.totalTime = Math.max(car.totalTime, prevOrder[i - 1].totalTime + 0.6);
      car.totalTime = Math.min(car.totalTime, prevOrder[i - 1].totalTime + 1.0);
    });
  } else if (lap > 1) {
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < prevOrder.length; i++) {
        const ahead = prevOrder[i - 1];
        const behind = prevOrder[i];
        if (behind.totalTime >= ahead.totalTime) continue;
        if (behind.status === 'pit' || ahead.status === 'pit') continue; // différence due aux stands : pas de duel
        const sa = statsOf(s, ahead.driverId);
        const sb = statsOf(s, behind.driverId);
        const paceDelta = ahead.lastLap - behind.lastLap; // >0 si derrière plus rapide
        let p = 0.12 + c.overtaking * 0.55 + clamp(paceDelta, -1, 2) * 0.22 + (sb.overtaking - sa.defending) / 180;
        const isPB = behind.driverId === PLAYER_ID;
        const isPA = ahead.driverId === PLAYER_ID;
        if (isPB && r.playerMode === 'attack') p += 0.1;
        if (isPA && r.playerMode === 'attack') p -= 0.06;
        // Ordres d'équipe acceptés
        if (r.teamOrder?.accepted && r.teamOrder.kind === 'letBy' && isPA && behind.driverId === r.teamOrder.target) p = 1;
        p = clamp(p, 0.04, 0.95);
        // Risque de contact
        const aggr = (isPB && r.playerMode === 'attack' ? 2.2 : 1) * (isPA && r.playerMode === 'attack' ? 1.6 : 1);
        if (chance(0.0065 * aggr * (1.4 - c.overtaking) * (r.weather.rain > 0.2 ? 2 : 1))) {
          const blamed = chance(0.55 + (sa.defending - sb.overtaking) / 200) ? behind : ahead;
          const victim = blamed === behind ? ahead : behind;
          const sev = Math.random();
          r.collisions.push({ a: behind.driverId, b: ahead.driverId, lap, blame: blamed.driverId });
          const pInv = isPA || isPB;
          if (sev < 0.25) {
            retire(ctx, r, victim, `accrochage avec ${lastNameOf(s, blamed.driverId)}`, true);
            if (chance(0.4)) retire(ctx, r, blamed, `accrochage avec ${lastNameOf(s, victim.driverId)}`, false);
            else blamed.damage = clamp(blamed.damage + 0.15, 0, 1);
          } else {
            victim.damage = clamp(victim.damage + rand(0.05, 0.2), 0, 1);
            victim.totalTime += rand(2, 8);
            ev(r, 'incident', `💥 Contact entre ${lastNameOf(s, behind.driverId)} et ${lastNameOf(s, ahead.driverId)} !`, pInv);
          }
          if (chance(0.6)) {
            const pen = chance(0.7) ? 5 : 10;
            blamed.penalties += pen;
            ev(r, 'penalty', `⚖️ ${lastNameOf(s, blamed.driverId)} jugé responsable : ${pen} s de pénalité.`, blamed.driverId === PLAYER_ID);
          }
          continue;
        }
        if (chance(p)) {
          if (!behind.dnf && !ahead.dnf) {
            ahead.totalTime = Math.max(ahead.totalTime, behind.totalTime + rand(0.2, 0.6));
            ev(r, 'overtake', `↗️ ${lastNameOf(s, behind.driverId)} dépasse ${lastNameOf(s, ahead.driverId)} pour la P${i}.`, isPA || isPB);
            if (isPB && chance(0.25)) radio(r, `Ingénieur : « Beau dépassement ! P${i}. »`);
          }
        } else {
          behind.totalTime = ahead.totalTime + rand(0.15, 0.45);
        }
      }
      prevOrder.sort((a, b) => a.totalTime - b.totalTime);
    }
  }

  // Classement & écarts
  const sorted = [...alive.filter((x) => x.status !== 'out')].sort((a, b) => a.totalTime - b.totalTime);
  sorted.forEach((car, i) => {
    car.pos = i + 1;
    car.gapAhead = i === 0 ? 0 : car.totalTime - sorted[i - 1].totalTime;
    car.positionsGained = car.startPos - car.pos;
  });
  if (sorted[0]) sorted[0].lapsLed++;
  const outs = r.cars.filter((x) => x.status === 'out');
  outs.forEach((car, i) => (car.pos = sorted.length + i + 1));

  // Meilleur tour
  for (const car of sorted) {
    if (r.safetyCar === 'none' && isFinite(car.lastLap) && (!r.fastestLap || car.lastLap < r.fastestLap.time) && lap > 2) {
      r.fastestLap = { driverId: car.driverId, time: car.lastLap };
      if (lap > r.totalLaps * 0.5) ev(r, 'fastest', `🟣 Meilleur tour pour ${lastNameOf(s, car.driverId)} (${car.lastLap.toFixed(3)} s).`, car.driverId === PLAYER_ID);
    }
  }

  // Fin de neutralisation
  if (r.safetyCar !== 'none') {
    r.scLaps--;
    if (r.scLaps <= 0) {
      ev(r, 'scEnd', r.safetyCar === 'sc' ? '🟢 La safety car rentre, relance !' : '🟢 Fin de VSC.');
      r.safetyCar = 'none';
    }
  }

  // Météo : messages
  if (prevRain < 0.2 && r.weather.rain >= 0.2) ev(r, 'rain', '🌧️ La pluie arrive, la piste devient glissante !');
  if (prevRain >= 0.2 && r.weather.rain < 0.15) ev(r, 'rain', '🌤️ La piste sèche, les pneus slicks deviennent la bonne option.');

  // Radio d'ingénieur pour le joueur
  const pc = r.cars.find((x) => x.driverId === PLAYER_ID);
  if (pc && pc.status !== 'out') {
    const want = r.weather.rain > 0.28 ? bestTyreForRain(r.weather.rain) : null;
    if (want && pc.tyre !== want && !r.pendingPit && chance(0.5)) radio(r, `Ingénieur : « La pluie s’intensifie. Box pour des ${TYRE_INFO[want].name.toLowerCase()} quand tu veux. »`);
    if (!want && (pc.tyre === 'I' || pc.tyre === 'W') && r.weather.rain < 0.15 && chance(0.5)) radio(r, 'Ingénieur : « Les temps en slicks sont meilleurs. On peut passer en sec. »');
    if (pc.tyreWear > 72 && !r.pendingPit && chance(0.35)) radio(r, `Ingénieur : « Usure des pneus à ${Math.round(pc.tyreWear)} %. Le cliff approche. »`);
    if (r.kind === 'race' && r.totalLaps - lap === 8 && !compoundsUsedOk(pc) && r.weather.rain < 0.2) radio(r, 'Ingénieur : « Attention, il te faut encore utiliser un second composé obligatoire ! »');
    if (pc.pos <= 3 && r.totalLaps - lap === 5) radio(r, `Ingénieur : « Cinq tours. P${pc.pos}. Garde la tête froide. »`);
    // Ordres d'équipe
    const mateId = teammateOf(s, PLAYER_ID);
    if (mateId && !r.teamOrder && r.kind === 'race' && lap > r.totalLaps * 0.35 && lap < r.totalLaps - 3) {
      const mate = r.cars.find((x) => x.driverId === mateId);
      const status = s.player.contract?.status ?? 'equal';
      if (mate && mate.status !== 'out' && mate.pos === pc.pos + 1 && mate.gapAhead < 1.0 && mate.lastLap < pc.lastLap - 0.15 && status !== 'first') {
        if (chance(status === 'second' ? 0.5 : 0.18)) {
          r.teamOrder = { kind: 'letBy', target: mateId, lap, answered: false };
          radio(r, `Ingénieur : « ${lastNameOf(s, mateId)} est plus rapide. Laisse-le passer, s’il te plaît. »`);
        }
      }
    }
  }

  // Arrivée
  if (lap >= r.totalLaps) finishRace(ctx, r);
}

function finishRace(ctx: RaceContext, r: RaceState) {
  r.finished = true;
  // Pénalité si un seul composé utilisé en course sèche
  if (r.kind === 'race') {
    for (const car of r.cars) {
      if (car.status !== 'out' && !compoundsUsedOk(car)) {
        car.dnf = 'disqualifié (un seul composé utilisé)';
        car.status = 'out';
        ev(r, 'penalty', `⚖️ ${lastNameOf(ctx.s, car.driverId)} disqualifié : règle des deux composés non respectée.`, car.driverId === PLAYER_ID);
      }
    }
  }
  applyRaceCheats(ctx.s, r);
  const fin = r.cars.filter((x) => x.status !== 'out').sort((a, b) => a.totalTime + a.penalties - (b.totalTime + b.penalties));
  fin.forEach((car, i) => (car.pos = i + 1));
  r.cars.filter((x) => x.status === 'out').forEach((car, i) => (car.pos = fin.length + i + 1));
  const w = fin[0];
  if (w) ev(r, 'flag', `🏁 Drapeau à damier ! Victoire de ${ctxName(ctx, w.driverId)} !`, w.driverId === PLAYER_ID);
}

function ctxName(c: RaceContext, id: string): string {
  return lastNameOf(c.s, id);
}

export function raceResults(_ctx: RaceContext, r: RaceState): RaceResultEntry[] {
  const pts = r.kind === 'sprint' ? POINTS_SPRINT : POINTS_RACE;
  const fin = [...r.cars].sort((a, b) => a.pos - b.pos);
  const winner = fin.find((x) => !x.dnf);
  const winnerTime = winner ? winner.totalTime + winner.penalties : 0;
  const leaderLap = winner ? winner.totalTime / Math.max(1, r.totalLaps) : 90;
  return fin.map((car) => {
    const finished = !car.dnf;
    const position = finished ? car.pos : 0;
    const time = car.totalTime + car.penalties;
    const gapS = time - winnerTime;
    let gap = '';
    if (!finished) gap = 'ABANDON';
    else if (car.pos === 1) gap = '';
    else if (gapS > leaderLap) gap = `+${Math.floor(gapS / leaderLap)} tour${gapS > 2 * leaderLap ? 's' : ''}`;
    else gap = `+${gapS.toFixed(3)} s`;
    return {
      driverId: car.driverId,
      teamId: car.teamId,
      position,
      grid: car.startPos,
      points: finished && position <= pts.length ? pts[position - 1] : 0,
      dnf: car.dnf,
      fastestLap: r.fastestLap?.driverId === car.driverId,
      time,
      gap,
      pits: car.pits,
    };
  });
}

/** Simule une course entière sans interaction (pour l'IA ou « simuler jusqu'à la fin »). */
export function simulateToEnd(ctx: RaceContext, r: RaceState): void {
  let guard = 0;
  while (!r.finished && guard++ < 200) {
    if (r.teamOrder && !r.teamOrder.answered) {
      r.teamOrder.answered = true;
      r.teamOrder.accepted = true;
    }
    simulateLap(ctx, r);
  }
}
