# Paddock — Carrière F1

Jeu de gestion de carrière de pilote de Formule 1 (navigateur, solo, en français).
Tu crées ton pilote, tu prends le baquet d’un titulaire de la grille 2026 et tu
gères **tout** : la piste, la presse, ton équipe, tes contrats, tes relations avec
les autres pilotes, ton argent et ta vie en dehors des circuits.

> Projet de fan, non commercial. Les noms des pilotes, écuries et circuits sont
> réels ; les portraits, logos et voitures sont chargés depuis le CDN officiel de
> formula1.com (ils appartiennent à leurs ayants droit). Les médias, journalistes,
> marques de sponsors et ingénieurs sont fictifs.

## Lancer le jeu

**Le plus simple : double-clique sur `Paddock.html`** (à la racine du dossier). Le jeu
s’ouvre dans ton navigateur, sans rien installer. La partie est sauvegardée dans le
navigateur.

**Application de bureau** (Windows, Mac, Linux), fabriquée avec Electron :

```bash
npm install
```
```bash
npm run dist:win
```

Le fichier `release/Paddock-F1-win.zip` contient `Paddock F1.exe` : dézippe et
double-clique. Sur Mac : `npm run dist:mac` ; sous Linux : `npm run dist:linux`.
Pour lancer l’application sans la fabriquer : `npm run app`.

**Mode développeur** : `npm run dev` puis http://localhost:5173. Après une
modification, `npm run build:app` régénère `Paddock.html`.

## Ce que tu gères

**Création du pilote.** Identité, nationalité, numéro, photo (import), casque,
parcours (champion F2, Super Formula, IndyCar, héritier…), répartition de points
de talent, choix de l’écurie et du pilote que tu remplaces, résidence fiscale,
difficulté.

**Grille réelle 2026 → saison 2027.** 11 écuries (dont Audi et Cadillac) avec
leurs vrais team principals, moteurs, couleurs et logos ; les 22 pilotes avec leurs
numéros, nationalités, âges et des attributs calibrés.

**Week-end de course complet** (24 GP du calendrier réel, 6 week-ends sprint) :
- conférence de presse du jeudi (tu écris tes réponses) ;
- essais libres : mini-jeu de réglages (5 paramètres) guidé par le retour de ton
  ingénieur, plus ou moins précis selon ton « retour technique » ;
- qualifications Q1/Q2/Q3 avec prise de risque par segment ;
- course sprint et Grand Prix en direct, tour par tour : stratégie pneus, mode de
  pilotage (économie/normal/push/attaque), « overtake mode » électrique (règlement
  2026), arrêts aux stands, météo évolutive, safety car et VSC, dépassements,
  accrochages, pénalités, abandons mécaniques, consignes d’équipe (obéir ou non) ;
- zone mixte après qualif et course, bilan financier, note du week-end.

**Presse & image.** Interviews en texte libre analysées (ton humble, arrogant,
drôle, loyal, critique envers l’équipe ou un rival, vulgaire…) : titres de presse,
confiance de l’équipe, sympathie, professionnalisme, polémique, relations avec
les pilotes cités. Interviews magazine, plateaux TV et podcasts à la demande.

**Téléphone.**
- Messages privés avec chacun des 22 pilotes et avec ton team principal ; chaque
  pilote répond selon sa personnalité publique (Verstappen sec et direct, Norris
  autodérision, Piastri laconique, Alonso « Karma 😉 », Leclerc chaleureux…).
- Groupe WhatsApp des pilotes : invitations (golf, padel, sim racing…), sujets
  GPDA, anniversaires réels, chambrage après les courses, réactions à tes messages.
- Instagram : publications, likes, commentaires des fans et des
  pilotes amis, croissance d’abonnés.
- Mail : offres de contrat, sponsors personnels, invitations à des événements.

**Relations.** Amitié, respect et rivalité avec chaque pilote, influencées par
tes messages, tes interviews, tes accrochages en piste et les activités partagées.

**Carrière & contrats.** Mercato à partir de la 8e manche, offres des écuries
selon tes performances, négociation (salaire, durée, statut n°1, primes, clause de
sortie, argumentaire libre) avec la patience de l’équipe, prolongations, demande
de statut, points de pénalité de super-licence, intersaison avec transferts IA,
retraites et rookies, carrière sur plusieurs saisons.

**Hors piste.** Planning des jours libres (entraînement, simulateur, usine,
sponsors, médias, golf, padel, vélo, soirées, yacht, Fashion Week, vacances…) avec
énergie, moral et stress qui influencent ta forme en piste ; invitation de pilotes ;
boutique (immobilier à Monaco, voitures, montres, yacht, jet privé…), staff
personnel (manager, préparateur, kiné, attaché de presse, coach, chef, pilote de
jet), résidence fiscale, sponsors personnels, placements, entreprises (merch,
karting, e-sport, restaurant…), fondation caritative, vie de couple.

## Nouveautés v2

