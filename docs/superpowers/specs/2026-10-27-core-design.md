# Complexe CORE — issue #22

Source et périmètre autorisé : https://github.com/Babaw201/cube-escape/issues/22.
Reconstruire le décor uniquement : couloir de référence, kit modulaire, cinq secteurs.
Conserver la grille, les dimensions T=4/H=2.8, BFS, portes et leur animation,
objectifs, génération, ordre des appels aléatoires, caméra, coop et règles de survie.

## Approche retenue

Correction explicite de l'utilisateur : créer les décors en Python pour Blender.
Le kit principal est donc écrit en `bpy` dans `scripts/blender/build_core.py`, avec
source `.blend` éditable et export `.glb`. `core-blender-models.js` charge et instancie
les géométries exportées. Le kit procédural dans `core-environment.js` sert de repli.
Les faces métalliques, attaches, ventilations et dégâts restent dans les cellules solides.
Les dalles et guides sont au ras du sol ; les plafonds sont visibles en vue subjective
seulement. Un réacteur périphérique dans une cellule déjà solide laisse le centre de
l'arène libre. Les portes enrichies restent enfants de leurs groupes existants.

Alternatives : décors entièrement GLB (assets de décor absents, téléchargement et
draw calls supplémentaires) ; ajout des détails au script principal (moins réutilisable).
La géométrie Blender fusionnée par matériau permet des ressources partagées ;
les variantes exportées assurent une dégradation déterministe.
Les GLB de robots existants restent utilisés par leur chargeur actuel. Des emplacements
de décor permettent un GLB facultatif autonome, borné à une cellule solide, avec repli.

## Secteurs

Confinement blanc/cyan ; industrie acier/orange et conduites ; énergie violet et
réseaux ; archives endommagées et phases ; arène avec plateforme affleurante,
réacteur périphérique, baies de déploiement et indicateurs de vagues/Titans.

## Contraintes et validation

Pas de nouvelle lumière dynamique ni ombre. Matériaux Standard et géométries
instanciées partagés par environnement ; destruction explicite lors des reconstructions.
Qualité persistante réglable au menu sans redémarrer la partie ni consommer de hasard.
Effets discrets, désactivés en faible ou mouvement réduit ; audio via le contrôle Muet.
Tests ciblés : emprises, grille inchangée, déterminisme, portes, ressources, chargement
GLB absent/tardif et réglage clavier accessible. Captures de géométrie avant/après ;
mesures WebGL sur scène/graine identiques quand Chromium est disponible.
