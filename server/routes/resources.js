const express = require("express");
const createResourceRouter = require("./resource-factory");

const router = express.Router();

// --- Mentors / mentées : annuaire public en lecture, auto-service en écriture ---
router.use("/mentors", createResourceRouter({
  table: "mentors", publicRead: true, ownerColumn: "user_id", ownerField: "userId",
  writePolicy: { create: ["owner", "staff"], update: ["owner", "staff"], delete: ["staff"] },
  indexExtractor: (r) => ({ user_id: r.userId }),
}));
router.use("/mentees", createResourceRouter({
  table: "mentees", ownerColumn: "user_id", ownerField: "userId",
  writePolicy: { create: ["owner", "staff"], update: ["owner", "staff"], delete: ["staff"] },
  indexExtractor: (r) => ({ user_id: r.userId }),
}));

// --- Logements / offres : annonces publiques (visibles filtrées "validée"), gérées par leur propriétaire + modération staff ---
router.use("/housing", createResourceRouter({
  table: "housing", publicRead: true, moderationColumn: "moderation_status",
  ownerColumn: "owner_id", ownerField: "ownerId", rbacModule: "housing",
  writePolicy: { create: ["owner", "rbac"], update: ["owner", "rbac"], delete: ["rbac"] },
  indexExtractor: (r) => ({ owner_id: r.ownerId, moderation_status: r.moderationStatus }),
}));
router.use("/opportunities", createResourceRouter({
  table: "opportunities", publicRead: true, moderationColumn: "moderation_status",
  ownerColumn: "publisher_id", ownerField: "publisherId", rbacModule: "opportunities",
  writePolicy: { create: ["owner", "rbac"], update: ["owner", "rbac"], delete: ["rbac"] },
  indexExtractor: (r) => ({ publisher_id: r.publisherId, moderation_status: r.moderationStatus }),
}));

// --- Signalements : n'importe qui d'authentifié peut signaler, seule la modération staff résout ---
router.use("/reports", createResourceRouter({
  table: "reports", rbacModule: "moderation",
  writePolicy: { create: ["any"], update: ["rbac"], delete: ["rbac"] },
  indexExtractor: (r) => ({ reporter_id: r.reporterId, status: r.status }),
}));

// --- Matchings : accepté/refusé par le mentor concerné, créé/réassigné par l'admin.
// L'identité "propriétaire" (mentorId/menteeId = id de FICHE, pas d'utilisateur) n'est pas
// résolue ici par simplicité : toute personne authentifiée peut créer/modifier un matching,
// ce qui reste une amélioration nette par rapport à l'accès public actuel, mais n'isole pas
// parfaitement les binômes entre eux (limite documentée, cf. résumé de fin de session).
router.use("/matchings", createResourceRouter({
  table: "matchings", rbacModule: "mentorship",
  writePolicy: { create: ["any"], update: ["any"], delete: ["rbac"] },
  indexExtractor: (r) => ({ mentor_id: r.mentorId, mentee_id: r.menteeId, status: r.status }),
}));

// --- Ressources publiques (guides/FAQ) et bannières : lecture publique, écriture staff "content" ---
router.use("/resources", createResourceRouter({
  table: "resources", publicRead: true, rbacModule: "content",
}));
router.use("/announcements", createResourceRouter({
  table: "announcements", publicRead: true, rbacModule: "content",
}));

// --- Notifications : strictement personnelles, jamais visibles pour un autre utilisateur ---
router.use("/notifications", createResourceRouter({
  table: "notifications", ownerColumn: "user_id", ownerField: "userId", scopeOwnerForRoles: ["mentore", "mentor", "proprietaire", "staff", "admin"],
  writePolicy: { create: ["any"], update: ["owner", "staff"], delete: ["owner", "staff"] },
  indexExtractor: (r) => ({ user_id: r.userId }),
}));

// --- Staff / départements : espace interne, lecture pour tout authentifié, écriture admin ---
router.use("/staff", createResourceRouter({
  table: "staff", rbacModule: "users",
  writePolicy: { create: ["rbac"], update: ["rbac", "owner"], delete: ["rbac"] },
  ownerColumn: "user_id", ownerField: "userId",
  indexExtractor: (r) => ({ user_id: r.userId, department: r.department, access_level: r.accessLevel }),
}));
router.use("/departments", createResourceRouter({ table: "departments", allowWrite: false }));
router.use("/org-chart", createResourceRouter({ table: "org_chart", allowWrite: false }));
router.use("/public-team", createResourceRouter({ table: "public_team", publicRead: true, allowWrite: false }));

// --- Tickets : espace interne, assignation/réassignation par le staff ---
router.use("/tickets", createResourceRouter({
  table: "tickets", rbacModule: "tickets",
  writePolicy: { create: ["any"], update: ["rbac"], delete: ["rbac"] },
  indexExtractor: (r) => ({ assigned_to: r.assignedTo, target_service: r.targetService, status: r.status }),
}));
router.use("/contact-requests", createResourceRouter({
  table: "contact_requests", publicRead: true,
  writePolicy: { create: ["any"], update: ["staff"], delete: ["staff"] },
}));

// --- Permissions (visibilité des modules staff par accessLevel) : lecture interne seule, jamais éditée en ligne ---
router.use("/permissions", createResourceRouter({ table: "permissions", allowWrite: false }));

// --- Kanban : cartes/listes/tableaux/labels/activité ---
router.use("/boards", createResourceRouter({ table: "boards", allowWrite: false }));
router.use("/lists", createResourceRouter({ table: "lists", allowWrite: false, indexExtractor: (r) => ({ board_id: r.boardId }) }));
router.use("/labels", createResourceRouter({ table: "labels", allowWrite: false }));
router.use("/cards", createResourceRouter({
  table: "cards", ownerColumn: "owner_id", ownerField: "ownerId",
  writePolicy: { create: ["owner", "staff"], update: ["owner", "staff"], delete: ["owner", "staff"] },
  indexExtractor: (r) => ({ board_id: r.boardId, list_id: r.listId, owner_id: r.ownerId, status: r.status }),
}));
router.use("/card-activity", createResourceRouter({
  table: "card_activity", writePolicy: { create: ["any"], update: ["staff"], delete: ["staff"] },
  indexExtractor: (r) => ({ card_id: r.cardId }),
}));

// --- Documents : privés au propriétaire, validés par la conformité staff ---
router.use("/documents", createResourceRouter({
  table: "documents", ownerColumn: "owner_id", ownerField: "ownerId", rbacModule: "documents",
  scopeOwnerForRoles: ["mentore", "mentor", "proprietaire"],
  writePolicy: { create: ["owner", "rbac"], update: ["rbac"], delete: ["rbac"] },
  indexExtractor: (r) => ({ owner_id: r.ownerId, status: r.status }),
}));

module.exports = router;
