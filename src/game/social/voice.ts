/**
 * Moteur de réponses « hors-ligne » : chaque pilote répond selon sa personnalité
 * publique (style, tics de langage, centres d'intérêt, relation avec le joueur).
 */
import { DRIVERS_BY_ID, type Persona, type VoiceStyle } from '../../data/drivers';
import { ACTIVITIES_BY_ID } from '../../data/lifestyle';
import type { GameState, Relationship } from '../types';
import { PLAYER_ID } from '../types';
import { pick, chance } from '../rng';
import type { Intent } from './nlp';
import { lastNameOf, teamOf } from '../people';
import { TEAMS_BY_ID } from '../../data/teams';

type Bank = Partial<Record<Intent | 'invite_yes' | 'invite_no' | 'cold' | 'race_good' | 'race_bad' | 'collision', string[]>>;

const STYLE_LINES: Record<VoiceStyle, Bank> = {
  dry: {
    greet: ['Hey.', 'Yo {buddy}.', 'Salut. Quoi de neuf ?'],
    congrats: ['Merci. On prend.', 'Cheers {buddy}. Pas mal ton dimanche non plus.', 'Merci, c’était une course correcte.'],
    thanks: ['Pas de souci.', 'De rien {buddy}.'],
    apology: ['Ok. C’est la course. On passe à autre chose.', 'Ça arrive. Fais juste gaffe la prochaine fois.', 'Excuses acceptées. Mais je m’en souviendrai {laugh}.'],
    taunt: ['Intéressant. On en reparle dimanche.', 'Ok {laugh}. On verra en piste.', 'Ça c’est du blabla. Le chrono dira la vérité.'],
    advice: ['Simple : sois rapide au freinage, patient en sortie. Le reste, c’est du bruit.', 'Arrête de lire les réseaux. Fais du simu. Beaucoup.', 'Écoute ton ingé, mais fais confiance à tes sensations.'],
    compliment: ['Merci. Toi aussi t’as été solide.', 'Haha merci {buddy}.'],
    joke: ['{laugh}', '{laugh} pas mal.', 'Ok celle-là elle est bonne.'],
    rumor: ['Aucune idée. Je m’occupe de ma voiture.', 'Les rumeurs, je ne les lis pas.', 'Demande aux journalistes, ils savent tout avant nous {laugh}.'],
    serious: ['D’accord sur le principe. Mais faut que la FIA écoute, pour une fois.', 'Oui, il faut en parler au briefing.'],
    complaint: ['C’est la course. Demain ça ira mieux.', 'Bienvenue en F1 {laugh}.', 'Respire. Analyse les data. Recommence.'],
    question: ['Ça va. Concentré sur le prochain GP.', 'Tranquille. Et toi ?', 'Bien. Beaucoup de simu cette semaine.'],
    flirt: ['Euh… ok {laugh}.', '???'],
    smalltalk: ['Ok.', 'Ouais.', 'Haha ok.', 'Intéressant.'],
    invite_yes: ['Ouais, pourquoi pas. Envoie l’heure.', 'Ok, je suis chaud.', 'Ça marche.'],
    invite_no: ['Pas cette fois, trop de boulot au simu.', 'Je passe, désolé.', 'Non merci, pas dispo.'],
    cold: ['Ok.', '…', 'On verra.', 'Pas le temps là.'],
  },
  banter: {
    greet: ['yooo {buddy} 👋', 'heyyy whats up', 'salut l’artiste {laugh}'],
    congrats: ['merci {buddy}!! 🙌 t’étais pas mal non plus (presque) {laugh}', 'cheers mate, honnêtement j’ai eu de la chance', 'ahah merci, j’ai failli tout gâcher au restart'],
    thanks: ['no worries {buddy}', 'anytime 🙌'],
    apology: ['t’inquiète {buddy} ça arrive, mais tu me dois un café {laugh}', 'all good, mais t’as détruit mon aileron avant 😭', 'np, j’aurais fait pareil (non)'],
    taunt: ['{laugh} ok ok on verra dimanche', 'ratio', 'dit celui qui était derrière moi 💀', 'calme-toi on n’est que jeudi {laugh}'],
    advice: ['honnêtement ? dors plus, scrolle moins {laugh}', 'le truc c’est de rester chill dans le cockpit, je te jure', 'fais du simu avec nous la nuit, tu progresseras grave'],
    compliment: ['arrête tu vas me faire rougir {laugh}', 'merci mate 🙏'],
    joke: ['{laugh} t’es con', '{laugh}{laugh}', 'NON 😭', 'je suis mort {laugh}'],
    rumor: ['aucune idée {laugh} moi on me dit jamais rien', 'les rumeurs c’est 90% faux et 10% Toto', 'si tu sais un truc dis-moi {laugh}'],
    serious: ['ouais c’est un vrai sujet, faut en parler au GPDA', 'clairement, je suis d’accord'],
    complaint: ['courage mate, on a tous eu ces week-ends', 'ugh ça craint, je connais ce feeling', 'next one will be better 💪'],
    question: ['ça va et toi ? je joue à trop de jeux en ce moment {laugh}', 'tranquille, golf demain si t’es chaud', 'bien bien, un peu fatigué des vols'],
    flirt: ['mdr quoi {laugh}', 'euh je te connais à peine 😭'],
    smalltalk: ['{laugh}', 'ouais grave', 'trop vrai', 'mdr', 'mood'],
    invite_yes: ['OUI let’s go', 'grave chaud!! envoie l’heure', 'deal {laugh}'],
    invite_no: ['ahh je peux pas, sponsor event 😭', 'pas cette semaine désolé', 'next time promis'],
    cold: ['mouais', 'ok', 'on verra'],
  },
  warm: {
    greet: ['Salut {buddy} ! Comment tu vas ?', 'Hey ! Ça fait plaisir 😊', 'Coucou ! Tout va bien ?'],
    congrats: ['Merci beaucoup, ça me touche ! Toi aussi tu as fait une belle course 🙏', 'Merci {buddy} ! L’équipe a fait un travail incroyable.', 'Merci ! Allez, la prochaine c’est toi devant 😉'],
    thanks: ['Avec plaisir !', 'Toujours là pour toi {buddy}.'],
    apology: ['Pas de souci, ce sont des choses qui arrivent. Merci de m’écrire, ça compte.', 'Merci pour ton message, c’est classe. On oublie 🙏', 'C’est la course. Mais merci, sincèrement.'],
    taunt: ['Haha, tu es en forme ! On verra ça en piste 😉', 'Ok ok, je note {laugh}', 'Je te laisse rêver un peu 😄'],
    advice: ['Mon conseil : entoure-toi de gens qui te disent la vérité. Et profite, ça passe vite.', 'Prends soin de ton mental. C’est 50% du travail.', 'Travaille avec tes ingénieurs, passe du temps à l’usine. Ils te le rendront.'],
    compliment: ['C’est très gentil, merci ! 🙏', 'Merci {buddy}, venant de toi ça compte.'],
    joke: ['{laugh} trop drôle', '{laugh} j’adore', 'Haha tu es terrible !'],
    rumor: ['Je ne sais rien de plus que toi 😅', 'On verra, je reste concentré sur mon équipe.', 'Les rumeurs… on en reparle quand c’est officiel !'],
    serious: ['Oui, c’est important. Je suis à 100% avec toi là-dessus.', 'Tu as raison, il faut qu’on en parle tous ensemble.'],
    complaint: ['Courage, ça va tourner. Tu as le talent 💪', 'Je comprends, ce sont des moments durs. Garde la tête haute.', 'On est tous passés par là. Ça forge.'],
    question: ['Ça va bien merci ! Un peu de repos avant le prochain GP. Et toi ?', 'Très bien ! Beaucoup de travail à l’usine.', 'Ça va, ça va ! Hâte d’être en piste.'],
    flirt: ['Haha 😅 merci, mais restons sur la piste !', 'Oh, c’est gentil {laugh}'],
    smalltalk: ['Haha oui !', 'Carrément 😊', 'C’est vrai !', '🙏'],
    invite_yes: ['Avec grand plaisir ! Dis-moi quand 😊', 'Oh oui, bonne idée !', 'Carrément, je suis partant !'],
    invite_no: ['Ah, j’aurais adoré, mais je suis pris. Une autre fois ?', 'Désolé, pas possible cette semaine 🙏', 'Une prochaine fois avec plaisir !'],
    cold: ['Ok.', 'On verra.', 'Bonne journée.'],
  },
  polished: {
    greet: ['Salut ! J’espère que tout va bien de ton côté.', 'Hello ! Comment ça se passe ?'],
    congrats: ['Merci beaucoup. Toute l’équipe mérite ce résultat.', 'Merci ! Un super travail collectif. Bonne course à toi aussi.'],
    thanks: ['Avec plaisir.', 'Pas de quoi, on se serre les coudes.'],
    apology: ['J’apprécie le message. Tournons la page, on a tous intérêt à courir proprement.', 'Merci, c’est respectable. On en parle au briefing si besoin.'],
    taunt: ['Intéressant comme approche. Je préfère laisser parler la piste.', 'On verra bien où on se situe dimanche.'],
    advice: ['Prépare chaque week-end comme un dossier : data, sommeil, nutrition. Rien au hasard.', 'Construis ta relation avec l’équipe dès maintenant. C’est un investissement.'],
    compliment: ['Merci, c’est apprécié.', 'Très sympa, merci.'],
    joke: ['{laugh} bien vu.', '{laugh}'],
    rumor: ['Je ne commente pas les rumeurs, même en privé {laugh}', 'Tout ce que je peux dire, c’est que je suis concentré sur mon programme.'],
    serious: ['Totalement d’accord. Je le remonte au GPDA et à la FIA.', 'C’est exactement le genre de sujet qu’on doit traiter collectivement.'],
    complaint: ['Ces week-ends font partie du jeu. Analyse, ajuste, reviens plus fort.', 'Ça arrive. Le plus important, c’est la réaction.'],
    question: ['Très bien, merci. Semaine chargée entre sponsors et simulateur.', 'Bien ! Focus total sur le prochain week-end.'],
    flirt: ['Restons professionnels {laugh}'],
    smalltalk: ['Absolument.', 'C’est sûr.', 'Bien vu.'],
    invite_yes: ['Bonne idée, je regarde mon planning — c’est bon pour moi.', 'Avec plaisir, ça fera du bien.'],
    invite_no: ['Planning complet cette semaine, mais remettons ça.', 'Malheureusement non, engagements sponsors.'],
    cold: ['Noté.', 'D’accord.'],
  },
  cocky: {
    greet: ['Hola {buddy} 😎', 'Ah, le jeune ! Qu’est-ce que tu veux ? 😉'],
    congrats: ['Merci. L’expérience, {buddy}. L’expérience 😉', 'Normal. Mais merci quand même 😎', 'Merci ! Toi aussi tu progresses… doucement {laugh}'],
    thanks: ['De nada.', 'Toujours un plaisir d’aider les jeunes 😉'],
    apology: ['Karma 😉', 'Ok. Mais rappelle-toi : moi, je n’oublie jamais.', 'Accepté. Prends des notes la prochaine fois.'],
    taunt: ['J’étais champion du monde quand tu jouais aux petites voitures 😉', '{laugh} Karma, amigo. Karma.', 'Garde ton énergie pour dimanche. Tu vas en avoir besoin 😎'],
    advice: ['Conseil gratuit : ne fais jamais confiance à un sourire dans le paddock 😉', 'Pense trois coups d’avance. Toujours.', 'La patience. Les autres font l’erreur, tu ramasses les points.'],
    compliment: ['Je sais 😎', 'Merci. Tu as bon goût.'],
    joke: ['{laugh} pas mal', '{laugh} celle-là je la garde'],
    rumor: ['Peut-être que je sais des choses… peut-être pas 😉', 'Le plan existe toujours. El Plan 😎'],
    serious: ['Oui, et ça fait vingt ans que je le dis.', 'D’accord. Mais la FIA ne nous écoute jamais.'],
    complaint: ['Bienvenue dans ma vie pendant dix ans {laugh}', 'Ça forge le caractère. Regarde-moi.'],
    question: ['Très bien. Je m’entraîne plus que les jeunes 😉', 'Parfait, comme d’habitude.'],
    flirt: ['{laugh} trop tard amigo'],
    smalltalk: ['😉', 'Bien sûr.', '{laugh}', 'Évidemment.'],
    invite_yes: ['Oui, mais je vais gagner. Je gagne toujours 😎', 'Ok. Prépare-toi à perdre 😉'],
    invite_no: ['Pas le temps, je suis en mission.', 'Une autre fois peut-être 😉'],
    cold: ['Mm.', 'On verra.', 'Karma.'],
  },
  shy: {
    greet: ['salut ! 😊', 'hey ! ça va ?', 'coucou 👋'],
    congrats: ['merci beaucoup 🙏 j’ai encore beaucoup à apprendre', 'oh merci !! ça me fait trop plaisir', 'merci ! toi aussi bravo 🙏'],
    thanks: ['de rien !! 😊', 'pas de souci 🙏'],
    apology: ['pas grave du tout ! désolé aussi de mon côté 😅', 'ok pas de souci, c’est la course 🙏'],
    taunt: ['euh… ok {laugh}', 'on verra 😅', 'je vais faire de mon mieux haha'],
    advice: ['honnêtement je demanderais plutôt à toi 😅', 'je regarde beaucoup les onboards des meilleurs, ça aide'],
    compliment: ['oh merci beaucoup 😳🙏', 'trop gentil !!'],
    joke: ['{laugh}', '{laugh} trop drôle', 'mdrr'],
    rumor: ['je sais pas du tout 😅', 'on ne me dit rien à moi {laugh}'],
    serious: ['oui je suis d’accord 🙏', 'c’est important oui'],
    complaint: ['courage !! 💪', 'je comprends, moi aussi j’ai eu des week-ends comme ça'],
    question: ['ça va ! un peu stressé mais ça va 😅', 'bien bien ! beaucoup de simu'],
    flirt: ['😳😅'],
    smalltalk: ['{laugh}', 'trop vrai', 'ah oui !', '😊'],
    invite_yes: ['oh oui avec plaisir !!', 'grave, merci de proposer 😊'],
    invite_no: ['ah je peux pas désolé 😢', 'pas cette fois, mais merci !!'],
    cold: ['ok', 'd’accord'],
  },
  fiery: {
    greet: ['yo {buddy} !', 'wesh ça dit quoi', 'hey 🔥'],
    congrats: ['merci {buddy} !! quelle course de malade 🔥', 'merci ! j’ai tout donné, j’ai plus de cou {laugh}', 'merciii, t’étais chaud aussi !'],
    thanks: ['de rien frère', 'tkt'],
    apology: ['ok… j’étais vénère sur le moment mais c’est bon', 'merci de t’excuser, respect. mais j’étais furax', 'bon. on oublie. mais la prochaine fois laisse de la place'],
    taunt: ['viens on règle ça en piste', 'parle moins, roule plus 😤', 'tu veux jouer à ça ? ok.', '{laugh} on verra qui rigole dimanche'],
    advice: ['ne te laisse jamais marcher dessus. jamais.', 'en piste faut montrer que t’as pas peur. sinon ils te mangent'],
    compliment: ['merci frère 🙏🔥', 'ça fait plaisir venant de toi'],
    joke: ['{laugh}{laugh}', '{laugh} t’es fou', 'je pleure {laugh}'],
    rumor: ['franchement j’en sais rien et je m’en fous un peu', 'les journalistes inventent la moitié'],
    serious: ['carrément, faut qu’on se bouge là-dessus', 'je suis à fond avec toi'],
    complaint: ['je te comprends trop, ça m’énerve aussi', 'fais-le payer la prochaine fois 💪', 'lâche rien'],
    question: ['ça va, je suis chaud pour le prochain GP 🔥', 'grave bien, et toi ?'],
    flirt: ['mdr t’es grave'],
    smalltalk: ['grave', '{laugh}', 'ouais', 'trop vrai'],
    invite_yes: ['GRAVE !! on y va', 'chaud chaud chaud 🔥', 'oui frère'],
    invite_no: ['je peux pas là, dsl', 'pas dispo cette semaine'],
    cold: ['ok.', 'mouais.', 'on verra.'],
  },
  chill: {
    greet: ['hey {buddy} 🤙', 'salut, ça roule ?', 'yo'],
    congrats: ['merci {buddy}, bonne course à toi aussi', 'cheers ! solide week-end', 'merci, on prend les points'],
    thanks: ['np', 'avec plaisir'],
    apology: ['all good, c’est la course', 'pas de souci, ça arrive', 'no stress'],
    taunt: ['{laugh} ok', 'on verra ça', 'tranquille, on en reparle dimanche'],
    advice: ['reste calme et profite, ça va vite tout ça', 'déconnecte entre les courses, ça change tout'],
    compliment: ['merci {buddy} 🙏', 'cool, merci'],
    joke: ['{laugh}', '{laugh} bien vu', 'pas mal celle-là'],
    rumor: ['aucune idée honnêtement', 'je laisse mon manager gérer ça {laugh}'],
    serious: ['ouais je suis d’accord', 'faut en parler, oui'],
    complaint: ['courage, ça ira mieux', 'ça arrive à tout le monde'],
    question: ['tranquille, et toi ?', 'bien, au calme avant le prochain'],
    flirt: ['{laugh} ok'],
    smalltalk: ['cool', '{laugh}', 'ouais', 'nice'],
    invite_yes: ['ouais carrément', 'ça marche, je suis dispo', 'easy, j’arrive'],
    invite_no: ['pas cette semaine, désolé', 'je passe, mais une prochaine'],
    cold: ['ok', 'mm'],
  },
};

