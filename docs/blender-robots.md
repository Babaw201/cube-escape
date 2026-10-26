# Spectre et Souverain — audit et intégration

Les fichiers `assets/models/spectre.glb` et `souverain.glb` sont les exports Blender originaux fournis, conservés sans modification. Le relevé reproductible et leurs empreintes SHA-256 figurent dans [robot-model-audit.json](robot-model-audit.json).

| Contrôle | Spectre | Souverain |
|---|---:|---:|
| Taille exacte | 246 424 octets | 342 484 octets |
| Scènes / robots | 1 / 1 | 1 / 1 |
| Maillages d'origine | 49 | 99 |
| Matériaux | 7 | 8 |
| Triangles | 8 588 | 9 596 |
| Dimensions X × Y × Z, unités glTF | 1,845 × 1,891 × 1,639 | 3,191 × 2,615 × 2,308 |
| Textures images / caméras / animations exportées | 0 / 0 / 0 | 0 / 0 / 0 |
| Erreurs / avertissements Khronos | 0 / 0 | 0 / 0 |
| Maillages affichés après regroupement | 10 | 45 |

Chaque scène contient un seul groupe racine (`SPECTRE__VAGUE_50_ROOT` ou `SOUVERAIN__VAGUE_100_ROOT`), uniquement les pièces du robot correspondant. Tous les nœuds sont rattachés à ce groupe. Aucun décor, lumière, caméra, autre robot ou fichier externe n'est nécessaire. Les couleurs, propriétés métalliques et émissions lumineuses sont décrites par des matériaux PBR ; l'absence de textures images est donc normale. Le validateur donne seulement 49/99 informations `UNUSED_OBJECT` sur des coordonnées UV inutilisées.

Les exports sont glTF 2.0, issus de `Khronos glTF Blender I/O v5.2.39`. Le chargeur officiel Three.js r128 est fourni localement, à la même version que le moteur. Une extension du chargeur restitue `KHR_materials_emissive_strength`, que r128 ne gérait pas encore. Aucun décodeur Draco/KTX2 ni service externe n'est requis.

## Comportement dans le jeu

L'entrée à jour est `index.html`, utilisée par GitHub Pages. À la première création ou prévisualisation de Spectre/Souverain, le modèle procédural fonctionne immédiatement ; le GLB le remplace dès qu'il est prêt. Une erreur HTTP, un fichier invalide, l'absence du chargeur ou un délai réseau supérieur à huit secondes conserve le repli. Un nouvel essai est possible après trente secondes à la création d'une nouvelle instance. L'ouverture directe en `file://` peut bloquer le chargement : utiliser un serveur HTTP ou GitHub Pages pour les GLB.

Le remplacement conserve les objets qui portent position, orientation, visibilité, repère du joueur et effets de jeu. Les identifiants `rspectre` et `rsovereign`, collisions, vitesses, tirs, ultimes (26/32 s), déblocages aux vagues 50/100 et messages réseau restent identiques. Un chargement terminé après destruction d'un robot n'est pas attaché à l'ancienne scène.

Les exports ont une origine décalée de ±2,35 unités en X. Le chargeur les recentre horizontalement et ajuste uniformément leur emprise à 1,60 unité, sans déformation et sans changer la collision existante. L'avant est déjà orienté vers +Z, comme les robots du jeu. Le bas de Spectre est placé à 0,25 unité et celui du Souverain à 0,06 unité, hors oscillation du déplacement. Les anneaux, la couronne et les six pattes reçoivent des animations légères dans le jeu ; aucun clip Blender n'a été exporté.

## Coût mobile et ressources

Les pièces statiques sont fusionnées par matériau, avec des groupes distincts pour les parties animées. La géométrie et les matériaux sont mis en cache une seule fois par robot, partagés entre les aperçus et les joueurs, tandis que leurs transformations restent indépendantes. Les deux caches sont conservés pendant la vie de la page. Détruire une instance ne détruit pas les ressources d'une autre. Les UV inutilisés sont retirés des copies de rendu ; les GLB originaux et tous leurs triangles sont conservés. Pas de nouvelles ombres dynamiques. Le plafond de résolution mobile existant à 1,5 est conservé.

Cette optimisation diminue les appels de dessin des robots de 79,6 % et 54,5 %. Elle ne constitue pas une mesure de FPS sur un téléphone physique. Les tests mobiles Chromium vérifient l'exécution à 844 × 390 et le chargement depuis un sous-chemin de type GitHub Pages ; une validation matérielle iOS/Android reste utile.

## Vérification

- `npm test` : logique existante, coopération, services et tests des vrais GLB (validation, dimensions, matériaux émissifs, cache, animations, destruction, délais et repli).
- `npm run test:browser` : suite navigateur existante puis chargement/rendu WebGL des GLB sur bureau et mobile, tirs/ultimes, aperçu, cache et échec réseau.
- `npm run audit:robots` : régénère le relevé JSON avec le validateur Khronos et les dimensions Three.js.
- `node tests/preview-server.cjs` puis `http://127.0.0.1:8765/robot-preview` : aperçu animé des deux modèles réellement intégrés.

Sur le poste Windows de préparation, les 86 tests Node passent et l'aperçu WebGL a été contrôlé dans le navigateur intégré. Le lancement d'un navigateur enfant par Playwright est refusé par l'environnement (`spawn EPERM`) ; la suite automatisée complète est exécutée dans GitHub Actions et son statut est indiqué sur la pull request. Les adaptations de l'instrumentation aux fins de ligne CRLF permettent aussi aux tests existants de fonctionner sous Windows.

Le fichier historique `Limbyrinth.html` est une ancienne version autonome, antérieure à ces deux skins. Il reste inchangé ; utiliser `index.html` pour cette intégration.

Sources techniques : [GLTFLoader r128](https://github.com/mrdoob/three.js/blob/r128/examples/js/loaders/GLTFLoader.js), [BufferGeometryUtils r128](https://github.com/mrdoob/three.js/blob/r128/examples/js/utils/BufferGeometryUtils.js), [validateur Khronos](https://github.com/KhronosGroup/glTF-Validator). Les deux fichiers de bibliothèque sont couverts par `vendor/LICENSE.three.txt`.
