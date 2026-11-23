/**
 * Analyse de texte libre (français + anglais) pour interpréter ce que le joueur
 * écrit en interview, en message privé ou dans le groupe WhatsApp.
 */
import { DRIVERS } from '../../data/drivers';
import { TEAMS } from '../../data/teams';
import type { TeamId } from '../types';

export function normalize(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ');
}

const LEX = {
  positive: ['pleased', 'delighted', 'fantastic', 'brilliant', 'enjoyed', 'love it', 'special', 'mega', 'solid', 'content', 'heureux', 'super', 'genial', 'incroyable', 'fier', 'merci', 'bravo', 'top', 'parfait', 'excellent', 'magnifique', 'bien', 'great', 'happy', 'proud', 'amazing', 'awesome', 'love', 'adore', 'kiffe', 'enorme', 'fantastique', 'positif', 'satisfait', 'ravi', 'good', 'nice', 'cool', 'gg', 'chapeau', 'respect', 'felicitations', 'congrats', 'well done', 'bien joue', 'grandiose', 'reve'],
  negative: ['decu', 'nul', 'catastrophe', 'horrible', 'colere', 'enerve', 'frustre', 'frustrant', 'mauvais', 'pire', 'honte', 'merde', 'putain', 'bad', 'terrible', 'disappointed', 'angry', 'frustrated', 'worst', 'shit', 'fuck', 'damn', 'degoute', 'rage', 'galere', 'penible', 'inacceptable', 'ridicule', 'pathetique', 'lamentable'],
  humble: ['credit to', 'hard work', 'thank the', 'thanks to', 'big thanks', 'the boys', 'my engineers', 'keep learning', 'one race at a time', 'still a lot to learn', 'equipe', 'les gars', 'mecaniciens', 'travail', 'apprendre', 'progresser', 'humble', 'chance', 'team', 'guys', 'mechanics', 'learn', 'improve', 'grateful', 'reconnaissant', 'ensemble', 'together', 'usine', 'factory', 'merci a', 'thanks to', 'respect', 'on va travailler', 'step by step', 'pas a pas', 'concentre'],
  arrogant: ['i am the best', 'i\'m the best', 'im the best', 'the fastest', 'better than everyone', 'nobody can', 'no one can', 'too good', 'i deserve', 'i will destroy', 'dominate', 'they are slow', 'meilleur', 'le plus rapide', 'personne', 'facile', 'trop fort', 'je suis le', 'best driver', 'easy', 'nobody', 'champion', 'je merite', 'i deserve', 'domine', 'dominer', 'ecraser', 'detruire', 'destroy', 'goat', 'legende', 'evidemment', 'obviously', 'trop lent', 'too slow', 'aucun pilote', 'je suis superieur', 'je les ai tous', 'personne ne peut'],
  blameTeam: ['the strategy', 'wrong strategy', 'bad strategy', 'the car is', 'the team messed', 'team mistake', 'they called', 'the pit crew', 'poor pit stop', 'not good enough car', 'the engineers', 'strategie', 'strategy', 'voiture lente', 'slow car', 'stands', 'pit stop', 'arret', 'equipe a fait', 'mauvais choix', 'erreur de l equipe', 'team mistake', 'ils ont', 'they made', 'la voiture est nulle', 'car is shit', 'pas au niveau', 'fiabilite', 'reliability', 'ingenieur', 'engineer', 'mal geree', 'incompetent', 'amateur'],
  blameOther: ['his fault', 'he hit me', 'crashed into me', 'pushed me off', 'no space', 'didn\'t leave space', 'didnt leave space', 'moved under braking', 'reckless', 'idiot', 'dangerous', 'sa faute', 'his fault', 'il m a', 'he hit', 'm a percute', 'idiot', 'dangereux', 'dangerous', 'stupide', 'stupid', 'inconscient', 'pousse dehors', 'pushed me', 'm a sorti', 'a pas regarde', 'didn t look', 'kamikaze', 'aveugle', 'blind', 'penalite meritee', 'n importe quoi'],
  apology: ['desole', 'pardon', 'excuse', 'ma faute', 'mon erreur', 'sorry', 'my fault', 'my mistake', 'apologize', 'je m excuse', 'j assume', 'responsabilite', 'c est moi'],
  humor: ['haha', 'ahah', 'lol', 'mdr', 'ptdr', 'xd', 'blague', 'joke', '😂', '🤣', '😅', 'rigole', 'drole', 'funny', 'jajaja', 'kkk', 'hihi', 'lmao'],
  ambition: ['titre', 'champion', 'gagner', 'victoire', 'podium', 'win', 'title', 'objectif', 'goal', 'ambition', 'battre', 'beat', 'conquerir', 'premier', 'pole'],
  loyalty: ['stay here', 'my team', 'committed', 'long-term', 'happy here', 'this is my home', 'rester', 'stay', 'loyal', 'fidele', 'ma maison', 'my home', 'famille', 'family', 'long terme', 'long term', 'engage', 'committed', 'prolonger', 'extend', 'heureux ici', 'happy here'],
  leaving: ['other teams', 'options', 'open to', 'we will see', 'we\'ll see', 'my manager is talking', 'talks', 'nothing signed', 'partir', 'leave', 'quitter', 'autres options', 'other options', 'offres', 'offers', 'ouvert', 'open to', 'marche', 'market', 'discussions', 'talks', 'on verra', 'we will see', 'rien n est signe', 'nothing is signed', 'pourquoi pas'],
  vulgar: ['merde', 'putain', 'connard', 'enfoire', 'fuck', 'shit', 'bitch', 'con ', 'salope', 'batard', 'ta gueule', 'nique', 'bordel', 'chier', 'wtf'],
  greeting: ['salut', 'hello', 'hey', 'coucou', 'bonjour', 'yo', 'hi ', 'wesh', 'ciao', 'hola', 'bonsoir', 'slt', 'cc '],
  question: ['?', 'comment', 'pourquoi', 'quand', 'ou ', 'quoi', 'how', 'why', 'when', 'what', 'tu penses', 'you think', 'ca va', 'how are you', 'quel', 'est-ce'],
  invite: ['viens', 'tu viens', 'on se fait', 'dispo', 'partant', 'chaud pour', 'ca te dit', 'join', 'wanna', 'want to', 'up for', 'dinner', 'diner', 'golf', 'padel', 'soiree', 'party', 'yacht', 'sortie', 'session', 'on joue', 'ce soir', 'tonight', 'ce weekend', 'demain', 'tomorrow', 'invite'],
  advice: ['conseil', 'advice', 'tips', 'astuce', 'comment tu fais', 'how do you', 'aide', 'help', 'tu me conseilles', 'apprendre de toi'],
  compliment: ['tu es fort', 'tu es le meilleur', 'quel pilote', 'great drive', 'what a drive', 'impressionnant', 'impressive', 'talent', 'monstre', 'beast', 'masterclass', 'respect', 'idole', 'idol', 'legende', 'goat', 'chapeau', 'bien joue', 'well done', 'congrats', 'bravo', 'felicitations'],
  taunt: ['lent', 'slow', 'nul', 'loser', 'perdant', 'tu dors', 'escargot', 'tortue', 'derriere moi', 'behind me', 'mes roues', 'my gearbox', 'ma boite', 'cheh', 'trop facile', 'easy', 'tu es fini', 'retraite', 'retire', 'papy', 'grandpa', 'pleure', 'cry', 'bouffon', 'clown', 'noob'],
  serious: ['securite', 'safety', 'gpda', 'reglement', 'regulation', 'fia', 'calendrier', 'calendar', 'sante', 'health', 'mental', 'chaleur', 'heat', 'environnement', 'diversite'],
  flirt: ['beau', 'belle', 'mignon', 'date', 'rendez-vous', 'bisou', 'kiss', 'je t aime', 'love you', '❤️', '😘'],
  rumor: ['rumeur', 'rumour', 'contrat', 'contract', 'transfert', 'transfer', 'prolonge', 'signe', 'sign', 'l annee prochaine', 'next year', 'quelle equipe', 'which team', 'baquet', 'seat', 'mercato'],
  weather: ['pluie', 'rain', 'meteo', 'weather', 'mouille', 'wet'],
  tyres: ['pneu', 'tyre', 'tire', 'degradation', 'gomme', 'graining', 'blistering'],
};

