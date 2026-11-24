/** Interviews écrites par le joueur : questions contextuelles et analyse des réponses. */
import { OUTLETS } from '../../data/media';
import { TEAMS_BY_ID } from '../../data/teams';
import type { GameState, InterviewEffect, PendingInterview, RaceResultEntry } from '../types';
import { PLAYER_ID } from '../types';
import { lastNameOf, teammateOf, teamOf } from '../people';
import { pick, uid } from '../rng';
import { analyze } from './nlp';
import { pickQuestions } from './questions';

export function createInterview(s: GameState, context: PendingInterview['context'], extra?: { race?: RaceResultEntry; raceId?: string; quali?: number }): PendingInterview {
  const outlet =
    context === 'tv'
      ? pick(OUTLETS.filter((o) => o.tone === 'tv'))
      : context === 'podcast'
        ? OUTLETS.find((o) => o.id === 'boxbox')!
        : context === 'postRace' || context === 'postQuali'
          ? pick(OUTLETS)
          : pick(OUTLETS.filter((o) => o.tone !== 'tv'));
  const qs = pickQuestions(s, context, outlet.tone, extra);
  return { id: uid('itw'), context, outlet: outlet.name, journalist: pick(outlet.journalists), questions: qs, answers: qs.map(() => ''), done: false, day: s.day };
}

