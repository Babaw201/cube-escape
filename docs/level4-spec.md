# LIMBYRINTH / CUBE ESCAPE — NIVEAU 4 : LE LABYRINTHE INSTABLE

Cahier des charges destiné à Codex — conception, intégration Three.js et critères de recette.

## 0. Contexte technique réel à préserver

- Dépôt de base inspecté : `Babaw201/cube-escape`, branche `main`, fichier `index.html` (le titre courant y est `Cube Escape`). Vérifier de nouveau la branche et le code avant toute modification : Limbyrinth peut avoir évolué.
- Implémentation actuelle : HTML + JavaScript monolithique, **Three.js r128** via CDN, `N = 15`, taille d'une case `T = 4`, collisions dans `hit()`, labyrinthe `grid[z][x]`, murs dynamiques `dyn`, état de jeu `LV`, `cur` (index 0-based), `start()`, `build0()`, `swapWalls()`, `hud()`, `update()`, `animate()`, `end()`, `drawMap()`.
- Déjà présents : murs qui basculent toutes les 20 s, tirs, dash, PV, drones, trois cristaux ou relais, portail, classement, boutique, progression `localStorage`, coop locale et WebRTC hôte/invité, commandes mobiles.
- La campagne se termine actuellement au niveau 3 (`cur === 2`) ; la nouvelle fin doit être déplacée au niveau 4 (`cur === 3`).

**Principe de design :** le niveau 4 ne doit pas être un simple renouvellement des anciens murs mobiles et drones. Sa nouveauté est de **contrôler les phases du labyrinthe pour accéder à trois ailes qui ne sont pas ouvertes simultanément**.

## 1. Identité et histoire

- Nom : `Le Labyrinthe instable` ; sous-titre : `Archives de confinement de CORE`.
- Récit : après « Le Noyau », le portail ne débouche pas sur l'extérieur mais sur un module d'évacuation falsifié. CORE enferme le joueur dans une dernière architecture reconfigurable. Sa voix annonce : « Vous n'avez pas quitté le système. Vous en avez atteint le cœur. »
- Objectif : récupérer **3 clés de stabilisation** (réutiliser techniquement la mécanique des 3 cristaux / relais), rejoindre le portail à l'angle sud-est, puis fuir avant le confinement final.
- Enjeu : apprendre les chemins, choisir la bonne phase, éviter le Traqueur. Ambiance futuriste sombre, chrome bleuté, cyan, magenta, ambre, sirènes rouges lors de la fuite.

## 2. Paramètres jouables

| Paramètre | Valeur MVP |
|---|---|
| Grille | 15 × 15 cases, compatible `N=15` |
| Taille des cases | 4 unités, compatible `T=4` |
| Durée initiale | 240 secondes |
| Rotation automatique de phase | toutes les 28 secondes |
| Avertissement | 4 dernières secondes (son + pulsation de la couleur suivante) |
| Phases | 0 = CYAN, 1 = MAGENTA, 2 = AMBRE ; boucle 0→1→2→0 |
| Console centrale | `E` pour passer à la phase suivante ; cooldown 8 s |
| Transition manuelle | avertissement 1,5 s avant application |
| Clefs | 3, persistantes après collecte ; chacune maintient définitivement ouverte sa porte d'aile |
| Ennemi | 1 Traqueur, qui peut être étourdi, et non détruit définitivement |
| Fuite | après la 3e clé, limiter le temps restant à 35 s et allumer une alarme rouge |
| Défaite | plus aucun joueur vivant, ou temps écoulé |
| Coop | rester compatible 1 joueur, 2 joueurs localement et WebRTC |

Les nombres doivent être centralisés dans des constantes pour réglages ultérieurs. 240 s évitent une difficulté injuste liée aux délais de changement de phase. Le rythme sera recalibré après tests.

## 3. Plan jouable précis

Coordonnées de grille **`(x,z)`**, origine en haut à gauche. Lignes z=0..14, colonnes x=0..14. Chaque ligne ci-dessous contient 15 caractères.

