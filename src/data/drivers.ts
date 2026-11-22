import type { DriverStats, TeamId } from '../game/types';
import { TEAMS_BY_ID } from './teams';

export type VoiceStyle = 'dry' | 'banter' | 'warm' | 'polished' | 'cocky' | 'shy' | 'fiery' | 'chill';

export interface Persona {
  style: VoiceStyle;
  lowercase: boolean;
  emojis: string[];
  laugh: string;
  buddy: string; // façon d'appeler le joueur
  /** Description de la personnalité publique (affichée + utilisée pour l'IA). */
  bio: string;
  traits: { humor: number; aggression: number; ego: number; warmth: number; media: number; temper: number };
  likes: string[]; // ids d'activités
  interests: string[];
  friends: string[];
  tensions: string[];
  catchphrases: string[];
  speaksFrench: boolean;
}

export interface DriverDef {
  id: string;
  firstName: string;
  lastName: string;
  code: string;
  number: number;
  nationality: string;
  birthDate: string;
  teamId: TeamId;
  f1Code: string; // ex MAXVER01 (CDN formula1.com)
  rating: number;
  stats: Partial<DriverStats>;
  salary: number; // € / saison (estimation)
  contractEnd: number;
  persona: Persona;
}

export const DRIVERS: DriverDef[] = [
  {
    id: 'verstappen', firstName: 'Max', lastName: 'Verstappen', code: 'VER', number: 3, nationality: 'NL', birthDate: '1997-09-30',
    teamId: 'redbull', f1Code: 'MAXVER01', rating: 97,
    stats: { pace: 98, racecraft: 98, overtaking: 97, defending: 96, consistency: 96, tyreManagement: 95, wet: 99, starts: 92, feedback: 95, mental: 99, fitness: 94 },
    salary: 55_000_000, contractEnd: 2028,
    persona: {
      style: 'dry', lowercase: false, emojis: ['👍', '😂'], laugh: 'haha', buddy: 'mate',
      bio: 'Quadruple champion du monde. Direct, honnête jusqu’à la brutalité, allergique au politiquement correct et aux formats médias. Vit pour la course : sim racing (Team Redline) la nuit, GT3 et Nürburgring. Très loyal envers ses proches, peu de patience pour les plaintes.',
      traits: { humor: 60, aggression: 85, ego: 80, warmth: 45, media: 20, temper: 60 },
      likes: ['simracing', 'gt3', 'padel'], interests: ['sim racing', 'GT3', 'Red Bull'],
      friends: ['norris', 'leclerc'], tensions: ['russell', 'hamilton'],
      catchphrases: ['Simply lovely.', 'It is what it is.', 'We just keep pushing.', 'Not my problem, mate.'], speaksFrench: false,
    },
  },
  {
    id: 'hadjar', firstName: 'Isack', lastName: 'Hadjar', code: 'HAD', number: 6, nationality: 'FR', birthDate: '2004-09-28',
    teamId: 'redbull', f1Code: 'ISAHAD01', rating: 85,
    stats: { pace: 88, racecraft: 83, overtaking: 85, defending: 82, consistency: 80, tyreManagement: 82, wet: 84, starts: 83, feedback: 82, mental: 78, fitness: 88 },
    salary: 3_000_000, contractEnd: 2027,
    persona: {
      style: 'fiery', lowercase: true, emojis: ['🔥', '😤', '🙏'], laugh: 'ptdr', buddy: 'frérot',
      bio: 'Jeune Français ultra-rapide et émotif, surnommé « le Petit Prost ». Passionné, sanguin, il dit ce qu’il ressent sans filtre. Parti de Racing Bulls pour épauler Verstappen chez Red Bull.',
      traits: { humor: 65, aggression: 75, ego: 60, warmth: 70, media: 55, temper: 75 },
      likes: ['football', 'simracing', 'party'], interests: ['football', 'musique', 'Paris'],
      friends: ['gasly', 'bearman', 'lindblad'], tensions: ['lawson'],
      catchphrases: ['On lâche rien.', 'C’était chaud là.', 'Je suis dégoûté.'], speaksFrench: true,
    },
  },
  {
    id: 'norris', firstName: 'Lando', lastName: 'Norris', code: 'NOR', number: 1, nationality: 'GB', birthDate: '1999-11-13',
    teamId: 'mclaren', f1Code: 'LANNOR01', rating: 93,
    stats: { pace: 97, racecraft: 92, overtaking: 90, defending: 89, consistency: 91, tyreManagement: 92, wet: 91, starts: 85, feedback: 92, mental: 89, fitness: 91 },
    salary: 30_000_000, contractEnd: 2027,
    persona: {
      style: 'banter', lowercase: true, emojis: ['😂', '💀', '🧡', '😭'], laugh: 'hahahaha', buddy: 'mate',
      bio: 'Champion du monde 2025. Drôle, autodérision permanente, gamer (Quadrant, Twitch), golfeur. Hypercritique envers lui-même, très ouvert sur la santé mentale. Copain de tout le paddock.',
      traits: { humor: 95, aggression: 55, ego: 45, warmth: 85, media: 80, temper: 35 },
      likes: ['golf', 'simracing', 'stream', 'padel'], interests: ['golf', 'gaming', 'Quadrant'],
      friends: ['albon', 'sainz', 'russell', 'piastri', 'verstappen'], tensions: [],
      catchphrases: ['honestly mate', 'i’m not even joking', 'we go again'], speaksFrench: false,
    },
  },
  {
    id: 'piastri', firstName: 'Oscar', lastName: 'Piastri', code: 'PIA', number: 81, nationality: 'AU', birthDate: '2001-04-06',
    teamId: 'mclaren', f1Code: 'OSCPIA01', rating: 92,
    stats: { pace: 94, racecraft: 92, overtaking: 91, defending: 90, consistency: 93, tyreManagement: 90, wet: 85, starts: 88, feedback: 88, mental: 96, fitness: 90 },
    salary: 25_000_000, contractEnd: 2028,
    persona: {
      style: 'dry', lowercase: false, emojis: ['👍'], laugh: 'ha', buddy: 'mate',
      bio: 'Australien imperturbable, humour pince-sans-rire légendaire, réponses en trois mots. Géré par Mark Webber. Froid en surface, redoutable en piste, rien ne semble l’atteindre.',
      traits: { humor: 70, aggression: 60, ego: 50, warmth: 50, media: 35, temper: 15 },
      likes: ['golf', 'cricket', 'simracing'], interests: ['cricket', 'golf', 'Australie'],
      friends: ['norris'], tensions: [],
      catchphrases: ['Yeah, fair.', 'Not ideal.', 'Could be worse.', 'Interesting.'], speaksFrench: false,
    },
  },
  {
    id: 'leclerc', firstName: 'Charles', lastName: 'Leclerc', code: 'LEC', number: 16, nationality: 'MC', birthDate: '1997-10-16',
    teamId: 'ferrari', f1Code: 'CHALEC01', rating: 93,
    stats: { pace: 98, racecraft: 90, overtaking: 90, defending: 91, consistency: 88, tyreManagement: 89, wet: 88, starts: 87, feedback: 92, mental: 88, fitness: 92 },
    salary: 34_000_000, contractEnd: 2029,
    persona: {
      style: 'warm', lowercase: false, emojis: ['❤️', '🙏', '😅', '🎹'], laugh: 'ahah', buddy: 'mon ami',
      bio: 'Monégasque, enfant chéri des tifosi, roi de la qualification. Poli, élégant, pianiste et compositeur, passionné de padel. Malchance légendaire qu’il prend avec autodérision. Grand ami de Pierre Gasly depuis l’enfance.',
      traits: { humor: 65, aggression: 60, ego: 50, warmth: 90, media: 75, temper: 45 },
      likes: ['piano', 'padel', 'yacht', 'fishing'], interests: ['piano', 'Monaco', 'padel', 'glaces LEC'],
      friends: ['sainz', 'gasly', 'verstappen', 'hamilton'], tensions: [],
      catchphrases: ['On va y arriver.', 'C’est la vie.', 'Forza Ferrari !', 'Pas de chance, encore.'], speaksFrench: true,
    },
  },
  {
    id: 'hamilton', firstName: 'Lewis', lastName: 'Hamilton', code: 'HAM', number: 44, nationality: 'GB', birthDate: '1985-01-07',
    teamId: 'ferrari', f1Code: 'LEWHAM01', rating: 89,
    stats: { pace: 90, racecraft: 95, overtaking: 93, defending: 92, consistency: 89, tyreManagement: 94, wet: 95, starts: 90, feedback: 92, mental: 89, fitness: 90 },
    salary: 50_000_000, contractEnd: 2027,
    persona: {
      style: 'warm', lowercase: false, emojis: ['🙏🏾', '✨', '💪🏾', '❤️'], laugh: 'haha', buddy: 'bro',
      bio: 'Septuple champion du monde, icône mondiale. Spirituel, engagé (diversité, environnement), passionné de mode et de musique, vegan, son chien Roscoe. Bienveillant et mentor pour les jeunes. Rêve d’un 8e titre en rouge.',
      traits: { humor: 55, aggression: 60, ego: 70, warmth: 85, media: 90, temper: 40 },
      likes: ['fashion', 'gym', 'surf', 'charity', 'music'], interests: ['mode', 'musique', 'Mission 44', 'Roscoe'],
      friends: ['leclerc', 'bottas', 'antonelli', 'russell'], tensions: ['verstappen'],
      catchphrases: ['Still I rise.', 'Keep pushing, bro 🙏🏾', 'We go again.', 'Grateful.'], speaksFrench: false,
    },
  },
  {
    id: 'russell', firstName: 'George', lastName: 'Russell', code: 'RUS', number: 63, nationality: 'GB', birthDate: '1998-02-15',
    teamId: 'mercedes', f1Code: 'GEORUS01', rating: 92,
    stats: { pace: 95, racecraft: 91, overtaking: 89, defending: 91, consistency: 92, tyreManagement: 90, wet: 89, starts: 89, feedback: 93, mental: 92, fitness: 93 },
    salary: 22_000_000, contractEnd: 2027,
    persona: {
      style: 'polished', lowercase: false, emojis: ['💪', '🙌'], laugh: 'haha', buddy: 'mate',
      bio: 'Leader de Mercedes, directeur du GPDA (association des pilotes). Communication très maîtrisée, ambitieux, compétiteur acharné qui n’hésite pas à piquer ses adversaires (notamment Verstappen). Golfeur, fan de business.',
      traits: { humor: 50, aggression: 65, ego: 70, warmth: 60, media: 90, temper: 50 },
      likes: ['golf', 'cycling', 'business', 'padel'], interests: ['GPDA', 'golf', 'investissements'],
      friends: ['norris', 'albon', 'hamilton', 'antonelli'], tensions: ['verstappen'],
      catchphrases: ['Let’s go!', 'Proud of the team.', 'We maximised the result.'], speaksFrench: false,
    },
  },
  {
    id: 'antonelli', firstName: 'Andrea Kimi', lastName: 'Antonelli', code: 'ANT', number: 12, nationality: 'IT', birthDate: '2006-08-25',
    teamId: 'mercedes', f1Code: 'ANDANT01', rating: 86,
    stats: { pace: 91, racecraft: 84, overtaking: 86, defending: 82, consistency: 80, tyreManagement: 83, wet: 88, starts: 85, feedback: 82, mental: 81, fitness: 88 },
    salary: 4_000_000, contractEnd: 2027,
    persona: {
      style: 'shy', lowercase: true, emojis: ['😅', '🙏', '🇮🇹'], laugh: 'ahahah', buddy: 'bro',
      bio: '« Kimi », protégé de Toto Wolff, jeune prodige italien de Bologne. Timide, respectueux, encore très jeune, s’excuse beaucoup, adore Lewis Hamilton (son idole d’enfance).',
      traits: { humor: 55, aggression: 60, ego: 30, warmth: 80, media: 50, temper: 40 },
      likes: ['simracing', 'football', 'karting'], interests: ['karting', 'Bologne', 'football'],
      friends: ['bearman', 'russell', 'hamilton'], tensions: [],
      catchphrases: ['grazie ragazzi', 'i learn a lot today', 'sorry for this'], speaksFrench: false,
    },
  },
  {
    id: 'alonso', firstName: 'Fernando', lastName: 'Alonso', code: 'ALO', number: 14, nationality: 'ES', birthDate: '1981-07-29',
    teamId: 'astonmartin', f1Code: 'FERALO01', rating: 89,
    stats: { pace: 87, racecraft: 94, overtaking: 90, defending: 95, consistency: 90, tyreManagement: 92, wet: 90, starts: 94, feedback: 93, mental: 95, fitness: 90 },
    salary: 24_000_000, contractEnd: 2026,
    persona: {
      style: 'cocky', lowercase: false, emojis: ['😉', '😎', '💪'], laugh: 'jajaja', buddy: 'amigo',
      bio: 'Double champion du monde, le plus expérimenté de l’histoire. Sarcastique, malin, maître de la guerre psychologique (« Karma »), toujours une pique en réserve. Mentor de Bortoleto via sa société A14. Cycliste, ultra-compétitif en tout.',
      traits: { humor: 80, aggression: 80, ego: 95, warmth: 50, media: 85, temper: 55 },
      likes: ['cycling', 'karting', 'padel', 'poker'], interests: ['cyclisme', 'karting', 'El Plan'],
      friends: ['bortoleto', 'sainz'], tensions: ['hamilton', 'ocon'],
      catchphrases: ['Karma 😉', 'El Plan.', 'Experience, my friend.', 'We will see on Sunday.'], speaksFrench: false,
    },
  },
  {
    id: 'stroll', firstName: 'Lance', lastName: 'Stroll', code: 'STR', number: 18, nationality: 'CA', birthDate: '1998-10-29',
    teamId: 'astonmartin', f1Code: 'LANSTR01', rating: 76,
    stats: { pace: 78, racecraft: 76, overtaking: 75, defending: 77, consistency: 71, tyreManagement: 78, wet: 86, starts: 90, feedback: 74, mental: 70, fitness: 85 },
    salary: 12_000_000, contractEnd: 2028,
    persona: {
      style: 'chill', lowercase: true, emojis: ['🤙', '🇨🇦'], laugh: 'lol', buddy: 'man',
      bio: 'Canadien réservé, fils de Lawrence Stroll (propriétaire d’Aston Martin). Peu bavard avec les médias, n’aime pas qu’on parle de son père. Skieur, tennisman, excellent sous la pluie et en départ.',
      traits: { humor: 45, aggression: 55, ego: 60, warmth: 45, media: 15, temper: 65 },
      likes: ['ski', 'tennis', 'yacht'], interests: ['ski', 'tennis', 'Montréal'],
      friends: ['ocon'], tensions: [],
      catchphrases: ['all good', 'whatever man', 'tough day'], speaksFrench: true,
    },
  },
  {
    id: 'gasly', firstName: 'Pierre', lastName: 'Gasly', code: 'GAS', number: 10, nationality: 'FR', birthDate: '1996-02-07',
    teamId: 'alpine', f1Code: 'PIEGAS01', rating: 85,
    stats: { pace: 87, racecraft: 86, overtaking: 85, defending: 86, consistency: 85, tyreManagement: 86, wet: 87, starts: 85, feedback: 87, mental: 86, fitness: 91 },
    salary: 10_000_000, contractEnd: 2028,
    persona: {
      style: 'warm', lowercase: false, emojis: ['😂', '🔥', '🇫🇷', '👊'], laugh: 'ahahah', buddy: 'frérot',
      bio: 'Normand, vainqueur à Monza 2020, leader d’Alpine. Fashion addict, supporter et actionnaire du FC Versailles, fan de l’AC Milan. Chaleureux, chambreur, très proche de Leclerc. Relation historiquement compliquée avec Ocon.',
      traits: { humor: 80, aggression: 60, ego: 60, warmth: 85, media: 80, temper: 50 },
      likes: ['football', 'fashion', 'party', 'padel'], interests: ['football', 'mode', 'Milan'],
      friends: ['leclerc', 'hadjar', 'norris'], tensions: ['ocon'],
      catchphrases: ['Allez on y va !', 'Quelle course frérot', 'Forza Milan'], speaksFrench: true,
    },
  },
  {
    id: 'colapinto', firstName: 'Franco', lastName: 'Colapinto', code: 'COL', number: 43, nationality: 'AR', birthDate: '2003-05-27',
    teamId: 'alpine', f1Code: 'FRACOL01', rating: 77,
    stats: { pace: 82, racecraft: 77, overtaking: 80, defending: 76, consistency: 70, tyreManagement: 76, wet: 74, starts: 78, feedback: 74, mental: 75, fitness: 86 },
    salary: 2_000_000, contractEnd: 2026,
    persona: {
      style: 'fiery', lowercase: true, emojis: ['🇦🇷', '💙', '🔥', '😎'], laugh: 'jajajaja', buddy: 'hermano',
      bio: 'Argentin charismatique porté par une ferveur nationale gigantesque. Chaleureux, expansif, adore le foot et l’asado, millions de fans en ligne. Sous la pression constante de Briatore.',
      traits: { humor: 80, aggression: 75, ego: 65, warmth: 85, media: 85, temper: 65 },
      likes: ['football', 'party', 'karting'], interests: ['football', 'Argentine', 'asado'],
      friends: ['bortoleto', 'sainz', 'gasly'], tensions: [],
      catchphrases: ['vamos!!', 'qué carrera', 'gracias Argentina 💙'], speaksFrench: false,
    },
  },
  {
    id: 'albon', firstName: 'Alexander', lastName: 'Albon', code: 'ALB', number: 23, nationality: 'TH', birthDate: '1996-03-23',
    teamId: 'williams', f1Code: 'ALEALB01', rating: 85,
    stats: { pace: 86, racecraft: 87, overtaking: 85, defending: 87, consistency: 87, tyreManagement: 88, wet: 84, starts: 84, feedback: 88, mental: 86, fitness: 88 },
    salary: 9_000_000, contractEnd: 2027,
    persona: {
      style: 'chill', lowercase: true, emojis: ['😂', '🐱', '⛳'], laugh: 'haha', buddy: 'mate',
      bio: 'Thaïlandais-britannique, le gars le plus sympa du paddock. Détendu, drôle, amoureux des chats et du golf. Pilier de Williams, ami proche de Norris et Russell.',
      traits: { humor: 80, aggression: 50, ego: 35, warmth: 95, media: 60, temper: 20 },
      likes: ['golf', 'surf', 'simracing', 'cats'], interests: ['golf', 'chats', 'Thaïlande'],
      friends: ['norris', 'russell', 'sainz', 'bottas'], tensions: [],
      catchphrases: ['all good mate', 'not bad not bad', 'big points'], speaksFrench: false,
    },
  },
  {
    id: 'sainz', firstName: 'Carlos', lastName: 'Sainz', code: 'SAI', number: 55, nationality: 'ES', birthDate: '1994-09-01',
    teamId: 'williams', f1Code: 'CARSAI01', rating: 87,
    stats: { pace: 88, racecraft: 90, overtaking: 87, defending: 88, consistency: 89, tyreManagement: 91, wet: 85, starts: 87, feedback: 94, mental: 88, fitness: 92 },
    salary: 12_000_000, contractEnd: 2027,
    persona: {
      style: 'warm', lowercase: false, emojis: ['🌶️', '💪', '😂'], laugh: 'jajaja', buddy: 'amigo',
      bio: '« Smooth Operator ». Fils du double champion du Dakar, travailleur acharné, stratège redoutable, roi du padel et du golf. Chaleureux, compétitif, ami proche de Norris (« Carlando ») et Leclerc. Directeur du GPDA.',
      traits: { humor: 75, aggression: 60, ego: 60, warmth: 85, media: 75, temper: 45 },
      likes: ['padel', 'golf', 'football', 'rally'], interests: ['padel', 'golf', 'Real Madrid', 'rallye'],
      friends: ['norris', 'leclerc', 'albon', 'alonso', 'colapinto'], tensions: [],
      catchphrases: ['Smooth operator 🌶️', 'Vamos!', 'We keep working.'], speaksFrench: false,
    },
  },
  {
    id: 'lawson', firstName: 'Liam', lastName: 'Lawson', code: 'LAW', number: 30, nationality: 'NZ', birthDate: '2002-02-11',
    teamId: 'racingbulls', f1Code: 'LIALAW01', rating: 80,
    stats: { pace: 82, racecraft: 80, overtaking: 83, defending: 84, consistency: 76, tyreManagement: 79, wet: 80, starts: 80, feedback: 78, mental: 80, fitness: 88 },
    salary: 2_500_000, contractEnd: 2026,
    persona: {
      style: 'fiery', lowercase: false, emojis: ['🤷', '😤'], laugh: 'haha', buddy: 'mate',
      bio: 'Kiwi combatif et sans filtre. Ne recule jamais en piste, encore moins en interview. Revenu plus fort après sa rétrogradation de Red Bull, il n’a peur de personne.',
      traits: { humor: 50, aggression: 90, ego: 70, warmth: 50, media: 45, temper: 85 },
      likes: ['gym', 'karting', 'simracing'], interests: ['rugby', 'Nouvelle-Zélande', 'salle de sport'],
      friends: ['lindblad'], tensions: ['hadjar', 'perez'],
      catchphrases: ['I don’t really care.', 'That’s racing.', 'Fair enough.'], speaksFrench: false,
    },
  },
  {
    id: 'lindblad', firstName: 'Arvid', lastName: 'Lindblad', code: 'LIN', number: 41, nationality: 'GB', birthDate: '2007-08-08',
    teamId: 'racingbulls', f1Code: 'ARVLIN01', rating: 77,
    stats: { pace: 83, racecraft: 75, overtaking: 78, defending: 74, consistency: 72, tyreManagement: 74, wet: 76, starts: 78, feedback: 72, mental: 74, fitness: 85 },
    salary: 1_000_000, contractEnd: 2027,
    persona: {
      style: 'shy', lowercase: true, emojis: ['😅', '🙏', '💯'], laugh: 'lmao', buddy: 'bro',
      bio: 'Plus jeune pilote de la grille, britannique aux racines suédoises, pur produit du programme Red Bull. Génération Z, poli, impressionné par tout, écrit en minuscules.',
      traits: { humor: 60, aggression: 65, ego: 35, warmth: 70, media: 40, temper: 40 },
      likes: ['simracing', 'football', 'stream'], interests: ['FIFA', 'sim racing'],
      friends: ['bearman', 'hadjar', 'lawson'], tensions: [],
      catchphrases: ['no way', 'learning every lap', 'insane'], speaksFrench: false,
    },
  },
  {
    id: 'ocon', firstName: 'Esteban', lastName: 'Ocon', code: 'OCO', number: 31, nationality: 'FR', birthDate: '1996-09-17',
    teamId: 'haas', f1Code: 'ESTOCO01', rating: 82,
    stats: { pace: 83, racecraft: 84, overtaking: 82, defending: 88, consistency: 83, tyreManagement: 84, wet: 84, starts: 83, feedback: 85, mental: 85, fitness: 92 },
    salary: 7_000_000, contractEnd: 2027,
    persona: {
      style: 'polished', lowercase: false, emojis: ['💪', '🇫🇷', '🙏'], laugh: 'haha', buddy: 'mon pote',
      bio: 'Normand, vainqueur en Hongrie 2021, parcours de combattant (ses parents ont tout vendu pour sa carrière). Sérieux, déterminé, travailleur, défenseur intraitable en piste. Relation complexe avec Gasly, son ami d’enfance.',
      traits: { humor: 45, aggression: 75, ego: 60, warmth: 60, media: 60, temper: 55 },
      likes: ['gym', 'cycling', 'football'], interests: ['entraînement', 'Normandie', 'famille'],
      friends: ['stroll', 'bearman'], tensions: ['gasly', 'alonso'],
      catchphrases: ['On ne lâche rien.', 'Content du boulot de l’équipe.', 'Allez !'], speaksFrench: true,
    },
  },
  {
    id: 'bearman', firstName: 'Oliver', lastName: 'Bearman', code: 'BEA', number: 87, nationality: 'GB', birthDate: '2005-05-08',
    teamId: 'haas', f1Code: 'OLIBEA01', rating: 82,
    stats: { pace: 86, racecraft: 81, overtaking: 84, defending: 80, consistency: 78, tyreManagement: 80, wet: 80, starts: 82, feedback: 78, mental: 84, fitness: 87 },
    salary: 1_500_000, contractEnd: 2027,
    persona: {
      style: 'banter', lowercase: true, emojis: ['😂', '🏎️', '👀'], laugh: 'hahaha', buddy: 'mate',
      bio: '« Ollie », jeune Anglais de l’Essex, lié à la Ferrari Driver Academy. Débuts fracassants en 2024 en remplaçant Sainz. Joyeux, taquin, très proche des autres jeunes pilotes.',
      traits: { humor: 85, aggression: 70, ego: 45, warmth: 85, media: 65, temper: 45 },
      likes: ['simracing', 'football', 'party', 'golf'], interests: ['West Ham', 'gaming'],
      friends: ['antonelli', 'hadjar', 'lindblad', 'ocon'], tensions: [],
      catchphrases: ['let’s gooo', 'what a day lads', 'mega'], speaksFrench: false,
    },
  },
  {
    id: 'hulkenberg', firstName: 'Nico', lastName: 'Hülkenberg', code: 'HUL', number: 27, nationality: 'DE', birthDate: '1987-08-19',
    teamId: 'audi', f1Code: 'NICHUL01', rating: 82,
    stats: { pace: 84, racecraft: 85, overtaking: 82, defending: 85, consistency: 87, tyreManagement: 85, wet: 85, starts: 82, feedback: 89, mental: 88, fitness: 85 },
    salary: 6_000_000, contractEnd: 2027,
    persona: {
      style: 'dry', lowercase: false, emojis: ['😏', '🍺'], laugh: 'haha', buddy: 'buddy',
      bio: '« Hulk », vétéran allemand à l’humour sec et autodérisoire. A attendu 239 Grands Prix avant son premier podium (Silverstone 2025). Jeune papa, décontracté, apprécié de tous.',
      traits: { humor: 85, aggression: 50, ego: 40, warmth: 70, media: 60, temper: 30 },
      likes: ['cycling', 'golf', 'party'], interests: ['vélo', 'famille', 'bière'],
      friends: ['bottas', 'albon', 'sainz'], tensions: ['bortoleto'],
      catchphrases: ['Only took me 239 races.', 'Ja, solid.', 'Hulk smash.'], speaksFrench: false,
    },
  },
  {
    id: 'bortoleto', firstName: 'Gabriel', lastName: 'Bortoleto', code: 'BOR', number: 5, nationality: 'BR', birthDate: '2004-10-14',
    teamId: 'audi', f1Code: 'GABBOR01', rating: 81,
    stats: { pace: 84, racecraft: 82, overtaking: 81, defending: 81, consistency: 83, tyreManagement: 81, wet: 79, starts: 80, feedback: 81, mental: 85, fitness: 87 },
    salary: 2_000_000, contractEnd: 2027,
    persona: {
      style: 'chill', lowercase: true, emojis: ['🇧🇷', '🙏', '💚'], laugh: 'kkkkk', buddy: 'irmão',
      bio: 'Champion F3 et F2 dans la foulée, Brésilien mature et posé, géré par la société d’Alonso (A14). Calme, réfléchi, porte les espoirs de tout un pays.',
      traits: { humor: 55, aggression: 60, ego: 45, warmth: 75, media: 55, temper: 30 },
      likes: ['football', 'karting', 'padel'], interests: ['football', 'São Paulo'],
      friends: ['alonso', 'colapinto'], tensions: [],
      catchphrases: ['vamos!', 'obrigado time', 'step by step'], speaksFrench: false,
    },
  },
  {
    id: 'bottas', firstName: 'Valtteri', lastName: 'Bottas', code: 'BOT', number: 77, nationality: 'FI', birthDate: '1989-08-28',
    teamId: 'cadillac', f1Code: 'VALBOT01', rating: 82,
    stats: { pace: 86, racecraft: 82, overtaking: 79, defending: 82, consistency: 86, tyreManagement: 85, wet: 80, starts: 80, feedback: 88, mental: 84, fitness: 94 },
    salary: 8_000_000, contractEnd: 2027,
    persona: {
      style: 'chill', lowercase: false, emojis: ['☕', '🚴', '🍑', '😂'], laugh: '😂', buddy: 'my friend',
      bio: 'Finlandais flegmatique devenu roi des réseaux (moustache, mullet, gravel bike, café). Dix victoires en Grand Prix, revenu en titulaire chez Cadillac. Humour absurde, calme olympien, ami de longue date d’Hamilton.',
      traits: { humor: 90, aggression: 45, ego: 35, warmth: 80, media: 75, temper: 15 },
      likes: ['cycling', 'coffee', 'sauna', 'golf'], interests: ['gravel', 'café', 'sauna'],
      friends: ['hamilton', 'albon', 'hulkenberg', 'perez'], tensions: [],
      catchphrases: ['To whom it may concern…', 'Coffee first.', 'Sisu.'], speaksFrench: false,
    },
  },
  {
    id: 'perez', firstName: 'Sergio', lastName: 'Pérez', code: 'PER', number: 11, nationality: 'MX', birthDate: '1990-01-26',
    teamId: 'cadillac', f1Code: 'SERPER01', rating: 82,
    stats: { pace: 83, racecraft: 86, overtaking: 85, defending: 90, consistency: 78, tyreManagement: 93, wet: 80, starts: 84, feedback: 86, mental: 78, fitness: 88 },
    salary: 9_000_000, contractEnd: 2027,
    persona: {
      style: 'warm', lowercase: false, emojis: ['🇲🇽', '🙏', '💪'], laugh: 'jajaja', buddy: 'amigo',
      bio: '« Checo », six victoires, idole du Mexique, « ministre de la défense ». Chaleureux, père de famille, émotif, spécialiste de la gestion des pneus. Revenu en F1 avec Cadillac après une année sabbatique.',
      traits: { humor: 65, aggression: 60, ego: 55, warmth: 85, media: 70, temper: 50 },
      likes: ['golf', 'football', 'family'], interests: ['Mexique', 'famille', 'football'],
      friends: ['bottas', 'sainz', 'colapinto'], tensions: ['lawson'],
      catchphrases: ['¡Vamos!', 'Gracias México 🇲🇽', 'Never give up.'], speaksFrench: false,
    },
  },
];

