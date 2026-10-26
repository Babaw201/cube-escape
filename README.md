# Limbyrinth — Cube Escape

Jeu 3D de labyrinthe en HTML et Three.js r128, avec quatre niveaux de campagne et un cinquième niveau en survie infinie, coopération locale et salons en ligne, commandes tactiles, progression et boutique.

**[▶ Jouer sur GitHub Pages](https://babaw201.github.io/cube-escape/)**

Choisir **« Niveau 1 : Labyrinthe »** pour commencer. Sur téléphone, ouvrir le lien dans Chrome ou Safari.

## Accueil compact sans défilement

- L'accueil est un écran fixe conçu pour être **entièrement utilisable sans faire défiler**, en particulier sur téléphone en paysage. Il conserve l'affichage de la sélection de niveau, du mode, du pseudo, de l'action « Jouer », des scores et des options principales.
- Direction artistique simplifiée : fond sombre avec anneau lumineux, composition plus aérée, miniatures discrètes des niveaux, un seul bouton de jeu orange qui domine.
- Les actualités, retours de bugs et commandes sont accessibles depuis deux menus compacts ; leurs sous-panneaux ne modifient pas la hauteur de l'accueil.
- Responsive pour **1440×900**, **844×390** (paysage) et **390×844** (portrait) avec des tests de visibilité et de non-défilement. Les écrans secondaires (scores, profil, boutique) conservent leur propre défilement si nécessaire.

## Interface futuriste et paysage mobile

- Menu principal inspiré de la maquette Limbyrinth : logo lumineux, grand bouton orange, modes **solo / coopération locale à 2 / jeu en ligne avec un ami**, cinq cartes de niveaux et mini-visuels graphiques CSS, galerie de records et accès direct au profil, aux scores et à la boutique.
- **Choisir une carte de niveau** met à jour la sélection sans lancer immédiatement le jeu. Appuyer ensuite sur **Commencer à jouer** pour lancer le secteur sélectionné (pseudo toujours obligatoire).
- Sur téléphone en **mode paysage**, le menu conserve ses deux colonnes et ses cinq niveaux en grille compacte ; sur téléphone vertical, le menu défile naturellement et la grille des niveaux devient horizontale.
- En jeu, le joystick suit la taille réelle de sa zone, les boutons tactiles TIR/DASH/VUE/PAUSE restent accessibles dans les coins, le radar et la barre de vie s'écartent des commandes, les notifications restent aux bords de l'écran.
- Le bouton **Plein écran · paysage**, disponible sur mobile, tente d'activer le plein écran et le verrouillage paysage lorsque le navigateur le permet. Tourner le téléphone manuellement reste possible.
- Les commandes tactiles ne s'affichent que pendant la partie ; elles disparaissent automatiquement au retour à l'accueil.
- Aucun modèle ou service 3D supplémentaire n'est téléchargé pour ce menu : les miniatures sont réalisées avec des styles CSS, pour garder un chargement léger.

## Accueil, profil et fin de partie

- **Pseudo obligatoire** avant une partie, y compris en solo : le premier clic sur « Commencer à jouer » ouvre la création du profil, puis lance le niveau demandé après validation. Un pseudo déjà enregistré est vérifié avant de jouer ; aucun pseudo invité anonyme n'est prévu.
- La connexion à Internet est nécessaire pour créer ou vérifier un pseudo lors du premier lancement. Les résultats locaux restent sur l'appareil et le Top 10 utilise ce profil.
- L'accueil regroupe une seule action principale, le mode de jeu, la liste des niveaux et les accès **Mon pseudo / Scores / Boutique / Jeu en ligne**. Les commandes et nouveautés sont accessibles dans des sections repliables.
- **À la fin de chaque partie**, victoire ou défaite, le jeu revient directement à l'accueil. Le dernier résultat (niveau, score et, en survie, vague et durée) y apparaît. La progression et les records sont enregistrés avant ce retour. Une partie en ligne termine également le salon.
- En niveau 5, les annonces et l'objectif tactique sont déplacés sur les bords et raccourcis pour dégager le centre de la vue. Les vagues 1 et 2 ont moins de drones et les renforts réguliers commencent à la vague 3.

## Niveau 5 — Survie infinie : **Protocole CORE**

Après le niveau 4, le joueur débloque une arène **sans fin** (nouvelle vague toutes les 12 secondes). En plus des affrontements contre les drones, la survie demande de **capturer les stations actives** : rester dans le cercle lumineux pendant 2,4 secondes, sans s'en éloigner. La capture fonctionne sur clavier, mobile et en coopération ; le niveau ne se limite donc pas à courir et tirer.

| Relais tactique | Effet |
|---|---|
| Impulsion EMP (bleu) | Immobilise les drones pendant 4 secondes |
| Station médicale (vert) | Rend 1 PV et ajoute un bouclier aux robots encore actifs |
| Surcharge de CORE (ambre) | Endommage/neutralise les drones à proximité |

Le relais actif change à chaque nouvelle vague, à partir de la vague 2. Les Titans arrivent toutes les cinq vagues, et la résistance des drones continue de croître après le plafond de 30 ennemis simultanés.

### Récompenses de progression
- **Vague 50** : skin de robot *Spectre* (sphère fantôme violette).
- **Vague 100** : skin légendaire *Souverain* (araignée noire et couronne plasma).
- Récompenses gratuites **verrouillées jusqu'au palier**, persistantes dans la sauvegarde et équipables depuis la boutique. Un ancien record de survie déjà sauvegardé est pris en compte.

### Records
- **Local :** le niveau 5 rejoint l'historique, les filtres, l'export CSV, les meilleurs scores par niveau et le record de vague, avec temps et nombre de drones détruits.
- **En ligne :** le classement Top 10 dispose d'un filtre « Niveau 5 / Survie », séparé de « Campagne (1–4) ». Le serveur doit accepter les résultats de survie avant que le Top 10 soit disponible : déployer `online/worker.mjs` et `online/social.mjs` ensemble sur Cloudflare (avec le module feedback actuel).
- Les parties refusées pendant une mise à jour serveur restent en attente localement pour une synchronisation ultérieure, tant que le profil de joueur et les données du navigateur sont conservés.
- Le classement est en **bêta**, sans anti-triche serveur faisant autorité. Ne pas l'utiliser pour une compétition récompensée.


## Nouveautés

- **Le Labyrinthe instable** : un quatrième niveau à carte fixe, trois phases cyan/magenta/ambre, console centrale, trois clés et portes définitivement ouvertes après stabilisation.
- **Le Traqueur** : ennemi étourdissable par trois tirs, suivi d’une fuite finale de 35 secondes après collecte des trois clés.
- **Quatre formes de robot gratuites** : Atlas bipède, Orbit flottant, Hexa à six pattes et Bastion à chenilles, avec aperçu 3D, animations et sauvegarde. Sélection dans **Boutique → Robots**.
- Éclairage et couleurs ajustés, murs entiers en vue aérienne, HUD de phase et mini-carte complète au niveau 4.
- Nouvelle fin de campagne après le quatrième niveau ; accès conservé pour les anciennes sauvegardes ayant terminé Le Noyau.

![Les quatre formes de robot](artifacts/robots.png)

## 🏆 Classement mondial Top 10

Depuis le menu **Scores & Top 10**, chaque joueur peut consulter un classement en ligne des **10 meilleurs pseudos**. Le tri porte sur le **meilleur score obtenu lors d'une seule partie** ; chaque joueur figure au plus une fois dans le Top 10 global. Un filtre permet aussi d'afficher les 10 meilleurs résultats de chaque niveau (1 à 4).

Le serveur Cloudflare `SocialHub` conserve un record par joueur et par niveau et affiche le pseudo actuel du compte. Les scores sont envoyés automatiquement **à la fin des nouvelles parties si le joueur a déjà créé son profil** dans « Amis & pseudo ». Les parties jouées sans profil et l'historique local antérieur ne sont pas importés. En cas de panne réseau, les résultats terminés sous un pseudo sont conservés en attente localement et une synchronisation est retentée depuis l'écran Scores.

**Bêta communautaire :** le serveur valide les formats, les valeurs de temps et les règles de calcul, mais un jeu web reste modifiable par son navigateur : **les scores ne bénéficient pas encore d'un anti-triche serveur faisant autorité**. Ne pas utiliser ce classement pour décerner des prix sans système de vérification. Le Top 10 est public : les pseudos qui participent y sont visibles.

## Scores et historique

Depuis l'accueil, appuyer sur **🏆 Scores** pour consulter le tableau des résultats. Il est également accessible depuis l'écran de fin de partie.

- Historique de toutes les parties **enregistrées à partir de cette version** : date, niveau, score, victoire/défaite, mode (solo, coop locale, en ligne), durée, cristaux, drones.
- Meilleur score et nombre de parties/victoires par niveau, points cumulés et record global.
- Filtres par niveau et mode ; tri chronologique ou par score ; export au format CSV.
- Les données sont conservées localement dans le navigateur (`limbyrinthScoresV1`). Le record de l'ancien système (`cubeEscapeBest`) reste visible, sans créer d'historique fictif.
- Les scores ne sont **pas** synchronisés entre appareils et ne forment **pas** un classement mondial. Vider les données du navigateur supprimera l'historique local (sauf sauvegarde CSV préalable).

## Commandes

| Action | Joueur 1 | Joueur 2 local |
| --- | --- | --- |
| Déplacement | ZQSD / WASD | Flèches |
| Tir | Clic gauche | Entrée |
| Dash | Maj gauche | Maj droite |
| Console du niveau 4 | E | O |

**V** : vue subjective (solo ou en ligne). **P** : pause solo/local. **M** : son. Sur mobile : joystick et boutons TIR, DASH, VUE et PHASE près de la console.

## Jouer hors connexion

Télécharger le dépôt et ouvrir `index.html` en conservant le dossier `vendor`, ou télécharger le fichier autonome [`Limbyrinth.html`](Limbyrinth.html) et l’ouvrir dans un navigateur compatible WebGL. Three.js est fourni localement avec sa licence.

## Actualités, sondages et signalements

L'accueil présente les ajouts **annoncés pour le lundi 26 octobre 2026** (matin : niveau 5 prévu ; après-midi : conception des murs et sondages prévus). Ce sont des annonces : les nouvelles fonctionnalités ne sont pas considérées comme déjà déployées.

Les visiteurs peuvent, sans compte, voter pour une priorité (nouveaux niveaux, murs, ennemis, coopération, autre), proposer une amélioration ou signaler un bug. Les réponses sont stockées dans le Durable Object SQLite `FeedbackInbox` via `POST /feedback`, sans collecter d'adresse ni d'identifiant de joueur.

Le créateur consulte les réponses sur [`retours-admin.html`](retours-admin.html), avec un **code secret Cloudflare `FEEDBACK_ADMIN_KEY` configuré exclusivement côté serveur**.
Les bugs peuvent déclencher un **e-mail privé** immédiatement après réception, avec reprise automatique en cas d'échec, si les paramètres serveur `RESEND_API_KEY` et `FEEDBACK_EMAIL_TO` sont configurés. La réception dans Gmail permet d'activer les notifications sur téléphone. Les messages restent dans la boîte de retours même sans service d'envoi. Il peut voir les derniers retours, les votes et les messages non lus, et marquer le tout comme lu. **Ce n'est pas une notification par e-mail ni une alerte push** : il faut ouvrir le tableau privé pour consulter les nouveaux retours. Ne pas placer le code dans GitHub.

Déployer la migration Durable Object `v3` et le secret Cloudflare avant de rendre l'interface accessible. Conserver les bindings `ROOMS` et `SOCIAL` pour ne pas affecter le multijoueur et les amitiés.

## Pseudos et amis (version expérimentale)

Dans le menu **👥 Amis & pseudo**, créer un profil avec un pseudo unique (3–16 caractères : lettres non accentuées, chiffres, soulignement ; commence par une lettre). Ensuite, on peut envoyer une demande à un pseudo exact, accepter/refuser, retirer ou bloquer un joueur, et inviter un ami confirmé dans un salon coopératif.

- Les profils et amitiés sont gérés par le service Cloudflare `/social/*` du Worker `limbyrinth-online`, avec stockage SQLite Durable Object.
- **Déploiement du Worker nécessaire** : il faut déployer `online/wrangler.jsonc` (migration `v2` ajoutant `SocialHub`) et `online/social.mjs` avant d'activer l'interface sur le site. Test conseillé avec deux navigateurs distincts.
- L'identifiant d'accès privé reste dans le stockage du navigateur, jamais dans un lien partagé ; il n'existe **pas de récupération de compte ou de synchronisation entre appareils** dans cette première version. Ne pas effacer les données du navigateur si l'on veut conserver ce profil.
- Les demandes nécessitent l'acceptation explicite du destinataire ; pas d'annuaire public, pas de messagerie privée ; bloquer retire les liens existants.
- Les invitations à rejoindre un salon expirent automatiquement après 15 minutes. La liste est rafraîchie lorsque le joueur ouvre **Amis & pseudo** ou clique sur *Actualiser*.
- Ce n'est pas un système complet de comptes (absence d'e-mail, de mot de passe, de restauration et de modération avancée). Pour une diffusion publique importante, ajouter des protections renforcées et un mécanisme de récupération.

