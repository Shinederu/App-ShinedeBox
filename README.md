# ShinedeBox Frontend

Frontend statique de ShinedeBox (admin file manager), connecte au backend `API/box`.

## Structure

- `index.html`
- `script.js`
- `style.css`
- `Nginx/box.shinederu.ch.conf` (exemple de vhost frontend)

## API cible

Par defaut, le front appelle:

- `https://api.shinederu.ch/box`

Override possible dans `index.html`:

- `window.__SHINEDEBOX_API_BASE__`
- `window.__SHINEDEBOX_AUTH_API_BASE__`

## Authentification

- Connexion via API auth centralisee: `https://api.shinederu.ch/auth`
- Session partagee domaine via cookie `sid`
- Acces metier reserve au droit central `box.files.manage` ou au super-admin global (controle effectue cote `API/box`)

## Fonctionnalites UI

- Drag & drop + selection classique de fichiers
- Upload avec progression et bouton d'annulation
- Recherche et tri de la liste
- Selection multiple + suppression en lot
- Copier lien, renommer, supprimer
- Notifications toast
- Rafraichissement automatique de la liste (intervalle 20s, session admin active)

## Verification locale

```bash
node --check script.js
```