export type LexKey = keyof typeof LEX;

export interface TextAnalysis {
  scores: Record<LexKey, number>;
  sentiment: number; // -1..1
  length: number;
  words: number;
  exclamations: number;
  caps: number; // ratio majuscules
  mentionsDrivers: string[];
  mentionsTeams: TeamId[];
  emojis: number;
  isEmpty: boolean;
}

function countHits(text: string, words: string[]): number {
  let n = 0;
  for (const w of words) {
    if (w.length <= 3 && /^[a-z]+$/.test(w)) {
      const re = new RegExp(`(^|[^a-z])${w}([^a-z]|$)`, 'g');
      n += (text.match(re) ?? []).length;
    } else if (text.includes(w)) n++;
  }
  return n;
}

const DRIVER_ALIASES: Record<string, string[]> = Object.fromEntries(
  DRIVERS.map((d) => {
    const l = normalize(d.lastName);
    const f = normalize(d.firstName.split(' ')[0]);
    const extra: Record<string, string[]> = {
      verstappen: ['max', 'mad max', 'verstappen', 'super max'],
      hamilton: ['lewis', 'sir lewis', 'ham'],
      perez: ['checo', 'perez'],
      antonelli: ['kimi', 'antonelli'],
      hulkenberg: ['hulk', 'hulkenberg', 'nico'],
      sainz: ['carlos', 'sainz', 'smooth operator'],
      leclerc: ['charles', 'leclerc', 'lec'],
      bottas: ['valtteri', 'bottas', 'vb'],
      bearman: ['ollie', 'oliver', 'bearman'],
      norris: ['lando', 'norris'],
      alonso: ['fernando', 'alonso', 'nando'],
      albon: ['alex', 'albon'],
    };
    return [d.id, extra[d.id] ?? [l, f]];
  }),
);

