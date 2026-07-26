# DiaspoConnect — backend PHP/MySQL (hébergement mutualisé)

Backend alternatif à `server/` (Node/Express + PostgreSQL), pensé pour tourner
sur de l'hébergement web mutualisé/Cloud classique (PHP + MySQL uniquement,
pas d'accès root, pas de process persistant) — typiquement Hostinger.

**Même API, même comportement** que `server/` : mêmes routes (`/api/...`),
mêmes réponses JSON, même RBAC (`lib/rbac.php` est un port fidèle de
`assets/js/core/rbac.js`), même journal d'audit dérivé de la session
authentifiée. Le frontend (`assets/js/core/data-store.js`, `auth.js`) ne fait
aucune différence entre les deux backends — aucune ligne de JS front n'a
changé pour cette variante.

## Différences techniques avec `server/` (Node)

- **MySQL/MariaDB** au lieu de PostgreSQL (`db/schema.sql` adapté : `VARCHAR(64)`
  au lieu de `TEXT` pour les id, `JSON` au lieu de `JSONB`, `DATETIME` au lieu
  de `TIMESTAMPTZ`).
- **Sessions PHP natives** (fichiers, `session_start()`) au lieu d'une table
  de sessions dédiée — aucune dépendance externe, fonctionne sur n'importe
  quel mutualisé sans configuration.
- **Aucune dépendance** (pas de composer, pas de framework) : PDO, `password_hash()`
  (bcrypt natif), sessions natives — tout est dans le PHP standard, pour
  rester compatible avec un hébergement basique.
- **Routage via `.htaccess`** (racine du dépôt) : `/api/*` est réécrit vers
  `server-php/api/index.php`, qui dispatche selon le chemin restant. Le reste
  (HTML/CSS/JS) est servi tel quel par Apache, sans PHP.
- `server-php/` est bloqué en accès web direct par son propre `.htaccess`
  (`Require all denied`), sauf `server-php/api/` (le seul point d'entrée).

## Démarrage local (test avec XAMPP ou équivalent LAMP)

1. **Base de données** : créer une base MySQL/MariaDB et son utilisateur, puis charger le schéma :
   ```bash
   mysql -u root -e "CREATE DATABASE diaspoconnect CHARACTER SET utf8mb4;"
   mysql -u root diaspoconnect < server-php/db/schema.sql
   ```
2. **Configuration** : `cp server-php/.env.example server-php/.env`, ajuster les identifiants DB.
3. **Données de démo** :
   ```bash
   cd server-php
   php seed.php
   ```
   Migre `assets/data/*.json` vers MySQL. Tous les comptes reçoivent le mot de passe `demo1234`.
4. **Servir le projet** via Apache (XAMPP, MAMP...) avec le dépôt comme docroot — `.htaccess`
   fait le reste. Vérifier que `mod_rewrite` est activé (`AllowOverride All` sur le dossier).

## Déploiement sur hébergement mutualisé (ex. Hostinger)

1. **Créer une base MySQL** dans hPanel (Bases de données → MySQL), noter host/nom/utilisateur/mot de passe.
2. **Importer `server-php/db/schema.sql`** via phpMyAdmin (onglet Importer).
3. **Uploader tout le dépôt** (FTP/File Manager) dans `public_html/` (ou un sous-dossier), en conservant `.htaccess` à la racine.
4. **Créer `server-php/.env`** directement sur le serveur (jamais commité) avec les vrais identifiants MySQL de l'étape 1, et `SESSION_SECURE=1` si le site est en HTTPS (obligatoire pour un vrai lancement).
5. **Lancer le seed** :
   - Si un accès SSH est disponible (plans Business/Cloud Hostinger) : `php server-php/seed.php`.
   - Sinon : retirer temporairement le `Require all denied` de `server-php/.htaccess`, créer une page PHP minimale qui appelle `dc_run_seed()`, l'exécuter une fois via le navigateur, puis **remettre le blocage immédiatement** (ou utiliser phpMyAdmin pour importer les données directement en SQL).
6. **Vérifier** : ouvrir le domaine, se connecter avec un compte de démo (`demo1234`) — puis vider/changer ces mots de passe avant toute vraie mise en ligne (voir avertissement section 12 du README racine).

## Limites connues

Identiques à `server/` (voir son README) : pas de résolution fiche-mentor →
utilisateur pour `matchings` (contrôle de propriété non strict), mot de passe
temporaire fixe pour les comptes créés par un admin, pas de rate-limiting/2FA,
pas de vrai stockage de fichiers pour les uploads.
