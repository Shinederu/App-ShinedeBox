# ShinedeBox Frontend

Interface statique de ShinedeBox, connectee au backend `API/box`.

ShinedeBox sert maintenant de petit service d'hebergement et de partage de fichiers: depot, bibliotheque, details fichier, liens publics et telechargements controles par l'API.

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
- Acces admin reserve au droit central `box.files.manage` ou au super-admin global, controle cote `API/box`.

## Fonctionnalites UI

- Connexion Shinederu integree.
- Drag & drop et selection classique de fichiers.
- Upload multi-fichiers avec progression et annulation.
- Bibliotheque avec recherche, tri et statistiques.
- Panneau detail pour telecharger, renommer ou supprimer un fichier.
- Creation, copie et revocation de liens publics.
- Vue publique `?share=<token>` pour telechargement sans session.
- Rafraichissement automatique toutes les 15 secondes si la session admin est active.

## Verification locale

```bash
node --check script.js
```