export function analyze(raw: string): TextAnalysis {
  const t = ' ' + normalize(raw) + ' ';
  const scores = Object.fromEntries((Object.keys(LEX) as LexKey[]).map((k) => [k, countHits(t, LEX[k])])) as Record<LexKey, number>;
  const letters = raw.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const caps = letters.length ? raw.replace(/[^A-ZÀ-Þ]/g, '').length / letters.length : 0;
  const words = raw.trim().split(/\s+/).filter(Boolean).length;
  const emojis = (raw.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  const mentionsDrivers = Object.entries(DRIVER_ALIASES)
    .filter(([, al]) => al.some((a) => new RegExp(`(^|[^a-z])${a}([^a-z]|$)`).test(t)))
    .map(([id]) => id);
  const mentionsTeams = TEAMS.filter((tm) => [normalize(tm.name), normalize(tm.short), tm.id].some((a) => a.length > 2 && t.includes(` ${a}`))).map((tm) => tm.id);
  const pos = scores.positive + scores.humble * 0.5 + scores.compliment;
  const neg = scores.negative + scores.blameTeam * 0.5 + scores.blameOther * 0.7 + scores.vulgar + scores.taunt * 0.6;
  const sentiment = pos + neg === 0 ? 0 : (pos - neg) / (pos + neg);
  return {
    scores,
    sentiment,
    length: raw.length,
    words,
    exclamations: (raw.match(/!/g) ?? []).length,
    caps,
    mentionsDrivers,
    mentionsTeams,
    emojis,
    isEmpty: raw.trim().length < 2,
  };
}

export type Intent =
  | 'greet'
  | 'congrats'
  | 'apology'
  | 'taunt'
  | 'invite'
  | 'advice'
  | 'compliment'
  | 'joke'
  | 'rumor'
  | 'serious'
  | 'complaint'
  | 'question'
  | 'thanks'
  | 'flirt'
  | 'smalltalk';

export function detectIntent(a: TextAnalysis, rawText: string): Intent {
  const s = a.scores;
  const t = normalize(rawText);
  if (s.apology > 0) return 'apology';
  if (s.taunt > 0 && s.compliment === 0) return 'taunt';
  if (s.vulgar > 0 && a.sentiment < 0) return 'taunt';
  if (s.invite > 0 && (s.question > 0 || /viens|dispo|partant|ca te dit|wanna|up for|join/.test(t))) return 'invite';
  if (s.compliment > 0 || /(bravo|felicitations|congrats|gg|bien joue|well done)/.test(t)) return 'congrats';
  if (/(merci|thanks|thank you|cheers)/.test(t)) return 'thanks';
  if (s.advice > 0) return 'advice';
  if (s.rumor > 0) return 'rumor';
  if (s.serious > 0) return 'serious';
  if (s.flirt > 0) return 'flirt';
  if (s.humor > 0) return 'joke';
  if (s.negative > 0 || s.blameTeam > 0 || s.blameOther > 0) return 'complaint';
  if (s.greeting > 0 && a.words <= 4) return 'greet';
  if (s.question > 0) return 'question';
  return 'smalltalk';
}

/** Activité mentionnée dans un message (pour les invitations). */
export function detectActivity(raw: string): string | null {
  const t = normalize(raw);
  const map: [RegExp, string][] = [
    [/golf/, 'golf'],
    [/padel/, 'padel'],
    [/(sim|iracing|simu|gaming|jouer|game|stream)/, 'simracing'],
    [/(velo|bike|cycling|gravel)/, 'cycling'],
    [/(diner|dinner|resto|restaurant|manger|bouffe|eat)/, 'dinner'],
    [/(soiree|party|club|fete|teuf)/, 'party'],
    [/(yacht|bateau|boat)/, 'yacht'],
    [/(foot|match|football|soccer)/, 'football'],
    [/(kart)/, 'karting'],
    [/(ski)/, 'ski'],
    [/(surf)/, 'surf'],
    [/(poker|cartes)/, 'poker'],
    [/(cafe|coffee)/, 'coffee'],
    [/(gym|salle|muscu|workout|training|entrain)/, 'gym'],
    [/(piano|musique|music)/, 'piano'],
    [/(peche|fishing)/, 'fishing'],
  ];
  for (const [re, id] of map) if (re.test(t)) return id;
  return null;
}

/** Plusieurs intentions dans un même message (ex. félicitations + demande de conseil). */
export function detectIntents(a: TextAnalysis, rawText: string): Intent[] {
  const primary = detectIntent(a, rawText);
  const out: Intent[] = [primary];
  const s = a.scores;
  const t = normalize(rawText);
  const add = (i: Intent, cond: boolean) => {
    if (cond && !out.includes(i)) out.push(i);
  };
  add('advice', s.advice > 0);
  add('invite', s.invite > 0 && /(viens|dispo|partant|ca te dit|wanna|up for|join|\?)/.test(t));
  add('rumor', s.rumor > 0);
  add('congrats', s.compliment > 0 || /(bravo|felicitations|congrats|well done|bien joue)/.test(t));
  add('question', s.question > 0 && out.length === 1 && !['invite', 'advice', 'rumor', 'apology', 'taunt'].includes(primary));
  // Ordre naturel : on répond d'abord aux félicitations, puis à la demande
  const order: Intent[] = ['apology', 'greet', 'congrats', 'thanks', 'taunt', 'complaint', 'joke', 'advice', 'invite', 'rumor', 'serious', 'question', 'compliment', 'flirt', 'smalltalk'];
  return out.sort((x, y) => order.indexOf(x) - order.indexOf(y));
}
