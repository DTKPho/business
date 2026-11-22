import type { ResidenceId, StatKey, StaffRole } from '../game/types';

export interface ActivityDef {
  id: string;
  name: string;
  emoji: string;
  category: 'training' | 'loisir' | 'media' | 'business' | 'social' | 'repos';
  cost: number;
  energy: number; // delta
  morale: number;
  stress: number;
  stats?: Partial<Record<StatKey, number>>; // xp gagnée
  followers?: number; // multiplicateur (fraction des followers actuels)
  image?: { likeability?: number; professionalism?: number; controversy?: number };
  invite: boolean; // peut inviter un pilote
  requiresAsset?: string; // id d'asset (sinon location au prix cost)
  desc: string;
}

export const ACTIVITIES: ActivityDef[] = [
  // Entraînement
  { id: 'gym', name: 'Salle de sport', emoji: '🏋️', category: 'training', cost: 0, energy: -15, morale: 2, stress: -5, stats: { fitness: 0.6 }, invite: true, desc: 'Renforcement musculaire, cou et tronc : indispensable pour encaisser 5G.' },
  { id: 'cardio', name: 'Cardio & endurance', emoji: '🏃', category: 'training', cost: 0, energy: -18, morale: 1, stress: -8, stats: { fitness: 0.7, mental: 0.1 }, invite: false, desc: 'Fractionné, course, aviron. Ton cœur doit rester calme à 180 bpm.' },
  { id: 'neck', name: 'Travail du cou & réflexes', emoji: '🧠', category: 'training', cost: 0, energy: -10, morale: 0, stress: -2, stats: { fitness: 0.3, pace: 0.2, starts: 0.3 }, invite: false, desc: 'Lumières Batak, harnais de cou, réflexes au départ.' },
  { id: 'sim', name: 'Simulateur de l’équipe', emoji: '🖥️', category: 'training', cost: 0, energy: -12, morale: 0, stress: 3, stats: { pace: 0.4, feedback: 0.6, consistency: 0.2 }, invite: false, desc: 'Une journée à l’usine dans le simu pour préparer le prochain GP. L’équipe adore.' },
  { id: 'debrief', name: 'Réunion ingénieurs', emoji: '📊', category: 'training', cost: 0, energy: -6, morale: 0, stress: 2, stats: { feedback: 0.5, tyreManagement: 0.3, racecraft: 0.2 }, invite: false, desc: 'Analyse data, onboard des rivaux, stratégie pneus.' },
  { id: 'mentalcoach', name: 'Séance préparateur mental', emoji: '🧘', category: 'training', cost: 2500, energy: 5, morale: 6, stress: -20, stats: { mental: 0.7 }, invite: false, desc: 'Visualisation, respiration, gestion de la pression.' },
  { id: 'karting', name: 'Karting', emoji: '🏎️', category: 'training', cost: 1500, energy: -10, morale: 8, stress: -6, stats: { racecraft: 0.4, overtaking: 0.4, defending: 0.3 }, invite: true, desc: 'Retour aux sources. Rien de tel pour aiguiser l’instinct de duel.' },
  { id: 'rainday', name: 'Roulage sous la pluie (TPC)', emoji: '🌧️', category: 'training', cost: 15000, energy: -14, morale: 2, stress: 2, stats: { wet: 0.9, consistency: 0.2 }, invite: false, desc: 'Test d’une ancienne monoplace sur piste arrosée.' },
  // Loisirs
  { id: 'golf', name: 'Golf', emoji: '⛳', category: 'loisir', cost: 600, energy: -3, morale: 8, stress: -10, invite: true, desc: 'Un 18 trous, le sport officiel du paddock.' },
  { id: 'padel', name: 'Padel', emoji: '🎾', category: 'loisir', cost: 200, energy: -8, morale: 8, stress: -8, stats: { fitness: 0.2 }, invite: true, desc: 'Le terrain où les rivalités espagnoles se règlent.' },
  { id: 'simracing', name: 'Sim racing en ligne', emoji: '🎮', category: 'loisir', cost: 0, energy: -4, morale: 6, stress: -4, stats: { racecraft: 0.15 }, followers: 0.003, invite: true, desc: 'Endurance virtuelle avec la team, la nuit entière.' },
  { id: 'stream', name: 'Stream Twitch', emoji: '📺', category: 'media', cost: 0, energy: -6, morale: 5, stress: -2, followers: 0.012, image: { likeability: 2 }, invite: true, desc: 'Discute avec les fans en jouant. Attention aux dérapages en direct.' },
  { id: 'cycling', name: 'Sortie vélo / gravel', emoji: '🚴', category: 'loisir', cost: 0, energy: -14, morale: 6, stress: -10, stats: { fitness: 0.5 }, invite: true, desc: '120 km dans l’arrière-pays.' },
  { id: 'surf', name: 'Surf', emoji: '🏄', category: 'loisir', cost: 400, energy: -10, morale: 10, stress: -12, stats: { fitness: 0.2 }, invite: true, desc: 'Vagues et déconnexion totale.' },
  { id: 'ski', name: 'Ski hors-piste', emoji: '⛷️', category: 'loisir', cost: 3000, energy: -12, morale: 12, stress: -10, invite: true, desc: 'Poudreuse… et une équipe qui préférerait que tu restes entier.' },
  { id: 'fishing', name: 'Pêche en mer', emoji: '🎣', category: 'loisir', cost: 1200, energy: 0, morale: 7, stress: -14, invite: true, desc: 'Le calme absolu.' },
  { id: 'piano', name: 'Soirée musique / piano', emoji: '🎹', category: 'loisir', cost: 0, energy: 2, morale: 6, stress: -10, invite: true, desc: 'Composer, jouer, souffler.' },
  { id: 'football', name: 'Match de foot (loge VIP)', emoji: '⚽', category: 'loisir', cost: 5000, energy: -2, morale: 9, stress: -6, followers: 0.002, invite: true, desc: 'Ligue des Champions en loge, photo avec les joueurs.' },
  { id: 'poker', name: 'Soirée poker', emoji: '🃏', category: 'loisir', cost: 10000, energy: -6, morale: 6, stress: -2, invite: true, desc: 'Gains… ou pertes. Le bluff, c’est aussi du racecraft.' },
  { id: 'coffee', name: 'Café & détente', emoji: '☕', category: 'repos', cost: 50, energy: 6, morale: 3, stress: -5, invite: true, desc: 'Un flat white, une terrasse, rien d’autre.' },
  { id: 'sauna', name: 'Sauna & récupération', emoji: '🧖', category: 'repos', cost: 300, energy: 14, morale: 3, stress: -10, invite: true, desc: 'Chaud, froid, cryo. Le corps dit merci.' },
  { id: 'rest', name: 'Repos complet', emoji: '🛌', category: 'repos', cost: 0, energy: 25, morale: 2, stress: -12, invite: false, desc: 'Dormir, série, téléphone en mode avion.' },
  { id: 'family', name: 'Temps en famille', emoji: '👨‍👩‍👧', category: 'repos', cost: 500, energy: 12, morale: 12, stress: -15, invite: false, desc: 'Rentrer à la maison, repas de famille.' },
  { id: 'vacation', name: 'Escapade de 3 jours', emoji: '🏝️', category: 'repos', cost: 25000, energy: 30, morale: 15, stress: -25, followers: 0.002, invite: true, desc: 'Mykonos, Maldives ou Dolomites. Uniquement s’il y a assez de jours libres.' },
  // Social / paddock
  { id: 'party', name: 'Soirée en club', emoji: '🪩', category: 'social', cost: 8000, energy: -20, morale: 12, stress: -8, followers: 0.004, image: { controversy: 3, professionalism: -2 }, invite: true, desc: 'Une table, des DJ… et des photographes à la sortie.' },
  { id: 'yacht', name: 'Journée sur un yacht', emoji: '🛥️', category: 'social', cost: 30000, energy: 2, morale: 12, stress: -12, followers: 0.003, invite: true, requiresAsset: 'yacht', desc: 'Crique isolée, jet-skis, coucher de soleil.' },
  { id: 'dinner', name: 'Dîner avec un pilote', emoji: '🍝', category: 'social', cost: 800, energy: -2, morale: 6, stress: -6, invite: true, desc: 'La meilleure façon de bâtir une vraie amitié dans le paddock.' },
  { id: 'fashion', name: 'Fashion Week', emoji: '👔', category: 'media', cost: 4000, energy: -10, morale: 8, stress: 0, followers: 0.015, image: { likeability: 2 }, invite: true, desc: 'Paris, Milan : premier rang, tenues commentées par toute la planète.' },
  { id: 'charity', name: 'Gala de charité', emoji: '🎗️', category: 'media', cost: 20000, energy: -8, morale: 8, stress: 0, followers: 0.004, image: { likeability: 5, professionalism: 2 }, invite: true, desc: 'Une soirée pour une cause. Ta fondation peut en bénéficier.' },
  { id: 'fanmeet', name: 'Rencontre avec les fans', emoji: '🤳', category: 'media', cost: 0, energy: -10, morale: 6, stress: 0, followers: 0.008, image: { likeability: 4 }, invite: false, desc: 'Autographes, selfies, karting avec des enfants.' },
  { id: 'podcast', name: 'Invité d’un podcast', emoji: '🎙️', category: 'media', cost: 0, energy: -6, morale: 2, stress: 3, followers: 0.01, invite: false, desc: 'Une heure d’interview longue. Prends garde à ce que tu dis.' },
  { id: 'sponsorEvent', name: 'Événement sponsor', emoji: '🤝', category: 'business', cost: 0, energy: -12, morale: -2, stress: 4, followers: 0.003, image: { professionalism: 3 }, invite: false, desc: 'Remplit tes obligations contractuelles et fait plaisir à l’équipe.' },
  { id: 'teamFactory', name: 'Visite à l’usine', emoji: '🏭', category: 'business', cost: 0, energy: -8, morale: 2, stress: 0, image: { professionalism: 4 }, invite: false, desc: 'Remercier les 1 000 employés. La confiance de l’équipe grimpe.' },
  { id: 'gt3', name: 'Course GT3 / Endurance', emoji: '🏁', category: 'loisir', cost: 20000, energy: -20, morale: 10, stress: -4, stats: { racecraft: 0.4, consistency: 0.3 }, followers: 0.004, invite: true, desc: 'Une manche de GT entre deux GP. Ton équipe F1 grince des dents.' },
];

