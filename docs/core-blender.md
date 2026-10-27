# Complexe CORE — source Python pour Blender

La géométrie principale est créée dans **Blender avec `bpy`**, puis exportée vers
Three.js. Le JavaScript place et instancie les modules ; le décor procédural sert
de repli immédiat pendant le téléchargement ou si le GLB est absent/invalide.

- Script source : [`scripts/blender/build_core.py`](../scripts/blender/build_core.py).
- Projet éditable : [`assets/models/core/core-source.blend`](../assets/models/core/core-source.blend).
- Kit autonome : [`assets/models/core/core-kit.glb`](../assets/models/core/core-kit.glb).
- Dimensions et scènes : [`core-blender-audit.json`](core-blender-audit.json).
- Plans des cinq secteurs, graine 123 : [`scripts/blender/layouts.json`](../scripts/blender/layouts.json).

## Régénération

Avec Blender 4.3 ou ultérieur, depuis la racine du dépôt :

```sh
blender --background --factory-startup -t 2 --python scripts/blender/build_core.py
blender --background --factory-startup -t 2 --python scripts/blender/build_core.py -- --render --render-sectors
```

La première commande crée le `.blend`, le `.glb` et l'audit. La seconde ajoute les
rendus Cycles du couloir et des cinq secteurs dans `artifacts/core/blender/`.
Aucune texture externe, bibliothèque Python ou extension Blender n'est nécessaire.
L'export n'utilise pas Draco. Le message du greffon Blender indiquant que Draco
n'est pas disponible n'affecte pas l'export sans compression.

Dans le `.blend`, choisir la scène `CORE_REFERENCE_CORRIDOR` pour le couloir,
`CORE_SECTOR_01_…` à `CORE_SECTOR_05_…` pour les secteurs, et
`CORE_MODULAR_LIBRARY` pour éditer les modules. Les biseaux et normales pondérées
restent des modificateurs éditables. Les secteurs utilisent des instances de
collections et des matériaux distincts, avec des maillages partagés.

## Modules et repères

Chaque module a un pivot au centre de la cellule, au niveau du sol. Cellule de
4 m, mur de 2,8 m. Les helpers Python prennent X/Y/Z du jeu (Y vertical) ; l'export
glTF convertit le Z vertical de Blender. La face de mur est orientée vers +Z.

Le kit comprend corps de mur, faces détaillées/simples/endommagées, dalles avec
grilles, plafond à poutres et chemins de câbles, terminal, conduites, réseau
énergétique, machine, porte de sécurité, réacteur, baie de drones et plateforme.
Les panneaux sont en relief réel, avec joints, fixations, ventilation et marquages.
Les variantes simples réduisent les triangles ; les gravures sont réservées au
réglage Élevé. Les matériaux PBR ont des noms sémantiques `CORE_PANEL`,
`CORE_ACCENT`, etc., recolorés selon les cinq ambiances dans le jeu.

## Intégration et performance

`core-blender-models.js` charge le kit local une seule fois, fusionne ses pièces
par module/matériau et partage les géométries entre les niveaux. Les placements
utilisent `InstancedMesh`. Les matériaux sont propres à chaque environnement et
sont détruits à sa fermeture ; les géométries du kit sont conservées dans un cache
unique. Aucun éclairage dynamique ni ombre n'est ajouté au jeu.

Le réglage Faible/Moyen/Élevé est accessible au clavier dans l'accueil et enregistré
séparément des sauvegardes. Faible supprime les effets d'ambiance, réduit les modules
et limite le pixel ratio à 1 ; Moyen utilise les variantes simples de panneaux et
des grilles espacées ; Élevé ajoute les gravures et détails. La préférence système
de réduction du mouvement supprime l'ambiance animée.

Le plafond se masque en vue du dessus et en coop locale ; il réapparaît en vue
subjective. Les accessoires restent dans des cellules solides. Le réacteur de
l'arène occupe une cellule périphérique existante ; la plateforme centrale est
affleurante. Le réacteur énergétique d'origine conserve sa cellule dédiée.
Les portes gardent leurs groupes, animation, collisions et états de phase ; leur
ancien cube visuel est masqué seulement quand la porte Blender est prête.

La construction historique du décor est retirée **après** le placement des éléments
de gameplay : Three r128 utilise `Math.random` pour ses UUID et changer cet ordre
déplacerait les objectifs et ennemis d'une graine partagée. Les empreintes de 30
combinaisons de niveaux/graines/coop vérifient la stricte identité des placements.

## Vérification et captures

```sh
npm test
npm run test:browser
```

Les tests couvrent les vrais GLB, emprises, cache, délai/échec réseau, destruction,
chargements tardifs, portes, niveaux, changement de qualité et gameplay d'origine.
Le test navigateur mesure les draw calls, géométries, textures, temps de construction
et temps de rendu synthétique `gl.finish()` à 1200×750 avec une caméra identique.
La CI joint les captures WebGL et `metrics.json` dans l'artefact
`core-webgl-evidence`. Ces mesures décrivent le GPU du runner, pas un Lenovo Iris Xe.

Les captures `artifacts/core/blender/` sont des rendus Cycles du fichier Blender.
Les captures CPU `artifacts/core/corridor-before.png` et `corridor-after.png` sont
des contrôles de géométrie sans textures, conservés séparément des rendus WebGL.
Ne pas confondre la lumière Cycles de présentation avec le budget du moteur de jeu.