- **Tes images partout** : fond de l’accueil et de l’onglet Écurie (équipe), fonds
  des circuits (calendrier et week-end), photos des articles de la boutique, galeries
  de tes maisons, voitures, yacht, jet, photo de ta résidence, fonds d’écran du
  téléphone et du groupe WhatsApp, photos dans tes posts Instagram. Deux façons :
  le bouton 🖼️ dans le jeu, ou le dossier `images/` (voir `images/LISEZMOI.md`
  pour les noms de fichiers exacts).
- **Ambiance par onglet** : couleurs, fonds et effets propres à chaque écran
  (couleurs de ton équipe à l’accueil, du pays sur les circuits, or pour le style
  de vie, vert pour les finances…).
- **Avatar neutre** (silhouette) tant que tu n’as pas importé de photo.
- **Anglais** : groupe WhatsApp, Instagram (commentaires), interviews et messages
  privés en anglais ; les pilotes francophones (Leclerc, Gasly, Ocon, Hadjar,
  Stroll) t’écrivent en français si ton pilote est francophone. Vasseur et Mekies
  aussi.
- **Réponses construites à partir de ton message** : invitation (activité + moment
  repris), question sur un circuit (avis selon la forme de leur voiture), avis sur
  un pilote cité (ami, rival, leader…), résultats réels, contrat, conseils selon le
  sujet (pluie, pneus, qualif, mental…), réaction à tes provocations ou excuses.
- **Décisions pendant le week-end** : en essais (évolution à tester, boîte fissurée,
  partage de données…), en qualif (trafic, drapeau jaune, aspiration, gêner un
  rival, timing…) et en course (crash devant toi, plongeon d’un rival, occasion de
  dépassement, undercut, débris, freins, pari météo, signaler un rival, aider un ami,
  relance après safety car, pneus en fin de vie).
- **Mode triche** (Réglages → afficher l’onglet 🎭) : position imposée en qualif et
  à l’arrivée, abandon forcé, rythme de chaque pilote, argent, attributs, etc.

## Simulation automatique (mode TV)

- **⚡ Simuler le GP** (accueil) ou **⚡ Simuler jusqu’à la course** (week-end) : essais,
  réglages, qualifs et décisions sont gérés par le pilote automatique, puis la
  course démarre en **mode TV**.
- **Profil du pilote automatique** : 🛡️ Prudent, ⚖️ Équilibré ou 🔥 Agressif (stratégie
  pneus, mode de pilotage, choix lors des décisions, consignes d’équipe). Option
  « M’arrêter pour les décisions » pour garder la main sur les moments clés.
- **Réalisation TV** : la course accélère quand il ne se passe rien et ralentit
  d’elle-même sur les moments chauds (bagarres, crash, safety car, changement de
  leader, derniers tours), avec bannières « moment fort », commentaires en direct,
  duels serrés, jauge d’intensité et graphique de ta position.
- **Résumé de course** après chaque sprint et Grand Prix (même avec « ⏭ Fin ») :
  courbe de ta position et chronologie des moments forts.
- Bouton **🎬 Mode TV / 🎮 Je pilote** pour passer de l’un à l’autre en pleine course.

## Attentes et verdicts

Chaque résultat est jugé par rapport au potentiel réel de ta voiture et de ton
pilotage sur ce circuit : l’équipe fixe un **objectif** avant chaque GP, et la
course reçoit un **verdict** (de « Exploit ! » à « Contre-performance »). P14 en
Cadillac peut être un exploit, P6 en Mercedes une déception. Le verdict influence
la note, le moral, la confiance de l’équipe, la presse et les questions des
journalistes (banque de plus de 75 questions, choisies selon le contexte et le ton
du média, sans répétition).

## Mode IA (optionnel)

Dans **Réglages**, tu peux renseigner une clé API Anthropic : les pilotes répondent
alors via Claude en incarnant leur personnalité, dans les messages privés comme
dans le groupe, et tes interviews sont analysées par un « rédacteur en chef » IA.
La clé reste dans ton navigateur et n’est jamais exportée avec la sauvegarde. Sans
clé, le moteur local prend le relais.

## Visuels

Les images viennent de `media.formula1.com`. Si la F1 change ses URL et qu’un
portrait ou un logo ne s’affiche plus, le jeu affiche un repli (initiales ou badge
aux couleurs de l’écurie) et tu peux coller l’adresse d’une autre image dans
**Réglages → Visuels officiels**.

## Structure

- `src/data/` : écuries, pilotes et personnalités, calendrier, style de vie, médias.
- `src/game/sim/` : rythme, réglages, qualifications, simulation de course.
- `src/game/social/` : analyse de texte, voix des pilotes, groupe, presse,
  interviews, intégration Claude.
- `src/game/career/` : contrats, négociation, saison, finances, mercato.
- `src/game/store.ts` : état central (Zustand, sauvegarde automatique).
- `src/components/` : interface (écrans, week-end, téléphone).
