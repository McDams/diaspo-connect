# DiaspoConnect

Plateforme d'accompagnement pour les étudiants africains, avec un focus initial sur les étudiants **béninois** préparant leur arrivée en France. DiaspoConnect met en relation des **filleuls** avec des **parrains/marraines** déjà installés en France, et donne accès à un **logement vérifié**, des **opportunités** (jobs saisonniers, stages, alternances) et des **ressources pratiques**.

Ce dépôt contient le **prototype frontend** de la plateforme : HTML5 / CSS3 / JavaScript natif + Bootstrap 5, sans aucune dépendance backend. Toutes les données sont simulées via des fichiers JSON locaux, mais l'architecture est pensée pour être branchée demain sur une vraie API (Node.js, Laravel ou Django) sans réécrire les pages.

---

## 1. Lancer le prototype

Le site charge ses données via `fetch()` (JSON) et injecte des composants HTML partagés (navbar, sidebar, footer) via `fetch()` également. **Cela nécessite un serveur local** — ouvrir les fichiers directement (`file://`) ne fonctionnera pas à cause des restrictions CORS des navigateurs sur `fetch`.

Depuis le dossier `diaspo-connect/`, lancer l'une de ces commandes :

```bash
python -m http.server 8893
```

ou, si Node.js est installé :

```bash
npx serve -l 8893
```

Puis ouvrir **http://localhost:8893** dans le navigateur.

### Comptes de démonstration

