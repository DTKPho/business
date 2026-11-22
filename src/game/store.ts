import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CALENDAR, raceDate } from '../data/calendar';
import { DRIVERS_BY_ID } from '../data/drivers';
import { ACTIVITIES_BY_ID, ASSETS_BY_ID, BRANDS_BY_ID, BUSINESSES_BY_ID, INVESTMENTS_BY_ID, RESIDENCES_BY_ID, STAFF_FIRST, STAFF_LAST, STAFF_ROLES } from '../data/lifestyle';
import { TEAMS_BY_ID } from '../data/teams';
import type {
  ContractOffer,
  GameState,
  InterviewEffect,
  PaceMode,
  PendingInterview,
  PhoneApp,
  QualiEntry,
  ResidenceId,
  Screen,
  SetupValues,
  SocialPost,
  StaffRole,
  TeamState,
  TyreCompound,
  WeekendResult,
  WeekendState,
  Settings,
} from './types';
import { PLAYER_ID } from './types';
import { createGame, daysUntilWeekend, SAVE_VERSION, type NewPlayerInput } from './init';
import { addDays } from './format';
import { chance, clamp, pick, rand, uid } from './rng';
import { lastNameOf, teamOf, teammateOf } from './people';
import { optimalSetup, setupFeedback, setupQuality, TYRE_INFO } from './sim/pace';
import { runQualifying, runSprintQuali, type QualiRisk } from './sim/qualifying';
import { initRace, raceResults, simulateLap, type RaceContext } from './sim/race';
import {
  addFollowers,
  applyRel,
  changeImage,
  changeTrust,
  dailyTick,
  emergencyOffers,
  finalizeSeason,
  gainXp,
  log,
  playerRating,
  postRace,
  pushDM,
  pushGroup,
  pushMail,
  startNextSeason,
} from './career/season';
import { buildOffer, negotiate as negotiateOffer, offerToContract, type CounterProposal } from './career/contracts';
import { createInterview, evaluateInterview } from './social/interview';
import { analyze, detectActivity, detectIntent, detectIntents } from './social/nlp';
import { inviteAcceptance, localReply } from './social/voice';
import { groupReplyTo } from './social/group';
import { claudeAvailable, claudeDriverReply, claudeEvaluateInterview, claudeGroupReplies } from './social/claude';
import { fanComments, makePost, news } from './social/press';
import { driverStandings } from './standings';

export interface UIState {
  screen: Screen;
  phoneApp: PhoneApp;
  openConversation: string | null;
  lastInterview: (InterviewEffect & { id: string }) | null;
  toast: { text: string; tone: 'good' | 'bad' | 'info' } | null;
  seasonReport: string[] | null;
  typing: Record<string, boolean>;
}

interface Store {
  game: GameState | null;
  ui: UIState;
  // général
  newGame: (input: NewPlayerInput) => void;
  resetGame: () => void;
  importSave: (json: string) => boolean;
  setScreen: (s: Screen) => void;
  setPhoneApp: (a: PhoneApp, conv?: string | null) => void;
  toast: (text: string, tone?: 'good' | 'bad' | 'info') => void;
  clearToast: () => void;
  updateSettings: (fn: (s: Settings) => void) => void;
  // temps libre
  doActivity: (activityId: string, guestId?: string | null) => string;
  restDay: () => void;
  skipToWeekend: () => void;
  // week-end
  startWeekend: () => void;
  advanceStage: () => void;
  setSetup: (v: SetupValues) => void;
  runPractice: (program: 'quali' | 'long' | 'aero') => void;
  runQuali: (risks: QualiRisk[]) => void;
  startRace: (startTyre: TyreCompound, plan: TyreCompound[]) => void;
  raceTick: () => void;
  raceToEnd: () => void;
  setPaceMode: (m: PaceMode) => void;
  setBoost: (b: boolean) => void;
  requestPit: (c: TyreCompound | null) => void;
  answerTeamOrder: (accept: boolean) => void;
  completeRaceSession: () => void;
  endWeekend: () => void;
  // presse
  submitInterview: (id: string, answers: string[]) => Promise<void>;
  skipInterview: (id: string) => void;
  requestInterview: (kind: PendingInterview['context']) => void;
  clearLastInterview: () => void;
  // téléphone
  sendDM: (convId: string, text: string) => Promise<void>;
  sendGroup: (text: string) => Promise<void>;
  markConversationRead: (id: string) => void;
  markGroupRead: () => void;
  readMail: (id: string) => void;
  resolveMail: (id: string, accept: boolean) => void;
  createPost: (kind: SocialPost['kind'], text: string) => void;
  likePost: (id: string) => void;
  // carrière
  negotiate: (offerId: string, ask: CounterProposal, pitch: string) => string;
  acceptOffer: (offerId: string) => void;
  rejectOffer: (offerId: string) => void;
  setDevFocus: (f: TeamState['devFocus']) => void;
  requestTeamMeeting: (topic: 'status' | 'car' | 'contract') => void;
  // style de vie
  buyAsset: (id: string) => void;
  sellAsset: (index: number) => void;
  setResidence: (r: ResidenceId) => void;
  hireStaff: (role: StaffRole, level: number) => void;
  fireStaff: (id: string) => void;
  buyBusiness: (id: string) => void;
  upgradeBusiness: (id: string) => void;
  invest: (id: string, amount: number) => void;
  withdraw: (id: string) => void;
  createFoundation: (name: string) => void;
  donate: (amount: number) => void;
  // saison
  nextSeason: () => void;
  clearSeasonReport: () => void;
}

const initialUI: UIState = { screen: 'home', phoneApp: 'messages', openConversation: null, lastInterview: null, toast: null, seasonReport: null, typing: {} };

function clone<T>(v: T): T {
  return structuredClone(v);
}

