# Cube Escape — mise à jour de la version GitHub

**Le fichier complet à utiliser pour ton site est `index.html` dans ce dossier.** Cette version prolonge le jeu du dépôt [Babaw201/cube-escape](https://github.com/Babaw201/cube-escape), sans remplacer ses modes multijoueurs par l'ancien jeu solo.

Base comparée : `index.html` de la branche `main`, blob `76f361e8627b3266a7725a3e148969bb479f30de`.

## Fonctionnalités conservées

- Interface néon en plein écran, robot cubique, caméra rapprochée qui suit les joueurs.
- Deux niveaux : labyrinthe bleu puis **Zone instable** orange.
- Trois cristaux, portail vert, 90 secondes, murs mobiles toutes les 20 secondes.
- Trois lasers au niveau 2, alternance toutes les 3 secondes.
- Trois points de vie par robot, tirs électriques, trois impacts pour détruire un Traqueur, dash avec 5 secondes de recharge.
- Deux Traqueurs au niveau 1 et quatre au niveau 2, comme dans ta version publiée.
- Protection pendant le dash, score et progression sauvegardés avec les mêmes clés du navigateur.
- Mode solo, **deux joueurs sur un clavier**, et **jeu en ligne par échange de deux codes WebRTC**.
- Un seul fichier HTML, Three.js r128 via le CDN déjà présent. Aucune bibliothèque supplémentaire dans le jeu.

## Améliorations apportées

- **Vue subjective optionnelle** avec le bouton Vue subjective ou V, en solo et en ligne. La caméra se place dans le robot, la souris oriente le regard, ZQSD/WASD deviennent relatifs à cette direction et le clic tire droit devant. V revient à la caméra de suivi. En duo local, la caméra commune reste en vue de suivi pour garder les deux joueurs visibles.
- **Radar de proximité** issu de la version publiée : il n'affiche que les sept cases autour du robot, avec les cristaux et Traqueurs proches, pour aider à s'orienter sans révéler tout le labyrinthe.
- **Pause avec Échap ou le bouton Pause**, reprise et retour à la sélection des niveaux. En ligne, l'hôte contrôle la pause et les deux jeux s'arrêtent ensemble. Quitter la fenêtre de l'hôte met la partie en pause.
- **Tirs et vision arrêtés par les murs** sur tout leur trajet, y compris lorsque le déplacement d'un projectile dépasse l'épaisseur visible d'un obstacle entre deux mises à jour.
- **Navigation des drones par centres de cases** : ils terminent un segment avant de tourner, puis poursuivent la dernière position vue quand le robot disparaît derrière un mur.
- **Déplacements et dash vérifiés par petits pas**, pour empêcher le franchissement d'un mur. La durée complète du dash est prise en compte par le déplacement.
- **Sélection des niveaux réservée à l'hôte** en ligne, nettoyage des commandes lors d'un changement de partie et prise en compte des murs dans la copie du labyrinthe de l'invité.
- **État final synchronisé avant la victoire ou la défaite** : compteurs, score, positions et visibilité des robots sont actualisés chez l'invité.
- Libération des anciennes ressources 3D lors des redémarrages, avec conservation des ressources partagées du combat.

## Lancement local

Ouvrir `index.html` dans un navigateur récent, avec une connexion Internet pour charger Three.js. Pour servir le dossier en HTTP, si Python est installé :

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

Lancer cette commande depuis ce dossier, puis ouvrir **http://127.0.0.1:8080/**. Arrêter le serveur avec `Ctrl+C`.

## Commandes

| Action | Joueur 1 / solo / en ligne | Joueur 2 sur le même clavier |
| --- | --- | --- |
| Déplacement | ZQSD ou WASD ; flèches également en solo/en ligne | Flèches |
| Tir | Clic gauche à l'endroit visé | Entrée, dans la direction du robot |
| Dash | Maj gauche / Shift | Maj droite |
| Pause | Échap ou bouton Pause ; hôte uniquement en ligne | Échap, pause commune |
| Recommencer | R ; hôte uniquement en ligne | R, mission commune |
| Choisir un niveau | Bouton Niveaux ; hôte uniquement en ligne | Menu commun |
| Changer de vue | Bouton Vue subjective ou V ; solo/en ligne | Vue commune conservée |

En vue subjective, cliquez dans le labyrinthe pour capturer la souris et tirer. Si la capture de souris n'est pas disponible, maintenez le clic et déplacez la souris pour tourner. Sur écran tactile, glissez sur le labyrinthe pour tourner et utilisez les boutons Tirer et Dash.

## Tester avant mise en ligne

1. **Solo :** lancer le niveau 1, se déplacer contre un mur, faire un dash, tirer sur un drone trois fois, puis essayer les tirs à travers un mur.
2. **Pause :** utiliser Échap pendant une recharge ; vérifier que le chronomètre, les drones et la recharge restent arrêtés. Reprendre, puis ouvrir Niveaux et relancer une mission.
3. **Progression :** prendre les trois cristaux et rejoindre le portail. Passer au niveau 2, vérifier les murs orange et les trois lasers, puis recharger la page : le niveau 2 et le record doivent être conservés.
4. **Deux joueurs locaux :** choisir le mode duo, tester les deux ensembles de touches, les deux barres de vie, les tirs et dash séparés. La victoire attend les robots encore vivants au portail.
5. **En ligne :** ouvrir la même version du jeu dans deux navigateurs, créer une partie côté hôte, échanger les deux codes et connecter. Vérifier le même labyrinthe, les déplacements du joueur distant, la pause synchronisée, les murs mobiles et les compteurs à la fin de partie.
6. **Redémarrages :** rejouer plusieurs fois, alterner les niveaux et les modes : aucun objet de l'ancienne partie ne doit rester affiché.
7. **Vue subjective :** en solo, appuyer sur V, avancer et tourner avec la souris ; vérifier que les murs bloquent toujours le robot et les tirs. Revenir avec V, puis essayer le bouton. En ligne, tester la vue sur l'invité ; en duo local, vérifier que la caméra commune reste disponible.

Le jeu en ligne conserve le système WebRTC existant, sans serveur relais payant. Sa connexion effective dépend des réseaux des deux joueurs ; elle doit être vérifiée sur les appareils utilisés.

## Vérifications effectuées

Dans le dossier de travail, les tests se lancent depuis la racine du dépôt avec :

```powershell
node --test tests/cube-escape-github.test.mjs
```

Les tests chargent le véritable script du fichier, utilisent les objets Three.js installés dans le dossier de travail et remplacent uniquement l'affichage et les éléments de page pour l'exécution dans Node. Ils couvrent la vue subjective, la conservation du duo et des sauvegardes, les tirs, la navigation, le dash, les menus, la pause et les messages entre deux joueurs simulés. Les trois lasers et l'accès aux objectifs ont été vérifiés sur 80 labyrinthes du niveau 2. Les deux niveaux ont été terminés en simulation, avec les ennemis et lasers actifs.

Le rendu WebGL de la vue subjective a été vérifié dans le navigateur local. Une connexion WebRTC réelle entre deux appareils reste à essayer ; les simulations ne remplacent pas cet essai.

## Mettre le fichier sur GitHub

Le fichier à mettre à jour dans **Babaw201/cube-escape** est l'`index.html` à la racine du dépôt. Le fichier HTML contient tout le jeu ; ce guide et les tests ne sont pas nécessaires à son exécution. Conserver la même adresse du site permet au navigateur de retrouver les niveaux débloqués et le record.
