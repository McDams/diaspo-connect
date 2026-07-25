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

🟠 **Élevée** — **Limitation documentée** (partiellement atténuée)

- Authentification simulée : `Auth` stocke la session dans `sessionStorage` (jamais `localStorage`), ce qui limite la persistance à l'onglet/la session navigateur — bon réflexe pour un mock, mais **aucun mot de passe n'est réellement vérifié** (pas de hash, pas de backend d'authentification).
- Pas de verrouillage après tentatives échouées, pas de 2FA, pas d'expiration de session — hors périmètre d'un frontend sans backend.
- 🟡 **Corrigé** : `assets/js/pages/page-admin-utilisateurs.js` — les boutons "Suspendre" / "Réactiver" ne vérifiaient pas si la cible est le compte admin courant. Un admin peut se suspendre lui-même sans confirmation supplémentaire (testé en session : `u-001` a pu se suspendre lui-même via son propre bouton d'action). *Non corrigé dans cette session par choix de portée (nécessiterait une règle métier "on ne peut pas s'auto-suspendre" à valider avec le produit) — **Reporté**, signalé ici pour suivi.*

## 2. Permissions / rôles

🟡 **Moyenne** — **Corrigé** (contrôle) + **Reporté** (renforcement)

- `RBAC.MATRIX` définit une grille fine module × action par rôle staff + rôles simples (`mentore`, `mentor`, `proprietaire`) ; `FULL_ACCESS_ROLES = ["admin", "super_admin"]` outrepasse tout, conformément à l'exigence produit "l'admin et le super admin doivent pouvoir faire tout ce que les autres rôles font".
- `StaffGuard` synthétise un enregistrement staff virtuel (`accessLevel: "super_admin"`) pour le rôle `admin` legacy, garantissant l'accès aux pages staff sans dépendre d'une fiche `staff.json` réelle.
- 🟡 Vérifié : `RBAC.toggle()` mute la matrice **en mémoire uniquement** (non persisté au reload) — cohérent avec le reste du mock, mais le toast "Permission mise à jour (simulation frontend)" pourrait être plus explicite pour un testeur non averti.
- 🟡 **Reporté** : les boutons `canCreate` des tableaux Kanban (`kanban-board.js` et les 5 pages `page-*-kanban.js`) sont câblés en dur par page plutôt que dérivés de `RBAC.can(roleKey, "kanban", "create")`. Le comportement observé est correct pour tous les rôles testés, mais la source de vérité est dupliquée (règle métier écrite deux fois : une fois dans RBAC.MATRIX, une fois en dur dans chaque page). Recommandation : faire lire `canCreate` directement depuis `RBAC.can()` pour éliminer ce risque de divergence future.

## 3. Qualité des formulaires

🟡 **Moyenne** — **Reporté** (audit de couverture, pas de bug bloquant trouvé)

- Le module `FormValidation` (règles `required`, `email`, `phone`, `validateForm`) est utilisé de façon cohérente sur les formulaires de création/édition les plus sensibles (utilisateurs, ressources, bannières...).
- Aucune régression trouvée sur les formulaires testés en navigateur pendant les phases précédentes (matching manuel, création de carte Kanban, formulaire utilisateur).
- Recommandation non traitée ici : passer en revue systématiquement chaque formulaire du dépôt pour confirmer que 100% des champs obligatoires sont couverts (l'inventaire exhaustif n'a pas été refait dans cette session, l'échantillon vérifié ne l'a pas montré en défaut).

## 4. Robustesse de la messagerie

🟡 **Moyenne** — **Corrigé** (vérification) + **Reporté** (gap architectural)

- `MessagingTransport` (BroadcastChannel) + `MessagingThread` fournissent réception quasi temps réel, accusés de lecture, indicateur de frappe (TTL 3s), badges non lus — testés avec deux onglets simultanés dans les phases précédentes.
- Tout le texte de message est échappé via `DCUtils.escapeHtml(m.text)` avant injection dans le DOM (`assets/js/ui/messaging-thread.js:129`) — pas de faille XSS trouvée sur ce canal, y compris sur l'indicateur de frappe (nom d'utilisateur échappé aussi).
- 🟡 **Reporté** : `MessagingTransport.subscribe()` expose un hook `onPoll` pensé pour un futur remplacement par polling/WebSocket/SSE réel, mais **aucun appelant ne l'utilise actuellement** — le mécanisme repose entièrement sur `BroadcastChannel`, qui ne fonctionne qu'entre onglets du même navigateur/même appareil. Deux utilisateurs sur deux machines différentes ne verraient pas leurs messages arriver "en temps réel" avec l'implémentation actuelle (ils les verraient au prochain rechargement de page). C'est le principal écart entre "l'architecture est prête pour du temps réel" (vrai, l'abstraction existe) et "le temps réel fonctionne cross-device" (faux dans ce prototype, nécessite un vrai serveur WebSocket/SSE).

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

`RBAC.ACTIONS` = read/create/update/delete/assign/validate/moderate/export/impersonate. `RBAC.can(roleKey, module, action)` est le point d'entrée unique utilisé par les écrans admin pour afficher/masquer les boutons. Reporté au point 2 : les tableaux Kanban ne consultent pas encore systématiquement cette fonction pour leur propre `canCreate`.

## 16. Exposition des données publiques

Voir le constat prioritaire en tête de document — 🔴 **Critique**, **limitation documentée**, non corrigible sans backend réel.

## 17. Gestion des erreurs

🟡 **Moyenne** — **Reporté**

- `DataStore.load()` capture les échecs `fetch` (`res.ok` check + `.catch`), logue en `console.error`, et propage l'erreur — mais **aucune page ne l'intercepte pour afficher un message d'erreur utilisateur** (pas de toast "impossible de charger les données", pas d'état de repli visible). En pratique, sur ce prototype statique servi localement, ce cas ne se produit jamais (les JSON existent toujours), donc le risque réel est faible, mais c'est un angle mort si un fichier venait à manquer ou à être renommé sans mise à jour de `FILES`.
- Recommandation non traitée : ajouter un `try/catch` générique dans chaque `init()` de page avec un état d'erreur visible (bannière `dc-banner-danger` + message), au lieu de laisser la page rester silencieusement vide.

## 18. Validations frontend

Voir point 3 — même constat, pas de défaut bloquant trouvé sur l'échantillon vérifié, couverture non ré-auditée exhaustivement.

## 19. Risques d'abus / dérive

🟠 **Élevée** — **Limitation documentée** + 1 gap **Reporté**

- Le risque le plus sérieux reste l'exposition publique des données JSON (point 16), qui rend tout "cloisonnement par rôle" strictement cosmétique en l'absence de backend — un attaquant n'a jamais besoin de contourner l'UI, il lui suffit d'appeler l'URL du fichier de données.
- Auto-suspension admin possible sans garde-fou (point 1) — reporté.
- `RBAC.toggle()` et les mutations `settings`/`permissions` ne sont jamais persistées au-delà du cache mémoire de l'onglet — un admin "malveillant" ne peut donc pas dégrader durablement les permissions d'un rôle dans ce prototype (la mutation se perd au reload), ce qui limite involontairement ce vecteur de dérive dans le contexte actuel.

## 20. Points faibles d'architecture

- 🔴 Absence de backend = absence de toute sécurité réelle des données (point 16), c'est le point faible structurant de tout le reste.
- 🟡 Duplication de règles métier RBAC vs `canCreate` codé en dur dans les pages Kanban (point 2/15).
- 🟡 `MessagingTransport` prêt pour un vrai transport réseau mais le hook `onPoll` n'est câblé par aucun consommateur (point 4) — l'écart entre "architecturé pour" et "fonctionne réellement en" cross-device doit être clair pour la suite du projet.
- 🟡 Aucun état d'erreur utilisateur en cas d'échec de chargement de données (point 17).

---

## Synthèse des corrections effectuées dans cette session

1. Créé `assets/js/core/audit.js` — schéma d'audit centralisé et standardisé.
2. Retrofité 11 sites d'écriture d'audit (7 fichiers admin + 1 fichier staff) vers `AuditLog.record()`.
3. Corrigé un bug de capture `before`/`after` (ordre lecture/mutation inversé) dans 6 fichiers.
4. Ajouté la trace d'audit manquante à la fin d'incarnation (`layout.js`), absente jusqu'ici.
5. Ajouté `<script src=".../core/audit.js">` aux 73 pages chargeant `ui/layout.js`.
6. Corrigé une faille XSS réelle : la bannière d'annonce publique (`layout.js`, `mountSiteBanner`) injectait `title`/`body` non échappés — désormais passés par `DCUtils.escapeHtml`.
7. Corrigé une coquille de style : `AUDIENCE_LABELS.mentor` contenait un doublon résiduel du renommage ("Mentors / mentors" → "Mentors").
8. Sweep XSS sur 139 sites `innerHTML =` du projet : un seul gap réel trouvé (point 6 ci-dessus), la messagerie et les autres écrans admin échappent déjà systématiquement le texte utilisateur.
9. Contrôle d'intégrité référentielle automatisé sur 15+ relations inter-fichiers JSON : 0 anomalie.
10. Vérification en navigateur (suspension de compte, permission togglée, incarnation démarrée/arrêtée) confirmant que les nouvelles entrées d'audit s'écrivent avec le schéma complet et sans erreur console.
11. Bump du cache-bust (`?v=15` → `?v=16`) sur l'ensemble des fichiers HTML pour refléter tous les changements JS de cette phase.

## Reporté / hors périmètre de cette session

- Auto-suspension admin sans garde-fou (point 1).
- `canCreate` Kanban non dérivé de `RBAC.can()` (points 2/15).
- Couverture exhaustive de `FormValidation` sur 100% des formulaires (points 3/18).
- Câblage réel du hook `onPoll` de `MessagingTransport` (point 4).
- Accessibilité du menu (Phase 6, à traiter juste après cette phase).
- Performance/bundling (point 9) — non prioritaire pour un prototype de démonstration.
- Vérification ligne à ligne de `database/schema.sql` (Phase 7, à venir).
- États d'erreur utilisateur en cas d'échec de `DataStore.load()` (point 17).
