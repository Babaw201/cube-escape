# Service de salons Limbyrinth

Worker Cloudflare `limbyrinth-online`, un Durable Object SQLite `GameRoom` par salon. Le relais transporte les snapshots de l’hôte et les commandes de l’invité via WebSocket ; la simulation reste dans le navigateur hôte.

## Connexion

- `POST /rooms` crée un code aléatoire de huit caractères et renvoie un jeton hôte éphémère.
- `GET /rooms/:code` vérifie que le salon existe et dispose d’une place, sans renvoyer le jeton hôte.
- `GET /rooms/:code/socket` effectue l’upgrade WebSocket. Sous-protocole `limbyrinth-v1`, plus `host.<jeton>` pour l’hôte uniquement.
- Le contrôle `room/waiting` indique que le code est prêt ; `room/ready` est émis aux deux joueurs une fois connectés. `room/closed` signale la fermeture.

L’hôte peut envoyer `start`, `s`, `end`, `cosmetic` ; l’invité peut envoyer `i`, `cosmetic`. Les autres trames sont refusées. Un salon accepte un hôte et un invité, expire après 15 min d’attente ou 2 h de session, et ferme les deux connexions au départ d’un joueur.

Les connexions utilisent l’API WebSocket d’hibernation et un ping/pong automatique. Les en-têtes de sous-protocole transportent le jeton hôte ; il n’apparaît ni dans le lien d’invitation ni dans la consultation publique du salon. Le serveur conserve son empreinte SHA-256. Limitation des requêtes par IP, des trames par connexion, et des origines de navigateur autorisées.

## Tests et déploiement

Depuis la racine du dépôt : `npm test`. La suite serveur exécute les requêtes SQLite réelles avec SQLite intégré à Node 24 ; les WebSockets et le contexte Cloudflare sont les frontières remplacées pour le test.

Depuis ce dossier, avec Wrangler authentifié au compte de déploiement :

```sh
npx wrangler deploy
```

La configuration et la migration SQLite sont dans `wrangler.jsonc`. Le client utilise `ONLINE_BASE` dans `index.html`. Aucun jeton de salon ne doit être enregistré dans le code ou les logs.

Le site GitHub Pages sert seulement le client. Le service est déployé séparément sur `https://limbyrinth-online.baptiste-werner.workers.dev`.