La page de connexion (`pages/public/login.html`) propose des raccourcis vers 4 comptes de démonstration (un clic pré-remplit l'email + un mot de passe démo). Le mot de passe n'est pas vérifié contre une vraie valeur dans ce prototype : n'importe quel mot de passe d'au moins 6 caractères fonctionne, à condition que l'email corresponde à un compte existant dans `assets/data/users.json`.

| Rôle | Email |
|---|---|
| Filleule | `rosine.agossou@mail.com` |
| Marraine | `aicha.zannou@mail.fr` |
| Propriétaire | `marc.lefevre@mail.fr` |
| Administrateur | `admin@diaspoconnect.fr` |

Il est aussi possible de créer un nouveau compte via les pages d'inscription (`register-filleul.html`, `register-parrain.html`, `register-proprietaire.html`) — le compte créé n'existe qu'en mémoire le temps de la session (voir section 5).

---

## 2. Arborescence du projet

```
diaspo-connect/
├── index.html                      # Page d'accueil publique
├── README.md
├── pages/
│   ├── public/                     # Pages accessibles sans connexion
│   │   ├── comment-ca-marche.html, parrains.html, logements.html,
│   │   │   opportunites.html, ressources.html, faq.html, charte.html, aide.html
│   │   ├── login.html, register-filleul.html, register-parrain.html,
│   │   │   register-proprietaire.html
│   │   └── 404.html
│   ├── filleul/                    # Espace filleul (authentifié)
│   │   ├── dashboard.html, profil.html, recherche-parrains.html,
│   │   │   matching.html, messagerie.html, logements.html,
│   │   │   opportunites.html, ressources.html, parametres.html
│   ├── parrain/                    # Espace parrain / marraine
│   │   ├── dashboard.html, profil.html, demandes.html, filleuls.html,
│   │   │   messagerie.html, parametres.html
│   ├── proprietaire/                # Espace propriétaire
│   │   ├── dashboard.html, creer-annonce.html, annonces.html, parametres.html
│   └── admin/                      # Espace administrateur
│       ├── dashboard.html, utilisateurs.html, matching.html,
│       │   moderation-messages.html, moderation-logements.html,
│       │   moderation-opportunites.html, ressources.html, parametres.html
├── components/                     # Partials HTML injectés dynamiquement
│   ├── navbar-public.html, footer-public.html, app-header.html
│   └── sidebar-filleul.html, sidebar-parrain.html,
│       sidebar-proprietaire.html, sidebar-admin.html
├── assets/
│   ├── css/
│   │   ├── variables.css     # Design tokens (couleurs, typo, ombres, radius)
│   │   ├── base.css          # Reset léger, typographie, focus clavier
│   │   ├── layout.css        # Navbar, header applicatif, sidebar, footer, hero
│   │   ├── components.css    # Cartes, badges, timeline, tables, formulaires...
│   │   └── pages.css         # Ajustements ponctuels par page
│   ├── js/
│   │   ├── core/
│   │   │   ├── data-store.js         # Couche unique d'accès aux données (JSON aujourd'hui, API demain)
│   │   │   ├── auth.js               # Authentification simulée + garde de page par rôle
│   │   │   ├── utils.js              # Formatage, échappement HTML, badges de statut, toasts
│   │   │   ├── checklist.js          # Checklist d'arrivée par filleul
│   │   │   └── notification-center.js # Centre de notifications par utilisateur
│   │   ├── engine/
│   │   │   └── matching-engine.js    # Règles métier du matching (quotas, scoring, préférences)
│   │   ├── ui/
│   │   │   ├── layout.js             # Montage navbar/sidebar/footer + session
│   │   │   ├── forms.js               # Moteur de validation de formulaires
│   │   │   ├── filters.js             # Prédicats de filtrage réutilisables
│   │   │   ├── modals.js              # Modal de confirmation générique
│   │   │   └── report-modal.js        # Formulaire de signalement réutilisable
│   │   └── pages/                     # 1 fichier JS par page (logique spécifique)
│   ├── data/                    # 10 fichiers JSON de données simulées (voir section 4)
│   └── img/                     # (réservé — avatars/illustrations si besoin)
```

---

## 3. Rôles et parcours

| Rôle | Peut faire |
|---|---|
| **Visiteur** | Consulter accueil, ressources, FAQ, charte ; parcourir (sans contacter) parrains/logements/opportunités ; s'inscrire ou se connecter |
| **Filleul** | Compléter son profil, rechercher un parrain/marraine (score de compatibilité), suivre son accompagnement, échanger en messagerie, rechercher logement/opportunités, suivre sa checklist d'arrivée |
| **Parrain / Marraine** | Gérer son profil, accepter/refuser des demandes (dans la limite de 2 filleuls actifs), suivre ses filleuls, échanger en messagerie |
| **Propriétaire** | Publier des annonces de logement (soumises à modération), gérer leur statut (brouillon → soumise → validée/rejetée → archivée) |
| **Administrateur** | Superviser tous les KPIs, gérer les comptes (suspendre/réactiver), superviser les matchings et la charge des parrains, modérer messages signalés / annonces / offres, gérer les ressources et la FAQ |

---

## 4. Règles métier implémentées

Toutes les règles ci-dessous sont appliquées dans `assets/js/engine/matching-engine.js` et dans la logique des pages associées :

1. **Quota de parrainage** : un parrain/marraine ne peut pas dépasser **2 filleuls actifs** simultanément (`MatchingEngine.isMentorEligible`). Une demande est bloquée côté filleul et côté acceptation parrain si le quota est atteint.
2. **Préférence de sexe** : seul le filleul peut définir une préférence de sexe pour son parrain/marraine. Si elle est renseignée, elle est **éliminatoire** dans le classement (`MatchingEngine.computeScore` renvoie `hardBlock: true`).
3. **Score de compatibilité** pondère : sexe (prioritaire), ville/établissement souhaité, domaine d'étude, langues parlées en commun, disponibilité du parrain, type d'accompagnement recherché.
4. **Statuts de parrainage** : `en_attente` → `validée` → `active` → (`suspendue` si signalement) → `terminée`, avec historique complet (`matching.statusHistory`) affiché en timeline.
5. **Messagerie encadrée** : bannière permanente rappelant la modération possible, bouton "Signaler" sur chaque message reçu, création d'un vrai enregistrement de signalement.
6. **Signalements** : 5 motifs prévus (harcèlement, comportement inapproprié, faux profil, tentative d'arnaque, proposition déplacée), avec statut (`ouvert` / `en_cours` / `résolu` / `rejeté`) traité côté admin.
7. **Modération obligatoire** : aucune annonce de logement ni offre d'emploi/stage/alternance n'apparaît publiquement sans passage par le statut `validée`.
8. **Espace admin** : vision globale des utilisateurs, suspension de comptes, vue des matchings et de la charge des parrains (avec alerte si quota atteint/dépassé), modération des signalements/annonces/offres, gestion des ressources et de la FAQ.

---

## 5. Fichiers JSON de démonstration (`assets/data/`)

| Fichier | Contenu |
|---|---|
| `users.json` | Tous les comptes (tous rôles confondus) : identité, statut, vérification |
| `mentors.json` | Profils parrains/marraines : ville, école, langues, disponibilité, quota |
| `mentees.json` | Profils filleuls : origine, ville souhaitée, préférences, statut de dossier |
| `matchings.json` | Binômes filleul↔parrain avec statut, score, historique |
| `messages.json` | Conversations et messages (avec un exemple de message signalé) |
| `reports.json` | Signalements (motif, statut, note admin) |
| `housing.json` | Annonces de logement avec statut de modération |
| `opportunities.json` | Offres (jobs saisonniers, stages, alternances) avec statut de modération |
| `resources.json` | Guides pratiques par catégorie + entrées FAQ |
| `notifications.json` | Notifications par utilisateur |

### Architecture d'accès aux données : `DataStore`

Toutes les pages passent exclusivement par `DataStore` (`assets/js/core/data-store.js`) :

```js
const mentors = await DataStore.getMentors();
await DataStore.insert("matchings", newMatching);
await DataStore.update("mentees", menteeId, { profileCompleteness: 80 });
```

- **Aujourd'hui** : `DataStore` charge les fichiers JSON via `fetch()` et garde un **cache mémoire** ; les écritures (`insert`/`update`) ne modifient que ce cache — elles sont donc perdues au rechargement de la page. C'est un choix assumé de prototype : aucune donnée métier n'est stockée dans `localStorage`.
- **Demain** : il suffira de réécrire l'intérieur de `load()`, `insert()` et `update()` pour qu'ils appellent une vraie API REST (`fetch('/api/mentors')`, etc.). **Aucune page ni composant n'aura à changer**, car ils ne connaissent que l'interface de `DataStore`.

De la même façon, `Auth` (`assets/js/core/auth.js`) simule une connexion par email/mot de passe et garde uniquement l'**identifiant de session** (`userId`, `role`) dans `sessionStorage` — jamais les données métier. Ce choix garde `sessionStorage` cantonné à un rôle d'auth minimal, facilement remplaçable par un vrai token JWT / cookie de session plus tard.

---

## 6. Design system

- **Palette** : bleu nuit institutionnel (`--dc-navy-*`) en couleur principale, vert sauge (`--dc-teal-*`) pour les accents "parrain/succès", terracotta (`--dc-terracotta-*`) pour les accents "filleul", violet (`--dc-purple-*`) pour "propriétaire". Statuts harmonisés (succès/attention/danger/info/neutre) via `--dc-success`, `--dc-warning`, `--dc-danger`, `--dc-info`, `--dc-neutral`.
- **Typographie** : Inter (Google Fonts, avec repli `system-ui`).
- **Framework UI** : Bootstrap 5 (grille, formulaires, modals, dropdowns, collapse) pour la structure ; classes utilitaires `dc-*` définies dans `assets/css/components.css` pour les composants propres au produit (cartes, badges de statut, timeline, checklist, messagerie, filtres). Tailwind n'est **pas utilisé** — toutes les classes suivent Bootstrap + le système `dc-*` pour rester cohérent.
- **Composants réutilisables** : navbar publique, header + sidebar applicatifs (un par rôle), footer, cartes profils/logement/opportunité, badges de statut, timeline de suivi, tableaux responsive (bascule cartes sur mobile), modals (confirmation, signalement, détail), bannières d'information, états vides, barres de recherche et panneaux de filtres.

---

## 7. Accessibilité & responsive

- Structure sémantique (`header`, `nav`, `main`, `aside`, `footer`), lien d'évitement ("Aller au contenu principal"), labels explicites sur tous les champs de formulaire, focus clavier visible (`:focus-visible`).
- Mobile-first : navbar publique en menu Bootstrap collapsible, sidebar applicative repliable (bouton hamburger + overlay) sous 992px, cartes empilées, tableaux basculant en cartes sur petit écran (`.dc-table-responsive-cards`).

---

## 8. Évolution vers un vrai backend

Ce prototype a été conçu pour minimiser la réécriture lors du passage à un vrai backend (Node.js/Express, Laravel ou Django) :

1. Remplacer l'implémentation interne de `DataStore` (fetch JSON → fetch API REST/GraphQL).
2. Remplacer `Auth.login/register` par de vrais appels d'authentification (session serveur ou JWT), en gardant la même interface (`Auth.getCurrentUser()`, `Auth.guard()`).
3. Déplacer `MatchingEngine` côté serveur (ou le dupliquer en garde-fou côté serveur) pour empêcher tout contournement des règles de quota/compatibilité depuis le client.
4. Remplacer les uploads de photos simulés (formulaire d'annonce) par un vrai stockage de fichiers.
5. Ajouter une vraie modération temps réel (webhooks, files d'attente) à la place des tableaux de statut en mémoire.

Aucune page HTML ni composant CSS n'a besoin d'être repensé pour cette migration : seule la couche `assets/js/core/` change d'implémentation interne.