```text
###############
#S...#...#....#
#..#.#.#.#..#.#
#........A.1..#
#....#...#....#
#######.#######
#....#...#....#
#.#.###O#..#..#
#....#...#....#
#######.#######
#....#...#....#
#..2.B...C.3..#
#..#.#...#..#.#
#....#...#...E#
###############
```

**Légende :** `#` mur fixe, `.` sol, `S` départ (1,1), `O` console centrale (7,7), `1` relais CYAN (11,3), `2` relais MAGENTA (3,11), `3` relais AMBRE (11,11), `A` porte CYAN (9,3), `B` porte MAGENTA (5,11), `C` porte AMBRE (9,11), `E` portail (13,13).

- `A`, `B`, `C` sont des **cellules de mur dynamique** : ouvertes seulement dans leur phase **ou** définitivement après collecte de leur relais respectif.
- En phase initiale CYAN, `A` est ouverte et `B,C` fermées.
- Le joueur progresse de sa salle de départ à la console grâce au passage fixe (5,3) puis (7,5).
- `1`, `2` et `3` sont dans trois ailes différentes. Le joueur peut les faire dans n'importe quel ordre, mais leur porte impose une phase initiale ; une fois le relais activé, l'aile reste accessible.
- Le portail est visuellement présent mais désactivé tant que les trois clés ne sont pas récupérées. Les murs décoratifs ne doivent pas occuper les couloirs du plan.

**Contrôle conceptuel déjà effectué :** départ→console accessible dans les trois phases ; départ→relais 1 en CYAN, →relais 2 en MAGENTA, →relais 3 en AMBRE ; départ→portail accessible dans les trois phases après activation des trois relais. Codex doit ajouter une validation BFS automatisée en lisant effectivement cette carte.

## 4. Boucle de gameplay

1. **0–20 s, tutoriel visuel** : le joueur entre ; texte « Phase CYAN : accès aux Archives Est ». Il voit les portes et le décompte. Première clef atteignable sans action spéciale.
2. **Découverte de la console** : au centre, un terminal projette l'anneau à trois couleurs. Panneau : « E — modifier la configuration ». Une activation passe CYAN→MAGENTA→AMBRE→CYAN.
3. **Recherche des clés** : le HUD affiche « Stabilisation 0/3 », « Phase CYAN », « Reconfiguration : 28 s ». Chaque clef enregistrée verrouille son accès en position ouverte (récompense concrète).
4. **Traque** : le Traqueur patrouille les zones accessibles, voit le joueur à portée et poursuit sa dernière position connue lorsqu'il le perd ; le joueur peut passer les portes ouvertes, utiliser un dash et l'étourdir par tir.
5. **Alarme** : sur la 3e clef, sirène, lumière rouge et annonce « Confinement final : 35 s » ; le portail passe au vert vif. Les trois portes, désormais verrouillées ouvertes, rendent la fuite possible quel que soit le cycle.
6. **Fin** : les joueurs vivants arrivent au portail ; révélation que CORE conserve une copie des données du labyrinthe. L'écran final de campagne et les récompenses doivent être déclenchés ici, pas au niveau 3.

## 5. Règles techniques exactes des phases

Modèle conseillé :

```js
const PHASES = ['CYAN', 'MAGENTA', 'AMBRE'];
const LEVEL4 = {
  duration: 240,
  phaseSeconds: 28,
  phaseWarningSeconds: 4,
  manualWarningSeconds: 1.5,
  consoleCooldownSeconds: 8,
  finalSeconds: 35
};
const LEVEL4_GATES = [
  { id: 'A', x: 9, z: 3, phase: 0, relay: 0 },
  { id: 'B', x: 5, z: 11, phase: 1, relay: 1 },
  { id: 'C', x: 9, z: 11, phase: 2, relay: 2 }
];
// Exemple d'état réinitialisé par start() AVANT build():
// level4 = { phase: 0, seconds: 28, consoleCooldown: 0,
//   pendingPhase: null, pendingSeconds: 0, latched: [false,false,false],
//   alarm: false };
function shouldGateBeOpen(gate, level4) {
  return level4.latched[gate.relay] || gate.phase === level4.phase;
}
```

