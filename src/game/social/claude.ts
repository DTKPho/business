/**
 * Mode « IA avancée » optionnel : si le joueur renseigne une clé API Anthropic
 * dans les réglages, les pilotes répondent via Claude en incarnant leur
 * personnalité publique, et les interviews sont analysées par Claude.
 * Sans clé, le jeu utilise le moteur local (voice.ts / interview.ts).
 */
import type Anthropic from '@anthropic-ai/sdk';

type SDK = typeof import('@anthropic-ai/sdk');
let sdkPromise: Promise<SDK> | null = null;
function loadSdk(): Promise<SDK> {
  sdkPromise ??= import('@anthropic-ai/sdk');
  return sdkPromise;
}
import { DRIVERS_BY_ID } from '../../data/drivers';
import { TEAMS_BY_ID } from '../../data/teams';
import type { ChatMessage, GameState, PendingInterview } from '../types';
import { PLAYER_ID } from '../types';
import { nameOf, teamOf } from '../people';
import { driverStandings } from '../standings';

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';

async function client(s: GameState): Promise<{ api: Anthropic; sdk: SDK } | null> {
  const c = s.settings.claude;
  if (!c.enabled || !c.apiKey.trim()) return null;
  const sdk = await loadSdk();
  return { api: new sdk.default({ apiKey: c.apiKey.trim(), dangerouslyAllowBrowser: true }), sdk };
}

export function claudeAvailable(s: GameState): boolean {
  return s.settings.claude.enabled && s.settings.claude.apiKey.trim().length > 10;
}

function worldContext(s: GameState): string {
  const st = driverStandings(s).slice(0, 6);
  const team = teamOf(s, PLAYER_ID);
  const p = s.player;
  const lines = [
    `Saison ${s.season}, date ${s.date}. Monde du jeu : simulation de carrière F1 fictive basée sur la grille réelle.`,
    `Le joueur : ${p.firstName} ${p.lastName} (${p.nationality}), n°${p.number}, pilote ${team ? TEAMS_BY_ID[team].name : 'sans volant'}, ${p.followers.toLocaleString('fr-FR')} abonnés.`,
    `Classement : ${st.map((d, i) => `${i + 1}. ${nameOf(s, d.driverId)} ${d.points} pts`).join(' · ')}.`,
  ];
  const last = s.results[s.results.length - 1];
  if (last) {
    const podium = last.race.filter((e) => e.position >= 1 && e.position <= 3).map((e) => nameOf(s, e.driverId));
    const me = last.race.find((e) => e.driverId === PLAYER_ID);
    lines.push(`Dernier GP (${last.raceId}) : podium ${podium.join(', ')} ; le joueur ${me ? (me.dnf ? 'a abandonné' : `a fini P${me.position}`) : 'n’a pas couru'}.`);
  }
  return lines.join('\n');
}

function personaPrompt(s: GameState, driverId: string): string {
  const def = DRIVERS_BY_ID[driverId];
  const d = s.drivers[driverId];
  const p = def.persona;
  return [
    `Tu incarnes ${def.firstName} ${def.lastName}, pilote de F1 (${d.teamId ? TEAMS_BY_ID[d.teamId].name : 'sans volant'}), dans un jeu vidéo de carrière.`,
    `Personnalité publique : ${p.bio}`,
    `Style d’écriture : ${p.style}, ${p.lowercase ? 'écrit en minuscules' : 'ponctuation normale'}, emojis favoris ${p.emojis.join(' ')}, rire « ${p.laugh} », appelle les gens « ${p.buddy} ». Expressions : ${p.catchphrases.join(' / ')}.`,
    `Centres d’intérêt : ${p.interests.join(', ')}. Amis : ${p.friends.map((f) => DRIVERS_BY_ID[f]?.lastName).join(', ') || '—'}. Tensions : ${p.tensions.map((f) => DRIVERS_BY_ID[f]?.lastName).join(', ') || '—'}.`,
    `Relation actuelle avec le joueur : amitié ${Math.round(d.rel.friendship)}/100, respect ${Math.round(d.rel.respect)}/100, rivalité ${Math.round(d.rel.rivalry)}/100.`,
    s.settings.driverLanguage === 'vo' && !p.speaksFrench ? 'Réponds dans ta langue naturelle (anglais ou ta langue maternelle mêlée d’anglais).' : 'Réponds en français (avec éventuellement quelques mots de ta langue).',
    'Reste fidèle à ce caractère public, bienveillant sur le fond : pas de propos diffamatoires, pas de vie privée inventée sensible. Messages courts comme sur un téléphone (1 à 3 phrases).',
  ].join('\n');
}

