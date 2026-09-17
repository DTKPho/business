# Comptoir & Commissions — 1899

Jeu de stratégie économique solo, ambiance USA fin XIXe siècle. Vous incarnez un
marchand qui ne possède aucune marchandise : vous construisez un réseau de
routes commerciales entre villes et prélevez une commission sur tout ce qui y
transite. Feuille de route complète implémentée (étapes 1 à 13, hors le
système de prestige, abandonné).

## Fonctionnalités

- **Carte** — les 50 États américains (SVG, projection Albers USA fidèle),
  avec 18 villes jouables réparties sur 12 États réels.
- **Marché** — 16 biens (agricole, matières premières, manufacturé, luxe,
  alcool) avec stocks virtuels par ville et prix qui fluctuent selon l'offre
  et la demande (`prix = prix_base * (stock_équilibre / stock_actuel) ^ élasticité`).
- **Routes & commission** — chariot, diligence, bateau à vapeur (villes
  portuaires/fluviales) et train (après construction d'une voie ferrée),
  avec taux de commission ajustable (2–15 %) et volume qui réagit à l'écart
  offre/demande et au taux pratiqué.
- **Licences & contrebande** — licence obligatoire par catégorie et par État
  pour percevoir une commission légale (manufacturé/luxe dès la Compagnie
  enregistrée) ; sans licence, commission réduite « au noir ». L'alcool n'est
  jamais licenciable : marge plus élevée, toujours en contrebande.
- **Nœuds stratégiques** — entrepôts constructibles/améliorables (3 niveaux)
  dans une ville, bonus de commission sur les routes reliées ; dilution du
  bonus si un rival possède aussi un entrepôt sur le même nœud.
- **Gangs** — risque d'attaque par route (dangerosité, valeur transportée,
  mode de transport, gardes armés), rançon possible, protection régulière
  payable par territoire de gang.
- **Rivaux IA** — 4 marchands rivaux au comportement distinct (agressif,
  opportuniste, défensif) qui ouvrent leurs propres routes sur le marché
  partagé ; rachat de parts (participation passive) ou absorption totale
  (forcée si affaibli, ou amiable à tout moment).
- **Concessions exclusives** — négociées par État et par catégorie (Charte
  d'État requise), avec risque aléatoire de perte au profit d'un rival.
- **Corruption & audits** — curseur de corruption par État qui réduit la
  taxe légale mais augmente le risque d'audit fédéral (amende, révocation de
  licence, réputation).
- **Charte** — 4 paliers (Marchand indépendant → Compagnie enregistrée →
  Charte d'État → Charte fédérale) débloqués par capital et réputation
  cumulée, qui ouvrent progressivement licences avancées, concessions,
  rachats de rivaux, train, puis licences fédérales automatiques.
- **Agents régionaux** — dès 8 routes actives, engagez un agent par État qui
  applique automatiquement une règle de gestion (taux bas, taux standard,
  alignement sur le meilleur rival local), avec vue holding dédiée.
- **Boucle de jeu continue** — pas de tours, pas d'horloge réelle : un cycle
  jour/nuit visuel rythme la partie, qui tourne tant que l'onglet est ouvert.
- **Sauvegarde** — automatique en `localStorage`, plus export/import JSON.

L'architecture reste modulaire : chaque mécanique de revenu (ici la
commission commerciale) est isolée dans `src/game/`, afin de pouvoir brancher
plus tard d'autres types d'entreprises (immobilier, production, banque,
presse, lobbying) sur le même état de jeu central (`src/game/store.ts`).

## Structure

- `src/data/` — données statiques : villes, biens, tracé des États, gangs,
  rivaux.
- `src/game/` — logique de simulation : types, store Zustand, formules de
  prix/stocks, routes/commission, licences, entrepôts, gangs, rivaux,
  concessions, corruption, charte, agents régionaux.
- `src/components/` — interface : carte SVG, panneaux latéraux, journal
  d'événements, écrans États & gouvernance / Rivaux / Holding.

## Développement

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
