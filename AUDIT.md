# Audit structuré — DiaspoConnect (Phase 5)

Date de l'audit : 2026-07-25.
Périmètre : prototype frontend statique (HTML/CSS/JS vanilla, Bootstrap 5, aucun backend, données mockées en JSON, persistance mémoire par chargement de page).

Légende sévérité : 🔴 Critique · 🟠 Élevée · 🟡 Moyenne · ⚪ Faible.
Légende statut : **Corrigé** (code modifié dans cette session et vérifié) · **Limitation documentée** (comportement inhérent à un frontend sans backend, non corrigible sans API réelle) · **Reporté** (amélioration identifiée, non traitée dans cette session par choix de priorisation).

---

## ⚠️ Constat prioritaire : exposition des données publiques

🔴 **Critique** — **Limitation documentée**

Comme il n'existe aucun backend, **tous les fichiers `assets/data/*.json` sont récupérables par n'importe qui**, simplement en connaissant leur URL (`/assets/data/users.json`, `/assets/data/messages.json`, `/assets/data/reports.json`, `/assets/data/documents.json`, `/assets/data/audit-log.json`...), indépendamment de tout rôle, session ou droit affiché dans l'interface. Le cloisonnement par rôle (RBAC, `StaffGuard`, `Auth.guard`) ne s'applique qu'à l'affichage côté client : il ne protège aucune donnée côté serveur puisqu'il n'y a pas de serveur applicatif.

Concrètement, un visiteur non authentifié peut lire : la liste complète des utilisateurs (noms, emails, villes), le contenu intégral des conversations privées, les signalements de modération, les documents/justificatifs déposés, le journal d'audit, les paramètres système.

**Conséquence pour ce projet** : acceptable pour un prototype de démonstration, mais **bloquant avant toute mise en production réelle**. Le passage à un vrai backend (API + base de données + authentification serveur + autorisation par endpoint) est un prérequis absolu, pas une optimisation. `DataStore` a été conçu dès l'origine comme une façade isolant cette dépendance (voir sa documentation interne) pour rendre cette transition la moins coûteuse possible.

---

## 1. Sécurité des comptes

🟠 **Élevée** — **Limitation documentée** (partiellement atténuée) + **Corrigé** (auto-suspension)

