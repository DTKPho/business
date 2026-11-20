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

---

# Néon Estate — Marchand de biens (nouveau jeu)

Jeu de gestion immobilière autonome dans `public/neon-estate/index.html` (un seul
fichier HTML, aucune dépendance) : ouvrez-le directement dans un navigateur, ou
lancez `npm run dev` puis allez sur `/neon-estate/`. Ambiance néon « coucher de
soleil sur la côte », HUD de jeu d'action, téléphone de messages, flash info.

Vous dirigez une société de marchand de biens dans la Baie de Solaris (ville
fictive, 8 quartiers) avec **3 M€** de départ. Objectif : passer de Petit
marchand à Légende (1 Md€ de patrimoine net).

- **Annonces** : studios, maisons, immeubles de rapport, villas, plateaux de
  bureaux, terrains, tours. Vendeurs motivés (succession, divorce, liquidation
  judiciaire, off-market), négociation avec contre-offres, expertise (amiante,
  mérule, structure), prêt in fine selon votre banquier et votre réputation,
  frais de notaire réduits à 2,5 %.
- **Valorisation** : rafraîchissement, rénovation complète, énergétique ou de
  prestige, division en lots, transformation de bureaux en logements, permis
  de construire puis promotion (résidence neuve).
- **Location** : loyers selon le quartier, vacance, impayés, interdiction de
  louer les passoires (DPE G, puis F dès 2028).
- **Fiscalité** : TVA sur marge à chaque vente, honoraires d'agence, IS annuel
  (15 % puis 25 %) avec report des déficits ; pression fiscale en étoiles
  (travaux au noir, pots-de-vin) et contrôles fiscaux.
- **Marché vivant** : phases Boom / Stable / Correction / Krach, taux directeur,
  événements (tram, ouragan, encadrement des loyers…), rivaux IA qui raflent
  les meilleures affaires et classement.
- **Montée en puissance** : 5 employés à 5 niveaux, 6 QG (capacité de 3 à 150
  biens), ligne de crédit, 14 missions, 7 rangs. Sauvegarde automatique
  (localStorage). Découvert pendant 4 semaines = liquidation.
