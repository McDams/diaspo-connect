# DiaspoConnect — backend réel

API Express + PostgreSQL qui remplace les fichiers `assets/data/*.json` statiques
du prototype : authentification réelle (mots de passe hashés, sessions httpOnly
côté serveur) et permissions RBAC appliquées sur chaque endpoint plutôt qu'en
façade côté client. Sert aussi le frontend statique (un seul process, un seul
port) : `http://localhost:4000`.

Voir `AUDIT.md` (racine du dépôt) pour le détail des failles corrigées et des
limites connues.

## Démarrage

1. **Base de données** (conteneur PostgreSQL dédié, identifiants dans `docker-compose.yml`) :
   ```bash
   docker volume create diaspoconnect_pgdata   # une seule fois
   cd server
   docker compose up -d
   ```
2. **Dépendances + configuration** :
   ```bash
   npm install
   cp .env.example .env   # ajuster si besoin (port DB 5433 par défaut, choisi pour ne pas entrer en conflit avec un PostgreSQL déjà installé sur la machine)
   ```
3. **Schéma + données de démo** :
   ```bash
   PGPASSWORD=diaspoconnect_dev_pw psql -h localhost -p 5433 -U diaspoconnect -d diaspoconnect -f db/schema.sql
   npm run seed
   ```
   Le seed migre `assets/data/*.json` vers PostgreSQL. Tous les comptes de démo
   reçoivent le mot de passe **`demo1234`** (identique à celui pré-rempli par les
   boutons "comptes de démo" de la page de connexion).
4. **Lancer le serveur** :
   ```bash
   npm start
   ```
   Puis ouvrir `http://localhost:4000` (remplace l'ancien `python -m http.server`).

## Architecture

- `db/schema.sql` — schéma pragmatique : colonnes réelles pour l'auth/les
  relations d'appartenance qui comptent pour la sécurité (users, ownerId,
  moderationStatus...), reste du contenu métier en JSONB (`data`) sous la même
  forme que les anciens fichiers JSON. Distinct de `database/schema.sql`
  (modèle normalisé à 74 tables, conservé comme référence de conception plus
  riche pour une V2).
- `routes/resource-factory.js` — routeur REST générique (GET/POST/PUT/DELETE)
  réutilisé par la plupart des ressources, avec permissions par verbe
  (`writePolicy: { create, update, delete }` combinant `any`/`staff`/`rbac`/`owner`).
- `routes/auth.js`, `routes/users.js`, `routes/messages.js`, `routes/settings.js`,
  `routes/audit-log.js` — routes bespoke pour les cas qui ne rentrent pas dans
  le schéma générique (authentification, PII, messagerie relationnelle,
  paramètres singleton, journal d'audit immuable).
- `middleware/auth.js` — charge l'utilisateur depuis la session, résout sa
  fiche staff, expose `req.rbacKey` pour `RBAC.can()`.
- `assets/js/core/rbac.js` est **partagé** entre client et serveur (`module.exports`
  ajouté en fin de fichier) : une seule grille de permissions, appliquée pour de
  vrai côté serveur au lieu d'être une simple façade d'affichage côté client.

## Déploiement en production

Voir la section 12 du `README.md` racine (VPS, Nginx, HTTPS, PM2). Deux réglages
de ce backend changent entre local et production :
`middleware/session.js` (`cookie.secure: true` derrière HTTPS) et `index.js`
(`app.set("trust proxy", 1)`), nécessaires pour que le cookie de session
fonctionne correctement derrière un reverse proxy.

## Limites connues (documentées, pas silencieuses)

- **`matchings`** : toute personne authentifiée peut créer/modifier un
  matching (pas de résolution fiche-mentor → utilisateur pour un contrôle de
  propriété strict). Grosse amélioration par rapport à l'accès public
  précédent, mais pas une isolation parfaite entre binômes.
- **Comptes créés par un admin** (`POST /api/users`) reçoivent un mot de passe
  temporaire fixe (`changeme123`) — pas de flux "définir son mot de passe" à
  la première connexion dans ce prototype.
- Pas de rate-limiting / verrouillage après échecs de connexion / 2FA.