- **Ne pas** appliquer `swapWalls()` au niveau 4 : ce serait la mécanique aléatoire des anciens niveaux. Utiliser `cycleLevel4Phase()` et `syncLevel4Gates()` ; les autres niveaux gardent leur comportement 20 s, inchangé.
- Une reconfiguration attend l'expiration du timer et applique simultanément le nouveau mode voulu, **sauf cellules occupées**.
- Collision : si un joueur OU un drone est sur la cellule qui doit se fermer ou traverse encore son volume (rayon/boîte de sécurité au moins `T/2 + 0.9`), ne jamais fermer cette cellule. Laisser cette porte temporairement ouverte, la signaler en orange et retenter dès que le volume est libre.
- Toujours mettre à jour les deux états ensemble lorsque la fermeture/ouverture se produit : `grid[z][x] = closed ? 1 : 0` et `gate.closed = closed`. Animer ensuite `mesh.scale.y` via le système `dyn` existant. La collision dépend de l'état **physique réel** de la porte, non d'un simple mode désiré.
- Ne jamais fermer un mur sur un joueur : ni collision téléportante, ni dommages imputables à un changement de phase sans avertissement.
- Les portes activées (`latched`) doivent rester ouvertes jusqu'à la fin de la partie, y compris lorsque le Traqueur passe devant.
- Changement manuel : le joueur doit être à moins de 2.4 unités de `O`, appuyer **une seule fois** sur `E`, et respecter un cooldown de 8 s. Après le signal de 1,5 s, passer à la phase suivante et réinitialiser le timer automatique à 28 s.
- Pour le coop local, ajouter une touche distincte au joueur 2 (`O` par exemple) ; pour mobile, ajouter un vrai bouton contextuel `PHASE` visible près de la console.
- En ligne, l'hôte valide l'activation selon la position réelle du joueur et le cooldown et diffuse le changement aux clients. Ne pas laisser le client invité modifier la phase lui-même.
- Le chrono, les transitions et les pauses doivent utiliser `dt` borné (p.ex. `Math.min(dt,0.05)` en mise à jour) et être arrêtés en pause / hors jeu.

## 6. Traqueur — une menace différente des drones classiques

- Un seul ennemi principal spawn dans le corridor central accessible, au plus près d'une cellule praticable proche de `(7,8)`.
- Apparence : drone un peu plus massif, œil rouge, anneau de trois segments, traînée lumineuse discrète. Réutiliser `creerDrone()` / `animerDrone()` et la géométrie existante, sans téléchargement externe obligatoire.
- États : `PATROL`, `CHASE`, `INVESTIGATE`, `STUNNED`. Le Traqueur patrouille à 2.5 u/s, poursuit à 4.8 u/s lorsqu'il voit un joueur vivant dans un rayon de 9 unités avec ligne de vue `los()`. Après perte de vision, se rend à la dernière case observée pendant 4 s puis reprend sa patrouille.
- Pathfinding : réutiliser `bfs()` sur la **grille actuelle**. Recalculer après toute reconfiguration ; si aucun chemin, retourner en patrouille sans traverser les murs.
- Combat : trois tirs réussis déclenchent un étourdissement de 4 s ; ensuite compteur de coups remis à zéro. Tant qu'il est étourdi, ne se déplace pas et ne blesse pas au contact ; petit cooldown anti-abus. Il n'est pas définitivement supprimé par les tirs. Les ennemis des niveaux 1 à 3 gardent leur comportement antérieur.
- En coop, cible toujours le joueur vivant visible / accessible le plus proche. La mort des joueurs conserve la logique actuelle.
- Éviter de faire apparaître un drone dans une aile fermée et de l'obliger à traverser le mur.

