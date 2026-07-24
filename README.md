# DiaspoConnect

Plateforme d'accompagnement pour les étudiants africains, avec un focus initial sur les étudiants **béninois** préparant leur arrivée en France. DiaspoConnect met en relation des **filleuls** avec des **parrains/marraines** déjà installés en France, et donne accès à un **logement vérifié**, des **opportunités** (jobs saisonniers, stages, alternances) et des **ressources pratiques**. La plateforme est aussi organisée comme une **vraie structure métier**, avec une équipe interne (direction, secrétariat, conseillers, modération, support, partenariats, contenu, conformité, technique), un organigramme public **fonctionnel** (sans identité nominative), un centre de tickets, et un **système de gestion de tâches Kanban intégré** à chaque espace utilisateur, jusqu'à un Kanban central pour l'administration.

Ce dépôt contient le **prototype frontend** de la plateforme : HTML5 / CSS3 / JavaScript natif + Bootstrap 5, sans aucune dépendance backend. Toutes les données sont simulées via des fichiers JSON locaux, mais l'architecture — et le schéma relationnel fourni dans `database/schema.sql` — sont pensés pour être branchés demain sur une vraie API et une vraie base PostgreSQL (Node.js, Laravel ou Django) sans réécrire les pages.

---

## 1. Lancer le prototype

Le site charge ses données via `fetch()` (JSON) et injecte des composants HTML partagés (navbar, sidebar, footer) via `fetch()` également. **Cela nécessite un serveur local** — ouvrir les fichiers directement (`file://`) ne fonctionnera pas à cause des restrictions CORS des navigateurs sur `fetch`.

Depuis le dossier `diaspo-connect/`, lancer l'une de ces commandes :

```bash
python -m http.server 8893
```

Puis ouvrir **http://localhost:8893** dans le navigateur.

> Si vous utilisez `npx serve` à la place, pensez à désactiver son mode "clean URLs" (option `-n` insuffisante ; ajoutez un `serve.json` avec `"cleanUrls": false`) : par défaut `serve` redirige `page.html?id=123` vers `page` en supprimant la query string, ce qui casse les liens profonds du site (ex. `team-member-detail.html?id=...`, `tickets-management.html?id=...`).

### Comptes de démonstration

