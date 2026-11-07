# Genesis Magma F1 Team

Jeu de gestion d'écurie de Formule 1, 100 % navigateur (aucun serveur), en français.
Vous incarnez **Liam Robert**, 42 ans, Executive Chairman & CEO de Genesis Magma F1 Team,
l'écurie de Hyundai Motor Group qui remplace Haas sur la grille 2027 (11 écuries).

> Projet à usage strictement personnel. Noms réels (écuries, pilotes, staff, marques) ;
> **toutes les statistiques sont des estimations inventées et non officielles.**

## Lancer le jeu

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # tests du moteur (Vitest)
npm run build    # version statique dans dist/ (ouvrable depuis n'importe quel hébergement statique)
```

## Application de bureau (double-clic)

Le jeu peut être installé comme une vraie application (Windows, macOS, Linux) grâce à Electron.
Sur l'ordinateur où vous voulez jouer, une seule fois :

```bash
npm install
npm run desktop:build
```

L'installeur apparaît dans le dossier `release/` :

- **Windows** : `Genesis Magma F1 Setup 1.0.0.exe` → l'installation crée un raccourci sur le bureau ;
- **macOS** : `Genesis Magma F1-1.0.0.dmg` → glisser l'application dans Applications
  (au premier lancement : clic droit → Ouvrir, l'application n'étant pas signée) ;
- **Linux** : `Genesis Magma F1-1.0.0.AppImage` → rendre exécutable puis double-cliquer.

`npm run desktop` lance l'application sans l'installer. L'installeur se fabrique pour le système
sur lequel la commande est lancée. Les sauvegardes de l'application de bureau sont stockées dans
son propre dossier de données (indépendant du navigateur) ; utilisez l'export / import JSON pour
transférer une carrière.

## Fonctionnalités

### Interface (version 1.1)

- Thème **Jour** (clair, par défaut) ou **Nuit**, réglable dans *Menu → Paramètres d'affichage*.
- Décors flous et animés propres à chaque onglet : hall du QG, garage, salle du conseil, campus,
  salle des trophées, paddock… (désactivables). Les illustrations sont générées par
  `node scripts/scenes.mjs` ; pour utiliser vos propres photos, placez-les dans `public/` et
  modifiez `src/data/scenes.json`.
- Menu latéral par sections repliables, menu déroulant « ☰ Menu », sous-onglets dans chaque écran
  (Voiture, Finances, Conseil, Personnel…) et détails repliables : on n'affiche que l'essentiel,
  le reste au clic.
- **Installations** : chaque installation s'ouvre dans une fenêtre avec son illustration, ses effets
  actuels et au niveau suivant, et les actions possibles (construire, améliorer, accélérer ou
  annuler les travaux, revendre un niveau).
- **Grands Prix uniques** : couleurs et drapeau du pays, fiche du circuit, **tracé réel** de chacun
  des 24 circuits, carte dans le calendrier.
- **Séances en direct** : essais libres et qualifications se regardent en entier (chronos qui
  tombent, éliminations Q1/Q2/Q3, vitesse ×10 à ×150) ou se passent ; **radar** avec les voitures
  qui roulent sur le tracé pendant les séances et la course.
- **Menu de triche** (*Menu → Menu de triche*) : argent, plafond, valorisation, conseil, parts de
  Liam, voiture, R&D, installations, moteurs, pilotes, staff, pit crew, signatures toujours
  acceptées, aucune panne. Une carrière qui triche est signalée dans la barre du haut.
- **Niveau de départ** au lancement d'une carrière : Écurie de garage (difficile), Partir de zéro
  (scénario original), Écurie structurée, Superpuissance (facile) ; options pour fournir un
  encadrement et deux pilotes de départ. Les niveaux sont modifiables dans
  `src/data/start-levels.json`.

### Jeu

- **Pré-saison** : Genesis démarre sans pilote ni encadrement. Recrutez deux titulaires (obligatoire
  avant Bahreïn), un réserviste et le staff avec les 250 M€ de trésorerie.
- **Saison 2027 réelle** : 24 manches, 10 week-ends sprint. Week-ends en 3 phases (essais avec
  programme de roulage, qualifications Q1/Q2/Q3, course), format sprint quand il y a lieu.
- **Moteur de course tour par tour** : pneus (5 composés, usure, falaise), carburant, météo
  évolutive, voiture de sécurité / VSC, accidents, pannes, ERS, modes moteur, consignes d'équipe,
  arrêts aux stands, règle des deux composés. **Mode direct** (1× à 8×, ordres en temps réel)
  et **mode simulé** utilisent exactement le même moteur.
- **Voiture & R&D** : aéro, châssis, groupe motopropulseur, fiabilité ; projets avec points de
  design, coûts de conception et de production, niveau d'ambition (gain, variance, risque
  d'échec, impact fiabilité), développement de la voiture de l'année suivante, restrictions
  d'essais aérodynamiques (ATR), allocation moteur et pénalités de grille.
- **Moteur** : client Ferrari 2027–2029, puis moteur Hyundai (programme de 400 M€ à Namyang,
  jalons, contribution optionnelle de l'écurie).
- **Personnel** : directeur technique, responsable aéro, chef du bureau d'études, directeur
  sportif, deux ingénieurs de course (un par pilote), responsable du scouting, pit crew.
  Notes, contrats, mentalité, moral, négociations, indemnités de transfert, débauchage.
  Les pilotes F2/F3 sont sur le marché (pas d'académie). Le scouting détermine la précision
  des notes affichées.
- **Finances** : trésorerie, plafond de dépenses en dollars (projection, amendes et sanction
  sportive), sponsors réels avec objectifs bonus, primes FOM, apports des actionnaires.
- **Conseil d'administration** : objectifs de Hyundai, RedBird et Arctos, satisfaction,
  confiance, valorisation mensuelle, vote de défiance.
- **Parts de Liam** : 5 % achetés + 4 % de fondateur (vesting 4 ans, cliff 1 an), sweat equity
  (4 × 2 %), earn-out (2 % à 6 Md€, 2 % à 10 Md€), dilution au prorata avec Hyundai ≥ 51 %,
  scénarios good / bad leaver.
- **Installations** : trois branches (développement voiture, personnel, opérations) ; soufflerie
  louée et pas de CFD au départ.
- **Boîte de réception** : événements aléatoires, rumeurs, crises, offres de sponsors,
  tentatives de débauchage, décisions à prendre.
- **Carrière sans fin** : intersaison (contrats, vieillissement, retraites, championnats F2/F3,
  nouveaux espoirs, nouvelle voiture) ; Liam vieillit chaque année.

## Sauvegarde

- Sauvegarde automatique dans **IndexedDB** après chaque action (fin de séance, de course, de
  semaine, de saison, décisions), plus à la fermeture ou mise en arrière-plan de l'onglet.
  La dernière partie est rouverte automatiquement.
- Plusieurs emplacements, duplication, **export / import JSON** (écran Sauvegardes ou menu).
- Format versionné (`schemaVersion`) avec migrations dans `src/engine/save/migrations.ts`.

## Modifier les données

Tout est dans `src/data/` (fichiers JSON) :

| Fichier | Contenu |
|---|---|
| `teams.json` | écuries, couleurs, réputation, notes de départ des voitures, contrats moteur |
| `drivers.json` | pilotes F1, F2, F3 et libres (notes, potentiel, mentalité, contrat) |
| `staff.json` | personnel réel (rôle, notes, salaire, fin de contrat, pilote suivi) |
| `circuits.json` | caractéristiques des circuits (appui, puissance, usure, dépassements, SC, pluie) |
| `calendar-2027.json` | calendrier ; les dates `dateEstimated` sont à vérifier |
| `power-units.json` | motoristes (puissance, fiabilité, coût client) |
| `sponsors.json` | marques, niveau, montant, réputation requise |
| `facilities.json` | installations, niveaux, coûts, effets |
| `rnd-templates.json` | pièces développables |
| `board-objectives.json` | modèles d'objectifs du conseil |
| `events/random-events.json` | événements aléatoires de la boîte de réception |
| `config.json` | équilibrage (plafond, taux €/$, barèmes de points et primes FOM, coûts) |
| `scenario.json` | fiction de départ (Liam, actionnariat, trésorerie, programme Hyundai) |
| `names.json` | noms utilisés pour générer le personnel secondaire (marqué « généré ») |
| `start-levels.json` | niveaux de départ proposés à la création de carrière |
| `scenes.json` | décors des onglets et images des installations |
| `tracks.json` | tracés des circuits (données [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits), licence MIT, non officielles) |

Les JSON servent à **créer une nouvelle partie** : une carrière en cours n'est jamais modifiée
par un changement de données.

Line-ups 2027 : grille confirmée à l'automne 2026 (sources : presse spécialisée), avec Genesis
à la place de Haas ; Ocon et Bearman (junior Ferrari) sont libres sur le marché. Les sièges Racing
Bulls et certaines dates du calendrier sont des estimations.

## Architecture

```
src/
├── data/            JSON modifiables
├── engine/          logique de jeu en TypeScript pur (aucun import React), testable
│   ├── core/        rng à graine (sfc32), dates, formats, identifiants
│   ├── model/       types.ts : tout le modèle de données (GameState)
│   ├── init/        chargement des données, création de partie
│   ├── season/      boucle hebdomadaire, week-ends, classements, intersaison
│   ├── race/        performance, essais, qualifications, course tour par tour, stratégie IA
│   ├── car/         voiture, R&D, groupe propulseur, programme Hyundai
│   ├── people/      notes, contrats, négociation, moral, débauchage, vieillissement
│   ├── finance/     registre, plafond, sponsors, flux hebdomadaires
│   ├── board/       objectifs, conditions, valorisation, parts de Liam
│   ├── facilities/  installations
│   ├── inbox/       messages, événements, effets des décisions
│   ├── ai/          recrutement et contrats des écuries IA
│   └── save/        sérialisation et migrations
├── persistence/     IndexedDB, export/import de fichiers
├── store/           store Zustand (applique les fonctions du moteur, sauvegarde)
└── ui/              écrans React + Tailwind
tests/               tests Vitest (déterminisme, parts, plafond, sauvegarde, carrière longue)
```

Le générateur aléatoire est stocké dans la sauvegarde : même graine + mêmes décisions = même partie.
En développement, le store est accessible dans la console via `genesis.getState()`.
