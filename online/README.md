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

## Comptes et amis

La migration `v2` crée le Durable Object SQLite `SocialHub`, singleton global sous `env.SOCIAL` ; il gère pseudonymes uniques, demandes, amis, blocages et invitations temporaires. Les jetons personnels sont hashés en SHA-256 côté serveur ; aucune donnée personnelle n'est demandée.

API (authentification `Authorization: Bearer <token>`, sauf inscription) :
- `POST /social/register` avec `{ "pseudo":"Robot32" }` retourne un jeton privé, une seule fois.
- `GET /social/me` retourne son profil, ses amis, demandes et invitations valables.
- `POST /social/rename`, `/social/request`, `/social/respond`, `/social/cancel`, `/social/remove`, `/social/block`, `/social/unblock` et `/social/invite`.
- Les invitations nécessitent une amitié mutuelle et un salon valide au format de code attendu ; l'ouverture du salon reste sécurisée par le Worker de jeu déjà existant.
- Les appels POST sont limités par le ratelimit Cloudflare déjà présent, plus plafonds de demandes et d'amis en base.

Déploiement : `cd online && npx wrangler deploy` avec un accès authentifié à **ce** compte Cloudflare. Tester le service avant de laisser l'interface en production. Le frontend contient la nouvelle fonctionnalité mais les endpoints n'existent pas avant ce déploiement. Pour de nombreux utilisateurs, ajouter une récupération de compte et une modération robuste.

## Boîte à idées et bugs (v3)

La migration `v3` ajoute `FeedbackInbox` (SQLite) sous `FEEDBACK` :
- `POST /feedback` : `{ "kind":"poll|idea|bug", "topic":"niveau5|murs|ennemis|cooperation|autre", "message":"..." }` : réponses anonymes, limitées par IP, sans données de contact.
- `GET /feedback/admin` : boîte des 500 dernières réponses + compteur non lus ; en-tête `Authorization: Bearer <clé privée>`.
- `POST /feedback/read` : marque les messages lus, même authentification.
- Secret obligatoire côté serveur : `FEEDBACK_ADMIN_KEY` (ne jamais le committer, le laisser dans les variables secrètes Cloudflare).

Le frontend d'administration est une page statique `retours-admin.html`, sans stockage local du code. L'historique est consultable en ouvrant ce tableau privé ; aucun envoi d'e-mail n'est configuré.

## Alertes Discord sur téléphone (v3, sans nouvelle migration)

Le backend `FeedbackInbox` envoie automatiquement une **notification Discord pour chaque signalement de bug**. Les votes et les idées restent consultables dans le tableau privé et ne déclenchent pas d'alerte instantanée.

Pour activer ce service :
1. Créer un serveur/salon Discord privé `#bugs-limbyrinth`, puis un webhook via **Paramètres du serveur → Intégrations → Webhooks**.
2. Dans **Cloudflare → Workers & Pages → limbyrinth-online → Settings → Variables and Secrets**, enregistrer l'URL complète du webhook comme secret nommé **`FEEDBACK_DISCORD_WEBHOOK_URL`**.
3. Sur le téléphone, installer Discord, activer les notifications push et définir les notifications de ce salon sur **Tous les messages** ; ne pas mettre le salon en sourdine.
4. Sur Limbyrinth, envoyer un vrai bug de test d'au moins 10 caractères. Le signalement apparaît dans la boîte privée et une alerte arrive sur Discord.

Le webhook n'est jamais publié dans GitHub, le frontend ou les liens partagés. Le Worker n'autorise que les URL HTTPS `discord.com/api/webhooks/…`. Le contenu est envoyé avec `allowed_mentions: { parse: [] }`, pour éviter les mentions indésirables. En cas d'échec Discord, le message reste enregistré, et les tentatives sont reprises grâce à une file SQLite et à un réveil Durable Object (jusqu'à cinq tentatives). Lorsque le webhook est absent, les signalements sont stockés, mais **aucune notification ne part sur le téléphone**.

Le secret `FEEDBACK_ADMIN_KEY` pour la boîte privée `retours-admin.html` est **distinct** du webhook Discord : il reste à configurer séparément si ce n'est pas encore fait. Ni la clé administrateur ni l'URL webhook ne doivent être communiquées aux joueurs.

## Alertes de bugs par e-mail (destinataire temporaire)

Le code privilégie **Resend** lorsque le service d'envoi d'e-mails est configuré ; le webhook Discord existant est conservé comme recours **uniquement lorsque l'e-mail n'est pas configuré**. Les bugs seuls déclenchent ces alertes : les votes et suggestions restent consultables dans le tableau privé.

Pour activer sur Cloudflare `limbyrinth-online`, enregistrer ces variables dans **Settings → Variables and Secrets** (jamais dans les fichiers publics ni le frontend) :

- **`RESEND_API_KEY`** (secret) : clé d'API obtenue sur [Resend](https://resend.com/api-keys).
- **`FEEDBACK_EMAIL_TO`** (secret ou variable privée) : la boîte Gmail qui recevra les bugs.
- Facultatif : **`FEEDBACK_EMAIL_FROM`** : adresse d'expédition autorisée par Resend. En l'absence de ce paramètre, le backend utilise `Limbyrinth <onboarding@resend.dev>`, limité **aux e-mails envoyés à l'adresse titulaire du compte Resend** tant qu'aucun domaine d'expédition n'est vérifié.

Configurer un compte Resend associé à l'adresse destinataire pour le mode de test, ou vérifier un domaine d'expédition si le fournisseur l'exige. Aucun accès ni mot de passe Gmail n'est nécessaire. Activer ensuite les notifications Gmail sur Android et déclencher un test via **Signaler un bug** dans le jeu. Si le fournisseur accepte l'e-mail, l'alerte arrive dans Gmail (éventuellement dans les spams). Ne jamais communiquer la clé d'API dans un message ou un dépôt public.

L'API `POST https://api.resend.com/emails` est appelée avec une clé d'idempotence spécifique à chaque bug ; la file durable SQLite et les alarmes déjà présentes gèrent les échecs temporaires (5 essais maximum). Les rapports restent enregistrés dans `FeedbackInbox` quelle que soit la réussite de l'alerte.

Le secret `FEEDBACK_ADMIN_KEY` de la boîte de retours est **indépendant** de la configuration e-mail. Ne pas envoyer ce secret par e-mail, ni l'ajouter au frontend. Le service n'est **pas prêt à envoyer réellement** avant d'avoir configuré les variables et testé la livraison.