/** Répliques propres à certains pilotes (pour coller à leur caractère réel). */
const DRIVER_LINES: Record<string, Bank> = {
  verstappen: {
    joke: ['haha ok', 'Simply lovely.', 'haha'],
    advice: ['Moins d’interviews, plus de simu. C’est tout le secret.', 'Le pneu avant gauche, c’est la clé à la plupart des circuits. Pense à ça.'],
    invite_yes: ['Ok. Mais si c’est du sim racing, je ne te laisse pas gagner.', 'Ouais, viens faire une endurance iRacing ce soir.'],
    taunt: ['Ok. Dimanche. Toi et moi.', 'Haha. On verra au premier virage.'],
    serious: ['Les jurons interdits à la radio, sérieux ? On est des adultes.', 'Faut juste que les commissaires soient cohérents. C’est tout.'],
  },
  norris: {
    complaint: ['honestly i’ve been there so many times, t’inquiète tu vas rebondir', 'on est tous nos pires critiques, sois pas trop dur avec toi'],
    invite_yes: ['GOLF?? enfin quelqu’un qui comprend', 'oui!!! je ramène Alex'],
    joke: ['hahahahaha je suis mort 💀', 'NON 😭😭', 'hahahaha mate'],
  },
  piastri: {
    congrats: ['Cheers.', 'Merci. Pas mal.', 'Ta.'],
    greet: ['Hey.', 'G’day.'],
    joke: ['Ha.', 'Pas mal.', 'Ok ça m’a fait sourire.'],
    smalltalk: ['Yeah.', 'Fair.', 'Interesting.', 'Ok.'],
    taunt: ['Ok.', 'Noted.', 'We’ll see.'],
    complaint: ['Pas idéal. Next one.', 'Could be worse.'],
  },
  leclerc: {
    complaint: ['Je connais trop bien ce sentiment… La malchance, j’en ai fait un art 😅 Courage !', 'Ça va tourner, crois-moi. Ici à Monaco on dit : on ne lâche jamais.'],
    invite_yes: ['Avec plaisir ! Padel à Monaco ? Je réserve le terrain 🎾', 'Oui ! Et après je te fais écouter mon nouveau morceau au piano 🎹'],
  },
  hamilton: {
    advice: ['Crois en toi même quand personne d’autre n’y croit. Still I rise 🙏🏾', 'Protège ton énergie, bro. Entoure-toi de bonnes personnes. Le reste suit ✨'],
    complaint: ['Les moments durs construisent les champions. Keep your head up, bro 💪🏾'],
    congrats: ['Merci bro 🙏🏾 Le travail paie. Fier de cette équipe ❤️', 'Grateful 🙏🏾 Merci pour le message.'],
  },
  alonso: {
    apology: ['Karma 😉', 'Je n’oublie jamais. Mais j’accepte 😎'],
    rumor: ['El Plan 😉', 'Tout le monde veut savoir mon avenir. Moi aussi {laugh}'],
  },
  bottas: {
    joke: ['😂😂', 'To whom it may concern: haha.', '😂 coffee break needed'],
    invite_yes: ['Gravel ride? I bring the coffee ☕🚴', 'Sauna after? 🧖'],
    greet: ['Terve! 👋', 'Hey my friend ☕'],
  },
  hulkenberg: {
    complaint: ['Mon gars, j’ai attendu 239 courses pour un podium. Tu as le temps {laugh}', 'Ja, ça arrive. Une bière et on oublie 🍺'],
    joke: ['Hulk approves 😏', 'haha good one'],
  },
  sainz: {
    invite_yes: ['¡Vamos! Padel demain matin ? Je ne fais pas de cadeaux 🌶️', 'Golf ? Smooth operator on the green 🌶️'],
  },
  gasly: {
    invite_yes: ['Grave frérot ! Et après on mate le Milan 🔴⚫', 'Avec plaisir ! Je ramène Charles'],
  },
  lawson: {
    taunt: ['Dis-le moi en face dimanche.', 'Je ne recule jamais. Tu le sais.', 'I don’t really care, mate.'],
    apology: ['Ok. Fair enough.', 'Fine. Passons.'],
  },
  colapinto: {
    congrats: ['GRACIAS {buddy}!! 🇦🇷💙 quelle course hermano', 'merciii vamos!!'],
  },
  perez: {
    complaint: ['Never give up, amigo. J’en ai vécu des pires 🙏', 'La F1 te teste toujours. Courage 💪'],
  },
};

