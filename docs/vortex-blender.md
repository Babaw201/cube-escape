# VORTEX — modèle créé en Python / Blender

Le modèle principal de VORTEX est généré par [build_vortex.py](../scripts/build_vortex.py), un script Python utilisant l’API native `bpy` de Blender. Il ne dépend d’aucune image externe, extension ou bibliothèque Python supplémentaire.

## Fichiers livrés

- `scripts/build_vortex.py` : construction reproductible des volumes, matériaux, articulations, export et studio.
- `assets/models/vortex.blend` : scène Blender éditable avec le robot, la caméra et l’éclairage de présentation.
- `assets/models/vortex.glb` : modèle autonome chargé dans le jeu ; aucun sol, caméra, lumière ou studio exporté.
- `assets/models/vortex.audit.json` : triangles, matériaux, taille et empreinte SHA-256 de l’export réel.
- `assets/previews/vortex.png` : rendu du modèle Blender réellement livré.

## Régénérer

```sh
blender --background --threads 4 --python scripts/build_vortex.py -- --render
```

Sans `--render`, le script exporte le GLB, le `.blend` et l’audit sans calculer l’image. `--samples 128` augmente la qualité du rendu ; la valeur par défaut est 64. Blender 4.3 est pris en charge. Le rendu fonctionne sur CPU et n’exige pas de module natif de débruitage.

La préparation du studio s’adapte aussi à Blender 5.x : groupe de composition, sortie de groupe et paramètres du nœud Glare sous forme de sockets. Blender 4.3 conserve son API précédente et le même effet lumineux.

### Depuis l’éditeur de texte de Blender, y compris sous Windows

Ouvrir `build_vortex.py` dans l’espace **Scripting**, puis utiliser **Exécuter le script**. Il n’est pas nécessaire que le texte ait un chemin de fichier complet : les chemins virtuels tels que `\build_vortex.py` et l’absence de `__file__` sont pris en charge.

La version **1.3** crée explicitement ses nœuds de matériau et de monde par leur type Blender. Les noms traduits comme « BSDF guidée » ou « Arrière-plan » ne bloquent donc plus la construction. `VORTEX_BUILD 1.3` est affiché dans la console pour identifier la version exécutée. Si plusieurs blocs de texte sont ouverts, créer un nouveau texte, y coller le script complet et l’exécuter avec **Alt + P** ; un ancien bloc `build_vortex.py` peut encore contenir la première version.

La version **1.4** conserve ces corrections et utilise les valeurs de menu `Fog Glow` / `High` attendues par les sockets de Blender 5.2. Les anciennes propriétés des nœuds Blender 4.3 conservent `FOG_GLOW` / `HIGH`. L’objet créé est récupéré dans `bpy.context.view_layer.objects.active`, ce qui fonctionne aussi quand le contexte de l’éditeur ne fournit pas `bpy.context.object`. La CI comprend un export réel avec Blender 5.2, interface française et contexte sans attribut `object`.

Le dossier de sortie est celui du dépôt quand il est reconnu. Sinon, le script utilise le dossier du `.blend` sauvegardé, puis celui du script téléchargé s’il existe sur disque. Avec une scène et un texte non sauvegardés, il crée **`Documents/VORTEX` dans le dossier personnel de l’utilisateur**. Les modèles se trouvent dans `assets/models/` à l’intérieur de ce dossier. Le chemin est affiché dans la console après `VORTEX_OUTPUT`.

En ligne de commande, un autre emplacement peut être choisi explicitement :

```sh
blender --background --python scripts/build_vortex.py -- --output-dir "C:/Users/MonNom/Documents/VORTEX"
```

## Direction artistique

Châssis flottant asymétrique autour d’un réacteur ouvert, blindage noir biseauté, panneaux anthracite, titane usiné et inserts dorés. Deux anneaux mécaniques cyan entourent le plasma violet. Les trois bras ont des volumes et rôles distincts : stabilisateur à aileron, injecteur de masse et focaliseur à cartouche. Griffes, vérins, roulements, verrous du réacteur et gravures complètent la mécanique sans textures lourdes.

## Intégration et budget

L’export compte **13 932 triangles**, sept matériaux et aucun fichier externe. Le chargeur le regroupe en **30 maillages de rendu** et conserve les pivots `VORTEX_Arm_0`, `VORTEX_Arm_1`, `VORTEX_Arm_2`, `VORTEX_Core`, `VORTEX_Ring_0` et `VORTEX_Ring_1`. Les ressources statiques sont partagées ; l’émission du noyau et les transformations restent indépendantes entre les joueurs.

L’emprise est ajustée aux couloirs avec une marge pour les bras et le bas du modèle reste à 0,34 unité du sol. L’orbite, l’inclinaison pendant le déplacement et le déploiement pendant SINGULARITÉ sont animés par le moteur de jeu. Le modèle procédural précédent apparaît immédiatement pendant le chargement et reste utilisé en cas d’échec réseau. Les règles d’attaque, déblocage, sauvegarde et autorité de l’hôte restent celles de VORTEX.

Le personnage est donc **modélisé en Python**, exporté en `.glb` et affiché dans le moteur navigateur existant. Le navigateur n’a pas besoin d’exécuter Python.

## Vérification

`npm test` inclut la validation Khronos et les tests du vrai GLB : autonomie, budget, géométrie, pivots, animations, partage des ressources, repli et attaques coop. `npm run test:browser` charge réellement le GLB dans l’aperçu et dans une partie, sur bureau et écran tactile.
