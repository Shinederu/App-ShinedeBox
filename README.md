# ShinedeBox Frontend

## Role

Interface statique de ShinedeBox, service d'hebergement et de partage de
fichiers. Le premier ecran utile est la bibliotheque commune des fichiers, avec
connexion Shinederu, import, recherche, details fichier et gestion des liens
publics.

Le frontend ne manipule pas directement la base de donnees ni le stockage disque.
Toutes les commandes metier passent par `App-ShinedeBox-API`.

## Repo et deploiement

- Repo source: `P:\DEV\GitHub\App-ShinedeBox`
- Repo GitHub: `https://github.com/Shinederu/App-ShinedeBox.git`
- Runtime frontend: `P:\PROD\ShinedeBox`
- Site public: `https://box.shinederu.ch`
- Backend proprietaire: `P:\DEV\GitHub\App-ShinedeBox-API`
- Runtime API: `P:\PROD\API\box`
- Code projet stable: `box`

`P:\PROD\ShinedeBox` doit contenir uniquement les fichiers servis au navigateur.
Ne pas y deployer `.git`, documentation, config Nginx de reference, caches,
tests, brouillons, secrets ou anciens dossiers d'upload.

## Structure

- `index.html`: shell HTML et configuration des bases API.
- `script.js`: logique auth, upload, liste, details, partage et vue publique.
- `style.css`: interface sombre responsive.
- `Nginx/box.shinederu.ch.conf`: exemple de vhost, conserve dans le repo comme
  reference infra et non deploye dans le runtime frontend.
- `AGENTS.md`: consignes de reprise locales.

## Endpoints

Le frontend appelle par defaut:

- API Box: `https://api.shinederu.ch/box/`
- API Auth: `https://api.shinederu.ch/auth/`

Pages publiques gerees par le frontend:

- `https://box.shinederu.ch/`
- `https://box.shinederu.ch/s/<token>/<nom-du-fichier>`
- compatibilite historique: `https://box.shinederu.ch/?share=<token>`

Overrides possibles dans `index.html`:

- `window.__SHINEDEBOX_API_BASE__`
- `window.__SHINEDEBOX_AUTH_API_BASE__`

## Authentification et permissions

- Authentification commune via `Module-Auth-API` et cookie `sid`.
- Les identifiants sont envoyes a `https://api.shinederu.ch/auth/`.
- L'acces metier est controle uniquement par `App-ShinedeBox-API`.
- Permission stable requise: `box.files.manage`.
- `core.super_admin` donne le bypass global via le service partage
  `ProjectAccessService`.

Les utilisateurs autorises accedent aujourd'hui a une bibliotheque commune. Il
n'existe pas encore d'espace prive par utilisateur; `owner_user_id` est une
information d'audit cote backend.

## Base de donnees

Le frontend ne se connecte pas a MySQL. Les donnees ShinedeBox sont gerees par
`App-ShinedeBox-API` dans le schema partage `ShinedeCore`, tables `box_*`.

## Dossiers runtime et fichiers partages

- Frontend public: `P:\PROD\ShinedeBox`
- Stockage persistant proprietaire: `P:\PROD\ShinedeBoxStorage\files`
- API runtime: `P:\PROD\API\box`

Les fichiers utilisateur ne doivent jamais etre stockes dans le dossier frontend
public. Ils restent hors webroot et sont servis par `download.php`.

## Temps reel et evenements

Aucun flux Mercure n'est publie ou consomme actuellement. La bibliotheque se
resynchronise par HTTP via `list.php` au chargement, apres action utilisateur et
toutes les 15 secondes quand la session Box est active.

Si un flux temps reel est ajoute plus tard, il doit passer par Mercure et rester
reconstructible via l'API HTTP. Topics attendus:

```text
https://api.shinederu.ch/box/topics/files
https://api.shinederu.ch/box/topics/files/{public_id}
```

## Dependances inter-projets

- `App-ShinedeBox-API`: proprietaire des actions fichiers et partages.
- `Module-Auth-API`: login, logout, sessions `sid`.
- `Module-ShinedeCore-PHP`: permissions centralisees via le backend.

Le frontend ne doit pas ecrire dans les tables ou dossiers d'un autre projet.

## Configuration

La configuration publique est dans `index.html`:

```html
<script>
  window.__SHINEDEBOX_API_BASE__ = "https://api.shinederu.ch/box";
  window.__SHINEDEBOX_AUTH_API_BASE__ = "https://api.shinederu.ch/auth";
</script>
```

Aucune variable secrete n'est attendue cote frontend.

## Fonctionnalites

- Connexion Shinederu integree.
- Bibliotheque commune avec recherche, tri et statistiques.
- Import multi-fichiers par modale, selection classique ou drag and drop.
- Progression et annulation d'upload.
- Selection d'un fichier, telechargement, renommage et soft delete via l'API.
- Creation, copie et revocation de liens publics.
- Vue publique de partage sans session.
- Responsive mobile.

## Verifications

```powershell
cd P:\DEV\GitHub\App-ShinedeBox
node --check script.js
```

## Deploiement

Aucun build n'est necessaire. Depuis le repo source:

```powershell
Copy-Item -LiteralPath index.html,script.js,style.css -Destination P:\PROD\ShinedeBox -Force
```

Apres copie, verifier que `P:\PROD\ShinedeBox` ne contient que les artefacts
publics necessaires.

## Notes de reprise

- Le repo frontend est volontairement statique.
- `Nginx/` est une reference de configuration, pas un artefact de deploiement
  frontend.
- Les anciens chemins `/api/` du domaine `box.shinederu.ch` ne sont plus le
  contrat public; utiliser `https://api.shinederu.ch/box/`.
- Le backend est la source de verite pour auth, permissions, DB, stockage et
  liens publics.
