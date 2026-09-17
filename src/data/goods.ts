export type GoodCategory = 'agricole' | 'matieres_premieres' | 'manufacture' | 'luxe' | 'alcool';

export interface GoodDef {
  id: string;
  name: string;
  category: GoodCategory;
  basePrice: number; // $ per unit at equilibrium stock
  elasticity: number; // price reaction to stock imbalance
  equilibriumStock: number; // target stock per city
}

export const GOODS: GoodDef[] = [
  // Agricole
  { id: 'ble', name: 'Blé', category: 'agricole', basePrice: 1.2, elasticity: 0.35, equilibriumStock: 1000 },
  { id: 'mais', name: 'Maïs', category: 'agricole', basePrice: 1.0, elasticity: 0.35, equilibriumStock: 1000 },
  { id: 'betail', name: 'Bétail', category: 'agricole', basePrice: 3.5, elasticity: 0.4, equilibriumStock: 600 },

  // Matières premières
  { id: 'bois', name: 'Bois', category: 'matieres_premieres', elasticity: 0.4, basePrice: 1.8, equilibriumStock: 900 },
  { id: 'fer', name: 'Fer', category: 'matieres_premieres', elasticity: 0.45, basePrice: 4.0, equilibriumStock: 700 },
  { id: 'charbon', name: 'Charbon', category: 'matieres_premieres', elasticity: 0.4, basePrice: 2.5, equilibriumStock: 800 },

  // Manufacturé
  { id: 'outils', name: 'Outils', category: 'manufacture', elasticity: 0.5, basePrice: 9.0, equilibriumStock: 400 },
  { id: 'textile', name: 'Textile', category: 'manufacture', elasticity: 0.5, basePrice: 7.0, equilibriumStock: 500 },

  // Luxe
  { id: 'cigares', name: 'Cigares', category: 'luxe', elasticity: 0.7, basePrice: 18.0, equilibriumStock: 250 },
  { id: 'chocolat', name: 'Chocolat', category: 'luxe', elasticity: 0.65, basePrice: 15.0, equilibriumStock: 250 },
  { id: 'bijoux', name: 'Bijoux', category: 'luxe', elasticity: 0.8, basePrice: 60.0, equilibriumStock: 100 },
  { id: 'fourrures', name: 'Fourrures', category: 'luxe', elasticity: 0.7, basePrice: 22.0, equilibriumStock: 200 },

  // Alcool
  { id: 'bourbon', name: 'Bourbon du Kentucky', category: 'alcool', elasticity: 0.75, basePrice: 25.0, equilibriumStock: 200 },
  { id: 'brandy', name: 'Brandy', category: 'alcool', elasticity: 0.7, basePrice: 28.0, equilibriumStock: 180 },
  { id: 'rhum', name: 'Rhum de Guarma', category: 'alcool', elasticity: 0.8, basePrice: 20.0, equilibriumStock: 180 },
  { id: 'whisky', name: 'Whisky', category: 'alcool', elasticity: 0.7, basePrice: 16.0, equilibriumStock: 250 },
];

export const GOODS_BY_ID: Record<string, GoodDef> = Object.fromEntries(GOODS.map((g) => [g.id, g]));

export const GOOD_CATEGORY_LABELS: Record<GoodCategory, string> = {
  agricole: 'Agricole',
  matieres_premieres: 'Matières premières',
  manufacture: 'Manufacturé',
  luxe: 'Luxe',
  alcool: 'Alcool',
};