export const ACTIVITIES_BY_ID = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a]));

export interface AssetDef {
  id: string;
  name: string;
  category: 'immobilier' | 'voiture' | 'montre' | 'luxe' | 'transport' | 'art';
  emoji: string;
  price: number;
  upkeep: number; // par saison
  prestige: number; // 0..100
  morale: number; // gain moral permanent (une fois)
  desc: string;
  resale: number; // fraction revendue
  brandConflict?: string; // teamId mécontent
  residence?: ResidenceId;
}

export const ASSETS: AssetDef[] = [
  { id: 'apt-monaco', name: 'Appartement à Monaco (Fontvieille)', category: 'immobilier', emoji: '🏙️', price: 6_500_000, upkeep: 90_000, prestige: 60, morale: 8, desc: '3 pièces vue sur le port. Voisins : la moitié de la grille.', resale: 1.0, residence: 'monaco' },
  { id: 'pent-monaco', name: 'Penthouse à Monte-Carlo', category: 'immobilier', emoji: '🌆', price: 28_000_000, upkeep: 350_000, prestige: 90, morale: 14, desc: 'Toit-terrasse avec piscine surplombant le virage du Casino.', resale: 1.0, residence: 'monaco' },
  { id: 'flat-london', name: 'Appartement à Londres (Chelsea)', category: 'immobilier', emoji: '🇬🇧', price: 4_200_000, upkeep: 60_000, prestige: 45, morale: 6, desc: 'Pratique pour l’usine et les sponsors.', resale: 0.98, residence: 'uk' },
  { id: 'villa-como', name: 'Villa au lac de Côme', category: 'immobilier', emoji: '🏛️', price: 12_000_000, upkeep: 180_000, prestige: 75, morale: 12, desc: 'Ponton privé, jardin à l’italienne.', resale: 1.02, residence: 'italy' },
  { id: 'chalet', name: 'Chalet à Verbier', category: 'immobilier', emoji: '🏔️', price: 9_000_000, upkeep: 120_000, prestige: 65, morale: 10, desc: 'Ski aux pieds, sauna, cheminée.', resale: 1.01, residence: 'switzerland' },
  { id: 'dubai', name: 'Penthouse à Dubaï Marina', category: 'immobilier', emoji: '🌴', price: 7_000_000, upkeep: 80_000, prestige: 55, morale: 8, desc: 'Résidence fiscale avantageuse, soleil toute l’année.', resale: 0.97, residence: 'dubai' },
  { id: 'paris', name: 'Appartement à Paris (16e)', category: 'immobilier', emoji: '🗼', price: 5_500_000, upkeep: 70_000, prestige: 50, morale: 7, desc: 'Haussmannien, moulures et parquet.', resale: 1.0, residence: 'france' },
  { id: 'miami', name: 'Villa à Miami Beach', category: 'immobilier', emoji: '🌊', price: 15_000_000, upkeep: 220_000, prestige: 70, morale: 11, desc: 'Ponton, piscine à débordement, à deux pas du circuit.', resale: 1.0, residence: 'usa' },
  { id: 'gt3rs', name: 'Porsche 911 GT3 RS', category: 'voiture', emoji: '🚗', price: 320_000, upkeep: 12_000, prestige: 25, morale: 5, desc: 'La voiture de piste homologuée ultime.', resale: 0.9, brandConflict: '' },
  { id: 'sf90', name: 'Ferrari SF90 XX', category: 'voiture', emoji: '🏎️', price: 900_000, upkeep: 25_000, prestige: 45, morale: 8, desc: 'Hybride de 1 030 ch. Mal vu si tu ne roules pas en rouge…', resale: 1.05, brandConflict: 'ferrari' },
  { id: 'amg-one', name: 'Mercedes-AMG ONE', category: 'voiture', emoji: '🏎️', price: 2_800_000, upkeep: 40_000, prestige: 60, morale: 10, desc: 'Le moteur d’une F1 dans une voiture de route.', resale: 1.1, brandConflict: 'mercedes' },
  { id: 'valkyrie', name: 'Aston Martin Valkyrie', category: 'voiture', emoji: '🏎️', price: 3_200_000, upkeep: 45_000, prestige: 65, morale: 10, desc: 'Signée Adrian Newey, V12 hurlant à 11 000 tr/min.', resale: 1.1, brandConflict: 'astonmartin' },
  { id: 'w1', name: 'McLaren W1', category: 'voiture', emoji: '🏎️', price: 2_300_000, upkeep: 35_000, prestige: 55, morale: 9, desc: 'Héritière de la F1 et de la P1.', resale: 1.05, brandConflict: 'mclaren' },
  { id: 'escalade', name: 'Cadillac Escalade V', category: 'voiture', emoji: '🚙', price: 160_000, upkeep: 6_000, prestige: 12, morale: 3, desc: 'Le SUV taille américaine.', resale: 0.8, brandConflict: 'cadillac' },
  { id: 'rs6', name: 'Audi RS6 Avant GT', category: 'voiture', emoji: '🚙', price: 240_000, upkeep: 8_000, prestige: 15, morale: 4, desc: 'Le break le plus désirable du monde.', resale: 0.85, brandConflict: 'audi' },
  { id: 'classic', name: 'Voiture de collection (années 60)', category: 'voiture', emoji: '🚘', price: 4_500_000, upkeep: 30_000, prestige: 55, morale: 8, desc: 'Une légende de Goodwood.', resale: 1.15 },
  { id: 'watch1', name: 'Montre de plongée en acier', category: 'montre', emoji: '⌚', price: 14_000, upkeep: 0, prestige: 5, morale: 2, desc: 'Une classique indestructible.', resale: 1.0 },
  { id: 'watch2', name: 'Chronographe en or rose', category: 'montre', emoji: '⌚', price: 85_000, upkeep: 0, prestige: 15, morale: 3, desc: 'Pour les podiums.', resale: 1.05 },
  { id: 'watch3', name: 'Grande complication tourbillon', category: 'montre', emoji: '💎', price: 1_200_000, upkeep: 0, prestige: 40, morale: 6, desc: 'Pièce unique, 18 mois de fabrication.', resale: 1.1 },
  { id: 'yacht', name: 'Yacht de 40 m', category: 'transport', emoji: '🛥️', price: 18_000_000, upkeep: 1_800_000, prestige: 80, morale: 12, desc: 'Équipage de 8. Monaco week-end, Ibiza l’été.', resale: 0.75 },
  { id: 'jet', name: 'Jet privé (light jet)', category: 'transport', emoji: '🛩️', price: 9_000_000, upkeep: 1_200_000, prestige: 70, morale: 10, desc: 'Moins de fatigue entre les GP (+énergie après chaque course).', resale: 0.7 },
  { id: 'jet2', name: 'Jet long-courrier', category: 'transport', emoji: '✈️', price: 45_000_000, upkeep: 4_000_000, prestige: 95, morale: 15, desc: 'Comme les plus grands. Récupération maximale (+énergie).', resale: 0.7 },
  { id: 'heli', name: 'Hélicoptère', category: 'transport', emoji: '🚁', price: 3_500_000, upkeep: 400_000, prestige: 45, morale: 6, desc: 'Nice-Monaco en 7 minutes.', resale: 0.7 },
  { id: 'art', name: 'Œuvre d’art contemporain', category: 'art', emoji: '🖼️', price: 2_000_000, upkeep: 10_000, prestige: 30, morale: 4, desc: 'Valeur fluctuante. Un investissement culturel.', resale: 1.0 },
  { id: 'sim-home', name: 'Simulateur pro à domicile', category: 'luxe', emoji: '🕹️', price: 250_000, upkeep: 15_000, prestige: 10, morale: 6, desc: 'Plateforme mobile pro (+XP du sim racing et du simu).', resale: 0.6 },
  { id: 'gym-home', name: 'Salle de sport privée', category: 'luxe', emoji: '🏋️', price: 180_000, upkeep: 20_000, prestige: 8, morale: 4, desc: 'Entraînements plus efficaces (+XP physique).', resale: 0.4 },
];

