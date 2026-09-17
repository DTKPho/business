# Comptoir & Commissions — 1899

Jeu de stratégie économique solo, ambiance USA fin XIXe siècle. Vous incarnez un
marchand qui ne possède aucune marchandise : vous construisez un réseau de
routes commerciales entre villes et prélevez une commission sur tout ce qui y
transite.

Ceci couvre le socle du jeu (étapes 1 à 3 de la feuille de route) :

- Carte des 50 États américains (SVG, projection Albers USA fidèle), avec 18
  villes jouables réparties sur 12 États réels.
- Marché par ville : 16 biens (agricole, matières premières, manufacturé,
  luxe, alcool) avec stocks virtuels et prix qui fluctuent selon l'offre et
  la demande (`prix = prix_base * (stock_équilibre / stock_actuel) ^ élasticité`).
- Création de routes commerciales (chariot), avec commission ajustable (2 % à
  15 %) prélevée sur le volume de marchandises qui y transite entre villes en
  surplus et villes en déficit.
- Boucle de jeu continue (pas de tours, pas de temps réel horloge système) :
  un cycle jour/nuit visuel rythme la partie, qui tourne tant que l'onglet
  est ouvert.
- Sauvegarde automatique en `localStorage`, plus export/import JSON.

L'architecture est pensée pour rester modulaire : chaque mécanique de revenu
(ici la commission commerciale) est isolée dans `src/game/`, afin de pouvoir
brancher plus tard d'autres types d'entreprises (immobilier, production,
banque, presse, lobbying) sur le même état de jeu central (`src/game/store.ts`).

## Structure

- `src/data/` — données statiques : villes, biens, tracé des États.
- `src/game/` — logique de simulation : types, store Zustand, formules de
  prix/stocks, formules de routes/commission.
- `src/components/` — interface : carte SVG, panneaux latéraux, journal
  d'événements.

## Développement

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
