# ShinedeBox Frontend

## Role

ShinedeBox est l'interface web statique du service de depot et partage de
fichiers Shinede. Elle permet a un utilisateur autorise de se connecter avec son
compte Shinederu, consulter la bibliotheque commune, importer des fichiers,
gerer les metadonnees visibles et creer des liens publics.

Le frontend est volontairement simple: HTML, CSS et JavaScript natif. Il ne
parle jamais directement a MySQL, au stockage disque, a Mercure ou a une
infrastructure locale. Toutes les commandes metier passent par
`App-ShinedeBox-API`, proprietaire de la logique fichiers.

## Statut produit

ShinedeBox est maintenu a la demande. Il peut recevoir une correction ou une
petite evolution lorsqu'un besoin concret apparait, sans roadmap proactive
permanente. Une idee non priorisee reste un parking; preferer le plus petit
changement complet.

## Repo et deploiement

- Repo source: `P:\DEV\GitHub\App-ShinedeBox`
- Repo GitHub: `https://github.com/Shinederu/App-ShinedeBox.git`
- Branche normale: `main`
- Runtime frontend: `P:\PROD\ShinedeBox`
- Site public: `https://box.shinederu.ch`
- API proprietaire: `P:\DEV\GitHub\App-ShinedeBox-API`
- Runtime API: `P:\PROD\API\box`
- Endpoint API: `https://api.shinederu.ch/box/`
- Code projet stable: `box`

`P:\PROD\ShinedeBox` doit rester un dossier public minimal. Il ne recoit que les
fichiers servis au navigateur. Ne pas y deployer `.git`, `.github`, README,
AGENTS, config Nginx de reference, caches, tests, brouillons, secrets, anciens
dossiers `uploads` ou fichiers de developpement.

## Structure

- `index.html`: shell HTML, vues principales et configuration publique des bases
  API.
- `script.js`: logique d'authentification UI, appels API, upload, liste, tri,
  details fichier, partages et vue publique.
- `style.css`: styles de l'interface sombre responsive.
- `Nginx/box.shinederu.ch.conf`: exemple de vhost frontend. Reference infra
  source uniquement, non deployee dans le runtime frontend.
- `.gitignore`: ignore les secrets et artefacts locaux.
- `AGENTS.md`: consignes de reprise locales pour Codex et autres agents.

## Endpoints

Configuration par defaut dans `index.html`:

```html
<script>
  window.__SHINEDEBOX_API_BASE__ = "https://api.shinederu.ch/box";
  window.__SHINEDEBOX_AUTH_API_BASE__ = "https://api.shinederu.ch/auth";
</script>
```

Endpoints consommes cote Box:

- `GET https://api.shinederu.ch/box/auth.php?action=status`
- `GET https://api.shinederu.ch/box/auth.php?action=logout`
- `GET https://api.shinederu.ch/box/list.php`
- `POST https://api.shinederu.ch/box/upload.php`
- `POST https://api.shinederu.ch/box/rename.php`
- `POST https://api.shinederu.ch/box/delete.php`
- `GET https://api.shinederu.ch/box/share.php?id=<file_id>`
- `GET https://api.shinederu.ch/box/share.php?token=<token>`
- `POST https://api.shinederu.ch/box/share.php`
- `GET https://api.shinederu.ch/box/download.php?id=<file_id>`
- `GET https://api.shinederu.ch/box/download.php?token=<token>`

Endpoints Auth consommes:

- `POST https://api.shinederu.ch/auth/?action=login`
- `POST https://api.shinederu.ch/auth/?action=logout`

Routes publiques gerees par le frontend:

- `https://box.shinederu.ch/`
- `https://box.shinederu.ch/s/<token>/<nom-du-fichier>`
- Compatibilite historique: `https://box.shinederu.ch/?share=<token>`

Le vhost frontend doit rediriger toutes les routes non fichiers vers
`index.html` pour permettre la route publique `/s/...`.

## Authentification et permissions

- Authentification commune via `Module-Auth-API`.
- Cookie session attendu: `sid` sur le domaine `.shinederu.ch`.
- Le formulaire de connexion poste vers l'API Auth centrale.
- Le frontend lit ensuite l'etat effectif via `App-ShinedeBox-API`.
- Permission stable requise cote API: `box.files.manage`.
- `core.super_admin` donne le bypass global via `Module-ShinedeCore-PHP`.
- Un utilisateur sans permission voit l'ecran "Compte non autorise".

La securite ne repose pas sur le masquage UI. Les endpoints sensibles de l'API
revalident la session et la permission.

Modele produit actuel:

- Bibliotheque commune pour tous les utilisateurs autorises.
- Pas encore d'espace prive par utilisateur.
- `owner_user_id` existe cote backend pour audit, mais ne filtre pas l'acces.
- Les liens publics donnent acces uniquement au fichier cible.

## Base de donnees

Le frontend n'a aucun acces direct a la base de donnees. Les donnees sont gerees
par `App-ShinedeBox-API` dans le schema partage `ShinedeCore`, tables `box_*`.

Tables proprietaires documentees cote API:

- `box_files`
- `box_shares`
- `box_download_events`