export const useGame = create<Store>()(
  persist(
    (set, get) => {
      const mutate = (fn: (g: GameState) => void) => {
        const g0 = get().game;
        if (!g0) return;
        const g = clone(g0);
        fn(g);
        set({ game: g });
      };
      const raceCtx = (g: GameState): RaceContext => {
        const w = g.weekend!;
        return { s: g, c: CALENDAR.find((x) => x.id === w.raceId)!, playerSetup: w.setupConfidence, raceId: w.raceId };
      };
      const advanceDate = (g: GameState, days = 1) => {
        for (let i = 0; i < days; i++) {
          g.date = addDays(g.date, 1);
          g.day++;
          dailyTick(g);
        }
        g.actionsLeft = daysUntilWeekend(g);
      };

      return {
        game: null,
        ui: initialUI,

        newGame: (input) => set({ game: createGame(input), ui: { ...initialUI } }),
        resetGame: () => set({ game: null, ui: { ...initialUI } }),
        importSave: (json) => {
          try {
            const g = JSON.parse(json) as GameState;
            if (!g.player || !g.drivers) return false;
            set({ game: g, ui: { ...initialUI } });
            return true;
          } catch {
            return false;
          }
        },
        setScreen: (screen) => set((st) => ({ ui: { ...st.ui, screen } })),
        setPhoneApp: (phoneApp, conv) => set((st) => ({ ui: { ...st.ui, screen: 'phone', phoneApp, openConversation: conv === undefined ? st.ui.openConversation : conv } })),
        toast: (text, tone = 'info') => set((st) => ({ ui: { ...st.ui, toast: { text, tone } } })),
        clearToast: () => set((st) => ({ ui: { ...st.ui, toast: null } })),
        updateSettings: (fn) => mutate((g) => fn(g.settings)),

        // ─────────── Temps libre ───────────
        doActivity: (activityId, guestId) => {
          const act = ACTIVITIES_BY_ID[activityId];
          let result = '';
          mutate((g) => {
            const p = g.player;
            if (g.actionsLeft <= 0 || g.weekend) {
              result = 'Plus de jour disponible avant le Grand Prix.';
              return;
            }
            const owns = act.requiresAsset && p.assets.some((a) => a.id === act.requiresAsset);
            const cost = owns ? Math.round(act.cost * 0.2) : act.cost;
            if (p.money < cost) {
              result = 'Pas assez d’argent.';
              return;
            }
            if (p.energy + act.energy < 0) {
              result = 'Trop fatigué pour ça. Repose-toi.';
              return;
            }
            p.money -= cost;
            p.energy = clamp(p.energy + act.energy, 0, 100);
            p.morale = clamp(p.morale + act.morale, 0, 100);
            p.stress = clamp(p.stress + act.stress, 0, 100);
            for (const [k, v] of Object.entries(act.stats ?? {})) gainXp(g, k as keyof typeof p.stats, v as number);
            if (act.followers) addFollowers(g, p.followers * act.followers * rand(0.6, 1.4));
            if (act.image) changeImage(g, act.image);
            const lines: string[] = [`${act.emoji} ${act.name}`];
            if (activityId === 'sim' || activityId === 'debrief' || activityId === 'teamFactory') {
              changeTrust(g, activityId === 'teamFactory' ? 3 : 1.5);
              const t = teamOf(g, PLAYER_ID);
              if (t) g.teams[t].car.devPoints += activityId === 'sim' ? 0.4 : 0.2;
            }
            if (activityId === 'sponsorEvent') {
              const sp = p.sponsors.find((x) => x.done < x.obligations);
              if (sp) {
                sp.done++;
                lines.push(`Obligation remplie pour ${BRANDS_BY_ID[sp.brandId].name} (${sp.done}/${sp.obligations}).`);
              }
              changeTrust(g, 1);
            }
            if (activityId === 'gt3' || activityId === 'ski') {
              changeTrust(g, -2);
              if (chance(0.06)) {
                p.energy = clamp(p.energy - 30, 0, 100);
                lines.push('Petite blessure… l’équipe n’est pas ravie.');
                changeTrust(g, -5);
              }
            }
            if (activityId === 'party' && chance(0.3)) {
              changeImage(g, { controversy: 6, professionalism: -3 });
              g.news.unshift(news(g, 'player', `${p.firstName} ${p.lastName} aperçu à 4h du matin en sortie de club`, 'Les photos font le tour des réseaux. Son équipe appréciera…', 'Pitlane Daily'));
              changeTrust(g, -3);
              lines.push('Des paparazzis t’ont photographié à la sortie…');
            }
            if (activityId === 'poker') {
              const gain = Math.round(rand(-40_000, 50_000));
              p.money += gain;
              lines.push(gain >= 0 ? `Tu repars avec +${gain.toLocaleString('fr-FR')} €.` : `Tu perds ${(-gain).toLocaleString('fr-FR')} €.`);
            }
            if (activityId === 'charity' && p.foundation) {
              p.foundation.funds += 50_000;
              lines.push('Ta fondation récolte 50 000 € de dons.');
            }
            if (activityId === 'family' && p.partner) p.partner.affection = clamp(p.partner.affection + 10, 0, 100);
            if (activityId === 'stream' && chance(0.12)) {
              changeImage(g, { controversy: 5 });
              lines.push('Un extrait de ton stream fait polémique (tu as critiqué un pilote en direct).');
            }
            // Invité
            if (guestId && DRIVERS_BY_ID[guestId] && act.invite) {
              const d = g.drivers[guestId];
              const invitedByThem = String(g.flags[`invite:${guestId}`] ?? '').startsWith(activityId);
              const ok = invitedByThem || chance(inviteAcceptance(g, guestId, activityId));
              if (ok) {
                const likes = DRIVERS_BY_ID[guestId].persona.likes.includes(activityId);
                applyRel(g, guestId, { friendship: likes ? rand(7, 12) : rand(3, 7), respect: 1, rivalry: -1 });
                lines.push(`${DRIVERS_BY_ID[guestId].firstName} t’accompagne${likes ? ' et adore ça' : ''}. Votre amitié progresse.`);
                p.morale = clamp(p.morale + 3, 0, 100);
                if (chance(0.5)) {
                  const post = makePost(g, guestId, 'lifestyle', `${act.emoji} avec ${p.firstName} ${DRIVERS_BY_ID[guestId].persona.emojis[0] ?? ''}`, p.followers * 0.06 + 200_000);
                  post.comments = fanComments(g, post, 0.6);
                  g.feed.unshift(post);
                  addFollowers(g, p.followers * 0.01);
                }
                delete g.flags[`invite:${guestId}`];
              } else {
                lines.push(`${DRIVERS_BY_ID[guestId].firstName} a décliné l’invitation.`);
                pushDM(g, guestId, localReply(g, guestId, 'invite', act.name, null).text.replace(/^(.*)$/, '$1'));
                applyRel(g, guestId, { friendship: 0 });
                d.lastMessageDay = g.day;
              }
            }
            log(g, lines.join(' '), 'info');
            result = lines.join('\n');
            advanceDate(g, activityId === 'vacation' ? Math.min(3, g.actionsLeft) : 1);
          });
          return result;
        },
        restDay: () =>
          mutate((g) => {
            if (g.actionsLeft <= 0) return;
            g.player.energy = clamp(g.player.energy + 12, 0, 100);
            g.player.stress = clamp(g.player.stress - 4, 0, 100);
            advanceDate(g, 1);
          }),
        skipToWeekend: () =>
          mutate((g) => {
            const n = g.actionsLeft;
            for (let i = 0; i < n; i++) {
              g.player.energy = clamp(g.player.energy + 8, 0, 100);
              g.player.stress = clamp(g.player.stress - 3, 0, 100);
            }
            advanceDate(g, n);
          }),

        // ─────────── Week-end ───────────
        startWeekend: () =>
          mutate((g) => {
            if (g.weekend || g.round >= 24) return;
            const c = CALENDAR[g.round];
            const rainy = (p: number) => (chance(p) ? rand(0.25, 0.85) : 0);
            const rain = { fp: rainy(c.rainChance), quali: rainy(c.rainChance), sprint: rainy(c.rainChance), race: rainy(c.rainChance * 1.1) };
            const stages: WeekendState['stages'] = c.sprint ? ['media', 'fp', 'sprintQuali', 'sprint', 'quali', 'race', 'post'] : ['media', 'fp', 'quali', 'race', 'post'];
            const itw = createInterview(g, 'thursday');
            g.interviews.unshift(itw);
            const pitlane = g.flags['banned'] === g.round;
            g.weekend = {
              raceId: c.id,
              round: g.round,
              stage: 'media',
              stageIndex: 0,
              stages,
              setup: { frontWing: 50, rearWing: 50, suspension: 50, rideHeight: 50, brakeBias: 55 },
              optimal: optimalSetup(c, `${c.id}-${g.season}-${teamOf(g, PLAYER_ID)}`),
              runs: [],
              runsLeft: c.sprint ? 2 : 3,
              setupConfidence: 0.45 + g.player.stats.feedback / 500,
              quali: null,
              sprintQuali: null,
              sprintResult: null,
              race: null,
              raceResult: null,
              weatherForecast: [rain.fp, rain.quali, rain.race].map((r) => clamp(r > 0 ? r * 0.8 + rand(0, 0.3) : rand(0, c.rainChance), 0, 1)),
              interviewsDone: [],
              strategyPlan: [],
              notes: [],
              rain,
              teamOrderAnswer: null,
              collisions: [],
              pitlaneStart: pitlane,
            };
            g.date = addDays(raceDate(g.season, g.round), -3);
            g.phase = 'weekend';
            log(g, `🏁 Week-end du ${c.name} : bienvenue à ${c.city} !`, 'info');
          }),
        advanceStage: () =>
          mutate((g) => {
            const w = g.weekend;
            if (!w) return;
            if (w.stageIndex < w.stages.length - 1) {
              w.stageIndex++;
              w.stage = w.stages[w.stageIndex];
              const off: Record<string, number> = { fp: -2, sprintQuali: -2, sprint: -1, quali: -1, race: 0, post: 0, media: -3 };
              g.date = addDays(raceDate(g.season, g.round), off[w.stage] ?? 0);
            }
          }),
        setSetup: (v) => mutate((g) => g.weekend && (g.weekend.setup = v)),
        runPractice: (program) =>
          mutate((g) => {
            const w = g.weekend;
            if (!w || w.runsLeft <= 0) return;
            const c = CALENDAR.find((x) => x.id === w.raceId)!;
            const q = setupQuality(w.setup, w.optimal);
            const team = TEAMS_BY_ID[teamOf(g, PLAYER_ID)!];
            const lap = c.baseLap * (1 + (1 - q) * 0.01 + (program === 'long' ? 0.025 : program === 'aero' ? 0.015 : 0) + rand(-0.002, 0.002) + w.rain.fp * 0.1);
            const fb = setupFeedback(w.setup, w.optimal, g.player.stats.feedback + (program === 'aero' ? 12 : 0), team.engineerName);
            if (program === 'long') fb.push(`🛞 Long run : dégradation ${c.tyreStress > 0.65 ? 'élevée, prévoir 2 arrêts' : c.tyreStress > 0.45 ? 'modérée, 1 arrêt possible' : 'faible, 1 arrêt facile'}.`);
            if (program === 'quali') fb.push(`⏱️ Simulation de qualif : ${q > 0.85 ? 'la voiture est affûtée.' : q > 0.65 ? 'il reste du temps à trouver.' : 'on est loin du compte.'}`);
            w.runs.push({ setup: { ...w.setup }, program, lapTime: lap, feedback: fb, quality: q });
            w.runsLeft--;
            w.setupConfidence = Math.max(w.setupConfidence * 0.5 + q * 0.5, q);
            gainXp(g, 'feedback', 0.4);
            g.player.energy = clamp(g.player.energy - 4, 0, 100);
          }),
        runQuali: (risks) =>
          mutate((g) => {
            const w = g.weekend;
            if (!w) return;
            const c = CALENDAR.find((x) => x.id === w.raceId)!;
            if (w.stage === 'sprintQuali') {
              const r = runSprintQuali(g, c, w.rain.quali, w.setupConfidence, risks[0] ?? 'normal', w.raceId);
              w.sprintQuali = r.entries;
              w.notes.push(...r.notes.map((n) => `SQ — ${n}`));
            } else {
              const r = runQualifying(g, c, w.rain.quali, w.setupConfidence, risks, w.raceId);
              let entries = r.entries;
              if (w.pitlaneStart) {
                const me = entries.find((e) => e.driverId === PLAYER_ID);
                if (me) {
                  entries = [...entries.filter((e) => e.driverId !== PLAYER_ID), me];
                  entries.forEach((e, i) => (e.position = i + 1));
                  w.notes.push('Sanction : vous partirez de la voie des stands.');
                }
              }
              w.quali = entries;
              w.notes.push(...r.notes);
              const me = entries.find((e) => e.driverId === PLAYER_ID);
              if (me?.position === 1) {
                log(g, '🟣 POLE POSITION !', 'good');
                addFollowers(g, g.player.followers * 0.02);
                g.player.morale = clamp(g.player.morale + 6, 0, 100);
              }
              const itw = createInterview(g, 'postQuali', { quali: me?.position });
              g.interviews.unshift(itw);
            }
          }),
        startRace: (startTyre, plan) =>
          mutate((g) => {
            const w = g.weekend;
            if (!w) return;
            const ctx = raceCtx(g);
            const kind = w.stage === 'sprint' ? 'sprint' : 'race';
            const grid: QualiEntry[] = (kind === 'sprint' ? w.sprintQuali : w.quali) ?? [];
            w.race = initRace(ctx, grid, kind, kind === 'sprint' ? w.rain.sprint : w.rain.race, startTyre, plan);
            w.strategyPlan = plan;
          }),
        raceTick: () => {
          const g = get().game;
          if (!g?.weekend?.race || g.weekend.race.finished) return;
          // Clone léger : on ne copie que la course
          const r = clone(g.weekend.race);
          const shallow: GameState = { ...g, weekend: { ...g.weekend, race: r } };
          if (r.teamOrder && !r.teamOrder.answered && r.lap - r.teamOrder.lap > 2) {
            r.teamOrder.answered = true;
            r.teamOrder.accepted = false;
          }
          simulateLap(raceCtx(shallow), r);
          set({ game: shallow });
        },
        raceToEnd: () => {
          const g = get().game;
          if (!g?.weekend?.race) return;
          const r = clone(g.weekend.race);
          const shallow: GameState = { ...g, weekend: { ...g.weekend, race: r } };
          let guard = 0;
          while (!r.finished && guard++ < 200) {
            if (r.teamOrder && !r.teamOrder.answered) {
              r.teamOrder.answered = true;
              r.teamOrder.accepted = true;
            }
            // Le joueur gère ses pneus automatiquement si nécessaire
            const me = r.cars.find((c) => c.driverId === PLAYER_ID);
            if (me && me.status !== 'out' && !r.pendingPit) {
              const lapsLeft = r.totalLaps - r.lap;
              const dryUsed = new Set(me.usedCompounds.filter((t) => 'SMH'.includes(t))).size;
              if (me.tyreAge < 3) {
                /* vient de changer de pneus */
              } else if (r.weather.rain > 0.28 && (me.tyre === 'S' || me.tyre === 'M' || me.tyre === 'H')) r.pendingPit = r.weather.rain > 0.68 ? 'W' : 'I';
              else if (r.weather.rain < 0.12 && (me.tyre === 'I' || me.tyre === 'W')) r.pendingPit = lapsLeft > 25 ? 'M' : 'S';
              else if (r.kind === 'race' && lapsLeft > 2 && (me.tyreWear > 75 || (dryUsed < 2 && lapsLeft < 6 && !me.usedCompounds.some((t) => t === 'I' || t === 'W')))) {
                const plan = shallow.weekend!.strategyPlan[me.pits] ?? (lapsLeft > 30 ? 'H' : lapsLeft > 15 ? 'M' : 'S');
                r.pendingPit = plan === me.tyre && dryUsed < 2 ? (plan === 'H' ? 'M' : 'H') : plan;
              }
            }
            simulateLap(raceCtx(shallow), r);
          }
          set({ game: shallow });
        },
        setPaceMode: (m) => mutate((g) => g.weekend?.race && (g.weekend.race.playerMode = m)),
        setBoost: (b) => mutate((g) => g.weekend?.race && (g.weekend.race.playerBoost = b)),
        requestPit: (c) => mutate((g) => g.weekend?.race && (g.weekend.race.pendingPit = c)),
        answerTeamOrder: (accept) =>
          mutate((g) => {
            const r = g.weekend?.race;
            if (!r?.teamOrder) return;
            r.teamOrder.answered = true;
            r.teamOrder.accepted = accept;
            r.radio.push(`T${r.lap} — Toi : « ${accept ? 'Compris, je le laisse passer.' : 'Négatif. Je suis plus rapide, laissez-nous nous battre.'} »`);
            g.weekend!.teamOrderAnswer = accept ? 'accepted' : 'refused';
          }),
        completeRaceSession: () =>
          mutate((g) => {
            const w = g.weekend;
            if (!w?.race?.finished) return;
            const ctx = raceCtx(g);
            const res = raceResults(ctx, w.race);
            w.collisions.push(...w.race.collisions);
            if (w.race.kind === 'sprint') {
              w.sprintResult = res;
              const me = res.find((e) => e.driverId === PLAYER_ID);
              if (me) log(g, `Sprint : ${me.dnf ? 'abandon' : `P${me.position}`} (${me.points} pts)`, me.points ? 'good' : 'neutral');
              g.player.energy = clamp(g.player.energy - 8, 0, 100);
            } else {
              w.raceResult = res;
              const wr: WeekendResult = { season: g.season, round: g.round, raceId: w.raceId, quali: w.quali ?? [], sprint: w.sprintResult, race: res, playerRating: 0 };
              wr.playerRating = playerRating(g, wr);
              g.results.push(wr);
              postRace(g, wr, w.collisions, w.teamOrderAnswer);
              const me = res.find((e) => e.driverId === PLAYER_ID);
              if (me) log(g, `Course : ${me.dnf ? `abandon (${me.dnf})` : `P${me.position}`} — ${me.points} pts. Note du week-end : ${wr.playerRating}/10`, me.position > 0 && me.position <= 10 ? 'good' : 'bad');
              const itw = createInterview(g, 'postRace', { race: me, raceId: w.raceId });
              g.interviews.unshift(itw);
            }
            w.race = null;
            // passe à l'étape suivante
            if (w.stageIndex < w.stages.length - 1) {
              w.stageIndex++;
              w.stage = w.stages[w.stageIndex];
            }
          }),
        endWeekend: () =>
          mutate((g) => {
            const w = g.weekend;
            if (!w) return;
            // interviews non faites = pénalité légère
            for (const itw of g.interviews) {
              if (!itw.done && (itw.context === 'postRace' || itw.context === 'thursday' || itw.context === 'postQuali')) {
                itw.done = true;
                changeImage(g, { professionalism: -2 });
              }
            }
            g.weekend = null;
            g.round++;
            g.date = addDays(raceDate(g.season, g.round - 1), 1);
            g.day += 4;
            if (g.round >= 24) {
              emergencyOffers(g);
              finalizeSeason(g);
            } else {
              g.phase = 'season';
            }
            g.actionsLeft = daysUntilWeekend(g);
          }),

        // ─────────── Presse ───────────
        submitInterview: async (id, answers) => {
          const g0 = get().game;
          if (!g0) return;
          const itw0 = g0.interviews.find((i) => i.id === id);
          if (!itw0 || itw0.done) return;
          const itw = { ...itw0, answers };
          let effect: InterviewEffect & { rel: Record<string, { friendship?: number; respect?: number; rivalry?: number }>; teamTrust: number; likeability: number; professionalism: number; controversy: number; followers: number; morale: number };
          const ai = claudeAvailable(g0) ? await claudeEvaluateInterview(g0, itw) : null;
          if (ai) {
            const rel: Record<string, { friendship?: number }> = {};
            for (const r of ai.relations) if (g0.drivers[r.driver_id]) rel[r.driver_id] = { friendship: clamp(r.friendship_delta, -12, 12) };
            effect = {
              headline: ai.headline,
              summary: `🤖 ${ai.summary}`,
              rel,
              teamTrust: clamp(ai.team_trust, -12, 12),
              likeability: clamp(ai.likeability, -10, 10),
              professionalism: clamp(ai.professionalism, -10, 10),
              controversy: clamp(ai.controversy, -10, 10),
              followers: Math.max(0, ai.controversy) * 0.002 + Math.max(0, ai.likeability) * 0.001,
              morale: 0,
              deltas: [
                { label: 'Confiance équipe', value: ai.team_trust },
                { label: 'Sympathie du public', value: ai.likeability },
                { label: 'Professionnalisme', value: ai.professionalism },
                { label: 'Polémique', value: ai.controversy },
                ...ai.relations.filter((r) => g0.drivers[r.driver_id]).map((r) => ({ label: `Relation avec ${lastNameOf(g0, r.driver_id)}`, value: r.friendship_delta })),
              ].filter((d) => d.value !== 0),
            };
          } else effect = evaluateInterview(g0, itw);
          mutate((g) => {
            const i = g.interviews.find((x) => x.id === id);
            if (!i) return;
            i.answers = answers;
            i.done = true;
            changeTrust(g, effect.teamTrust);
            changeImage(g, { likeability: effect.likeability, professionalism: effect.professionalism, controversy: effect.controversy });
            addFollowers(g, g.player.followers * effect.followers);
            for (const [d, r] of Object.entries(effect.rel)) {
              applyRel(g, d, r);
              const def = DRIVERS_BY_ID[d];
              if (def && (r.friendship ?? 0) <= -6 && chance(0.4 + def.persona.traits.temper / 200)) pushDM(g, d, def.persona.traits.temper > 65 ? 'J’ai lu ton interview. Tu veux vraiment jouer à ça ?' : 'Pas très sympa ce que t’as dit en conf de presse…');
              if (def && (r.friendship ?? 0) >= 4 && chance(0.25)) pushDM(g, d, 'Merci pour les mots sympas en interview 🙏');
            }
            g.news.unshift(news(g, 'interview', effect.headline, effect.summary, i.outlet));
            const t = teamOf(g, PLAYER_ID);
            if (t && effect.teamTrust <= -5) pushDM(g, `tp:${t}`, `J’ai lu tes déclarations dans ${i.outlet}. Ce genre de choses se règle en interne, pas dans la presse.`, `tp:${t}`);
            log(g, `🎙️ Interview ${i.outlet} : « ${effect.headline} »`, effect.teamTrust < 0 || effect.controversy > 4 ? 'bad' : 'info');
          });
          set((st) => ({ ui: { ...st.ui, lastInterview: { ...effect, id } } }));
        },
        skipInterview: (id) =>
          mutate((g) => {
            const i = g.interviews.find((x) => x.id === id);
            if (!i || i.done) return;
            i.done = true;
            changeImage(g, { professionalism: -3, likeability: -1 });
            if (i.context === 'thursday') changeTrust(g, -2);
            log(g, `Tu as zappé l’interview ${i.outlet}. La FIA et ton équipe n’apprécient pas.`, 'bad');
          }),
        requestInterview: (kind) =>
          mutate((g) => {
            const itw = createInterview(g, kind);
            g.interviews.unshift(itw);
          }),
        clearLastInterview: () => set((st) => ({ ui: { ...st.ui, lastInterview: null } })),

        // ─────────── Téléphone ───────────
        sendDM: async (convId, text) => {
          const g0 = get().game;
          if (!g0 || !text.trim()) return;
          mutate((g) => pushDM(g, PLAYER_ID, text.trim(), convId));
          set((st) => ({ ui: { ...st.ui, typing: { ...st.ui.typing, [convId]: true } } }));
          const g1 = get().game!;
          const isDriver = !!DRIVERS_BY_ID[convId] && !!g1.drivers[convId];
          let replyText = '';
          let rel: { friendship?: number; rivalry?: number; respect?: number } = {};
          let accepted: string | undefined;
          const act = detectActivity(text);
          if (isDriver) {
            const ai = claudeAvailable(g1) ? await claudeDriverReply(g1, convId, g1.conversations[convId]?.messages ?? [], text) : null;
            if (ai) {
              replyText = ai.reply;
              rel = { friendship: clamp(ai.friendship_delta, -10, 10), rivalry: clamp(ai.rivalry_delta, -10, 10) };
              if (ai.accepts_invitation && act) accepted = act;
            } else {
              await new Promise((r) => setTimeout(r, 700 + Math.random() * 1500));
              const a = analyze(text);
              const intents = detectIntents(a, text);
              const parts = intents.slice(0, 2).map((it) => localReply(g1, convId, it, text, act));
              replyText = parts.map((r) => r.text).join(' ');
              rel = parts.reduce<{ friendship?: number; rivalry?: number; respect?: number }>((acc, r) => ({ friendship: (acc.friendship ?? 0) + (r.rel.friendship ?? 0), rivalry: (acc.rivalry ?? 0) + (r.rel.rivalry ?? 0), respect: (acc.respect ?? 0) + (r.rel.respect ?? 0) }), {});
              accepted = parts.find((r) => r.acceptedActivity)?.acceptedActivity;
            }
          } else if (convId.startsWith('tp:')) {
            await new Promise((r) => setTimeout(r, 1200));
            const a = analyze(text);
            const intent = detectIntent(a, text);
            const team = TEAMS_BY_ID[convId.slice(3) as keyof typeof TEAMS_BY_ID];
            const trust = g1.teams[team.id].trust;
            if (intent === 'complaint' || a.scores.blameTeam) {
              replyText = trust > 60 ? 'Je t’entends. Viens à l’usine lundi, on regarde ça ensemble avec les ingénieurs.' : 'Moins de plaintes, plus de résultats. C’est comme ça que ça marche ici.';
              rel = {};
              mutate((g) => changeTrust(g, trust > 60 ? 0 : -2));
            } else if (a.scores.rumor || a.scores.leaving) {
              replyText = trust > 50 ? 'On veut te garder. On en parle dès que les chiffres sont prêts.' : 'Ta place se mérite course après course. On verra en fin de saison.';
            } else if (a.scores.humble || a.scores.positive) {
              replyText = pick(['Merci. Continue à travailler comme ça.', 'Bon état d’esprit. On compte sur toi ce week-end.', 'Apprécié. Toute l’équipe pousse dans la même direction.']);
              mutate((g) => changeTrust(g, 1));
            } else replyText = pick(['Bien reçu.', 'Ok, je transmets aux ingénieurs.', 'On en parle au debrief.', 'Noté. Concentre-toi sur la piste.']);
            replyText = `${team.principal} : ${replyText}`;
          }
          mutate((g) => {
            if (replyText) pushDM(g, convId, replyText, convId);
            if (isDriver) {
              applyRel(g, convId, rel);
              if (accepted) {
                g.flags[`invite:${convId}`] = `${accepted}|${g.day}`;
                log(g, `${DRIVERS_BY_ID[convId].firstName} est partant pour ${ACTIVITIES_BY_ID[accepted]?.name.toLowerCase() ?? 'un plan'} : programme-le dans le planning !`, 'good');
              }
            }
          });
          set((st) => ({ ui: { ...st.ui, typing: { ...st.ui.typing, [convId]: false } } }));
        },
        sendGroup: async (text) => {
          const g0 = get().game;
          if (!g0 || !text.trim()) return;
          mutate((g) => pushGroup(g, [{ id: uid('g'), from: PLAYER_ID, text: text.trim(), day: g.day }]));
          set((st) => ({ ui: { ...st.ui, typing: { ...st.ui.typing, group: true } } }));
          const g1 = get().game!;
          const ai = claudeAvailable(g1) ? await claudeGroupReplies(g1, g1.group.messages, text) : null;
          if (!ai) await new Promise((r) => setTimeout(r, 900 + Math.random() * 1200));
          mutate((g) => {
            if (ai) {
              pushGroup(g, ai.messages.map((m) => ({ id: uid('g'), from: m.driver_id, text: m.text, day: g.day })));
              for (const m of ai.messages) applyRel(g, m.driver_id, { friendship: clamp(m.friendship_delta, -8, 8) * 0.6 });
            } else {
              const r = groupReplyTo(g, text);
              pushGroup(g, r.messages);
              for (const [d, rel] of Object.entries(r.relChanges)) applyRel(g, d, rel);
              for (const d of r.accepted) {
                const act = detectActivity(text);
                if (act) g.flags[`invite:${d}`] = `${act}|${g.day}`;
              }
              if (r.accepted.length) log(g, `Partants pour ton plan : ${r.accepted.map((d) => DRIVERS_BY_ID[d].firstName).join(', ')}. Invite-les depuis le planning.`, 'good');
            }
            g.group.unread = 0;
            const a = analyze(text);
            if (a.scores.vulgar || a.scores.taunt) {
              if (chance(0.08)) {
                changeImage(g, { controversy: 8 });
                g.news.unshift(news(g, 'player', `Fuite : un message de ${g.player.lastName} dans le groupe des pilotes fait scandale`, 'Une capture d’écran circule sur les réseaux…', 'Pitlane Daily'));
              }
            }
          });
          set((st) => ({ ui: { ...st.ui, typing: { ...st.ui.typing, group: false } } }));
        },
        markConversationRead: (id) => mutate((g) => g.conversations[id] && (g.conversations[id].unread = 0)),
        markGroupRead: () => mutate((g) => (g.group.unread = 0)),
        readMail: (id) => mutate((g) => {
          const m = g.mail.find((x) => x.id === id);
          if (m) m.read = true;
        }),
        resolveMail: (id, accept) =>
          mutate((g) => {
            const m = g.mail.find((x) => x.id === id);
            if (!m || m.resolved || !m.action) return;
            m.resolved = true;
            const a = m.action;
            if (a.kind === 'sponsorOffer' && accept) {
              const b = BRANDS_BY_ID[a.brandId];
              g.player.sponsors.push({ id: uid('sp'), brandId: a.brandId, perSeason: a.perSeason, endSeason: g.season + a.seasons - 1, obligations: a.obligations, done: 0 });
              if (b.image === 'risky') changeImage(g, { controversy: 6, likeability: -3 });
              if (b.image === 'premium') changeImage(g, { professionalism: 2 });
              log(g, `🤝 Contrat de sponsoring signé avec ${b.name}.`, 'good');
              g.news.unshift(news(g, 'business', `${g.player.lastName} devient ambassadeur ${b.name}`, `Un partenariat estimé à plusieurs centaines de milliers d’euros par saison.`));
            }
            if (a.kind === 'event' && accept) {
              g.player.money += a.reward;
              g.player.energy = clamp(g.player.energy - 10, 0, 100);
              addFollowers(g, g.player.followers * 0.01);
              changeImage(g, { likeability: 2 });
              log(g, `Participation à « ${a.eventId} » (+${a.reward.toLocaleString('fr-FR')} €).`, 'good');
            }
          }),
        createPost: (kind, text) =>
          mutate((g) => {
            const p = g.player;
            const a = analyze(text);
            let quality = 0.04 + Math.max(-0.02, a.sentiment * 0.015) + Math.min(0.02, a.emojis * 0.004) + (a.scores.humor ? 0.01 : 0);
            if (kind === 'race' && g.results.length) {
              const me = g.results[g.results.length - 1].race.find((e) => e.driverId === PLAYER_ID);
              if (me && me.position > 0 && me.position <= 3) quality += 0.04;
            }
            if (kind === 'sponsor') quality -= 0.015;
            const pr = p.staff.find((x) => x.role === 'pr')?.level ?? 0;
            const post = makePost(g, PLAYER_ID, kind, text, p.followers * quality * (1 + pr * 0.1) * rand(0.7, 1.3));
            post.comments = fanComments(g, post, a.sentiment);
            // Pilotes amis qui commentent
            const friends = Object.values(g.drivers).filter((d) => d.rel.friendship > 25 && DRIVERS_BY_ID[d.id]);
            for (const f of friends.slice(0, 2)) if (chance(0.5)) post.comments.unshift({ author: f.id, text: pick(['🔥', '😂😂', 'legend', '👏', 'trop beau', '🙌', 'qui a pris la photo 👀']) });
            g.feed.unshift(post);
            addFollowers(g, p.followers * quality * 0.15);
            if (kind === 'sponsor') {
              const sp = p.sponsors.find((x) => x.done < x.obligations);
              if (sp) sp.done++;
            }
            if (a.scores.vulgar || a.scores.blameTeam || a.scores.taunt) {
              changeImage(g, { controversy: 5, professionalism: -2 });
              if (a.scores.blameTeam) changeTrust(g, -4);
              for (const d of a.mentionsDrivers) applyRel(g, d, { friendship: -6, rivalry: 5 });
            } else {
              changeImage(g, { likeability: 1 });
              for (const d of a.mentionsDrivers) applyRel(g, d, { friendship: 2 });
            }
            log(g, `📸 Publication : ${post.likes.toLocaleString('fr-FR')} likes.`, 'info');
          }),
        likePost: (id) => mutate((g) => {
          const p = g.feed.find((x) => x.id === id);
          if (!p || p.likedByPlayer) return;
          p.likedByPlayer = true;
          p.likes++;
          if (DRIVERS_BY_ID[p.author]) applyRel(g, p.author, { friendship: 0.5 });
        }),

        // ─────────── Carrière ───────────
        negotiate: (offerId, ask, pitch) => {
          let msg = '';
          mutate((g) => {
            const i = g.offers.findIndex((o) => o.id === offerId);
            if (i < 0) return;
            const r = negotiateOffer(g, g.offers[i], ask, pitch);
            g.offers[i] = r.offer;
            msg = r.message;
          });
          return msg;
        },
        acceptOffer: (offerId) =>
          mutate((g) => {
            const o = g.offers.find((x) => x.id === offerId) as ContractOffer | undefined;
            if (!o || (o.state !== 'open' && o.state !== 'negotiating')) return;
            o.state = 'accepted';
            const team = TEAMS_BY_ID[o.teamId];
            const current = g.player.contract?.teamId;
            for (const other of g.offers) if (other !== o && other.fromSeason === o.fromSeason && (other.state === 'open' || other.state === 'negotiating')) other.state = 'rejected';
            if (o.teamId === current) {
              g.player.contract = offerToContract({ ...o, fromSeason: g.season });
              g.player.contract.endSeason = o.fromSeason + o.years - 1;
              changeTrust(g, 10);
              log(g, `✍️ Prolongation signée avec ${team.name} jusqu’en ${g.player.contract.endSeason} !`, 'good');
              g.news.unshift(news(g, 'transfer', `Officiel : ${g.player.lastName} prolonge chez ${team.name}`, `Le pilote est engagé jusqu’à fin ${g.player.contract.endSeason}.`));
            } else {
              if (current) changeTrust(g, -15);
              log(g, `✍️ Contrat signé avec ${team.name} à partir de ${o.fromSeason} !`, 'good');
              g.news.unshift(news(g, 'transfer', `BOMBE : ${g.player.firstName} ${g.player.lastName} chez ${team.name} en ${o.fromSeason} !`, `${team.principal} : « Nous sommes ravis d’accueillir un talent de ce calibre. »`));
              if (current) pushDM(g, `tp:${current}`, `${TEAMS_BY_ID[current].principal} : J’ai appris la nouvelle. Déçu, mais je respecte ton choix. Je compte sur toi jusqu’à la dernière course.`, `tp:${current}`);
              if (!g.player.contract || g.phase === 'offseason') {
                // sans contrat actif : on change tout de suite
                if (!g.player.contract) g.player.contract = offerToContract(o);
              }
            }
          }),
        rejectOffer: (offerId) => mutate((g) => {
          const o = g.offers.find((x) => x.id === offerId);
          if (o && (o.state === 'open' || o.state === 'negotiating')) o.state = 'rejected';
        }),
        setDevFocus: (f) => mutate((g) => {
          const t = teamOf(g, PLAYER_ID);
          if (t) {
            g.teams[t].devFocus = f;
            changeTrust(g, 0.5);
          }
        }),
        requestTeamMeeting: (topic) =>
          mutate((g) => {
            const t = teamOf(g, PLAYER_ID);
            if (!t) return;
            const team = TEAMS_BY_ID[t];
            const trust = g.teams[t].trust;
            const st = driverStandings(g);
            const mate = teammateOf(g, PLAYER_ID);
            const myPos = st.findIndex((d) => d.driverId === PLAYER_ID);
            const matePos = mate ? st.findIndex((d) => d.driverId === mate) : 99;
            let reply = '';
            if (topic === 'status') {
              if (g.player.contract && g.player.contract.status !== 'first' && trust > 70 && myPos < matePos && g.round > 5) {
                g.player.contract.status = g.player.contract.status === 'second' ? 'equal' : 'first';
                reply = `D’accord. Vu ta saison, tu passes au statut « ${g.player.contract.status === 'first' ? 'premier pilote' : 'égalité de traitement'} ».`;
                if (mate) applyRel(g, mate, { friendship: -8, rivalry: 10 });
              } else {
                reply = trust > 50 ? 'Le statut se gagne sur la piste. Bats ton coéquipier régulièrement et on en reparle.' : 'Franchement ? Tu n’es pas en position de demander ça.';
                changeTrust(g, -2);
              }
            } else if (topic === 'car') {
              reply = `On pousse sur ${g.teams[t].devFocus === 'balanced' ? 'tous les domaines' : g.teams[t].devFocus}. Ton retour technique (${g.player.stats.feedback}) aide les ingénieurs.`;
              changeTrust(g, 1);
            } else {
              const end = g.player.contract?.endSeason ?? g.season;
              if (end > g.season) reply = `Ton contrat court jusqu’en ${end}. On n’est pas pressés.`;
              else if (trust > 40) {
                reply = 'On prépare une proposition, tu la recevras très vite.';
                const already = g.offers.some((o) => o.teamId === t && (o.state === 'open' || o.state === 'negotiating'));
                if (!already) {
                  const o = buildOffer(g, t, g.season + 1, 1.02);
                  g.offers.push(o);
                  pushMail(g, { from: `${team.principal} — ${team.name}`, subject: 'Prolongation de contrat', body: 'Comme convenu, voici notre proposition de prolongation. Tous les détails sont dans l’onglet Carrière.', action: { kind: 'contractOffer', offerId: o.id } });
                }
              } else reply = 'Pour l’instant, nous évaluons toutes nos options pour l’an prochain.';
            }
            pushDM(g, `tp:${t}`, `${team.principal} : ${reply}`, `tp:${t}`);
          }),

        // ─────────── Style de vie ───────────
        buyAsset: (id) =>
          mutate((g) => {
            const a = ASSETS_BY_ID[id];
            if (!a || g.player.money < a.price) return;
            g.player.money -= a.price;
            g.player.assets.push({ id, boughtDay: g.day, price: a.price });
            g.player.morale = clamp(g.player.morale + a.morale, 0, 100);
            addFollowers(g, g.player.followers * (a.prestige / 4000));
            const t = teamOf(g, PLAYER_ID);
            if (a.brandConflict && t && a.brandConflict !== t) {
              changeTrust(g, -4);
              log(g, `Ton équipe n’apprécie pas trop de te voir rouler dans une voiture concurrente…`, 'bad');
            } else if (a.brandConflict && a.brandConflict === t) changeTrust(g, 2);
            if (a.price > 10_000_000) g.news.unshift(news(g, 'player', `${g.player.lastName} s’offre ${a.name.toLowerCase()}`, 'Le pilote ne se refuse rien.', 'Pitlane Daily'));
            log(g, `🛍️ Achat : ${a.name}`, 'info');
          }),
        sellAsset: (index) =>
          mutate((g) => {
            const o = g.player.assets[index];
            if (!o) return;
            const def = ASSETS_BY_ID[o.id];
            const value = Math.round(o.price * def.resale * rand(0.92, 1.08));
            g.player.money += value;
            g.player.assets.splice(index, 1);
            log(g, `💰 Vente : ${def.name} pour ${value.toLocaleString('fr-FR')} €`, 'info');
          }),
        setResidence: (r) =>
          mutate((g) => {
            if (g.player.residence === r) return;
            g.player.residence = r;
            g.player.money -= 50_000;
            log(g, `🏠 Nouvelle résidence fiscale : ${RESIDENCES_BY_ID[r].name}`, 'info');
          }),
        hireStaff: (role, level) =>
          mutate((g) => {
            const def = STAFF_ROLES.find((x) => x.role === role)!;
            g.player.staff = g.player.staff.filter((x) => x.role !== role);
            g.player.staff.push({ id: uid('st'), role, name: `${pick(STAFF_FIRST)} ${pick(STAFF_LAST)}`, level, salary: Math.round(def.baseSalary * (0.6 + level * 0.4)) });
            log(g, `👥 Embauche : ${def.name} (niveau ${level})`, 'good');
          }),
        fireStaff: (id) => mutate((g) => {
          g.player.staff = g.player.staff.filter((x) => x.id !== id);
        }),
        buyBusiness: (id) =>
          mutate((g) => {
            const b = BUSINESSES_BY_ID[id];
            if (!b || g.player.money < b.cost || g.player.businesses.some((x) => x.id === id)) return;
            g.player.money -= b.cost;
            g.player.businesses.push({ id, level: 1, boughtDay: g.day });
            addFollowers(g, g.player.followers * b.followers);
            g.news.unshift(news(g, 'business', `${g.player.lastName} se lance dans les affaires : ${b.name.toLowerCase()}`, b.desc));
            log(g, `🏢 Nouvelle activité : ${b.name}`, 'good');
          }),
        upgradeBusiness: (id) =>
          mutate((g) => {
            const own = g.player.businesses.find((x) => x.id === id);
            const b = BUSINESSES_BY_ID[id];
            if (!own || own.level >= 5) return;
            const cost = b.upgradeCost * own.level;
            if (g.player.money < cost) return;
            g.player.money -= cost;
            own.level++;
            log(g, `📈 ${b.name} passe au niveau ${own.level}`, 'good');
          }),
        invest: (id, amount) =>
          mutate((g) => {
            if (amount <= 0 || g.player.money < amount) return;
            g.player.money -= amount;
            const inv = g.player.investments.find((x) => x.id === id);
            if (inv) {
              inv.amount += amount;
              inv.value += amount;
            } else g.player.investments.push({ id, amount, value: amount });
            log(g, `💹 Investissement : ${INVESTMENTS_BY_ID[id].name}`, 'info');
          }),
        withdraw: (id) =>
          mutate((g) => {
            const i = g.player.investments.findIndex((x) => x.id === id);
            if (i < 0) return;
            const inv = g.player.investments[i];
            g.player.money += inv.value;
            log(g, `💹 Retrait ${INVESTMENTS_BY_ID[id].name} : ${inv.value >= inv.amount ? '+' : ''}${Math.round(inv.value - inv.amount).toLocaleString('fr-FR')} €`, inv.value >= inv.amount ? 'good' : 'bad');
            g.player.investments.splice(i, 1);
          }),
        createFoundation: (name) =>
          mutate((g) => {
            if (g.player.foundation || g.player.money < 500_000) return;
            g.player.money -= 500_000;
            g.player.foundation = { name, funds: 500_000 };
            changeImage(g, { likeability: 8, professionalism: 3 });
            g.news.unshift(news(g, 'player', `${g.player.lastName} lance la fondation « ${name} »`, 'Une initiative saluée par le paddock.'));
            log(g, `🎗️ Fondation « ${name} » créée.`, 'good');
          }),
        donate: (amount) =>
          mutate((g) => {
            if (!g.player.foundation || g.player.money < amount) return;
            g.player.money -= amount;
            g.player.foundation.funds += amount;
            changeImage(g, { likeability: Math.min(6, amount / 200_000) });
          }),

        // ─────────── Saison ───────────
        nextSeason: () => {
          let report: string[] = [];
          mutate((g) => {
            if (g.phase !== 'offseason') return;
            // Sponsors expirés ou non honorés
            g.player.sponsors = g.player.sponsors.filter((sp) => {
              if (sp.endSeason <= g.season) return false;
              if (sp.done < sp.obligations) {
                pushMail(g, { from: BRANDS_BY_ID[sp.brandId].name, subject: 'Fin de notre partenariat', body: 'Vous n’avez pas respecté vos obligations contractuelles. Nous mettons fin au partenariat.', action: { kind: 'info' } });
                return false;
              }
              sp.done = 0;
              return true;
            });
            report = startNextSeason(g);
          });
          set((st) => ({ ui: { ...st.ui, seasonReport: report, screen: 'home' } }));
        },
        clearSeasonReport: () => set((st) => ({ ui: { ...st.ui, seasonReport: null } })),
      };
    },
    {
      name: 'paddock-career-save',
      version: SAVE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (st) => ({ game: st.game }) as unknown as Store,
      migrate: (persisted) => persisted as Store,
    },
  ),
);

export function useGameState(): GameState {
  return useGame((s) => s.game!) as GameState;
}

export { TYRE_INFO };
