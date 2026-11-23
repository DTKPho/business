/**
 * « Réalisation TV » de la course : moments forts, commentaires et intensité.
 * Rend la course palpitante même en simulation automatique.
 */
import type { GameState, RaceState } from '../types';
import { PLAYER_ID } from '../types';
import { lastNameOf } from '../people';
import { pick } from '../rng';

export interface Highlight {
  lap: number;
  emoji: string;
  text: string;
  weight: number; // 1..5
  player?: boolean;
}

const HYPE = ['INCROYABLE !', 'Quelle action !', 'Oh là là !', 'Mesdames et messieurs…', 'C’est chaud devant !', 'Le public est debout !', 'Énorme !'];

function n(s: GameState, id: string) {
  return id === PLAYER_ID ? s.player.lastName.toUpperCase() : lastNameOf(s, id);
}

/** Positions avant le tour (à appeler au début de simulateLap). */
export function snapshot(r: RaceState): { order: Record<string, number>; events: number; leader: string | null } {
  const order: Record<string, number> = {};
  for (const c of r.cars) order[c.driverId] = c.pos;
  const leader = r.cars.find((c) => c.pos === 1 && c.status !== 'out')?.driverId ?? null;
  return { order, events: r.events.length, leader };
}

/** Analyse le tour qui vient d'être simulé : moments forts, commentaires, intensité. */
export function broadcastLap(s: GameState, r: RaceState, before: { order: Record<string, number>; events: number; leader: string | null }) {
  r.highlights ??= [];
  r.commentary ??= [];
  r.posHistory ??= {};
  const add = (h: Highlight) => {
    r.highlights!.push(h);
    if (r.highlights!.length > 80) r.highlights!.shift();
  };
  const say = (t: string) => {
    r.commentary!.push(`T${r.lap} · ${t}`);
    if (r.commentary!.length > 40) r.commentary!.shift();
  };
  for (const c of r.cars) {
    (r.posHistory![c.driverId] ??= []).push(c.status === 'out' ? 0 : c.pos);
  }
  let heat = 0;
  const me = r.cars.find((c) => c.driverId === PLAYER_ID);
  const running = r.cars.filter((c) => c.status !== 'out').sort((a, b) => a.pos - b.pos);
  const leader = running[0]?.driverId ?? null;

  // Changement de leader
  if (leader && before.leader && leader !== before.leader && r.lap > 1) {
    const p = leader === PLAYER_ID;
    add({ lap: r.lap, emoji: '👑', text: `${n(s, leader)} prend la tête de la course devant ${n(s, before.leader)} !`, weight: 5, player: p || before.leader === PLAYER_ID });
    say(`${pick(HYPE)} ${n(s, leader)} passe en tête ! ${p ? 'Le rookie mène le Grand Prix !' : ''}`);
    heat += 5;
  }

  // Événements du tour
  for (const e of r.events.slice(before.events)) {
    const pl = !!e.involvesPlayer;
    switch (e.kind) {
      case 'overtake': {
        const m = e.text.match(/P(\d+)/);
        const pos = m ? Number(m[1]) : 20;
        const w = pl ? 4 : pos <= 3 ? 4 : pos <= 6 ? 2 : 1;
        if (w >= 2) add({ lap: r.lap, emoji: pl ? '🔥' : '↗️', text: e.text.replace(/^↗️\s*/, ''), weight: w, player: pl });
        if (w >= 3 || (pl && Math.random() < 0.8)) say(pl ? pick([`Quel dépassement de ${s.player.lastName} !`, `${s.player.lastName} met la pression et ça passe !`, `Plongée au freinage, ${s.player.lastName} gagne une place !`]) : pick([`Bataille pour le podium : ${e.text.replace(/^↗️\s*/, '')}`, `${e.text.replace(/^↗️\s*/, '')} Superbe manœuvre.`]));
        heat += w;
        break;
      }
      case 'dnf':
        add({ lap: r.lap, emoji: '💥', text: e.text.replace(/^❌\s*/, ''), weight: pl ? 5 : 3, player: pl });
        say(pl ? 'Coup dur… l’aventure s’arrête ici pour notre pilote.' : pick(['Abandon ! La course perd un acteur.', 'Fumée, voiture arrêtée… c’est fini pour lui.', 'Le drame frappe encore !']));
        heat += pl ? 5 : 3;
        break;
      case 'sc':
      case 'vsc':
        add({ lap: r.lap, emoji: '🟨', text: e.text.replace(/^🟨\s*/, ''), weight: 4 });
        say(pick(['Safety car ! Tout est relancé, les écarts sont effacés.', 'Neutralisation ! Les stratèges s’agitent dans les stands.', 'Tout peut basculer maintenant…']));
        heat += 4;
        break;
      case 'scEnd':
        add({ lap: r.lap, emoji: '🚦', text: 'Relance ! Tout le monde est collé.', weight: 4 });
        say('Le peloton est en file indienne… ATTENTION À LA RELANCE !');
        heat += 4;
        break;
      case 'rain':
        add({ lap: r.lap, emoji: '🌧️', text: e.text.replace(/^\S+\s*/, ''), weight: 3 });
        say(pick(['La météo s’en mêle ! Qui va jouer le bon coup ?', 'Les nuages changent tout…']));
        heat += 3;
        break;
      case 'penalty':
        add({ lap: r.lap, emoji: '⚖️', text: e.text.replace(/^⚖️\s*/, ''), weight: pl ? 4 : 2, player: pl });
        if (pl) say('Les commissaires ont tranché… et c’est contre nous.');
        heat += pl ? 3 : 1;
        break;
      case 'incident':
        if (pl || /Contact|💥/.test(e.text)) {
          add({ lap: r.lap, emoji: '⚠️', text: e.text.replace(/^\S+\s*/, ''), weight: pl ? 4 : 2, player: pl });
          say(pl ? 'Frayeur pour notre pilote !' : 'Ça frotte en piste !');
          heat += pl ? 3 : 2;
        }
        break;
      case 'pit':
        if (pl) say(`Arrêt aux stands pour ${s.player.lastName}… ${e.text.includes('raté') ? 'et c’est LENT !' : 'rapide et propre.'}`);
        if (e.text.includes('raté')) add({ lap: r.lap, emoji: '🐌', text: e.text.replace(/^🔧\s*/, ''), weight: pl ? 4 : 2, player: pl });
        break;
      case 'fastest':
        if (pl) add({ lap: r.lap, emoji: '🟣', text: e.text.replace(/^🟣\s*/, ''), weight: 2, player: true });
        break;
      case 'flag':
        break;
    }
  }

  // Gains / pertes de places du joueur
  if (me && me.status !== 'out' && before.order[PLAYER_ID]) {
    const delta = before.order[PLAYER_ID] - me.pos;
    if (Math.abs(delta) >= 3 && r.lap > 1) {
      add({ lap: r.lap, emoji: delta > 0 ? '🚀' : '📉', text: `${s.player.lastName} ${delta > 0 ? 'gagne' : 'perd'} ${Math.abs(delta)} places en un tour (P${me.pos}).`, weight: 4, player: true });
      heat += 3;
    }
    if (r.lap === 1) {
      const d0 = me.startPos - me.pos;
      if (d0 !== 0) {
        add({ lap: 1, emoji: d0 > 0 ? '🚀' : '😬', text: `Départ : ${s.player.lastName} ${d0 > 0 ? `gagne ${d0}` : `perd ${-d0}`} place(s), P${me.pos} après le premier tour.`, weight: Math.abs(d0) >= 2 ? 4 : 2, player: true });
        say(d0 > 0 ? 'Départ canon de notre pilote !' : 'Départ difficile, il va falloir remonter.');
      }
    }
  }

  // Batailles serrées (pour l'affichage et l'intensité)
  const battles: [string, string][] = [];
  for (let i = 1; i < running.length; i++) {
    const a = running[i - 1];
    const b = running[i];
    if (b.gapAhead > 0 && b.gapAhead < 0.6 && (i <= 3 || a.driverId === PLAYER_ID || b.driverId === PLAYER_ID)) battles.push([a.driverId, b.driverId]);
  }
  r.battles = battles;
  heat += battles.length * 1.2;
  if (me && me.status !== 'out' && (me.gapAhead < 0.8 || (running.find((c) => c.pos === me.pos + 1)?.gapAhead ?? 9) < 0.8)) heat += 1.5;

  // Final : tension croissante
  const left = r.totalLaps - r.lap;
  if (left <= 3 && left > 0) {
    heat += 3 - left + 2;
    if (left === 3) say(pick(['Trois tours ! Tout reste possible.', 'Dernières boucles, la tension est à son comble.']));
    if (left === 1) say('DERNIER TOUR !');
  }
  if (r.finished) {
    const fin = r.cars.filter((c) => !c.dnf).sort((a, b) => a.pos - b.pos);
    const [w, second] = fin;
    if (w && second) {
      const gap = second.totalTime + second.penalties - (w.totalTime + w.penalties);
      if (gap < 0.6) add({ lap: r.lap, emoji: '📸', text: `Photo-finish ! ${n(s, w.driverId)} l’emporte pour ${gap.toFixed(3)} s devant ${n(s, second.driverId)} !`, weight: 5, player: w.driverId === PLAYER_ID || second.driverId === PLAYER_ID });
      add({ lap: r.lap, emoji: '🏁', text: `Victoire de ${n(s, w.driverId)} !`, weight: w.driverId === PLAYER_ID ? 5 : 3, player: w.driverId === PLAYER_ID });
      say(w.driverId === PLAYER_ID ? `${s.player.firstName.toUpperCase()} ${s.player.lastName.toUpperCase()} GAGNE LE GRAND PRIX !!! Incroyable !` : `Drapeau à damier ! ${n(s, w.driverId)} s’impose.`);
    }
    const mine = fin.find((c) => c.driverId === PLAYER_ID);
    if (mine && mine.pos > 1 && mine.pos <= 3) add({ lap: r.lap, emoji: '🍾', text: `PODIUM pour ${s.player.lastName} (P${mine.pos}) !`, weight: 5, player: true });
  }
  if (r.safetyCar !== 'none') heat += 1;
  r.intensity = Math.max(0, Math.min(10, heat));
}

/** Les meilleurs moments de la course (résumé). */
export function topHighlights(r: { highlights?: Highlight[] }, max = 10): Highlight[] {
  const hs = r.highlights ?? [];
  const best = [...hs].sort((a, b) => b.weight + (b.player ? 1 : 0) - (a.weight + (a.player ? 1 : 0))).slice(0, max);
  return best.sort((a, b) => a.lap - b.lap);
}
