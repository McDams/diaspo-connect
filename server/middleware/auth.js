const pool = require("../db/pool");
const RBAC = require("../../assets/js/core/rbac.js");

function toClientUser(row) {
  if (!row) return null;
  return {
    id: row.id, role: row.role, firstName: row.first_name, lastName: row.last_name,
    email: row.email, phone: row.phone, city: row.city, status: row.status, verified: row.verified,
    avatarInitials: row.avatar_initials, avatarColor: row.avatar_color,
    createdAt: row.created_at, lastLoginAt: row.last_login_at,
  };
}

/** Charge l'utilisateur (et sa fiche staff le cas échéant) à partir de la session active. Rejette silencieusement si absent/suspendu. */
async function requireAuth(req, res, next) {
  const sessionUser = req.session.user;
  if (!sessionUser) return res.status(401).json({ error: "Non authentifié." });
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [sessionUser.id]);
  const row = rows[0];
  if (!row || row.status === "suspendu") {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Session invalide ou compte suspendu." });
  }
  req.user = toClientUser(row);

  if (req.user.role === "admin") {
    req.rbacKey = "admin";
    req.staff = null;
  } else if (req.user.role === "staff") {
    const staffRes = await pool.query("SELECT * FROM staff WHERE user_id = $1", [req.user.id]);
    req.staff = staffRes.rows[0] || null;
    req.rbacKey = req.staff ? req.staff.access_level : "staff";
  } else {
    req.rbacKey = req.user.role;
    req.staff = null;
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé pour ce rôle." });
    }
    next();
  };
}

/** Vérifie RBAC.can(rbacKey, module, action) — même grille que le frontend, appliquée réellement ici. */
function requireRbac(module, action) {
  return (req, res, next) => {
    if (RBAC.can(req.rbacKey, module, action)) return next();
    return res.status(403).json({ error: `Action non autorisée (${module}/${action}) pour ce rôle.` });
  };
}

module.exports = { requireAuth, requireRole, requireRbac, toClientUser };