## Jouer avec un ami

1. L’hôte ouvre **Jouer en ligne → Créer un salon**.
2. Il partage le **code court** ou le **lien d’invitation**. Son ami ouvre le lien, ou saisit le code dans **Rejoindre le salon**.
3. Une fois les deux joueurs connectés, l’hôte choisit le niveau.

Les salons accueillent deux joueurs. Le code expire après 15 minutes d’attente ; une session connectée dure au maximum deux heures. **Quitter le salon** permet de revenir au jeu local. Un message explique les codes invalides, salons complets ou expirés et déconnexions.

La connexion passe par un relais WebSocket ; aucun long code WebRTC à échanger. Les transitions, portes et ramassages restent validés par l’hôte. Le service et sa configuration sont dans [`online/`](online/README.md).

## Vérification

Avec Node 24 :

```sh
npm install
npm test
npm run preview:robots
```

**41 tests passent** (jeu, client et service de salons) : carte/BFS et accès aux ailes, 100 transitions avec occupants, portes fermées solides à l’approche, console/cooldown, clés et alarme, étourdissement, snapshots et autorité hôte, modèles en coopération, anciennes sauvegardes et régressions des niveaux 1–3. Le parcours complet sans ennemi utilise les mouvements et collisions réels. Les tests de salons vérifient aussi les rôles, la capacité à deux joueurs, la déconnexion, l’expiration, les annulations et les raccourcis clavier pendant la saisie.

Le démarrage d’un niveau a aussi été vérifié sur la version hébergée dans un navigateur, avec une fenêtre bureau et une fenêtre mobile de 390×844 : clic sur le niveau, fermeture du menu, animation et absence d’erreurs JavaScript lors de ces contrôles. Le nouveau service a été vérifié avec deux connexions WebSocket réelles. L’écran de connexion a été testé au format mobile : saisie sans déclenchement des raccourcis, arrivée d’un invité, départ au niveau 4, synchronisation de phase, commandes et sortie du salon. La fluidité sur téléphone physique et le parcours complet avec le Traqueur restent à vérifier.

Pour lancer la suite navigateur complète :

```sh
npx playwright install chromium
npm run test:browser
```

`CHROMIUM_PATH` permet de sélectionner un Chromium installé. Les tests Node utilisent la logique et les géométries Three.js réelles, avec un DOM de test et la frontière WebGL remplacée. L’image des robots est un rendu de contrôle des maillages.

Le cahier des charges du niveau 4 est dans [`docs/level4-spec.md`](docs/level4-spec.md). L’ancienne variante HTML du dépôt est conservée.
