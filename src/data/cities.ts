export type CitySpecialty = 'ranching' | 'mining' | 'agricultural' | 'industrial' | 'port' | 'distillery';

export type DevelopmentLevel = 1 | 2 | 3; // 1 = petit bourg, 2 = ville moyenne, 3 = grande ville

export interface CityDef {
  id: string;
  name: string;
  stateId: string; // two-letter state abbreviation, matches US_STATE_PATHS ids
  x: number;
  y: number;
  population: number;
  specialty: CitySpecialty;
  dev: DevelopmentLevel;
  /** Goods this city produces in surplus (feeds its stock, lowers local price). */
  produces: string[];
  isPort: boolean; // coastal, can use steamboat
  isRiver: boolean; // riverine, can use steamboat
}

export const CITIES: CityDef[] = [
  { id: 'valentine', name: 'Valentine', stateId: 'MT', x: 295.22, y: 69.4, population: 5000, specialty: 'ranching', dev: 1, produces: ['betail', 'ble'], isPort: false, isRiver: false },
  { id: 'copperhead_gulch', name: 'Copperhead Gulch', stateId: 'MT', x: 275.38, y: 94.35, population: 7000, specialty: 'mining', dev: 1, produces: ['fer'], isPort: false, isRiver: false },
  { id: 'annesburg', name: 'Annesburg', stateId: 'WY', x: 344.8, y: 127.07, population: 6000, specialty: 'mining', dev: 1, produces: ['charbon'], isPort: false, isRiver: false },
  { id: 'strawberry', name: 'Strawberry', stateId: 'CO', x: 341.4, y: 231.67, population: 5000, specialty: 'mining', dev: 1, produces: ['fer'], isPort: false, isRiver: false },
  { id: 'ridgewood', name: 'Ridgewood', stateId: 'CO', x: 360.94, y: 224.38, population: 25000, specialty: 'industrial', dev: 2, produces: ['outils'], isPort: false, isRiver: false },
  { id: 'dodge_crossing', name: 'Dodge Crossing', stateId: 'KS', x: 429.9, y: 266.7, population: 12000, specialty: 'agricultural', dev: 2, produces: ['ble', 'mais', 'betail'], isPort: false, isRiver: true },
  { id: 'blackwater', name: 'Blackwater', stateId: 'MO', x: 535.53, y: 244.13, population: 15000, specialty: 'agricultural', dev: 2, produces: ['mais', 'ble'], isPort: false, isRiver: true },
  { id: 'armadillo', name: 'Armadillo', stateId: 'TX', x: 418.23, y: 384.67, population: 4000, specialty: 'mining', dev: 1, produces: ['fer'], isPort: false, isRiver: false },
  { id: 'tumbleweed', name: 'Tumbleweed', stateId: 'TX', x: 323.16, y: 371.55, population: 2000, specialty: 'ranching', dev: 1, produces: ['betail'], isPort: false, isRiver: false },
  { id: 'van_horn', name: 'Van Horn', stateId: 'TX', x: 348.02, y: 387.65, population: 6000, specialty: 'ranching', dev: 1, produces: ['betail', 'bois'], isPort: false, isRiver: false },
  { id: 'saint_denis', name: 'Saint Denis', stateId: 'LA', x: 584.46, y: 411.6, population: 60000, specialty: 'port', dev: 3, produces: ['cigares', 'chocolat'], isPort: true, isRiver: true },
  { id: 'rhodes', name: 'Rhodes', stateId: 'LA', x: 559.2, y: 400.8, population: 4000, specialty: 'agricultural', dev: 1, produces: ['mais', 'ble'], isPort: false, isRiver: true },
  { id: 'barrelhaven', name: 'Barrelhaven', stateId: 'KY', x: 642.34, y: 258.28, population: 8000, specialty: 'distillery', dev: 1, produces: ['bourbon', 'whisky'], isPort: false, isRiver: true },
  { id: 'millhaven', name: 'Millhaven', stateId: 'IL', x: 604.05, y: 185.03, population: 45000, specialty: 'industrial', dev: 3, produces: ['outils', 'textile'], isPort: true, isRiver: true },
  { id: 'ironhollow', name: 'Ironhollow', stateId: 'PA', x: 713.16, y: 198.28, population: 30000, specialty: 'industrial', dev: 2, produces: ['fer', 'charbon', 'outils'], isPort: false, isRiver: true },
  { id: 'harrows_landing', name: "Harrow's Landing", stateId: 'NY', x: 794.69, y: 176.56, population: 80000, specialty: 'port', dev: 3, produces: ['bijoux', 'textile'], isPort: true, isRiver: true },
  { id: 'port_solace', name: 'Port Solace', stateId: 'CA', x: 107.39, y: 214.23, population: 35000, specialty: 'port', dev: 2, produces: ['fourrures'], isPort: true, isRiver: true },
  { id: 'goldrush', name: 'Goldrush', stateId: 'CA', x: 124.53, y: 203.17, population: 9000, specialty: 'mining', dev: 2, produces: ['fer'], isPort: false, isRiver: true },
];

export const CITIES_BY_ID: Record<string, CityDef> = Object.fromEntries(CITIES.map((c) => [c.id, c]));

export const PLAYABLE_STATE_IDS = Array.from(new Set(CITIES.map((c) => c.stateId)));

export const SPECIALTY_LABELS: Record<CitySpecialty, string> = {
  ranching: 'Élevage',
  mining: 'Mine',
  agricultural: 'Agricole',
  industrial: 'Industrielle',
  port: 'Port',
  distillery: 'Distillerie',
};

export const DEV_LEVEL_LABELS: Record<DevelopmentLevel, string> = {
  1: 'Petit bourg',
  2: 'Ville moyenne',
  3: 'Grande ville',
};
