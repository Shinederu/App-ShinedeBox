# Guide Agents - App-ShinedeBox

Lire d'abord:

1. `P:\AGENTS.md`
2. `P:\ECOSYSTEM.md`
3. `P:\DEV\GitHub\README.md`
4. `P:\DEV\GitHub\App-ShinedeBox\README.md`
5. `P:\DEV\GitHub\App-ShinedeBox-API\README.md`

## Role

Frontend statique de ShinedeBox. Le backend proprietaire est
`P:\DEV\GitHub\App-ShinedeBox-API`, expose en production sous
`https://api.shinederu.ch/box/`.

## Regles de travail

- Modifier la source dans `P:\DEV\GitHub\App-ShinedeBox`.
- Aucun build n'est necessaire.
- Verifier `script.js` avec `node --check script.js`.
- Deployer seulement `index.html`, `script.js` et `style.css` vers
  `P:\PROD\ShinedeBox`.
- Ne pas deployer `.git`, `README.md`, `AGENTS.md`, `Nginx`, caches, brouillons,
  tests, `.env`, `uploads` ou fichiers de dev dans `P:\PROD\ShinedeBox`.
- Les fichiers utilisateur appartiennent au stockage runtime
  `P:\PROD\ShinedeBoxStorage`, jamais au dossier frontend public.

## Contrats ecosysteme

- API Box: `https://api.shinederu.ch/box/`.
- API Auth: `https://api.shinederu.ch/auth/`.
- Auth commune via cookie `sid`.
- Permission stable requise cote API: `box.files.manage`.
- Aucun flux Mercure n'est publie ou consomme actuellement; la resynchronisation
  se fait par HTTP via `list.php`.