/** Analyse locale des réponses du joueur et calcul de leurs conséquences. */
export function evaluateInterview(s: GameState, itw: PendingInterview): InterviewEffect & {
  rel: Record<string, { friendship?: number; respect?: number; rivalry?: number }>;
  teamTrust: number;
  likeability: number;
  professionalism: number;
  controversy: number;
  followers: number;
  morale: number;
} {
  let teamTrust = 0;
  let likeability = 0;
  let professionalism = 0;
  let controversy = 0;
  let followersMul = 0;
  const rel: Record<string, { friendship?: number; respect?: number; rivalry?: number }> = {};
  const quotes: string[] = [];
  const mate = teammateOf(s, PLAYER_ID);
  const prMitigation = s.player.staff.some((m) => m.role === 'pr') ? 0.7 : 1;
  type Angle = 'humble' | 'arrogant' | 'blame' | 'funny' | 'bland' | 'loyal' | 'leaving' | 'angry';
  const st = { angle: 'bland' as Angle };
  let angleScore = 0;
  const setAngle = (a: Angle, sc: number) => {
    if (sc > angleScore) {
      st.angle = a;
      angleScore = sc;
    }
  };

  itw.questions.forEach((q, i) => {
    const ans = itw.answers[i] ?? '';
    const a = analyze(ans);
    const sc = a.scores;
    if (a.isEmpty || a.words < 3) {
      professionalism -= 2;
      likeability -= 1;
      setAngle('bland', 1);
      return;
    }
    if (a.words > 12) quotes.push(ans.trim().split(/(?<=[.!?])\s/)[0].slice(0, 140));
    // Humilité & équipe
    if (sc.humble) {
      teamTrust += 2 * sc.humble;
      likeability += 1.5 * sc.humble;
      professionalism += 1;
      setAngle('humble', sc.humble * 2);
    }
    if (sc.arrogant) {
      likeability -= 2 * sc.arrogant;
      controversy += 3 * sc.arrogant * prMitigation;
      followersMul += 0.004 * sc.arrogant;
      setAngle('arrogant', sc.arrogant * 3);
    }
    if (sc.blameTeam) {
      teamTrust -= 5 * sc.blameTeam * prMitigation;
      controversy += 3 * sc.blameTeam;
      professionalism -= 2;
      setAngle('blame', sc.blameTeam * 4);
    }
    if (sc.vulgar) {
      professionalism -= 4 * sc.vulgar;
      controversy += 4 * sc.vulgar;
      setAngle('angry', sc.vulgar * 4);
    }
    if (sc.humor) {
      likeability += 2;
      followersMul += 0.003;
      setAngle('funny', sc.humor * 2);
    }
    if (sc.apology) {
      likeability += 2;
      professionalism += 2;
    }
    if (q.topic === 'contract') {
      if (sc.loyalty) {
        teamTrust += 4;
        setAngle('loyal', 3);
      }
      if (sc.leaving) {
        teamTrust -= 5;
        controversy += 3;
        followersMul += 0.003;
        setAngle('leaving', 5);
      }
    }
    if (q.topic === 'team' && a.sentiment > 0.2) teamTrust += 2;
    if (q.topic === 'team' && a.sentiment < -0.2) teamTrust -= 4;
    // Mentions de pilotes
    const targets = new Set([...a.mentionsDrivers, ...(q.subject && q.topic !== 'team' ? [q.subject] : [])]);
    for (const d of targets) {
      if (d === PLAYER_ID || !s.drivers[d]) continue;
      const r = (rel[d] ??= {});
      if (sc.blameOther > 0 || sc.taunt > 0 || (a.sentiment < -0.3 && a.mentionsDrivers.includes(d))) {
        r.friendship = (r.friendship ?? 0) - 8;
        r.rivalry = (r.rivalry ?? 0) + 8;
        controversy += 2;
        if (d === mate) teamTrust -= 3;
      } else if (a.sentiment > 0.2 || sc.compliment > 0) {
        r.friendship = (r.friendship ?? 0) + 4;
        r.respect = (r.respect ?? 0) + 2;
        likeability += 1;
      }
    }
    if (a.words > 25) professionalism += 1;
    if (a.exclamations > 3 || a.caps > 0.5) controversy += 1;
  });

  const rest = { teamTrust, likeability, professionalism, controversy, followers: followersMul, morale: st.angle === 'angry' ? 3 : 0 };
  const name = `${s.player.firstName} ${s.player.lastName}`;
  const team = teamOf(s, PLAYER_ID);
  const teamName = team ? TEAMS_BY_ID[team].name : '';
  const q0 = quotes[0] ? `« ${quotes[0]} »` : '';
  const angle = st.angle;
  const headlines: Record<Angle, string[]> = {
    humble: [`${name} keeps calm: "All credit goes to the team"`, `${name} stays humble and focused`],
    arrogant: [`${name} oozes confidence`, `"I'm the fastest": ${name} turns up the heat`, `${name}'s ego takes centre stage`],
    blame: [`${name} hits out at ${teamName} in public`, `Tension at ${teamName}: ${name} criticises his team`, `${name} doesn't hold back on his engineers`],
    funny: [`${name}, humour as a weapon`, `Paddock in stitches after ${name}'s press conference`],
    bland: [`${name} plays it safe with the media`, `${name}: straight bat, full focus`],
    loyal: [`${name} pledges loyalty to ${teamName}`, `${name} wants to write his story with ${teamName}`],
    leaving: [`${name} opens the door to a move!`, `Silly season: ${name} is listening to offers`, `${teamName} under pressure as ${name} keeps options open`],
    angry: [`${name} explodes in front of the microphones`, `${name} loses his cool in the media pen`],
  };
  const headline = pick(headlines[angle]);
  const summaries: Record<Angle, string> = {
    humble: 'Discours humble et collectif, apprécié par l’équipe et le public.',
    arrogant: 'Ton jugé arrogant : buzz garanti, mais une partie du paddock grince des dents.',
    blame: 'Critiques publiques envers l’équipe : la confiance en interne en prend un coup.',
    funny: 'Ton léger et drôle : les fans adorent.',
    bland: 'Réponses courtes et prudentes, sans relief.',
    loyal: 'Message de loyauté envers l’équipe, bien reçu en interne.',
    leaving: 'Vous avez ouvert la porte à un départ : les rumeurs de mercato s’enflamment.',
    angry: 'Langage fleuri et colère visible : la presse s’en délecte.',
  };
  const deltas = [
    { label: 'Confiance équipe', value: Math.round(teamTrust) },
    { label: 'Sympathie du public', value: Math.round(likeability) },
    { label: 'Professionnalisme', value: Math.round(professionalism) },
    { label: 'Polémique', value: Math.round(controversy) },
  ].filter((d) => d.value !== 0);
  for (const [d, r] of Object.entries(rel)) {
    if (r.friendship) deltas.push({ label: `Relation avec ${lastNameOf(s, d)}`, value: Math.round(r.friendship) });
  }
  return { ...rest, rel, summary: summaries[angle] + (q0 ? ` Citation retenue : ${q0}` : ''), headline, deltas };
}