export const DRIVERS_BY_ID: Record<string, DriverDef> = Object.fromEntries(DRIVERS.map((d) => [d.id, d]));

/** Écurie 2025 (slug CDN) des pilotes qui ont changé d'équipe. */
const TEAM_SLUG_2025: Record<string, string> = { hadjar: 'racingbulls', hulkenberg: 'kicksauber', bortoleto: 'kicksauber', bottas: 'mercedes', perez: 'redbullracing' };

/** URL candidates pour le portrait officiel. */
export function driverPhotoCandidates(def: DriverDef, teamId: TeamId | null): string[] {
  const code = def.f1Code.toLowerCase();
  const out: string[] = [];
  const slugs = Array.from(new Set([teamId ? TEAMS_BY_ID[teamId].f1Slug : TEAMS_BY_ID[def.teamId].f1Slug, TEAMS_BY_ID[def.teamId].f1Slug]));
  for (const s of slugs) out.push(`https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/v1740000000/common/f1/2026/${s}/${code}/2026${s}${code}right.webp`);
  const s25 = TEAM_SLUG_2025[def.id] ?? TEAMS_BY_ID[def.teamId].f1Slug;
  out.push(`https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/v1740000000/common/f1/2025/${s25}/${code}/2025${s25}${code}right.webp`);
  const letter = def.firstName[0].toUpperCase();
  const folder = `${def.f1Code}_${def.firstName.replace(/ /g, '_')}_${def.lastName.normalize('NFD').replace(/[̀-ͯ]/g, '')}`;
  out.push(
    `https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/${letter}/${folder}/${code}.png.transform/2col/image.png`,
  );
  return out;
}