export const ASSETS_BY_ID = Object.fromEntries(ASSETS.map((a) => [a.id, a]));

export interface ResidenceDef {
  id: ResidenceId;
  name: string;
  flag: string;
  taxRate: number; // impôt sur revenus
  livingCost: number; // € par saison
  desc: string;
}

export const RESIDENCES: ResidenceDef[] = [
  { id: 'monaco', name: 'Monaco', flag: 'MC', taxRate: 0, livingCost: 600_000, desc: 'Pas d’impôt sur le revenu, la moitié du plateau habite ici.' },
  { id: 'switzerland', name: 'Suisse (Vaud)', flag: 'CH', taxRate: 0.12, livingCost: 450_000, desc: 'Forfait fiscal, calme et discrétion.' },
  { id: 'dubai', name: 'Dubaï', flag: 'AE', taxRate: 0, livingCost: 500_000, desc: 'Zéro impôt, vols directs partout, chaleur en été.' },
  { id: 'uk', name: 'Royaume-Uni', flag: 'GB', taxRate: 0.45, livingCost: 350_000, desc: 'Proche des usines, fiscalité lourde.' },
  { id: 'france', name: 'France', flag: 'FR', taxRate: 0.45, livingCost: 280_000, desc: 'À la maison, mais le fisc est gourmand.' },
  { id: 'spain', name: 'Espagne', flag: 'ES', taxRate: 0.47, livingCost: 250_000, desc: 'Le soleil, mais l’Agencia Tributaria veille.' },
  { id: 'italy', name: 'Italie', flag: 'IT', taxRate: 0.2, livingCost: 300_000, desc: 'Régime d’impatriés avantageux, la dolce vita.' },
  { id: 'usa', name: 'États-Unis (Floride)', flag: 'US', taxRate: 0.37, livingCost: 400_000, desc: 'Pas d’impôt d’État en Floride, mais fédéral élevé.' },
  { id: 'netherlands', name: 'Pays-Bas', flag: 'NL', taxRate: 0.49, livingCost: 260_000, desc: 'Plat et taxé.' },
];

