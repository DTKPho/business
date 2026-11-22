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
    if (r.dnf) qs.push({ text: `Abandon aujourd’hui (${r.dnf}). Que s’est-il passé de votre point de vue ?`, topic: 'result' });
    else if (r.position === 1) qs.push({ text: 'Victoire ! Décrivez-nous ce que vous ressentez en ce moment.', topic: 'result' });
    else if (r.position <= 3) qs.push({ text: `Un podium, P${r.position}. Satisfait, ou il y avait mieux à faire ?`, topic: 'result' });
    else if (r.position <= 10) qs.push({ text: `P${r.position}, des points. Quel bilan tirez-vous de cette course ?`, topic: 'result' });
    else qs.push({ text: `P${r.position}, hors des points. Qu’est-ce qui n’a pas fonctionné ?`, topic: 'result' });
    const col = s.flags['lastCollision'] as string | undefined;
    if (col) {
      const [other, blame] = col.split('|');
      qs.push({ text: `Le contact avec ${lastNameOf(s, other)} : ${blame === PLAYER_ID ? 'les commissaires vous ont jugé responsable. Vous acceptez la décision ?' : 'il semble être fautif. Que lui dites-vous ?'}`, topic: 'rival', subject: other });
    } else if (mate) {
      const mr = s.weekend?.raceResult?.find((e) => e.driverId === mate);
      if (mr) qs.push({ text: `${lastNameOf(s, mate)} termine ${mr.dnf ? 'en abandon' : `P${mr.position}`}. Comment jugez-vous votre duel interne ?`, topic: 'teammate', subject: mate });
    }
    if (s.flags['teamOrderRefused']) qs.push({ text: 'Vous avez ignoré une consigne d’équipe à la radio. Pourquoi ?', topic: 'controversy' });
    else qs.push({ text: myPos <= 3 ? `Vous êtes P${myPos} au championnat. On peut parler de titre ?` : `Prochaine étape : ${CALENDAR[s.round + 1]?.short ?? 'la fin de saison'}. Quels objectifs ?`, topic: 'championship' });
    return qs;
  }

  if (context === 'postQuali') {
    const q = extra?.quali ?? 10;
    qs.push({ text: q === 1 ? 'La pole position ! Comment était ce dernier tour ?' : q <= 5 ? `P${q} sur la grille. Content de votre qualif ?` : `P${q} seulement. Que vous a-t-il manqué ?`, topic: 'result' });
    qs.push({ text: 'Quelle stratégie pour demain ? On peut s’attendre à quoi ?', topic: 'team' });
    return qs;
  }

  // Jeudi presse / interviews longues
  qs.push({ text: `Bienvenue à ${circuit?.city ?? 'ce Grand Prix'}. ${circuit?.street ? 'Un circuit urbain' : 'Un circuit'} qui vous convient ?`, topic: 'result' });
  if (lastMe && lastMe.dnf) qs.push({ text: 'Après votre abandon du week-end dernier, comment avez-vous rebondi mentalement ?', topic: 'personal' });
  else if (lastMe && lastMe.position === 1) qs.push({ text: 'Vous arrivez en vainqueur. Est-ce que la pression change ?', topic: 'championship' });
  if (mate && chance(0.7)) qs.push({ text: `On dit que l’ambiance avec ${nameOf(s, mate)} est ${chance(0.5) ? 'tendue' : 'excellente'}. Qu’en est-il vraiment ?`, topic: 'teammate', subject: mate });
  const contract = s.player.contract;
  if (contract && contract.endSeason <= s.season && chance(0.85)) qs.push({ text: `Votre contrat avec ${team?.name} expire en fin de saison. Discussions en cours ? D’autres équipes ?`, topic: 'contract' });
  if (leader && leader.driverId !== PLAYER_ID && chance(0.5)) qs.push({ text: `${nameOf(s, leader.driverId)} mène le championnat. Est-il battable cette saison ?`, topic: 'rival', subject: leader.driverId });
  if (chance(0.4) && team) qs.push({ text: `Que pensez-vous du travail de ${team.principal} à la tête de l’équipe ?`, topic: 'team', subject: teamId ?? undefined });
  if (s.player.image.controversy > 40 && chance(0.6)) qs.push({ text: 'Vos sorties nocturnes et vos posts font beaucoup parler. Est-ce compatible avec le haut niveau ?', topic: 'lifestyle' });
  if (chance(0.35)) qs.push({ text: 'Que pensez-vous des sanctions de la FIA sur les jurons à la radio ?', topic: 'regulations' });
  if (chance(0.3)) qs.push({ text: 'Un message pour vos fans, de plus en plus nombreux ?', topic: 'fans' });
  if (context === 'podcast') {
    qs.push({ text: 'Raconte-nous ton enfance, comment tout a commencé en karting ?', topic: 'personal' });
    qs.push({ text: 'Qui est le pilote le plus drôle du paddock, et le plus pénible en piste ?', topic: 'rival' });
  }
  if (context === 'feature') qs.push({ text: 'Où vous voyez-vous dans cinq ans ?', topic: 'future' });
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
    humble: [`${name}, la tête froide : « Tout le mérite revient à l’équipe »`, `${name} reste humble et concentré`],
    arrogant: [`${name} affiche une confiance XXL`, `« Je suis le plus rapide » : ${name} met la pression`, `${name} fait parler son ego`],
    blame: [`${name} tacle ${teamName} en public`, `Malaise chez ${teamName} : ${name} critique son équipe`, `${name} ne mâche pas ses mots contre ses ingénieurs`],
    funny: [`${name}, l’humour comme arme fatale`, `Le paddock hilare après la conférence de ${name}`],
    bland: [`${name} reste prudent face à la presse`, `${name} : langue de bois et concentration`],
    loyal: [`${name} jure fidélité à ${teamName}`, `${name} veut écrire son histoire avec ${teamName}`],
    leaving: [`${name} ouvre la porte à un départ !`, `Mercato : ${name} écoute les offres`, `${teamName} sous pression : ${name} laisse planer le doute`],
    angry: [`${name} explose face aux micros`, `Coup de sang de ${name} en zone mixte`],
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
