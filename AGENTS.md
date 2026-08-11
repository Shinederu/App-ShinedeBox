# Guide Agents - App-ShinedeBox

## Lecture de demarrage

Lire dans cet ordre:

1. `P:\AGENTS.md`
2. `P:\ECOSYSTEM.md`
3. `P:\DEV\GitHub\README.md`
4. `P:\DEV\GitHub\AGENTS.md`
5. `P:\DEV\GitHub\App-ShinedeBox\README.md`

Lire aussi `P:\DEV\GitHub\App-ShinedeBox-API\README.md` uniquement si la tache
inclut explicitement l'API ou si une analyse de dependance est necessaire sans
modification.

## Role

Frontend statique de ShinedeBox. Il consomme `https://api.shinederu.ch/box/` et
`https://api.shinederu.ch/auth/`, mais ne possede ni la DB, ni le stockage, ni
les permissions.

## Statut produit

ShinedeBox est maintenu a la demande. Intervenir uniquement pour un besoin
concret et borne; une idee documentee ne vaut pas priorisation. Ne pas ajouter
de service, temps reel, stockage ou dependance durable « au cas ou ».

## Perimetre strict

Modifier uniquement:

- `P:\DEV\GitHub\App-ShinedeBox`
- `P:\PROD\ShinedeBox` lors d'un deploiement frontend demande

Ne pas modifier au passage:

- `App-ShinedeBox-API`
- `Module-Auth-API`
- `Module-ShinedeCore-PHP`
- tout autre repo applicatif
- `P:\PROD\API\box`
- `P:\PROD\ShinedeBoxStorage`

Si un probleme semble venir d'un autre projet, le documenter dans le compte-rendu
ou dans `P:\DEV\AI-Exchange\Reports\Codex`, sans secret, puis attendre une
demande explicite.

## Regles de travail

- Travailler sur `main`.
- Faire `git pull --rebase` avant modification.
- Aucun build n'est necessaire.
- Verifier `script.js` avec `node --check script.js`.
- Ne jamais ajouter de secret cote frontend.
- Garder `Nginx/` comme reference source uniquement.
- Ne pas creer de stockage utilisateur sous le frontend public.

## Contrats ecosysteme

- API Box: `https://api.shinederu.ch/box/`.
- API Auth: `https://api.shinederu.ch/auth/`.
- Session: cookie `sid`.
- Permission requise cote API: `box.files.manage`.
- Stockage fichiers: `P:\PROD\ShinedeBoxStorage\files`, proprietaire
  ShinedeBox API.
- Aucun Mercure actuellement; resynchronisation par HTTP via `list.php`.

## Deploiement

Deploy frontend seulement:

```powershell
Copy-Item -LiteralPath index.html,script.js,style.css -Destination P:\PROD\ShinedeBox -Force
```

`P:\PROD\ShinedeBox` ne doit contenir que les fichiers publics necessaires.
Ne pas deployer README, AGENTS, `.git`, `.github`, `Nginx`, `.env`, caches,
tests, brouillons, `uploads` ou fichiers de dev.

## Verification de fin

```powershell
node --check P:\DEV\GitHub\App-ShinedeBox\script.js
git -c safe.directory=* -C P:\DEV\GitHub\App-ShinedeBox status --short --branch
```

Si un deploiement a ete fait:

```powershell
node --check P:\PROD\ShinedeBox\script.js
Get-ChildItem -LiteralPath P:\PROD\ShinedeBox -Force
```
