/** Interviews écrites par le joueur : questions contextuelles et analyse des réponses. */
import { OUTLETS } from '../../data/media';
import { CALENDAR } from '../../data/calendar';
import { TEAMS_BY_ID } from '../../data/teams';
import type { GameState, InterviewEffect, InterviewQuestion, PendingInterview, RaceResultEntry } from '../types';
import { PLAYER_ID } from '../types';
import { lastNameOf, nameOf, teammateOf, teamOf } from '../people';
import { pick, uid, chance } from '../rng';
import { analyze } from './nlp';
import { driverStandings } from '../standings';

export function createInterview(s: GameState, context: PendingInterview['context'], extra?: { race?: RaceResultEntry; raceId?: string; quali?: number }): PendingInterview {
  const outlet = context === 'tv' || context === 'postRace' || context === 'postQuali' ? pick(OUTLETS.filter((o) => o.tone === 'tv')) : context === 'podcast' ? OUTLETS.find((o) => o.id === 'boxbox')! : pick(OUTLETS.filter((o) => o.tone !== 'tv'));
  const qs = generateQuestions(s, context, extra);
  return { id: uid('itw'), context, outlet: outlet.name, journalist: pick(outlet.journalists), questions: qs, answers: qs.map(() => ''), done: false, day: s.day };
}

function generateQuestions(s: GameState, context: PendingInterview['context'], extra?: { race?: RaceResultEntry; raceId?: string; quali?: number }): InterviewQuestion[] {
  const teamId = teamOf(s, PLAYER_ID);
  const team = teamId ? TEAMS_BY_ID[teamId] : null;
  const mate = teammateOf(s, PLAYER_ID);
  const standings = driverStandings(s);
  const myPos = standings.findIndex((d) => d.driverId === PLAYER_ID) + 1;
  const leader = standings[0];
  const qs: InterviewQuestion[] = [];
  const circuit = extra?.raceId ? CALENDAR.find((c) => c.id === extra.raceId) : CALENDAR[s.round];
  const last = s.results[s.results.length - 1];
  const lastMe = last?.race.find((e) => e.driverId === PLAYER_ID);

  if (context === 'postRace' && extra?.race) {
    const r = extra.race;
    if (r.dnf) qs.push({ text: `You retired today (${r.dnf}). What happened from your side?`, topic: 'result' });
    else if (r.position === 1) qs.push({ text: pick(['You won! Tell us what you are feeling right now.', 'Victory! Talk us through those final laps.']), topic: 'result' });
    else if (r.position <= 3) qs.push({ text: `A podium, P${r.position}. Happy, or was there more out there?`, topic: 'result' });
    else if (r.position <= 10) qs.push({ text: `P${r.position}, some points. How would you sum up your race?`, topic: 'result' });
    else qs.push({ text: `P${r.position}, out of the points. What went wrong?`, topic: 'result' });
    const col = s.flags['lastCollision'] as string | undefined;
    if (col) {
      const [other, blame] = col.split('|');
      qs.push({ text: `The contact with ${lastNameOf(s, other)}: ${blame === PLAYER_ID ? 'the stewards found you responsible. Do you accept the decision?' : 'it looked like his fault. What would you say to him?'}`, topic: 'rival', subject: other });
    } else if (mate) {
      const mr = s.weekend?.raceResult?.find((e) => e.driverId === mate);
      if (mr) qs.push({ text: `${lastNameOf(s, mate)} finished ${mr.dnf ? 'with a DNF' : `P${mr.position}`}. How do you rate your intra-team battle?`, topic: 'teammate', subject: mate });
    }
    if (s.flags['teamOrderRefused']) qs.push({ text: 'You ignored a team order on the radio. Why?', topic: 'controversy' });
    else qs.push({ text: myPos <= 3 ? `You're P${myPos} in the championship. Can we talk about the title?` : `Next up: ${CALENDAR[s.round + 1]?.short ?? 'the end of the season'}. What are your targets?`, topic: 'championship' });
    return qs;
  }

  if (context === 'postQuali') {
    const q = extra?.quali ?? 10;
    qs.push({ text: q === 1 ? 'Pole position! How did that final lap feel?' : q <= 5 ? `P${q} on the grid. Happy with your qualifying?` : `Only P${q}. What was missing?`, topic: 'result' });
    qs.push({ text: 'What\'s the plan for tomorrow? What can we expect?', topic: 'team' });
    return qs;
  }

  // Jeudi presse / interviews longues
  qs.push({ text: `Welcome to ${circuit?.city ?? 'this Grand Prix'}. Does ${circuit?.street ? 'a street circuit' : 'this track'} suit you?`, topic: 'result' });
  if (lastMe && lastMe.dnf) qs.push({ text: 'After last weekend\'s DNF, how did you bounce back mentally?', topic: 'personal' });
  else if (lastMe && lastMe.position === 1) qs.push({ text: 'You arrive here as a race winner. Does the pressure change?', topic: 'championship' });
  if (mate && chance(0.7)) qs.push({ text: `People say the atmosphere with ${nameOf(s, mate)} is ${chance(0.5) ? 'tense' : 'great'}. What's the truth?`, topic: 'teammate', subject: mate });
  const contract = s.player.contract;
  if (contract && contract.endSeason <= s.season && chance(0.85)) qs.push({ text: `Your contract with ${team?.name} ends this season. Any talks? Other teams?`, topic: 'contract' });
  if (leader && leader.driverId !== PLAYER_ID && chance(0.5)) qs.push({ text: `${nameOf(s, leader.driverId)} leads the championship. Can he be beaten this year?`, topic: 'rival', subject: leader.driverId });
  if (chance(0.4) && team) qs.push({ text: `What do you think of ${team.principal}'s work leading the team?`, topic: 'team', subject: teamId ?? undefined });
  if (s.player.image.controversy > 40 && chance(0.6)) qs.push({ text: 'Your nights out and social posts get a lot of attention. Is that compatible with elite sport?', topic: 'lifestyle' });
  if (chance(0.35)) qs.push({ text: 'What\'s your view on the FIA\'s fines for swearing on the radio?', topic: 'regulations' });
  if (chance(0.3)) qs.push({ text: 'Any message for your growing fanbase?', topic: 'fans' });
  if (context === 'podcast') {
    qs.push({ text: 'Tell us about your childhood. How did it all start in karting?', topic: 'personal' });
    qs.push({ text: 'Who is the funniest driver in the paddock, and the most annoying on track?', topic: 'rival' });
  }
  if (context === 'feature') qs.push({ text: 'Where do you see yourself in five years?', topic: 'future' });
  return qs.slice(0, context === 'podcast' || context === 'feature' ? 4 : 3);
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