export const RESIDENCES_BY_ID = Object.fromEntries(RESIDENCES.map((r) => [r.id, r])) as Record<ResidenceId, ResidenceDef>;

export interface StaffRoleDef {
  role: StaffRole;
  name: string;
  emoji: string;
  desc: string;
  baseSalary: number;
}

export const STAFF_ROLES: StaffRoleDef[] = [
  { role: 'manager', name: 'Manager / agent', emoji: '💼', desc: 'Négocie tes contrats (meilleurs salaires, plus de patience des équipes) et trouve des sponsors.', baseSalary: 250_000 },
  { role: 'trainer', name: 'Préparateur physique', emoji: '💪', desc: 'Accélère la progression physique et réduit la fatigue des voyages.', baseSalary: 120_000 },
  { role: 'physio', name: 'Kiné / physio', emoji: '🩺', desc: 'Récupération plus rapide de l’énergie et du stress.', baseSalary: 100_000 },
  { role: 'pr', name: 'Attaché(e) de presse', emoji: '📣', desc: 'Limite les dégâts en interview et booste ta croissance sur les réseaux.', baseSalary: 110_000 },
  { role: 'coach', name: 'Coach de pilotage', emoji: '🎯', desc: 'Ancien pilote : analyse tes données, accélère la progression technique.', baseSalary: 200_000 },
  { role: 'chef', name: 'Chef cuisinier & nutrition', emoji: '🥗', desc: 'Moral, énergie et condition physique en hausse.', baseSalary: 90_000 },
  { role: 'pilot', name: 'Pilote de jet privé', emoji: '👨‍✈️', desc: 'Nécessaire pour exploiter ton jet. Voyages sans fatigue.', baseSalary: 150_000 },
];