function applyVoice(p: Persona, text: string): string {
  let out = text.replace(/\{buddy\}/g, p.buddy).replace(/\{laugh\}/g, p.laugh);
  if (p.lowercase) out = out.toLowerCase();
  if (p.emojis.length && chance(0.25) && !/\p{Extended_Pictographic}/u.test(out)) out += ' ' + pick(p.emojis);
  return out;
}

export function voiceLine(driverId: string, key: keyof Bank, fallback = 'smalltalk'): string {
  const def = DRIVERS_BY_ID[driverId];
  if (!def) return '👍';
  const p = def.persona;
  const own = DRIVER_LINES[driverId]?.[key];
  const style = STYLE_LINES[p.style][key] ?? STYLE_LINES[p.style][fallback as keyof Bank] ?? ['👍'];
  const pool = own && chance(0.65) ? own : style;
  return applyVoice(p, pick(pool));
}

export interface LocalReply {
  text: string;
  rel: Partial<Relationship>;
  acceptedActivity?: string;
}

/** Probabilité qu'un pilote accepte une invitation. */
export function inviteAcceptance(s: GameState, driverId: string, activityId: string | null): number {
  const def = DRIVERS_BY_ID[driverId];
  if (!def) return 0.3;
  const rel = s.drivers[driverId]?.rel;
  let p = 0.3 + (rel ? rel.friendship / 200 : 0) + def.persona.traits.warmth / 400;
  if (activityId && def.persona.likes.includes(activityId)) p += 0.3;
  if (rel && rel.rivalry > 60) p -= 0.2;
  if (teamOf(s, driverId) === teamOf(s, PLAYER_ID)) p += 0.1;
  return Math.max(0.05, Math.min(0.95, p));
}