La page de connexion (`pages/public/login.html`) propose des raccourcis vers 4 comptes de démonstration (un clic pré-remplit l'email + un mot de passe démo). Le mot de passe n'est pas vérifié contre une vraie valeur dans ce prototype : n'importe quel mot de passe d'au moins 6 caractères fonctionne, à condition que l'email corresponde à un compte existant dans `assets/data/users.json`.

| Rôle | Email |
|---|---|
| Filleule | `rosine.agossou@mail.com` |
| Marraine | `aicha.zannou@mail.fr` |
| Propriétaire | `marc.lefevre@mail.fr` |
| Administrateur (legacy) | `admin@diaspoconnect.fr` |
| Direction (équipe interne, super_admin) | `serge.donou@diaspoconnect.fr` |
| Secrétariat | `aminata.djossou@diaspoconnect.fr` |
| Conseiller démarches | `fabrice.koudjo@diaspoconnect.fr` |
| Conseillère logement | `nadia.sourou@diaspoconnect.fr` |
| Conseiller emploi | `olivier.aihonnou@diaspoconnect.fr` |
| Modération & confiance | `michee.hounkanrin@diaspoconnect.fr` |
| Support utilisateur | `thomas.berger@diaspoconnect.fr` |
| Partenariats | `lea.fontaine@diaspoconnect.fr` |
| Contenu (community manager) | `carine.zannou@diaspoconnect.fr` |
| Conformité / vérification | `sophie.marchal@diaspoconnect.fr` |
| Technique | `yannick.adjahoui@diaspoconnect.fr` |

Il est aussi possible de créer un nouveau compte via les pages d'inscription (`register-filleul.html`, `register-parrain.html`, `register-proprietaire.html`) — le compte créé n'existe qu'en mémoire le temps de la session (voir section 5).

> **Deux points d'entrée, une seule mainmise réelle.** L'espace `pages/admin/*` (rôle `admin`) reste la console de supervision de la plateforme étudiante, désormais **enrichie** du Kanban central, des tickets, des documents, de l'audit, des permissions et des paramètres système (section 6.5). L'espace `pages/staff/*` (rôle `staff`) est la couche organisationnelle interne par pôle, décrite en section 6. Conformément à la règle produit *"l'admin et surtout le super admin doivent pouvoir faire tout ce que les autres rôles font"*, `StaffGuard` (section 6.2) donne désormais au rôle `admin` un accès total à `pages/staff/*` au même titre qu'un membre `super_admin` — les deux espaces restent deux façades distinctes côté frontend, mais aucun des deux n'est jamais restreint face à l'autre.

---

## 2. Arborescence du projet

```
diaspo-connect/
├── index.html                      # Page d'accueil publique
├── README.md
├── database/
│   └── schema.sql                  # Schéma PostgreSQL de référence (~74 tables, voir section 7)
├── pages/
│   ├── public/                     # Pages accessibles sans connexion
│   │   ├── comment-ca-marche.html, parrains.html, logements.html,
│   │   │   opportunites.html, ressources.html, faq.html, charte.html, aide.html
│   │   ├── about.html              # Missions/responsabilités par pôle — AUCUN nom affiché
│   │   ├── organization.html       # Gouvernance, niveaux de décision, organigramme fonctionnel
│   │   ├── how-we-work.html        # Circuit d'une demande, principes de traitement
│   │   ├── contact-team.html, join-team.html, team-member-detail.html, privacy.html
│   │   ├── login.html, register-filleul.html, register-parrain.html,
│   │   │   register-proprietaire.html
│   │   └── 404.html
│   ├── filleul/                    # Espace filleul (authentifié)
│   │   ├── dashboard.html, profil.html, recherche-parrains.html,
│   │   │   matching.html, messagerie.html, logements.html,
│   │   │   opportunites.html, ressources.html, parametres.html
│   │   └── kanban.html             # "Mes tâches" — démarches, documents, deadlines
│   ├── parrain/                    # Espace parrain / marraine
│   │   ├── dashboard.html, profil.html, demandes.html, filleuls.html,
│   │   │   messagerie.html, parametres.html
│   │   └── kanban.html             # "Mes tâches" — suivi des filleuls, rappels
│   ├── proprietaire/                # Espace propriétaire
│   │   ├── dashboard.html, creer-annonce.html, annonces.html, parametres.html
│   │   └── kanban.html             # "Mes tâches" — annonces, candidatures, pièces
│   ├── admin/                      # Espace administrateur (rôle `admin`, accès total — voir section 6)
│   │   ├── dashboard.html, utilisateurs.html, matching.html
│   │   ├── moderation-messages.html, moderation-logements.html, moderation-opportunites.html
│   │   ├── kanban.html             # Kanban central : vue agrégée de TOUS les boards/pôles/rôles
│   │   ├── tickets.html            # Centre de tickets transverse (réassignation/escalade)
│   │   ├── documents.html          # Centre de documents (validation/rejet des pièces)
│   │   ├── audit.html              # Journal d'audit (lecture seule, filtrable)
│   │   ├── calendar.html           # Calendrier global des échéances Kanban
│   │   ├── workload.html           # Charge de travail & performance par pôle
│   │   ├── reports.html            # Rapports, délais de traitement, export simulé
│   │   ├── permissions.html        # Matrice RBAC module × action, par rôle interne
│   │   ├── search.html             # Recherche globale (utilisateurs, logements, offres, tickets, cartes)
│   │   ├── system-settings.html    # Paramètres système + feature flags
│   │   ├── ressources.html, parametres.html
│   └── staff/                      # Espace interne équipe (rôle `staff`, voir section 6)
│       ├── staff-dashboard.html          # Direction (super_admin / direction_admin)
│       ├── secretariat-dashboard.html    # Secrétariat général
│       ├── advisors-dashboard.html       # Conseil (démarches / logement / emploi, contenu adapté à l'advisorType)
│       ├── moderation-dashboard.html     # Modération & confiance
│       ├── support-dashboard.html        # Support utilisateur
│       ├── partnerships-dashboard.html   # Partenariats
│       ├── content-dashboard.html        # Contenu & ressources
│       ├── compliance-dashboard.html     # Vérification & conformité
│       ├── technical-dashboard.html      # Technique
│       ├── tickets-management.html       # Centre de tickets transverse
│       ├── staff-directory.html          # Annuaire interne complet
│       ├── org-management.html           # Organigramme & pôles (vue interne)
│       └── kanban.html                   # "Mes tâches" : ouvre automatiquement le board du pôle du membre connecté
├── components/                     # Partials HTML injectés dynamiquement
│   ├── navbar-public.html, footer-public.html, app-header.html
│   └── sidebar-filleul.html, sidebar-parrain.html,
│       sidebar-proprietaire.html, sidebar-admin.html
│       (la sidebar de l'espace staff est générée dynamiquement en JS, cf. Layout.mountStaffApp)
├── assets/
│   ├── css/
│   │   ├── variables.css     # Design tokens (couleurs, typo, ombres, radius)
│   │   ├── base.css          # Reset léger, typographie, focus clavier
│   │   ├── layout.css        # Navbar, header applicatif, sidebar, footer, hero
│   │   ├── components.css    # Cartes, badges, timeline, tables, formulaires, Kanban...
│   │   └── pages.css         # Ajustements ponctuels par page (dont organigramme fonctionnel)
│   ├── js/
│   │   ├── core/
│   │   │   ├── data-store.js         # Couche unique d'accès aux données (JSON aujourd'hui, API demain)
│   │   │   ├── auth.js               # Authentification simulée + garde de page par rôle
│   │   │   ├── utils.js              # Formatage, échappement HTML, badges de statut/priorité, toasts
│   │   │   ├── checklist.js          # Checklist d'arrivée par filleul
│   │   │   ├── notification-center.js # Centre de notifications par utilisateur
│   │   │   ├── permissions.js         # Modules de sidebar autorisés par accessLevel (staff)
│   │   │   ├── rbac.js                # Permissions fines module × action (voir section 6.5)
│   │   │   ├── staff-guard.js         # Garde de page pour l'espace interne (session + permissions)
│   │   │   └── ticket-helpers.js      # Libellés catégorie/service, calcul de retard, nom d'assigné
│   │   ├── engine/
│   │   │   ├── matching-engine.js    # Règles métier du matching (quotas, scoring, préférences)
│   │   │   └── kanban-engine.js      # Logique métier Kanban (déplacement, assignation, filtres, activité)
│   │   ├── ui/
│   │   │   ├── layout.js             # Montage navbar/sidebar/footer + sidebar dynamique staff
│   │   │   ├── forms.js               # Moteur de validation de formulaires
│   │   │   ├── filters.js             # Prédicats de filtrage réutilisables
│   │   │   ├── modals.js              # Modal de confirmation générique
│   │   │   ├── report-modal.js        # Formulaire de signalement réutilisable
│   │   │   └── kanban-board.js        # Composant de tableau Kanban réutilisable (tous les espaces)
│   │   └── pages/                     # 1 fichier JS par page (logique spécifique)
│   ├── data/                    # 26 fichiers JSON de données simulées (voir section 5)
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
| **Administrateur** (`admin`) | Accès **total** : tous les KPIs, gestion des comptes/rôles, matchings, modération, ressources, **et** désormais le Kanban central, le centre de tickets, les documents, l'audit, les permissions RBAC, les paramètres système — **ainsi que tout l'espace interne `pages/staff/*`** (voir section 6.2) |
| **Équipe interne (`staff`)** | 12 postes (direction, secrétariat, 3 conseillers, modération, support, partenariats, contenu, conformité, technique), chacun avec son propre dashboard, ses propres accès et son propre tableau Kanban de pôle (voir section 6) |
| **super_admin** (`staff` + `accessLevel: super_admin`) | Même niveau d'accès total que `admin` : vision globale, création/modification/réassignation de n'importe quelle tâche ou dossier, tous rôles confondus |

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
| `users.json` | Tous les comptes (tous rôles confondus, y compris `staff`) : identité, statut, vérification |
| `mentors.json` | Profils parrains/marraines : ville, école, langues, disponibilité, quota |
| `mentees.json` | Profils filleuls : origine, ville souhaitée, préférences, statut de dossier |
| `matchings.json` | Binômes filleul↔parrain avec statut, score, historique |
| `messages.json` | Conversations et messages (avec un exemple de message signalé) |
| `reports.json` | Signalements (motif, statut, note admin) |
| `housing.json` | Annonces de logement avec statut de modération |
| `opportunities.json` | Offres (jobs saisonniers, stages, alternances) avec statut de modération |
| `resources.json` | Guides pratiques par catégorie + entrées FAQ |
| `notifications.json` | Notifications par utilisateur |
| `staff.json` | Fiches internes des 12 membres de l'équipe : poste, pôle, accessLevel, statut collaborateur, charge, disponibilité, **consentement d'affichage public** |
| `departments.json` | Les 9 pôles/départements (direction, secrétariat, conseil, support, modération, partenariats, contenu, technique, conformité) |
| `permissions.json` | Modules autorisés par `accessLevel`, page d'atterrissage après connexion, droits de gestion transverse |
| `org-chart.json` | Arbre hiérarchique (fondateur → pôles → sous-postes) utilisé par l'organigramme public et la vue interne |
| `public-team.json` | **Projection publique** de `staff.json` : uniquement les membres ayant consenti, avec seulement les champs qu'ils ont choisi de partager (simule ce qu'une vraie API publique exposerait) |
| `tickets.json` | Tickets internes : catégorie, canal, service cible, priorité, assignation, statut, historique, notes internes, réponse |
| `contact-requests.json` | Soumissions brutes des formulaires de contact publics, chacune liée à un ticket (`linkedTicketId`) |
| `audit-log.json` | Journal d'audit des actions sensibles (suspension de compte, validation/rejet d'annonce ou d'offre, décision de modération, assignation de ticket, réassignation, modification de permission/feature flag...) |
| `boards.json` | Les tableaux Kanban : 3 boards personnels (filleul/parrain/propriétaire, réutilisés en modèle par tous les comptes du rôle), 9 boards de pôle (un par département), 1 board central (agrégation virtuelle, sans cartes propres) |
| `lists.json` | Les colonnes de chaque board (libellés adaptés au métier : « Nouvelles demandes » pour le secrétariat, « Résolu » pour le support, etc.), avec `isDoneColumn` |
| `cards.json` | Les cartes/tâches : titre, priorité, statut normalisé (`todo`/`in_progress`/`blocked`/`done`), échéance, `ownerId`, `assignees[]`, `labels[]`, `checklist[]`, `comments[]`, lien optionnel vers un objet métier (`linkedRecordType`/`linkedRecordId`) |
| `labels.json` | Étiquettes Kanban réutilisables (couleur + nom) |
| `card_activity.json` | Journal d'activité par carte (créée, déplacée, assignée, commentée, checklist mise à jour...) |
| `documents.json` | Pièces justificatives déposées par filleuls/parrains/propriétaires, avec statut de vérification (`en_attente`/`valide`/`rejete`) |
| `settings.json` | Réglages système généraux (quota parrain, SLA ticket par défaut...) et feature flags |

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

## 6. Organisation interne, permissions et centre de tickets

### 6.1 Rôles internes et niveaux d'accès

12 postes internes sont modélisés dans `staff.json`, chacun rattaché à un `accessLevel` qui détermine ce qu'il peut voir et faire dans l'espace `pages/staff/*` :

| Poste | accessLevel | Dashboard d'atterrissage |
|---|---|---|
| Fondateur / Directeur | `super_admin` | `staff-dashboard.html` (accès total) |
| Direction | `direction_admin` | `staff-dashboard.html` |
| Secrétaire général(e) | `secretariat_admin` | `secretariat-dashboard.html` |
| Conseiller(ère) démarches | `advisor_admin` | `advisors-dashboard.html` |
| Conseiller(ère) logement | `housing_admin` | `advisors-dashboard.html` |
| Conseiller(ère) emploi | `career_admin` | `advisors-dashboard.html` |
| Responsable modération / confiance | `moderation_admin` | `moderation-dashboard.html` |
| Support utilisateur | `support_admin` | `support-dashboard.html` |
| Responsable partenariats | `partnership_admin` | `partnerships-dashboard.html` |
| Community manager / Responsable contenu | `content_admin` | `content-dashboard.html` |
| Vérificateur(trice) profils / conformité | `compliance_admin` | `compliance-dashboard.html` |
| Administrateur technique | `technical_admin` | `technical-dashboard.html` |

**`advisors-dashboard.html` est une page unique partagée par les 3 spécialités de conseil** : son contenu (dossiers affectés, checklists, annonces logement ou offres emploi) s'adapte au champ `advisorType` (`demarches` / `logement` / `emploi`) du conseiller connecté — c'est ce qui matérialise la règle "les conseillers ne voient que les dossiers pertinents pour leur domaine".

### 6.2 Comment fonctionne le contrôle d'accès

- `assets/js/core/permissions.js` lit `permissions.json` et expose `Permissions.can(accessLevel, moduleId)`, `Permissions.canManageAllTickets(accessLevel)` et `Permissions.landingPageFor(accessLevel)`.
- `assets/js/core/staff-guard.js` (`StaffGuard.require(moduleId)`) est appelé en tête de chaque page `pages/staff/*` : il vérifie la session, résout la fiche `staff` de l'utilisateur, puis vérifie via `Permissions.can()` que son `accessLevel` a le droit d'accéder à ce module. Sinon, redirection vers **son propre** dashboard (jamais une erreur brute).
- `assets/js/ui/layout.js` expose `Layout.mountStaffApp(moduleId, ctx)` : la sidebar de l'espace interne n'est **pas un fichier HTML statique** comme pour filleul/parrain/propriétaire/admin — elle est générée dynamiquement à partir de la liste des modules autorisés (`STAFF_NAV` filtré par `Permissions.getFor(accessLevel).modules`). Un secrétaire ne voit donc jamais apparaître de lien vers l'organigramme ou la gestion des permissions, par exemple.
- `super_admin` **et** `admin` (rôle legacy) court-circuitent toujours ces vérifications (accès total), ce qui correspond à la règle "un collaborateur interne ne voit que les modules de son rôle, sauf s'il est admin ou super admin". Pour un utilisateur `admin`, `StaffGuard.require()` synthétise une fiche staff virtuelle (`accessLevel: "super_admin"`, sans `staffId` réel) plutôt que d'exiger une entrée dans `staff.json` — c'est ce qui permet au compte `admin@diaspoconnect.fr` d'ouvrir n'importe quelle page `pages/staff/*`, y compris `org-management.html` ou `staff-directory.html`.

> **Note d'architecture** : l'espace `pages/admin/*` (rôle `admin`) et l'espace `pages/staff/*` (rôle `staff`) restent deux jeux de pages HTML distincts dans ce prototype (pas de fusion des fichiers), mais leurs gardes d'accès (`Auth.guard(["admin"])` et `StaffGuard.require()`) s'accordent désormais un accès mutuel total. Dans un vrai backend, les deux seraient unifiés sous un seul système de rôles/permissions côté serveur (table `roles`/`user_roles`/`role_permissions` du schéma SQL, section 7).

### 6.3 Centre de tickets et formulaires de contact

- La page publique `contact-team.html` propose 9 services (Direction, Secrétariat, Conseiller démarches/logement/emploi, Support, Modération, Partenariats, Rejoindre l'équipe). Chaque soumission crée **à la fois** une entrée dans `contact-requests.json` (la demande brute, avec mention de consentement RGPD) **et** un ticket dans `tickets.json` déjà routé vers le bon `targetService` — c'est la même logique que reprend `join-team.html` pour les candidatures bénévoles.
- `pages/staff/tickets-management.html` est le centre de tickets transverse : filtres (statut, priorité, service), historique complet, notes internes, réassignation, réponse envoyée. La portée des tickets visibles dépend de `canManageAllTickets` (vrai pour secrétariat/direction/super_admin, faux pour les spécialistes qui ne voient que leurs tickets assignés ou ceux de leur pôle).
- Chaque dashboard métier (secrétariat, conseil, modération, support, partenariats) affiche une vue filtrée des mêmes tickets, adaptée à son périmètre — pas de duplication de données, juste des filtres différents sur `tickets.json`.
- Les actions sensibles (suspension de compte, validation/rejet d'annonce ou d'offre, résolution/rejet de signalement, réassignation de ticket) écrivent une ligne dans `audit-log.json` via `DataStore.insert("auditLog", ...)`.

### 6.4 Organigramme public et confidentialité des fiches équipe

- La page `about.html` affiche un organigramme visuel (fondateur → pôles → sous-postes, construit depuis `org-chart.json`) et une grille de fiches membres construite depuis `public-team.json`.
- **Règle de confidentialité stricte** : `public-team.json` ne contient déjà que les membres avec `consentPublicDisplay: true` dans `staff.json`, et seulement les champs correspondant à leur `publicVisibility` (`public_complet` = tout ; `public_partiel` = identité + poste, sans bio/activité détaillée). Les postes occupés par des membres **non consentants** (`interne` ou `caché`) restent visibles dans l'organigramme — le poste existe — mais affichent "Poste occupé — profil non public" sans aucune donnée personnelle.
- `pages/staff/org-management.html` et `pages/staff/staff-directory.html` sont des outils **internes** : ils affichent l'identité réelle de tous les membres sans filtre de visibilité, car réservés à l'équipe.
- `team-member-detail.html?id=staff-XXX` affiche la fiche individuelle publique ; un identifiant qui ne correspond à aucune entrée de `public-team.json` (profil non consentant ou lien invalide) affiche un état "Profil indisponible" plutôt qu'une erreur.
- **La page publique `about.html` n'affiche plus aucun nom.** Depuis la V3, elle présente uniquement l'organisation **fonctionnelle** : les pôles (`departments.json`, avec `mission` et `responsibilities[]`), leurs responsabilités et l'organigramme construit depuis `org-chart.json` mais rendu sans identité (`page-about.js` ne lit plus `public-team.json`). Les pages `organization.html` (gouvernance, niveaux de décision, statuts collaborateur) et `how-we-work.html` (circuit d'une demande, principes de traitement) complètent cette présentation institutionnelle. Les annuaires nominatifs (`staff-directory.html`, `team-member-detail.html`, `org-management.html`) restent des outils **internes**, jamais exposés publiquement.

### 6.5 Permissions fines (RBAC module × action)

En complément de `Permissions` (qui ne gère que la **visibilité des pages** dans la sidebar interne), `assets/js/core/rbac.js` implémente un vrai contrôle **RBAC** à granularité fine :

- **Modules** : `users`, `mentorship`, `housing`, `opportunities`, `tickets`, `moderation`, `content`, `documents`, `kanban`, `settings`, `permissions`, `audit`, `reports`, `calendar`.
- **Actions** : `read`, `create`, `update`, `delete`, `assign`, `validate`, `moderate`, `export`, `impersonate`.
- `RBAC.can(roleKey, module, action)` répond vrai/faux ; `RBAC.roleKeyFor(user, staffRecord)` résout la bonne clé de rôle (`"admin"` pour le rôle legacy, l'`accessLevel` pour un membre `staff`, le rôle brut pour filleul/parrain/propriétaire).
- `admin` et `super_admin` retournent toujours `true` (accès total, sans même consulter la matrice) — c'est la traduction directe de la règle produit sur leur mainmise totale.
- La page `pages/admin/permissions.html` affiche cette matrice pour les 14 rôles restants et permet de **basculer** une permission à titre de démonstration (mutation en mémoire via `RBAC.toggle()`, tracée dans `audit-log.json`) — en production, la source de vérité serait la table `role_permissions` du schéma SQL (section 8).

---

## 7. Système de tâches intégré (Kanban)

Chaque espace utilisateur dispose d'un **vrai système de gestion de tâches type Trello**, rendu par un unique composant réutilisable (`assets/js/ui/kanban-board.js`) au-dessus d'un moteur métier partagé (`assets/js/engine/kanban-engine.js`).

### 7.1 Un usage différent par rôle

| Espace | Board | Usage métier |
|---|---|---|
| Filleul | `board-filleul` | Suivi personnel des démarches, documents et deadlines |
| Parrain / Marraine | `board-parrain` | Suivi des filleuls accompagnés, rappels, actions à faire |
| Propriétaire | `board-proprietaire` | Suivi des annonces, candidatures reçues, pièces à traiter |
| Chaque pôle interne (`pages/staff/kanban.html`) | `board-{departement}` | Tri/affectation (secrétariat), dossiers affectés (conseil), tickets (support), incidents (modération)... |
| Administration (`pages/admin/kanban.html`) | Agrégation virtuelle de **tous** les boards | Vue globale, tous rôles/pôles/priorités confondus |

Les boards `filleul`/`parrain`/`proprietaire` sont des **modèles partagés** par tous les comptes du rôle : `KanbanBoard` filtre systématiquement les cartes par `ownerId === utilisateur connecté` (option `selfOwned: true`) pour qu'un filleul ne voie jamais les cartes d'un autre — cette vérification est faite côté moteur (`kanban-board.js`), pas seulement par un filtre optionnel d'interface.

### 7.2 Fonctionnalités communes à tous les boards

Colonnes, cartes, **priorités** (basse/normale/haute/urgente), **checklists**, **échéances** (avec indicateurs "en retard" / "à échéance proche"), **commentaires** internes, **pièces jointes simulées**, **étiquettes**, **assignations**, **filtres** (priorité, pôle, membre, recherche, en retard, non assignées, bloquées, "mes tâches"), **déplacement entre colonnes** (glisser-déposer HTML5 natif + sélecteur de colonne accessible dans le détail de carte), et un **journal d'activité** par carte (`card_activity.json`).

### 7.3 Kanban central admin

`pages/admin/kanban.html` (`KanbanBoard.mount({ mode: "central", ... })`) agrège les cartes de tous les boards réels en 4 colonnes normalisées (À faire / En cours / Bloqué / Terminé, déduites du champ `status` de chaque carte) et ajoute : filtre par pôle et par membre, compteurs "en retard"/"non assignées", création de carte pour **n'importe quel membre**, assignation multiple, et étiquette de board d'origine sur chaque carte pour garder le contexte. C'est le même composant que les boards personnels — seule la fonction d'agrégation change (`KanbanEngine.centralContext()` vs `KanbanEngine.boardContext()`).

### 7.4 Vues transverses associées

Le calendrier global (`admin/calendar.html`), la charge de travail par pôle (`admin/workload.html`, croisée avec `staff.workloadPct`) et les rapports de délais (`admin/reports.html`) sont tous calculés à partir des mêmes `cards.json`/`tickets.json` — aucune donnée dupliquée, seulement des angles de lecture différents, à l'image de ce que ferait une vraie vue SQL agrégée côté backend.

---

## 8. Base de données relationnelle (`database/schema.sql`)

Le prototype est accompagné d'un schéma **PostgreSQL 15+** de référence, pensé pour être la cible exacte du futur backend — chaque table correspond à une collection JSON ou à une vue frontend existante.

- **~74 tables** réparties en 9 blocs : utilisateurs & accès (13), structure interne (4), parrainage/accompagnement (9), logement (5), emploi (4), communication (9), **Kanban (14 tables : `boards`, `board_columns`, `cards`, `card_assignees`, `card_labels`, `card_checklists`, `card_comments`, `card_activity_logs`...)**, gouvernance/conformité (8), CMS léger (7).
- **19 types énumérés** (`CREATE TYPE ... AS ENUM`) pour tous les statuts métier fermés (`mentorship_status_enum`, `moderation_status_enum`, `priority_enum`, `rbac_action_enum`...), plutôt que des chaînes libres.
- `created_at`/`updated_at` sur toutes les tables (triggers `set_updated_at()` fournis en exemple), `deleted_at` sur les tables à fort enjeu (utilisateurs, annonces, offres).
- Contraintes métier traduites en SQL : `mentor_profiles.max_active_mentees` bridé à 2 par `CHECK`, et un **index unique partiel** (`uq_one_active_match_per_mentee`) empêchant un filleul d'avoir deux binômes `active` simultanés — la même règle que `MatchingEngine` applique côté frontend.
- `linked_record_type`/`linked_record_id` sur `cards` et `document_records` : liaison polymorphe volontairement non contrainte par FK stricte, résolue côté application — c'est l'équivalent SQL de `linkedRecordType`/`linkedRecordId` dans `cards.json`.
- `audit_logs` stocke `before_state`/`after_state` en `JSONB` pour rester agnostique du type d'entité modifiée, à l'image de `audit-log.json`.

Ce fichier n'est **pas exécuté** par le prototype (aucune dépendance backend) : c'est un document de conception, à charger tel quel dans une instance PostgreSQL le jour de la mise en production.

---

## 9. Design system

- **Palette** : bleu nuit institutionnel (`--dc-navy-*`) en couleur principale, vert sauge (`--dc-teal-*`) pour les accents "parrain/succès", terracotta (`--dc-terracotta-*`) pour les accents "filleul", violet (`--dc-purple-*`) pour "propriétaire". Statuts harmonisés (succès/attention/danger/info/neutre) via `--dc-success`, `--dc-warning`, `--dc-danger`, `--dc-info`, `--dc-neutral`.
- **Typographie** : Inter (Google Fonts, avec repli `system-ui`).
- **Framework UI** : Bootstrap 5 (grille, formulaires, modals, dropdowns, collapse) pour la structure ; classes utilitaires `dc-*` définies dans `assets/css/components.css` pour les composants propres au produit (cartes, badges de statut, timeline, checklist, messagerie, filtres). Tailwind n'est **pas utilisé** — toutes les classes suivent Bootstrap + le système `dc-*` pour rester cohérent.
- **Composants réutilisables** : navbar publique, header + sidebar applicatifs (un par rôle), footer, cartes profils/logement/opportunité, badges de statut, timeline de suivi, tableaux responsive (bascule cartes sur mobile), modals (confirmation, signalement, détail), bannières d'information, états vides, barres de recherche et panneaux de filtres.

---

## 10. Accessibilité & responsive

- Structure sémantique (`header`, `nav`, `main`, `aside`, `footer`), lien d'évitement ("Aller au contenu principal"), labels explicites sur tous les champs de formulaire, focus clavier visible (`:focus-visible`).
- Mobile-first : navbar publique en menu Bootstrap collapsible, sidebar applicative repliable (bouton hamburger + overlay) sous 992px, cartes empilées, tableaux basculant en cartes sur petit écran (`.dc-table-responsive-cards`).

---

## 11. Évolution vers un vrai backend

Ce prototype a été conçu pour minimiser la réécriture lors du passage à un vrai backend (Node.js/Express, Laravel ou Django), en s'appuyant sur `database/schema.sql` (section 8) comme cible :

1. Créer la base PostgreSQL à partir de `database/schema.sql`, puis migrer les 26 fichiers JSON vers leurs tables respectives (correspondance quasi directe : `cards.json` → `cards`, `staff.json` → `staff_profiles`, etc.).
2. Remplacer l'implémentation interne de `DataStore` (fetch JSON → fetch API REST/GraphQL) ; les méthodes `insert`/`update` deviennent de vrais appels `POST`/`PATCH`.
3. Remplacer `Auth.login/register` par de vrais appels d'authentification (session serveur ou JWT), en gardant la même interface (`Auth.getCurrentUser()`, `Auth.guard()`).
4. Déplacer `MatchingEngine` et `KanbanEngine` côté serveur (ou les dupliquer en garde-fou côté serveur) pour empêcher tout contournement des règles de quota/compatibilité/permissions depuis le client — en particulier l'index unique partiel sur `mentorship_matches` et les contraintes RBAC de `role_permissions`.
5. Remplacer les uploads de photos et pièces jointes simulés par un vrai stockage de fichiers (S3-compatible), référencé par `file_url` dans `document_records`/`card_attachments`.
6. Ajouter une vraie modération temps réel (webhooks, files d'attente) à la place des tableaux de statut en mémoire.
7. Déplacer `Permissions`/`RBAC`/`StaffGuard` côté serveur (middleware d'autorisation par rôle, table `role_permissions`) pour qu'un accès refusé côté client ne soit jamais contournable via l'API, et unifier à cette occasion les rôles `admin` (legacy) et `staff` sous le même système `roles`/`user_roles` du schéma SQL.
8. Brancher un vrai moteur d'export (`reports.html`, `audit.html`) et un vrai calcul de KPI agrégés côté SQL (vues matérialisées) plutôt que des calculs en JavaScript sur les collections chargées en mémoire.

Aucune page HTML ni composant CSS n'a besoin d'être repensé pour cette migration : seule la couche `assets/js/core/` et `assets/js/engine/` change d'implémentation interne.