## 7. HUD et expérience utilisateur

- Remplacer uniquement au niveau 4 « Cristaux » par « Clés » ou « Stabilisation », en gardant le compteur 0/3.
- Afficher phase courante avec nom **et** couleur (utile pour le daltonisme), prochaine phase et secondes jusqu'au basculement.
- `O` doit être repérable depuis le couloir via une lueur et un anneau holographique. Afficher une indication `E — Reconfigurer` seulement dans son rayon d'action.
- Les portes colorées portent aussi un symbole distinct `A/B/C`; la couleur seule ne doit pas être l'unique indicateur.
- La mini-carte doit représenter les portes selon l'état réellement ouvert/fermé, les trois relais non activés, la console et le portail.
- Signal avant transition : 2 bips, clignotement orange, basse vibration visuelle légère, sans écran blanc ni flash agressif.
- Mobile : boutons existants TIR/DASH/VUE maintenus, plus bouton `PHASE` contextuel, sans recouvrir le joystick.
- Performance : textures / maillages réutilisés ; éclairage dynamique limité ; objectif fluide sur téléphone de milieu de gamme ; libérer les objets créés lors des rebuilds.

## 8. Points d'intégration dans le fichier actuel

1. Ajouter une quatrième entrée à `LV` (nom, sous-titre, brief, couleurs, `lasers:0`, `foes:1`, `duration:240`). Utiliser `cur===3` pour toutes les mécaniques spéciales ; ne pas toucher la logique `cur===2` du réacteur.
2. Dans `build0()`, utiliser le plan déterministe de la section 3 pour `cur===3` au lieu de `genMaze()`. Construire `grid` et `m.dynCells` avec les seules trois portes A/B/C, puis générer les géométries comme d'habitude.
3. Étendre les tableaux dépendants de l'index du niveau (`tint`, couleurs de sol, décorations), car ils comportent aujourd'hui seulement trois éléments. Vérifier les branches `if(cur===0)...else if(cur===1)...else`.
4. Placer les trois relais aux coordonnées fixes (11,3), (3,11), (11,11), au lieu des `picks` aléatoires ; pour le niveau 4, conserver l'auto-ramassage à proximité pour éviter d'inventer un second bouton d'interaction.
5. Initialiser l'état `level4` **avant** `build()` dans `start()` ; réinitialiser tous les états lors des redémarrages.
6. Dans `update()` utiliser l'horloge de phase pour `cur===3`, sans appeler `swapWalls()`. Traiter console, transitions, collecte et alarme. Mettre l'alarme de 35 s seulement pour `cur===3`; garder celle de 25 s du réacteur pour `cur===2`.
7. Dans `animate()`, réutiliser l'animation verticale des `dyn`, la pulsation des matériaux, le portail, les cristaux et les éléments visuels de l'alarme. Distinguer visuellement les trois portes.
8. Créer un comportement Traqueur propre au niveau 4 à partir de `foeAI`, `bfs`, `los` et `hitFoe`, sans changer la logique de destruction des drones classiques.
9. Mettre à jour `hud()`, `drawMap()`, CSS et commandes clavier/tactiles sans casser la disposition mobile actuelle.
10. WebRTC : ajouter au snapshot les propriétés nécessaires (`phase`, `latched`, `pendingSeconds`, `alarm`, `stun`, etc.) ; dans `applySnap()`, synchroniser **aussi** `grid` avec la fermeture réelle des portes, pas seulement `dyn.closed`. Seul l'hôte décide des transitions et des ramassages.
11. Déplacer la fin de campagne au nouveau dernier index. Adapter les textes : le niveau 3 ouvre l'accès au niveau 4, tandis que le niveau 4 déclenche crédits et épilogue. Gérer les anciennes sauvegardes `save.l3` ou `save.finished` pour que les joueurs ayant déjà terminé le niveau 3 puissent essayer le niveau 4 sans tout recommencer. Éviter les récompenses finales doublées (marqueur séparé si nécessaire).
12. Ne pas renommer brutalement les identifiants `localStorage`, ne pas supprimer le shop ni les modes coop / mobile.