async function jsonCall<T>(s: GameState, system: string, user: string, schema: Record<string, unknown>, maxTokens = 2000): Promise<T | null> {
  const c = await client(s);
  if (!c) return null;
  const { Anthropic: A } = { Anthropic: c.sdk.default };
  try {
    const res = await c.api.beta.messages.create({
      model: s.settings.claude.model || DEFAULT_CLAUDE_MODEL,
      max_tokens: maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') return null;
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    return JSON.parse(text) as T;
  } catch (e) {
    if (e instanceof A.AuthenticationError) console.warn('Clé API Anthropic invalide.');
    else if (e instanceof A.RateLimitError) console.warn('Limite de débit Anthropic atteinte.');
    else if (e instanceof A.APIError) console.warn(`Erreur API ${e.status}: ${e.message}`);
    else console.warn('Appel Claude impossible', e);
    return null;
  }
}

export interface ClaudeDMReply {
  reply: string;
  friendship_delta: number;
  rivalry_delta: number;
  accepts_invitation: boolean;
}

export async function claudeDriverReply(s: GameState, driverId: string, history: ChatMessage[], text: string): Promise<ClaudeDMReply | null> {
  const def = DRIVERS_BY_ID[driverId];
  if (!def) return null;
  const convo = history
    .slice(-14)
    .map((m) => `${m.from === PLAYER_ID ? s.player.firstName : def.firstName}: ${m.text}`)
    .join('\n');
  return jsonCall<ClaudeDMReply>(
    s,
    personaPrompt(s, driverId) + '\n\n' + worldContext(s),
    `Conversation privée (messagerie) avec le joueur :\n${convo}\n${s.player.firstName}: ${text}\n\nRéponds comme ${def.firstName}. Indique aussi l’impact sur la relation (−10..10) et si tu acceptes une éventuelle invitation.`,
    {
      type: 'object',
      additionalProperties: false,
      required: ['reply', 'friendship_delta', 'rivalry_delta', 'accepts_invitation'],
      properties: {
        reply: { type: 'string' },
        friendship_delta: { type: 'integer' },
        rivalry_delta: { type: 'integer' },
        accepts_invitation: { type: 'boolean' },
      },
    },
  );
}

export interface ClaudeGroupReply {
  messages: { driver_id: string; text: string; friendship_delta: number }[];
}

export async function claudeGroupReplies(s: GameState, history: ChatMessage[], text: string): Promise<ClaudeGroupReply | null> {
  const ids = Object.values(s.drivers).filter((d) => d.teamId && !d.retired && DRIVERS_BY_ID[d.id]).map((d) => d.id);
  const roster = ids
    .map((id) => {
      const p = DRIVERS_BY_ID[id].persona;
      return `- ${id} (${DRIVERS_BY_ID[id].firstName} ${DRIVERS_BY_ID[id].lastName}) : style ${p.style}, ${p.lowercase ? 'minuscules' : ''}, rire « ${p.laugh} », ${p.bio.slice(0, 160)} Relation joueur ${Math.round(s.drivers[id].rel.friendship)}.`;
    })
    .join('\n');
  const convo = history
    .slice(-12)
    .map((m) => `${m.from === PLAYER_ID ? s.player.firstName : (DRIVERS_BY_ID[m.from]?.firstName ?? m.from)}: ${m.text}`)
    .join('\n');
  const res = await jsonCall<ClaudeGroupReply>(
    s,
    `Tu animes le groupe WhatsApp privé des pilotes de F1 dans un jeu vidéo. Chaque pilote garde sa personnalité publique réelle (bienveillant sur le fond, chambrage amical, pas de diffamation).\n${worldContext(s)}\nPilotes disponibles :\n${roster}`,
    `Historique récent :\n${convo}\n${s.player.firstName} (joueur) vient d’écrire : « ${text} »\n\nGénère 1 à 4 réponses réalistes de pilotes concernés (driver_id parmi la liste), courtes, avec l’impact sur leur amitié avec le joueur (−10..10).`,
    {
      type: 'object',
      additionalProperties: false,
      required: ['messages'],
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['driver_id', 'text', 'friendship_delta'],
            properties: { driver_id: { type: 'string' }, text: { type: 'string' }, friendship_delta: { type: 'integer' } },
          },
        },
      },
    },
  );
  if (res) res.messages = res.messages.filter((m) => ids.includes(m.driver_id)).slice(0, 4);
  return res;
}

