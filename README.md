# ShinedeBox Frontend

Interface statique de ShinedeBox, connectee au backend source `App-ShinedeBox-API`, deploye sous `PROD/API/box`.

ShinedeBox sert de service d'hebergement et de partage de fichiers: depot, bibliotheque commune, details fichier, liens publics et telechargements controles par l'API.

L'interface est une application statique sombre et responsive. Le premier ecran utile est la bibliotheque de fichiers, avec les actions de session dans le header, la liste au centre et le panneau de selection/partage a droite.

## Structure

- `index.html` : shell HTML et configuration des bases API.
- `script.js` : logique auth, upload, liste, details et partages.
- `style.css` : interface sombre responsive.
- `Nginx/box.shinederu.ch.conf` : exemple de vhost frontend.

## API cible

Par defaut, le front appelle:

- `https://api.shinederu.ch/box`
- `https://api.shinederu.ch/auth`

Override possible dans `index.html`:

- `window.__SHINEDEBOX_API_BASE__`
- `window.__SHINEDEBOX_AUTH_API_BASE__`

## Authentification

- Connexion via API auth centralisee.
- Session partagee domaine via cookie `sid`.
- Acces Box reserve au droit central `box.files.manage` ou au super-admin global, controle cote `App-ShinedeBox-API`.
- Les utilisateurs autorises accedent a une bibliotheque commune: les fichiers uploades par un utilisateur autorise sont visibles et gerables par les autres utilisateurs autorises.
- Il n'y a pas encore d'espace prive par utilisateur; `owner_user_id` est une information d'audit cote backend.

## Fonctionnalites UI

- Connexion Shinederu integree.
- Header avec l'utilisateur courant, le role Box, l'import, le rafraichissement et la deconnexion.
- Import via bouton `Importer un fichier` dans le header, ouvrant une modale dediee.
- Drag & drop et selection classique dans la modale d'import.
- Upload multi-fichiers avec progression, annulation et fermeture automatique si tout reussit.
- Bibliotheque avec recherche, tri et statistiques.
- Selection d'un fichier par clic sur toute sa carte; le bouton `Telecharger` reste une action directe.
- Panneau detail lateral pour telecharger, renommer ou supprimer le fichier selectionne.
- Creation, copie et revocation de liens publics.
- Vue publique `/s/<token>/<nom-du-fichier>` pour telechargement sans session.
- Compatibilite conservee avec l'ancien format `?share=<token>`.
- Rafraichissement automatique toutes les 15 secondes si la session admin est active.
- Responsive mobile: le header se replie en actions empilees, la liste passe en cartes verticales et la modale reste limitee a la hauteur viewport.

## Deploiement

Aucun build n'est necessaire. Apres verification, synchroniser les fichiers deployables vers la production:

```powershell
Copy-Item index.html,script.js,style.css P:\PROD\ShinedeBox\ -Force
```

## Verification locale

```bash
node --check script.js
```
