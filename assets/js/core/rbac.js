/**
 * RBAC - permissions fines par module et par action, distinctes de
 * `Permissions` (qui gère uniquement la visibilité des pages dans la
 * sidebar interne). RBAC répond à la question "cet utilisateur a-t-il le
 * droit de faire CETTE action sur CE module ?" - utilisé par les écrans
 * admin pour afficher/masquer boutons et actions de masse.
 *
 * `role` (u-001 = "admin") et `staff.accessLevel === "super_admin"` ont,
 * par exigence produit, la main sur tout : aucune restriction ne s'applique.
 * Remplaçable demain par une vraie table role_permissions / user_roles côté API.
 */
const RBAC = (() => {
  const ACTIONS = ["read", "create", "update", "delete", "assign", "validate", "moderate", "export", "impersonate"];
  const FULL_ACCESS_ROLES = ["admin", "super_admin"];

  // roleKey -> { module: [actions] }. Un module absent = aucun droit.
  const MATRIX = {
    direction_admin: {
      users: ["read", "update", "validate", "export"],
      mentorship: ["read", "assign", "validate", "export"],
      housing: ["read", "validate", "export"],
      opportunities: ["read", "validate", "export"],
      tickets: ["read", "assign", "export"],
      moderation: ["read", "moderate", "export"],
      content: ["read", "export"],
      documents: ["read", "validate", "export"],
      kanban: ["read", "create", "update", "assign", "export"],
      settings: ["read"],
      permissions: ["read"],
      audit: ["read", "export"],
      reports: ["read", "export"],
      calendar: ["read"],
    },
    secretariat_admin: {
      users: ["read"],
      mentorship: ["read", "assign"],
      housing: ["read"],
      opportunities: ["read"],
      tickets: ["read", "create", "update", "assign"],
      documents: ["read", "update"],
      kanban: ["read", "create", "update", "assign"],
      calendar: ["read"],
    },
    advisor_admin: {
      mentorship: ["read", "update"],
      tickets: ["read", "update"],
      documents: ["read"],
      kanban: ["read", "create", "update"],
      calendar: ["read"],
    },
    housing_admin: {
      housing: ["read", "update", "validate", "moderate"],
      tickets: ["read", "update"],
      documents: ["read"],
      kanban: ["read", "create", "update"],
      calendar: ["read"],
    },
    career_admin: {
      opportunities: ["read", "update", "validate", "moderate"],
      tickets: ["read", "update"],
      documents: ["read"],
      kanban: ["read", "create", "update"],
      calendar: ["read"],
    },
    moderation_admin: {
      moderation: ["read", "create", "update", "moderate"],
      users: ["read", "update"],
      tickets: ["read", "update"],
      kanban: ["read", "create", "update"],
      calendar: ["read"],
    },
    support_admin: {
      tickets: ["read", "create", "update", "assign"],
      users: ["read"],
      kanban: ["read", "create", "update"],
      calendar: ["read"],
    },
    partnership_admin: {
      tickets: ["read", "update"],
      kanban: ["read", "create", "update"],
      calendar: ["read"],
    },
    content_admin: {
      content: ["read", "create", "update", "delete"],
      kanban: ["read", "create", "update"],
      calendar: ["read"],
    },
    compliance_admin: {
      documents: ["read", "update", "validate"],
      users: ["read", "validate"],
      housing: ["read", "validate"],
      opportunities: ["read", "validate"],
      kanban: ["read", "create", "update"],
      calendar: ["read"],
    },
    technical_admin: {
      settings: ["read", "update"],
      audit: ["read"],
      kanban: ["read", "create", "update"],
      calendar: ["read"],
    },
    mentore: { kanban: ["read", "create", "update"] },
    mentor: { kanban: ["read", "create", "update"] },
    proprietaire: { kanban: ["read", "create", "update"] },
  };

  /** Détermine la clé RBAC d'un utilisateur : "admin"/"super_admin" (accès total), accessLevel staff, ou rôle simple. */
  function roleKeyFor(user, staffRecord) {
    if (!user) return null;
    if (user.role === "admin") return "admin";
    if (user.role === "staff" && staffRecord) return staffRecord.accessLevel;
    return user.role;
  }

  function can(roleKey, module, action) {
    if (!roleKey) return false;
    if (FULL_ACCESS_ROLES.includes(roleKey)) return true;
    const modulePerms = MATRIX[roleKey]?.[module];
    return !!modulePerms && modulePerms.includes(action);
  }

  function hasFullAccess(roleKey) {
    return FULL_ACCESS_ROLES.includes(roleKey);
  }

  function actionsFor(roleKey, module) {
    if (FULL_ACCESS_ROLES.includes(roleKey)) return ACTIONS.slice();
    return (MATRIX[roleKey]?.[module] || []).slice();
  }

  /** Bascule une permission (module, action) pour un rôle - mutation en mémoire uniquement (simulation admin). */
  function toggle(roleKey, module, action) {
    if (FULL_ACCESS_ROLES.includes(roleKey)) return; // accès total non modifiable
    if (!MATRIX[roleKey]) MATRIX[roleKey] = {};
    if (!MATRIX[roleKey][module]) MATRIX[roleKey][module] = [];
    const list = MATRIX[roleKey][module];
    const idx = list.indexOf(action);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(action);
  }

  const ROLE_LABELS = {
    direction_admin: "Direction", secretariat_admin: "Secrétariat", advisor_admin: "Conseiller démarches",
    housing_admin: "Conseillère logement", career_admin: "Conseiller emploi", moderation_admin: "Modération & confiance",
    support_admin: "Support utilisateur", partnership_admin: "Partenariats", content_admin: "Contenu & ressources",
    compliance_admin: "Conformité & vérification", technical_admin: "Technique",
    mentore: "Mentoré", mentor: "Mentor", proprietaire: "Propriétaire",
  };
  const MODULES = ["users", "mentorship", "housing", "opportunities", "tickets", "moderation", "content", "documents", "kanban", "settings", "permissions", "audit", "reports", "calendar"];

  return { ACTIONS, MODULES, ROLE_LABELS, MATRIX, roleKeyFor, can, hasFullAccess, actionsFor, toggle };
})();

// Partagé avec le serveur Node (server/middleware/rbac.js) pour une seule source
// de vérité entre le contrôle d'affichage côté client et l'application réelle
// des droits côté serveur. N'affecte pas l'usage navigateur (RBAC reste global).
if (typeof module !== "undefined" && module.exports) {
  module.exports = RBAC;
}