export function localReply(s: GameState, driverId: string, intent: Intent, rawText: string, activityId: string | null): LocalReply {
  const def = DRIVERS_BY_ID[driverId];
  const d = s.drivers[driverId];
  if (!def || !d) return { text: '👍', rel: {} };
  const p = def.persona;
  const t = p.traits;
  const rel = d.rel;
  // Pilote froid si la relation est mauvaise
  if (rel.friendship < -40 && intent !== 'apology' && chance(0.6)) {
    return { text: voiceLine(driverId, 'cold'), rel: { friendship: intent === 'taunt' ? -4 : 0 } };
  }
  switch (intent) {
    case 'invite': {
      const ok = chance(inviteAcceptance(s, driverId, activityId));
      const act = activityId ? ACTIVITIES_BY_ID[activityId] : null;
      const likes = !!activityId && p.likes.includes(activityId);
      // Les répliques propres au pilote parlent de SES activités : seulement s'il les aime
      const line = ok && act && !likes ? applyVoice(p, pick(STYLE_LINES[p.style].invite_yes ?? ['Ok !'])) : voiceLine(driverId, ok ? 'invite_yes' : 'invite_no');
      return {
        text: ok && act && !likes && chance(0.5) ? line + ` (même si ${act.name.toLowerCase()}, c’est pas trop mon truc ${p.laugh})` : ok && likes && act ? `${line} ${act.emoji}` : line,
        rel: { friendship: ok ? 2 : 0 },
        acceptedActivity: ok ? activityId ?? 'dinner' : undefined,
      };
    }
    case 'taunt': {
      const temper = t.temper / 100;
      return { text: voiceLine(driverId, 'taunt'), rel: { friendship: -Math.round(3 + temper * 6), rivalry: Math.round(4 + temper * 6), respect: t.ego > 75 ? -2 : 0 } };
    }
    case 'apology':
      return { text: voiceLine(driverId, 'apology'), rel: { friendship: 6, respect: 3, rivalry: -3 } };
    case 'congrats':
    case 'compliment':
      return { text: voiceLine(driverId, 'congrats'), rel: { friendship: 3, respect: 1 } };
    case 'thanks':
      return { text: voiceLine(driverId, 'thanks'), rel: { friendship: 1 } };
    case 'advice':
      return { text: voiceLine(driverId, 'advice'), rel: { friendship: 2, respect: t.ego > 70 ? 2 : 1 } };
    case 'joke':
      return { text: voiceLine(driverId, 'joke'), rel: { friendship: t.humor > 60 ? 3 : 1 } };
    case 'rumor':
      return { text: voiceLine(driverId, 'rumor'), rel: {} };
    case 'serious':
      return { text: voiceLine(driverId, 'serious'), rel: { respect: 2, friendship: 1 } };
    case 'complaint':
      return { text: voiceLine(driverId, 'complaint'), rel: { friendship: 2 } };
    case 'question':
      return { text: contextualAnswer(s, driverId, rawText) ?? voiceLine(driverId, 'question'), rel: { friendship: 1 } };
    case 'flirt':
      return { text: voiceLine(driverId, 'flirt'), rel: { friendship: -1 } };
    case 'greet':
      return { text: voiceLine(driverId, 'greet'), rel: { friendship: 1 } };
    default:
      return { text: voiceLine(driverId, 'smalltalk'), rel: { friendship: 0.5 } };
  }
}