export const STAFF_FIRST = ['James', 'Sofia', 'Marco', 'Chloé', 'Lukas', 'Aisha', 'Tom', 'Elena', 'Hugo', 'Maya', 'Ben', 'Lena', 'Raphaël', 'Nina', 'Diego', 'Zoé'];
export const STAFF_LAST = ['Carter', 'Rossi', 'Dubois', 'Müller', 'Okafor', 'Lindqvist', 'Moreau', 'García', 'Fischer', 'Bennett', 'Laurent', 'Novak', 'Kowalski', 'Ricci'];

export interface BrandDef {
  id: string;
  name: string;
  sector: string;
  emoji: string;
  minFollowers: number;
  basePerSeason: number;
  image: 'premium' | 'mass' | 'risky';
  desc: string;
}

/** Marques fictives (sponsors personnels). */
export const BRANDS: BrandDef[] = [
  { id: 'aurelion', name: 'Aurelion Genève', sector: 'Horlogerie', emoji: '⌚', minFollowers: 2_000_000, basePerSeason: 1_800_000, image: 'premium', desc: 'Manufacture horlogère suisse de haute précision.' },
  { id: 'voltrix', name: 'Voltrix Energy', sector: 'Boisson énergisante', emoji: '⚡', minFollowers: 400_000, basePerSeason: 350_000, image: 'mass', desc: 'Boisson énergétique qui sponsorise sports extrêmes et e-sport.' },
  { id: 'delacroix', name: 'Maison Delacroix', sector: 'Mode & luxe', emoji: '👔', minFollowers: 3_000_000, basePerSeason: 2_500_000, image: 'premium', desc: 'Maison de couture parisienne.' },
  { id: 'nexus', name: 'Nexus Gear', sector: 'Gaming', emoji: '🎮', minFollowers: 300_000, basePerSeason: 250_000, image: 'mass', desc: 'Périphériques gaming et cockpits de simulation.' },
  { id: 'satoshi', name: 'SatoshiSwap', sector: 'Crypto', emoji: '🪙', minFollowers: 500_000, basePerSeason: 2_000_000, image: 'risky', desc: 'Plateforme d’échange crypto… à la réputation fragile.' },
  { id: 'helios', name: 'Helios Eyewear', sector: 'Lunettes', emoji: '🕶️', minFollowers: 800_000, basePerSeason: 600_000, image: 'premium', desc: 'Lunettes de soleil haut de gamme.' },
  { id: 'kinetica', name: 'Kinetica Sportswear', sector: 'Équipement sportif', emoji: '👟', minFollowers: 1_500_000, basePerSeason: 1_200_000, image: 'mass', desc: 'Géant mondial du sportswear.' },
  { id: 'veloce', name: 'Veloce Café', sector: 'Café', emoji: '☕', minFollowers: 200_000, basePerSeason: 150_000, image: 'mass', desc: 'Torréfacteur italien.' },
  { id: 'aero', name: 'AeroLux Jets', sector: 'Aviation privée', emoji: '🛩️', minFollowers: 1_000_000, basePerSeason: 900_000, image: 'premium', desc: 'Location de jets privés.' },
  { id: 'oasis', name: 'Oasis Hydration', sector: 'Eau minérale', emoji: '💧', minFollowers: 100_000, basePerSeason: 80_000, image: 'mass', desc: 'Eau minérale et boissons isotoniques.' },
  { id: 'betblitz', name: 'BetBlitz', sector: 'Paris sportifs', emoji: '🎰', minFollowers: 600_000, basePerSeason: 1_500_000, image: 'risky', desc: 'Site de paris en ligne. Généreux, controversé.' },
  { id: 'lumen', name: 'Lumen Bank', sector: 'Banque privée', emoji: '🏦', minFollowers: 2_500_000, basePerSeason: 2_200_000, image: 'premium', desc: 'Banque privée luxembourgeoise.' },
];

