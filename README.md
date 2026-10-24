# Limbyrinth — Cube Escape

Jeu 3D de labyrinthe en HTML et Three.js r128, avec quatre niveaux, coopération locale et WebRTC, commandes tactiles, progression et boutique.

**[▶ Jouer sur GitHub Pages](https://babaw201.github.io/cube-escape/)**

Choisir **« Niveau 1 : Labyrinthe »** pour commencer. Sur téléphone, ouvrir le lien dans Chrome ou Safari.

## Nouveautés

- **Le Labyrinthe instable** : un quatrième niveau à carte fixe, trois phases cyan/magenta/ambre, console centrale, trois clés et portes définitivement ouvertes après stabilisation.
- **Le Traqueur** : ennemi étourdissable par trois tirs, suivi d’une fuite finale de 35 secondes après collecte des trois clés.
- **Quatre formes de robot gratuites** : Atlas bipède, Orbit flottant, Hexa à six pattes et Bastion à chenilles, avec aperçu 3D, animations et sauvegarde. Sélection dans **Boutique → Robots**.
- Éclairage et couleurs ajustés, murs entiers en vue aérienne, HUD de phase et mini-carte complète au niveau 4.
- Nouvelle fin de campagne après le quatrième niveau ; accès conservé pour les anciennes sauvegardes ayant terminé Le Noyau.

![Les quatre formes de robot](artifacts/robots.png)

## Commandes

| Action | Joueur 1 | Joueur 2 local |
| --- | --- | --- |
| Déplacement | ZQSD / WASD | Flèches |
| Tir | Clic gauche | Entrée |
| Dash | Maj gauche | Maj droite |
| Console du niveau 4 | E | O |

**V** : vue subjective (solo ou WebRTC). **P** : pause solo/local. **M** : son. Sur mobile : joystick et boutons TIR, DASH, VUE et PHASE près de la console.

## Jouer hors connexion

Télécharger le dépôt et ouvrir `index.html` en conservant le dossier `vendor`, ou télécharger le fichier autonome [`Limbyrinth.html`](Limbyrinth.html) et l’ouvrir dans un navigateur compatible WebGL. Three.js est fourni localement avec sa licence.

Le mode en ligne utilise le serveur STUN existant et l’échange manuel de codes. Les transitions, portes et ramassages sont validés par l’hôte.

## Vérification

Avec Node 24 :

```sh
npm install
npm test
npm run preview:robots
```

**18 tests passent** : carte/BFS et accès aux ailes, 100 transitions avec occupants, portes fermées solides à l’approche, console/cooldown, clés et alarme, étourdissement, snapshots et autorité hôte, modèles en coopération, anciennes sauvegardes et régressions des niveaux 1–3. Le parcours complet sans ennemi utilise les mouvements et collisions réels.

Le démarrage d’un niveau a aussi été vérifié sur la version hébergée dans un navigateur, avec une fenêtre bureau et une fenêtre mobile de 390×844 : clic sur le niveau, fermeture du menu, animation et absence d’erreurs JavaScript lors de ces contrôles. La connexion WebRTC réelle entre deux navigateurs, la fluidité sur téléphone physique et le parcours complet avec le Traqueur restent à vérifier.

Pour lancer la suite navigateur complète :

```sh
npx playwright install chromium
npm run test:browser
```

`CHROMIUM_PATH` permet de sélectionner un Chromium installé. Les tests Node utilisent la logique et les géométries Three.js réelles, avec un DOM de test et la frontière WebGL remplacée. L’image des robots est un rendu de contrôle des maillages.

Le cahier des charges du niveau 4 est dans [`docs/level4-spec.md`](docs/level4-spec.md). L’ancienne variante HTML du dépôt est conservée.