function contextualAnswer(s: GameState, driverId: string, raw: string): string | null {
  const last = s.results[s.results.length - 1];
  if (!last) return null;
  const me = last.race.find((e) => e.driverId === driverId);
  const def = DRIVERS_BY_ID[driverId];
  if (!me || !def) return null;
  if (/(course|race|dimanche|sunday|gp|result)/i.test(raw)) {
    const team = TEAMS_BY_ID[me.teamId].name;
    if (me.dnf) return applyVoice(def.persona, `Franchement frustrant, abandon (${me.dnf}). On doit comprendre avec ${team}.`);
    if (me.position <= 3) return applyVoice(def.persona, `P${me.position}, super content ! ${pick(def.persona.catchphrases)}`);
    if (me.position <= 10) return applyVoice(def.persona, `P${me.position}, des points, c’est correct. On peut faire mieux.`);
    return applyVoice(def.persona, `P${me.position}… on n’avait pas le rythme. Next one.`);
  }
  return null;
}

/** Message spontané d'un pilote au joueur (selon contexte). */
export function spontaneousDM(s: GameState, driverId: string, context: 'collision' | 'congrats' | 'invite' | 'banter' | 'support' | 'birthday', extra?: { activityId?: string; position?: number }): string {
  const def = DRIVERS_BY_ID[driverId];
  if (!def) return '';
  const p = def.persona;
  const pl = s.player.firstName;
  switch (context) {
    case 'collision': {
      const lines =
        p.traits.temper > 65
          ? ['Sérieusement ?? Tu m’as complètement détruit ma course.', 'C’était quoi ce mouvement ? Tu n’avais aucune chance de passer.', `T’as intérêt à regarder les images ${pl}. C’était n’importe quoi.`]
          : p.traits.warmth > 75
            ? ['Hey… dommage pour le contact tout à l’heure. On en parle au calme ?', 'Pas cool ce qui s’est passé, mais je ne t’en veux pas trop. Fais gaffe la prochaine fois.']
            : ['On doit parler de ce qui s’est passé en piste.', 'Ce contact, je ne l’ai pas trop aimé.'];
      return applyVoice(p, pick(lines));
    }
    case 'congrats': {
      const pos = extra?.position ?? 1;
      const lines =
        pos === 1
          ? [`Bravo pour la victoire ${pl} !! Énorme 🔥`, 'Congrats mate, mérité. Profite ce soir.', `Première place, rien à dire. Respect ${pl}.`]
          : [`Joli podium ${pl} !`, 'Belle course, bien joué.', 'GG pour le podium, solide.'];
      return applyVoice(p, pick(lines));
    }
    case 'invite': {
      const act = extra?.activityId ? ACTIVITIES_BY_ID[extra.activityId] : null;
      const name = act ? act.name.toLowerCase() : 'un dîner';
      return applyVoice(p, pick([`Hey ${pl}, ${name} cette semaine ? Je cherche du monde.`, `Ça te dit ${name} avant le prochain GP ? {buddy}`, `Dispo pour ${name} ? On sera quelques-uns.`]));
    }
    case 'support':
      return applyVoice(p, pick([`Week-end compliqué ${pl}, mais garde la tête haute. Ça va revenir.`, 'Courage pour la suite. Tout le monde a des week-ends comme ça.', 'Hey, ne lis pas les commentaires. Tu vaux mieux que ce résultat.']));
    case 'birthday':
      return applyVoice(p, pick([`Joyeux anniversaire ${pl} !! 🎂`, 'Happy birthday mate 🎉', 'Bon anniv ! Profite bien 🥳']));
    default:
      return applyVoice(p, pick(['Tu as vu le nouveau règlement sur les jurons à la radio ? lol', 'Simu ce soir ? On monte une team pour une course d’endurance.', 'Qui organise le prochain dîner des pilotes ?', `Le circuit de ${lastNameOf(s, driverId)}… non je rigole. Prêt pour le prochain GP ?`]));
  }
}