- Authentification simulée : `Auth` stocke la session dans `sessionStorage` (jamais `localStorage`), ce qui limite la persistance à l'onglet/la session navigateur — bon réflexe pour un mock, mais **aucun mot de passe n'est réellement vérifié** (pas de hash, pas de backend d'authentification).
- Pas de verrouillage après tentatives échouées, pas de 2FA, pas d'expiration de session — hors périmètre d'un frontend sans backend.
- ✅ **Corrigé** : `assets/js/pages/page-admin-utilisateurs.js` — un admin pouvait se suspendre lui-même (testé en session : `u-001` a pu se suspendre lui-même via son propre bouton d'action). Corrigé par : (1) le bouton "Suspendre" est désormais désactivé sur la propre ligne de l'admin connecté (`disabled` + `title` explicite) ; (2) un garde-fou dans le handler de clic bloque quand même l'action et affiche un toast si elle était déclenchée ; (3) le formulaire d'édition (`submitUserForm`) empêche également l'admin de changer son propre rôle hors `"admin"` ou de désactiver son propre statut. Vérifié en navigateur : le bouton apparaît bien désactivé sur la ligne de l'admin connecté.

## 2. Permissions / rôles

🟢 **Corrigé / vérifié**

- `RBAC.MATRIX` définit une grille fine module × action par rôle staff + rôles simples (`mentore`, `mentor`, `proprietaire`) ; `FULL_ACCESS_ROLES = ["admin", "super_admin"]` outrepasse tout, conformément à l'exigence produit "l'admin et le super admin doivent pouvoir faire tout ce que les autres rôles font".
- `StaffGuard` synthétise un enregistrement staff virtuel (`accessLevel: "super_admin"`) pour le rôle `admin` legacy, garantissant l'accès aux pages staff sans dépendre d'une fiche `staff.json` réelle.
- 🟡 Vérifié : `RBAC.toggle()` mute la matrice **en mémoire uniquement** (non persisté au reload) — cohérent avec le reste du mock.
- ✅ **Corrigé** : les boutons `canCreate` des 5 tableaux Kanban (`page-mentore-kanban.js`, `page-mentor-kanban.js`, `page-proprietaire-kanban.js`, `page-staff-kanban.js`, `page-admin-kanban.js`) étaient câblés en dur (`canCreate: true`) plutôt que dérivés de `RBAC.can(roleKey, "kanban", "create")`. Remplacé par un appel réel à `RBAC.can()` (ou `RBAC.hasFullAccess()` pour l'admin et le staff `super_admin`/`direction_admin`), et ajouté `core/rbac.js` aux 4 pages qui ne le chargeaient pas encore (`mentor/kanban.html`, `mentore/kanban.html`, `proprietaire/kanban.html`, `staff/kanban.html`). Vérifié en navigateur pour un mentoré, un membre staff `secretariat_admin` et l'admin : le bouton "Nouvelle carte" apparaît toujours de façon cohérente avec `RBAC.MATRIX`, sans erreur console. La source de vérité est désormais unique.

## 3. Qualité des formulaires

🟢 **Corrigé / vérifié**

- Inventaire exhaustif effectué : 32 fichiers HTML avec `<form>`. Sur les formulaires de saisie réelle (hors formulaires de filtre, qui n'ont pas besoin de validation), tous utilisent déjà `FormValidation` — sauf un.
- ✅ **Corrigé** : `pages/admin/system-settings.html` (formulaire "Réglages généraux" : nom de la plateforme, email support, quota mentorés/mentor, délai SLA) n'avait **aucune validation** — les champs n'avaient même pas d'attribut `name`, indispensable pour `FormValidation.validateForm()`. Ajouté les attributs `name`, les blocs `.invalid-feedback`, et un schéma de validation (`required`/`email`/`number`/`minValue(1)`) câblé dans `page-admin-system-settings.js`. Vérifié en navigateur : un email invalide est rejeté avec message d'erreur.
- **Bonus trouvé en corrigeant ce formulaire** : le champ quota (`s-quota`) avait un attribut HTML `max="2"` codé en dur — soit exactement la valeur alors stockée dans `settings.json`. Cela interdisait à tout admin d'augmenter un jour ce quota au-delà de 2, rendant le réglage inutilisable pour son propre objet. Supprimé ; vérifié en navigateur que la valeur peut désormais être portée à 5 (ou plus) et persiste dans le cache `DataStore`.

## 4. Robustesse de la messagerie

🟢 **Corrigé / vérifié**

- `MessagingTransport` (BroadcastChannel) + `MessagingThread` fournissent réception quasi temps réel, accusés de lecture, indicateur de frappe (TTL 3s), badges non lus — testés avec deux onglets simultanés dans les phases précédentes.
- Tout le texte de message est échappé via `DCUtils.escapeHtml(m.text)` avant injection dans le DOM (`assets/js/ui/messaging-thread.js:129`) — pas de faille XSS trouvée sur ce canal, y compris sur l'indicateur de frappe (nom d'utilisateur échappé aussi).
- ✅ **Corrigé** : le hook `onPoll` de `MessagingTransport.subscribe()` était défini mais **jamais utilisé par aucun appelant**. Câblé désormais dans `assets/js/ui/messaging-thread.js` (`subscribeActive()` et `subscribeInactiveConversations()`) via une nouvelle fonction `pollResync()` qui revérifie périodiquement (toutes les 4s) la source canonique (`DataStore.getMessages()`) et fusionne tout message présent côté source mais absent localement — un filet de secours pour un évènement `BroadcastChannel` manqué (onglet en arrière-plan throttlé, navigateur sans support `BroadcastChannel`). Vérifié en navigateur : le cycle de poll s'exécute sans erreur console sur plusieurs itérations.
- **Limitation documentée persistante** (non corrigible sans backend) : le transport réel reste `BroadcastChannel`, qui ne fonctionne qu'entre onglets du même navigateur/même appareil — deux utilisateurs sur deux machines différentes ne recevraient leurs messages qu'au prochain rechargement, pas "en temps réel". Le hook `onPoll` désormais câblé est le point d'extension exact où brancher un vrai polling réseau ou un remplacement WebSocket/SSE le jour où un backend existera — l'architecture est prête, mais son exécution actuelle (dans un `DataStore` 100% en mémoire par onglet) ne peut pas, par construction, découvrir un message envoyé depuis un autre appareil.

## 5. Cohérence du système Kanban par rôle

⚪ **Faible** — **Corrigé** (vérifié)

- Les 6 vues (colonnes, liste, calendrier, en retard, bloquées, terminées) partagent la même logique `applyFilters()`/`refresh()` sur les 3 topologies de tableau (central agrégé, personnel filtré, pôle partagé) — testé avec assertions de comptage exact de cartes par rôle dans les phases précédentes.
- Cloisonnement des tableaux personnels vérifié : un mentoré ne voit que ses propres cartes (`ownerId` filtré sur `selfOwned`), pas celles des autres mentorés du même tableau-modèle partagé.
- Résolution des avatars staff vs utilisateur correcte via `resolveUser()` (préfixe `staff-`).

## 6. Traçabilité des actions (journal d'audit)

🟠 **Élevée** — **Corrigé** (travail principal de cette session)

C'était le chantier central de cette phase :
- Création de `assets/js/core/audit.js` (`AuditLog.record()`) centralisant le schéma d'entrée : `actorId/actorName/actorRole`, `module`, `action`, `targetType/targetId`, `before/after`, `result`, `details`, `date`.
- **11 sites d'écriture** retrofités depuis l'ancien schéma minimal (`DataStore.insert("auditLog", {...})` sans rôle ni before/after) : documents, matching (×3), modération logements/messages/opportunités, permissions, ressources (+bannières), paramètres système (×2), tickets admin (×2), utilisateurs (×4), tickets staff (×1).
- **Bug corrigé dans 6 fichiers** : le `before` capturé dans plusieurs handlers reflétait en réalité déjà le nouvel état, car l'objet muté par référence (`doc`, `m`, `listing`, `report`, `opp`, `target`) était lu *après* la mutation. Corrigé partout en capturant l'état précédent (`const previousStatus = obj.status`) **avant** toute écriture.
- **Trou comblé** : la fin d'incarnation (`stopImpersonation`) n'émettait *aucune* entrée d'audit — seul le démarrage était tracé. Ajouté dans `assets/js/ui/layout.js` (bouton "Revenir à mon compte admin"), avec récupération du nom admin d'origine.
- `core/audit.js` ajouté aux **73 pages** qui chargent `ui/layout.js` (celui-ci en dépend désormais pour le nouveau log de fin d'incarnation).
- Vérifié en navigateur : suspension de compte, changement de permission et incarnation écrivent des entrées conformes au nouveau schéma (voir capture de test : `actorRole`, `module`, `before`/`after` bien renseignés).

🟡 **Limitation documentée** : comme tout `DataStore`, le journal d'audit n'est **pas persisté sur disque** — il vit en mémoire par chargement de page et disparaît à la navigation/au reload. Un vrai backend devra écrire ces entrées dans une table `audit_log` immuable (voir `database/schema.sql`, Phase 7 à venir).

## 7. Accessibilité

🟡 **Moyenne** — **Reporté** (traité en Phase 6)

- Seuls 14 fichiers HTML sur 73 utilisent `aria-label` actuellement — couverture partielle.
- Le menu d'accueil actuel est textuel (pas encore l'inventaire d'icônes accessible demandé). C'est explicitement l'objet de la **Phase 6** à venir (icônes + alt/tooltip + navigation clavier + aria-labels + mobile + pas de code couleur seul) — non traité dans cette phase d'audit pour éviter de dupliquer le travail.
- Points positifs déjà en place : `DCUtils.escapeHtml` systématique limitant les risques d'injection qui casseraient un lecteur d'écran ; boutons avec libellés textuels visibles (pas d'icône seule sans texte) sur la plupart des actions admin.

## 8. Navigation

⚪ **Faible** — **Reporté** (lié au point 7 / Phase 6)

- Navigation cohérente par rôle (sidebar staff dynamique selon `accessLevel`, navbar publique distincte). Pas de lien mort trouvé lors des sweeps automatisés des phases précédentes.
- Le passage à un menu d'accueil iconographique (Phase 6) devra être vérifié pour ne pas régresser cette cohérence.

## 9. Performance frontend

🟡 **Moyenne** — **Reporté**

- Chaque page charge une dizaine à une quinzaine de scripts synchrones (`core/*`, `engine/*`, `ui/*`, `pages/*`) sans `defer`/`async`, un par un — acceptable pour un prototype de cette taille (pas de bundling), mais ne passerait pas à l'échelle sans concaténation/minification ou passage à un bundler.
- `DataStore` met en cache par clé après premier chargement (`cache[key]`), évitant les requêtes réseau redondantes dans une même session de page — bon réflexe déjà en place.
- Pas d'images lourdes non optimisées identifiées (le projet utilise principalement des icônes Bootstrap Icons et des avatars générés en CSS).

## 10. Structure SQL

🟡 **Moyenne** — **Reporté** (objet de la Phase 7)

- `database/schema.sql` existe (74 tables, 19 types enum), déjà mis à jour par le script de renommage global de la Phase 1 (`filleul`/`parrain` → `mentore`/`mentor` dans les valeurs d'enum et commentaires) mais **non re-vérifié ligne à ligne** dans cette session.
- Reste à confirmer explicitement (Phase 7) : les relations remontant les cartes Kanban personnelles vers le tableau admin central, le lien cartes ↔ enregistrements métier, messages ↔ conversations/signalements, et l'historisation des actions sensibles côté SQL (miroir du `AuditLog` frontend).

## 11. Cohérence des données JSON

🟢 **Corrigé / vérifié** — aucune anomalie trouvée

Contrôle d'intégrité référentielle automatisé exécuté sur l'ensemble des fichiers mock (users, mentors, mentees, staff, matchings, boards, lists, cards, card_activity, messages, notifications, reports, tickets, documents, housing, opportunities, departments) : **0 référence orpheline détectée** parmi les relations suivantes :
- `mentors.userId` / `mentees.userId` / `staff.userId` → `users`
- `staff.department` → `departments`
- `matchings.mentorId/menteeId` → `mentors`/`mentees`
- `lists.boardId`, `cards.boardId/listId` → `boards`/`lists`
- `cards.ownerId` (users/mentors/mentees) et `cards.assignees` (staff/users)
- `card_activity.cardId` → `cards`
- `messages[].participants`/`messages[].messages[].senderId` → `users`
- `notifications.userId`, `reports.reporterId`, `tickets.assignedTo`/`targetService`, `documents.ownerId`, `housing.ownerId`, `opportunities.publisherId` → cibles correspondantes

## 12. Logique admin

🟢 **Corrigé / vérifié**

- L'admin peut créer des cartes pour n'importe quel rôle (sélecteur de tableau/propriétaire/assigné dynamique dans la modale de création), voir/réassigner toutes les tâches, agir sur tous les modules (documents, matching, modération, utilisateurs, tickets, ressources, paramètres) — vérifié fonctionnellement dans les phases précédentes et de nouveau lors des tests d'audit de cette session.
- Chaque action sensible admin passe désormais par `AuditLog.record()` avec le rôle de l'acteur correctement typé (`"admin"`), donc traçable de bout en bout (point 6).

## 13. Logique super admin

🟢 **Corrigé / vérifié**

- `FULL_ACCESS_ROLES` inclut `"super_admin"` (accessLevel staff), qui outrepasse toute restriction RBAC comme `"admin"`. Le "super dashboard" central agrège tous les tableaux/rôles (Phase 3).
- L'incarnation ("impersonation simulée par rôle") est fonctionnelle et désormais tracée à l'ouverture **et** à la fermeture (correction de cette session).

## 14. Permissions par module

🟢 **Corrigé / vérifié**

`RBAC.MODULES` couvre 14 modules (users, mentorship, housing, opportunities, tickets, moderation, content, documents, kanban, settings, permissions, audit, reports, calendar), chacun avec une grille d'actions par rôle staff dans `MATRIX`. La page `admin/permissions.html` permet de visualiser/modifier cette grille par rôle (simulation mémoire, non persistée — cohérent avec le reste du mock) et chaque modification est maintenant auditée avec l'état avant/après exact de la permission togglée.

## 15. Permissions par action

🟢 **Corrigé / vérifié**

`RBAC.ACTIONS` = read/create/update/delete/assign/validate/moderate/export/impersonate. `RBAC.can(roleKey, module, action)` est le point d'entrée unique utilisé par les écrans admin pour afficher/masquer les boutons, désormais également par les 5 tableaux Kanban pour leur `canCreate` (voir point 2, corrigé).

## 16. Exposition des données publiques

Voir le constat prioritaire en tête de document — 🔴 **Critique**, **limitation documentée**, non corrigible sans backend réel.

## 17. Gestion des erreurs

🟢 **Corrigé / vérifié**

- `DataStore.load()` capture les échecs `fetch` (`res.ok` check + `.catch`), logue en `console.error`, et propage l'erreur — mais **aucune page n'interceptait cela pour afficher un message d'erreur utilisateur** (pas de toast, pas d'état de repli visible).
- ✅ **Corrigé** de façon centralisée (plutôt qu'en dupliquant un `try/catch` dans chacun des ~73 `init()` de page) : `assets/js/core/data-store.js`, dans le `.catch()` unique de `load()`, ajoute désormais un `DCUtils.toast(...)` visible en cas d'échec de chargement, en plus du `console.error` existant — puisque `DataStore` est le point d'accès unique à toutes les données, ce correctif couvre automatiquement toutes les pages sans les modifier une à une.

## 18. Validations frontend

Voir point 3 — corrigé : le seul gap réel trouvé (formulaire paramètres système) est comblé.

## 19. Risques d'abus / dérive

🟠 **Élevée** — **Limitation documentée** (structurelle) + gaps applicatifs **corrigés**

- Le risque le plus sérieux reste l'exposition publique des données JSON (point 16), qui rend tout "cloisonnement par rôle" strictement cosmétique en l'absence de backend — un attaquant n'a jamais besoin de contourner l'UI, il lui suffit d'appeler l'URL du fichier de données. Non corrigible sans backend réel.
- ✅ **Corrigé** : auto-suspension admin possible sans garde-fou (point 1).
- `RBAC.toggle()` et les mutations `settings`/`permissions` ne sont jamais persistées au-delà du cache mémoire de l'onglet — un admin "malveillant" ne peut donc pas dégrader durablement les permissions d'un rôle dans ce prototype (la mutation se perd au reload), ce qui limite involontairement ce vecteur de dérive dans le contexte actuel.

## 20. Points faibles d'architecture

- 🔴 Absence de backend = absence de toute sécurité réelle des données (point 16), c'est le point faible structurant de tout le reste — **non corrigible côté frontend**, prérequis pour toute mise en production.
- ✅ Duplication de règles métier RBAC vs `canCreate` codé en dur dans les pages Kanban (point 2/15) — corrigée.
- ✅ Hook `onPoll` de `MessagingTransport` câblé (point 4) — reste toutefois un filet de secours limité par l'absence de backend (voir limitation documentée au point 4).
- ✅ État d'erreur utilisateur ajouté en cas d'échec de chargement de données (point 17).

---

## Synthèse des corrections effectuées dans cette session

**Premier passage (journal d'audit + XSS + cohérence JSON) :**
1. Créé `assets/js/core/audit.js` — schéma d'audit centralisé et standardisé.
2. Retrofité 11 sites d'écriture d'audit (7 fichiers admin + 1 fichier staff) vers `AuditLog.record()`.
3. Corrigé un bug de capture `before`/`after` (ordre lecture/mutation inversé) dans 6 fichiers.
4. Ajouté la trace d'audit manquante à la fin d'incarnation (`layout.js`), absente jusqu'ici.
5. Ajouté `<script src=".../core/audit.js">` aux 73 pages chargeant `ui/layout.js`.
6. Corrigé une faille XSS réelle : la bannière d'annonce publique (`layout.js`, `mountSiteBanner`) injectait `title`/`body` non échappés — désormais passés par `DCUtils.escapeHtml`.
7. Corrigé une coquille de style : `AUDIENCE_LABELS.mentor` contenait un doublon résiduel du renommage ("Mentors / mentors" → "Mentors").
8. Sweep XSS sur 139 sites `innerHTML =` du projet : un seul gap réel trouvé (point 6 ci-dessus).
9. Contrôle d'intégrité référentielle automatisé sur 15+ relations inter-fichiers JSON : 0 anomalie.
10. Vérification en navigateur (suspension de compte, permission togglée, incarnation démarrée/arrêtée) confirmant que les nouvelles entrées d'audit s'écrivent avec le schéma complet et sans erreur console.

**Second passage (traitement de tous les points restés "Reportés") :**
11. **Auto-suspension admin** (point 1) : bouton désactivé sur sa propre ligne + garde-fous dans les handlers de suspension et d'édition de rôle/statut (`page-admin-utilisateurs.js`). Vérifié en navigateur.
12. **`canCreate` Kanban** (points 2/15) : les 5 pages `page-*-kanban.js` dérivent désormais `canCreate` de `RBAC.can()`/`RBAC.hasFullAccess()` au lieu d'un `true` codé en dur ; `core/rbac.js` ajouté aux 4 pages qui ne le chargeaient pas. Vérifié en navigateur pour 3 rôles différents.
13. **Formulaire "Paramètres système" sans validation** (points 3/18) : ajout des attributs `name`, des blocs d'erreur et d'un schéma `FormValidation` complet. Bonus : suppression d'un `max="2"` codé en dur qui plafonnait injustement le quota mentorés/mentor à sa valeur initiale.
14. **Hook `onPoll` jamais câblé** (point 4) : implémenté via une fonction `pollResync()` dans `messaging-thread.js`, appelée toutes les 4s comme filet de secours si un évènement `BroadcastChannel` est manqué. Vérifié en navigateur (aucune erreur sur plusieurs cycles).
15. **Aucun état d'erreur utilisateur sur échec de chargement** (point 17) : ajout d'un `DCUtils.toast()` centralisé dans `DataStore.load()`, couvrant toutes les pages sans les modifier individuellement.
16. Bump du cache-bust (`?v=15` → `?v=16` → `?v=17`) sur l'ensemble des fichiers HTML pour refléter tous les changements JS/HTML de cette phase.

## Volontairement non traité (hors périmètre même après ce second passage)

- **Accessibilité du menu** — objet explicite de la Phase 6, qui suit immédiatement ; traiter ici aurait dupliqué ce travail.
- **Performance/bundling** (point 9) — non prioritaire pour un prototype de démonstration, pas un défaut fonctionnel.
- **Vérification ligne à ligne de `database/schema.sql`** — objet explicite de la Phase 7.
- **Exposition publique des données JSON** (point 16) et **absence de vraie sécurité des comptes** (point 1, hash/2FA/expiration) — non corrigibles sans un vrai backend ; ce sont des limitations structurelles du prototype, pas des oublis.