export const BRANDS_BY_ID = Object.fromEntries(BRANDS.map((b) => [b.id, b]));

export interface BusinessDef {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  upgradeCost: number;
  income: number; // par saison au niveau 1 (multiplié par niveau)
  risk: number; // 0..1 variance
  followers: number;
  desc: string;
}

export const BUSINESSES: BusinessDef[] = [
  { id: 'merch', name: 'Marque de merchandising', emoji: '🧢', cost: 500_000, upgradeCost: 800_000, income: 300_000, risk: 0.4, followers: 0.02, desc: 'Ta ligne de casquettes et de vêtements. Les ventes suivent ta popularité.' },
  { id: 'kartteam', name: 'Équipe de karting', emoji: '🏁', cost: 1_200_000, upgradeCost: 1_000_000, income: 150_000, risk: 0.3, followers: 0.005, desc: 'Former la prochaine génération. Bonne image, rentabilité modeste.' },
  { id: 'esport', name: 'Équipe e-sport', emoji: '🎮', cost: 2_000_000, upgradeCost: 1_500_000, income: 500_000, risk: 0.6, followers: 0.015, desc: 'Sim racing et FPS. Volatile mais énorme visibilité.' },
  { id: 'restaurant', name: 'Restaurant à Monaco', emoji: '🍽️', cost: 3_000_000, upgradeCost: 2_000_000, income: 600_000, risk: 0.35, followers: 0.004, desc: 'Le spot du paddock pendant le GP.' },
  { id: 'icecream', name: 'Marque de glaces / snacks', emoji: '🍦', cost: 1_500_000, upgradeCost: 1_200_000, income: 450_000, risk: 0.45, followers: 0.006, desc: 'Produit de grande consommation à ton nom.' },
  { id: 'football', name: 'Parts d’un club de foot (D3)', emoji: '⚽', cost: 5_000_000, upgradeCost: 4_000_000, income: 400_000, risk: 0.5, followers: 0.01, desc: 'Comme certains pilotes, investis dans un club ambitieux.' },
  { id: 'gtteam', name: 'Écurie GT / Endurance', emoji: '🏎️', cost: 8_000_000, upgradeCost: 5_000_000, income: 900_000, risk: 0.55, followers: 0.01, desc: 'Ta propre équipe en GT World Challenge.' },
];