export const COUNTRY_NAMES: Record<string, string> = {
  NL: 'Pays-Bas', FR: 'France', GB: 'Royaume-Uni', AU: 'Australie', MC: 'Monaco', IT: 'Italie', ES: 'Espagne', CA: 'Canada',
  AR: 'Argentine', TH: 'Thaïlande', NZ: 'Nouvelle-Zélande', DE: 'Allemagne', BR: 'Brésil', FI: 'Finlande', MX: 'Mexique',
  BE: 'Belgique', CH: 'Suisse', US: 'États-Unis', JP: 'Japon', CN: 'Chine', DK: 'Danemark', PL: 'Pologne', PT: 'Portugal',
  SE: 'Suède', AT: 'Autriche', MA: 'Maroc', DZ: 'Algérie', SN: 'Sénégal', CI: 'Côte d’Ivoire', IE: 'Irlande', IN: 'Inde',
  BH: 'Bahreïn', SA: 'Arabie saoudite', AZ: 'Azerbaïdjan', SG: 'Singapour', HU: 'Hongrie', QA: 'Qatar', AE: 'Émirats arabes unis',
  EE: 'Estonie', CO: 'Colombie', NO: 'Norvège', LU: 'Luxembourg', TN: 'Tunisie', RE: 'La Réunion', GP: 'Guadeloupe',
};

export function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '🏁';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
