const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db/pool");
const { requireAuth, toClientUser } = require("../middleware/auth");
const { recordAudit } = require("../lib/audit");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ ok: false, message: "Adresse email invalide." });
  if (!password || password.length < 6) return res.status(400).json({ ok: false, message: "Le mot de passe doit contenir au moins 6 caractères." });

  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
  const row = rows[0];
  if (!row) return res.status(401).json({ ok: false, message: "Aucun compte ne correspond à cet email sur cette démo." });
  if (row.status === "suspendu") return res.status(403).json({ ok: false, message: "Ce compte a été suspendu par l'administration. Contactez le support." });

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) return res.status(401).json({ ok: false, message: "Email ou mot de passe incorrect." });

  await pool.query("UPDATE users SET last_login_at = now() WHERE id = $1", [row.id]);
  req.session.user = { id: row.id, role: row.role };
  delete req.session.impersonation;
  res.json({ ok: true, user: toClientUser(row) });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.post("/register", async (req, res) => {
  const { firstName, lastName, email, password, phone, city, role } = req.body || {};
  if (!firstName || !lastName || !email || !EMAIL_RE.test(email)) return res.status(400).json({ ok: false, message: "Champs invalides." });
  if (!password || password.length < 6) return res.status(400).json({ ok: false, message: "Le mot de passe doit contenir au moins 6 caractères." });
  if (!["mentore", "mentor", "proprietaire"].includes(role)) return res.status(400).json({ ok: false, message: "Rôle invalide." });

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
  if (existing.rows.length) return res.status(409).json({ ok: false, message: "Un compte existe déjà avec cet email." });

  const id = `u-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
  const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
  const colors = ["#1F3A5F", "#5B4B8A", "#0E7C61", "#B23A48", "#B8860B", "#2F6F4E"];
  const avatarColor = colors[Math.abs([...email].reduce((a, c) => a + c.charCodeAt(0), 0)) % colors.length];
  const passwordHash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(
    `INSERT INTO users (id, role, first_name, last_name, email, password_hash, phone, city, status, verified, avatar_initials, avatar_color, created_at, last_login_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'actif',false,$9,$10, now(), now()) RETURNING *`,
    [id, role, firstName, lastName, email.toLowerCase(), passwordHash, phone || null, city || null, initials, avatarColor]
  );
  req.session.user = { id, role };
  delete req.session.impersonation;
  res.json({ ok: true, user: toClientUser(rows[0]) });
});

router.get("/session", requireAuth, (req, res) => {
  const impersonation = req.session.impersonation
    ? {
        targetUserId: req.session.impersonation.targetUserId,
        targetLabel: req.session.impersonation.targetLabel,
        targetRole: req.session.impersonation.targetRole,
        startedAt: req.session.impersonation.startedAt,
      }
    : null;
  res.json({ user: req.user, impersonation });
});

// Route spécifique enregistrée AVANT /impersonate/:targetId — sinon Express matche
// "/impersonate/stop" comme targetId="stop" sur la route générique ci-dessous.
router.post("/impersonate/stop", requireAuth, async (req, res) => {
  const info = req.session.impersonation;
  if (!info) return res.status(400).json({ ok: false, message: "Aucune incarnation en cours." });

  req.session.user = { id: info.adminId, role: info.adminRole };
  delete req.session.impersonation;

  await recordAudit({
    actorId: info.adminId, actorName: info.adminLabel, actorRole: info.adminRole,
    module: "users", action: "impersonation_terminee", targetType: "user", targetId: info.targetUserId,
    before: { impersonating: info.targetUserId, role: info.targetRole }, after: null,
    details: `Incarnation de ${info.targetLabel} (${info.targetRole}) terminée, retour au compte administrateur.`,
  });

  res.json({ ok: true });
});

router.post("/impersonate/:targetId", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ ok: false, message: "Seul un administrateur peut incarner un autre compte." });
  if (req.session.impersonation) return res.status(409).json({ ok: false, message: "Une incarnation est déjà en cours." });

  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [req.params.targetId]);
  const target = rows[0];
  if (!target) return res.status(404).json({ ok: false, message: "Utilisateur introuvable." });
  if (target.role === "admin") return res.status(400).json({ ok: false, message: "Impossible d'incarner un autre compte administrateur." });

  req.session.impersonation = {
    adminId: req.user.id,
    adminLabel: `${req.user.firstName} ${req.user.lastName}`,
    adminRole: req.user.role,
    targetUserId: target.id,
    targetLabel: `${target.first_name} ${target.last_name}`,
    targetRole: target.role,
    startedAt: new Date().toISOString(),
  };
  req.session.user = { id: target.id, role: target.role };

  await recordAudit({
    actorId: req.user.id, actorName: `${req.user.firstName} ${req.user.lastName}`, actorRole: req.user.role,
    module: "users", action: "impersonation_demarree", targetType: "user", targetId: target.id,
    before: null, after: { impersonating: target.id, role: target.role },
    details: `Incarnation de ${target.first_name} ${target.last_name} (${target.role}) démarrée par l'administration.`,
  });

  res.json({ ok: true, target: toClientUser(target) });
});

module.exports = router;