export const BUSINESSES_BY_ID = Object.fromEntries(BUSINESSES.map((b) => [b.id, b]));

export interface InvestmentDef {
  id: string;
  name: string;
  emoji: string;
  volatility: number; // écart-type par course
  drift: number; // rendement moyen par course
  desc: string;
}

export const INVESTMENTS: InvestmentDef[] = [
  { id: 'etf', name: 'ETF actions mondiales', emoji: '📈', volatility: 0.025, drift: 0.003, desc: 'Diversifié, rendement régulier.' },
  { id: 'realestate', name: 'Fonds immobilier', emoji: '🏢', volatility: 0.01, drift: 0.002, desc: 'Stable et peu risqué.' },
  { id: 'startup', name: 'Start-up tech (seed)', emoji: '🚀', volatility: 0.12, drift: 0.004, desc: 'Peut faire x10… ou zéro.' },
  { id: 'crypto', name: 'Crypto-actifs', emoji: '🪙', volatility: 0.15, drift: 0.002, desc: 'Montagnes russes garanties.' },
  { id: 'bonds', name: 'Obligations d’État', emoji: '🏛️', volatility: 0.004, drift: 0.0012, desc: 'Le placement de père de famille.' },
];

export const INVESTMENTS_BY_ID = Object.fromEntries(INVESTMENTS.map((i) => [i.id, i]));