## 9. Tests d'acceptation (obligatoires)

**Logique et sécurité**

- Chaque ligne de la carte contient exactement 15 caractères ; les symboles attendus sont présents une seule fois (sauf `.` et `#`).
- En phase 0, seule A est ouverte ; en phase 1, seule B ; en phase 2, seule C (avant collecte) ; après activation, chaque porte d'aile reste ouverte indépendamment des phases.
- BFS : S→O fonctionne en phase 0,1,2 ; S→1 en phase 0 ; S→2 en phase 1 ; S→3 en phase 2 ; S→E fonctionne dans les trois phases après activation des trois relais.
- La console n'active pas plusieurs transitions lors d'une touche maintenue, et le cooldown bloque le spam.
- Une porte occupée ne se ferme jamais sur un joueur, un dash ou le Traqueur ; elle se ferme après leur départ si c'est toujours l'état souhaité.
- La collision réelle, le maillage 3D et la mini-carte concordent après chaque phase et sur le client invité.
- L'alarme se déclenche **une seule fois** à la troisième clé, avec 35 secondes restantes au maximum.
- Le niveau 4 peut être terminé en solo sans exploiter de bug ; échec si temps écoulé ; les deux modes coop restent jouables.

**Régression / ergonomie**

- Les niveaux 1, 2, 3 conservent leurs murs à 20 s, drones, lasers, réacteur et scoring.
- Recharge ou retour menu puis replay du niveau 4 sans duplication de monde, de HUD ou de gestionnaires clavier.
- Partie mobile : le bouton `PHASE` est utilisable sans masquer TIR/DASH ; la mini-carte se met à jour.
- Partie WebRTC : client invité voit les bonnes portes et n'est pas capable de déclencher seul une transition ; états joueurs cohérents.
- Ancien joueur avec `save.finished === 1` peut choisir le niveau 4 ; nouveaux joueurs doivent le déverrouiller par le niveau 3.
- Aucun échec console / exception / violation de collision dans un essai automatisé d'au moins 100 transitions de phase.

## 10. Ordre d'exécution conseillé pour Codex

1. Inspecter la branche courante, confirmer l'architecture et faire un court inventaire des changements indispensables.
2. Implémenter d'abord la quatrième entrée LV, la carte fixe, les portes et le moteur de phases ; écrire la validation de carte et BFS.
3. Intégrer relais, alarme et portail ; tester le parcours complet sans ennemi.
4. Ajouter le Traqueur et la console à interaction ; régler collision / cooldown et UI.
5. Étendre mobile et coop/WebRTC ; corriger les régressions de progression et de fin de campagne.
6. Exécuter les tests disponibles, vérifier le navigateur si possible, corriger puis faire un commit descriptif (sans déployer en production sans demande explicite).

## 11. Prompt prêt à coller dans Codex

> Travaille dans mon dépôt de jeu `Babaw201/cube-escape` (ou dans le dépôt actuellement ouvert si celui-ci a été renommé Limbyrinth). Implémente intégralement le **niveau 4 « Le Labyrinthe instable »** selon le cahier des charges contenu dans ce fichier. Inspecte d'abord l'architecture réelle et respecte Three.js et les mécaniques déjà présentes. Le niveau 4 a une carte fixe 15×15, trois portes de phase A/B/C, trois relais qui verrouillent définitivement leurs portes en position ouverte, une console centrale activable avec E et un bouton mobile, un Traqueur étourdissable, une fuite finale de 35 s, et la nouvelle fin de campagne. Les anciennes mécaniques des niveaux 1 à 3 doivent rester intactes. Donne la priorité à un niveau **terminable**, aux collisions sûres, aux tests BFS et à la cohérence mobile/coop/WebRTC. Procède par étapes, vérifie les régressions, puis résume les fichiers modifiés, les tests et les problèmes restants. Ne publie pas sans mon accord.