export interface ClaudeInterviewEval {
  headline: string;
  summary: string;
  team_trust: number;
  likeability: number;
  professionalism: number;
  controversy: number;
  relations: { driver_id: string; friendship_delta: number }[];
}

export async function claudeEvaluateInterview(s: GameState, itw: PendingInterview): Promise<ClaudeInterviewEval | null> {
  const qa = itw.questions.map((q, i) => `Q: ${q.text}\nR: ${itw.answers[i] || '(pas de réponse)'}`).join('\n\n');
  const team = teamOf(s, PLAYER_ID);
  const res = await jsonCall<ClaudeInterviewEval>(
    s,
    `Tu es le rédacteur en chef de « ${itw.outlet} », média F1, dans un jeu vidéo de carrière. Tu analyses l’interview du joueur et en tires un titre d’article et ses conséquences.\n${worldContext(s)}\nÉquipe du joueur : ${team ? TEAMS_BY_ID[team].name + ' (dirigée par ' + TEAMS_BY_ID[team].principal + ')' : 'aucune'}.\nIds des pilotes : ${Object.keys(DRIVERS_BY_ID).join(', ')}.`,
    `Interview (${itw.context}) menée par ${itw.journalist} :\n\n${qa}\n\nRends : un titre de presse percutant en français, un résumé de l’angle retenu (2 phrases), et les variations (−10..10) de confiance de l’équipe, sympathie du public, professionnalisme, polémique, ainsi que l’impact sur les pilotes mentionnés.`,
    {
      type: 'object',
      additionalProperties: false,
      required: ['headline', 'summary', 'team_trust', 'likeability', 'professionalism', 'controversy', 'relations'],
      properties: {
        headline: { type: 'string' },
        summary: { type: 'string' },
        team_trust: { type: 'integer' },
        likeability: { type: 'integer' },
        professionalism: { type: 'integer' },
        controversy: { type: 'integer' },
        relations: {
          type: 'array',
          items: { type: 'object', additionalProperties: false, required: ['driver_id', 'friendship_delta'], properties: { driver_id: { type: 'string' }, friendship_delta: { type: 'integer' } } },
        },
      },
    },
  );
  return res;
}

export async function claudeTestKey(s: GameState): Promise<string> {
  const c = await client(s);
  if (!c) return 'Aucune clé renseignée (ou mode IA désactivé).';
  const A = c.sdk.default;
  try {
    const res = await c.api.messages.create({
      model: s.settings.claude.model || DEFAULT_CLAUDE_MODEL,
      max_tokens: 200,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Réponds uniquement « Radio check OK 📻 ».' }],
    });
    const t = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    return `✅ Connexion réussie : ${t}`;
  } catch (e) {
    if (e instanceof A.AuthenticationError) return '❌ Clé API invalide.';
    if (e instanceof A.APIError) return `❌ Erreur ${e.status} : ${e.message}`;
    return `❌ ${String(e)}`;
  }
}