## Dossiers runtime et fichiers partages

- Frontend public: `P:\PROD\ShinedeBox`
- API runtime: `P:\PROD\API\box`
- Stockage persistant proprietaire: `P:\PROD\ShinedeBoxStorage\files`
- Logs API: `P:\PROD\API\box\logs`
- Rate limit API: `P:\PROD\API\box\_ratelimit`

Les fichiers utilisateur ne doivent jamais etre stockes dans le dossier frontend
public. Ils restent hors webroot et sont servis par `download.php`.

Le systeme de fichiers n'est pas un bus inter-projets. Si un autre projet doit
consommer un fichier Box, il doit passer par une API documentee de ShinedeBox.

## Temps reel et evenements

Aucun flux Mercure n'est publie ou consomme actuellement. Le frontend reconstruit
l'etat depuis HTTP:

- au chargement;
- apres connexion;
- apres upload, renommage, suppression ou modification de partage;
- toutes les 15 secondes quand la session Box est active;
- au retour de visibilite de l'onglet.

Le rafraichissement HTTP actuel est suffisant. Ne pas ajouter de temps reel tant
qu'un besoin explicite et observe ne montre pas le contraire. Si ce besoin
apparait, definir alors le contrat minimal; ne pas preconstruire topics, types
d'evenements ou infrastructure.

## Dependances inter-projets

- `App-ShinedeBox-API`: proprietaire des commandes fichiers et partages.
- `Module-Auth-API`: login, logout, sessions `sid`.
- `Module-ShinedeCore-PHP`: permissions centralisees via l'API.

Regle de perimetre: une tache frontend ShinedeBox ne modifie pas ces projets
voisins. Si une correction semble necessaire dans Auth, Core ou une autre API,
documenter le constat et attendre une demande explicite.

## Configuration

Variables globales navigateur:

- `window.__SHINEDEBOX_API_BASE__`
- `window.__SHINEDEBOX_AUTH_API_BASE__`

Ces valeurs sont publiques. Aucun secret, token prive, mot de passe, cookie ou
identifiant infrastructure ne doit etre ajoute au frontend.

## Fonctionnalites

- Connexion Shinederu integree.
- Lecture du statut Box et affichage du role effectif.
- Bibliotheque commune avec recherche par nom.
- Tri par date recente, date ancienne, nom A-Z, nom Z-A et taille.
- Statistiques: nombre de fichiers, stockage, partages actifs,
  telechargements.
- Upload multi-fichiers par modale, input fichier ou drag and drop.
- Progression d'upload et annulation via `XMLHttpRequest`.
- Selection clavier ou souris d'un fichier.
- Telechargement direct d'un fichier autorise.
- Renommage avec validation backend.
- Suppression logique via API.
- Creation de lien public avec expiration en jours optionnelle.
- Limite optionnelle du nombre de telechargements par partage.
- Copie du lien public dans le presse-papiers.
- Revocation de lien public.
- Vue publique d'un partage sans session.
- Compatibilite mobile responsive.

## Verifications

Verification syntaxe:

```powershell
cd P:\DEV\GitHub\App-ShinedeBox
node --check script.js
```

Smoke tests manuels recommandes:

- ouvrir `https://box.shinederu.ch/`;
- se connecter avec un compte autorise;
- verifier la liste et les statistiques;
- importer un petit fichier de test;
- renommer puis telecharger ce fichier;
- creer un lien public et l'ouvrir dans une session sans cookie;
- revoquer le lien public;
- supprimer le fichier de test;
- verifier l'affichage d'un compte sans `box.files.manage` si disponible.

## Deploiement

Aucun build n'est necessaire. Depuis `P:\DEV\GitHub\App-ShinedeBox`:

```powershell
Copy-Item -LiteralPath index.html,script.js,style.css -Destination P:\PROD\ShinedeBox -Force
```

Apres copie:

```powershell
Get-ChildItem -LiteralPath P:\PROD\ShinedeBox -Force
node --check P:\PROD\ShinedeBox\script.js
```

Le dossier cible doit rester limite aux artefacts publics necessaires:

- `index.html`
- `script.js`
- `style.css`

Ne pas synchroniser la documentation source vers `PROD`.

## Notes de reprise

- Le repo frontend est statique et ne depend pas de Node au runtime.
- `Nginx/` est une reference source, pas un artefact de deploiement.
- Les anciens chemins `/api/` de `box.shinederu.ch` ne sont plus le contrat
  public; utiliser `https://api.shinederu.ch/box/`.
- Le frontend lit encore les champs top-level renvoyes par l'API (`files`,
  `stats`, `share`, etc.). L'API expose aussi `data` pour le contrat commun.
- Le stockage appartient a ShinedeBox et reste hors webroot.
- Aucune integration Corelink, Wake, Arcadia ou UniFi n'existe actuellement.

## Limites connues

- Pas d'espace prive par utilisateur.
- Pas de dossiers, tags ou descriptions editables dans l'UI.
- Pas de restauration UI des fichiers en soft delete.
- Pas de preview fichier.
- Pas de temps reel Mercure.
- Pas de tests automatises frontend.
