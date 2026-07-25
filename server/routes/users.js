const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db/pool");
const { requireAuth, requireRbac, toClientUser } = require("../middleware/auth");

const router = express.Router();

const TEMP_PASSWORD = "changeme123"; // compte créé par un admin : à faire changer par l'utilisateur (hors périmètre de ce prototype)

// Liste : authentifié requis (fermé au public, contrairement aux JSON statiques d'origine).
// Les emails/téléphones (PII) ne sont renvoyés qu'à l'admin/staff — les autres rôles
// voient seulement ce qui est nécessaire à l'affichage (nom, avatar, rôle, ville).
router.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM users ORDER BY created_at");
  const isPrivileged = req.user.role === "admin" || req.user.role === "staff";
  res.json(rows.map((row) => {
    const u = toClientUser(row);
    if (!isPrivileged && row.id !== req.user.id) {
      delete u.email;
      delete u.phone;
    }
    return u;
  }));
});

router.get("/me", requireAuth, (req, res) => res.json(req.user));

router.post("/", requireAuth, requireRbac("users", "create"), async (req, res) => {
  const { firstName, lastName, email, phone, city, role, status, verified } = req.body || {};
  if (!firstName || !lastName || !email || !role) return res.status(400).json({ error: "Champs requis manquants." });
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
  if (existing.rows.length) return res.status(409).json({ error: "Un compte existe déjà avec cet email." });

  const id = `u-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
  const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (id, role, first_name, last_name, email, password_hash, phone, city, status, verified, avatar_initials, avatar_color, created_at, last_login_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now(), null) RETURNING *`,
    [id, role, firstName, lastName, email.toLowerCase(), passwordHash, phone || null, city || null,
      status || "actif", !!verified, initials, `hsl(${Math.floor(Math.random() * 360)},45%,35%)`]
  );
  res.status(201).json(toClientUser(rows[0]));
});

router.put("/:id", requireAuth, async (req, res) => {
  const isSelf = req.params.id === req.user.id;
  const isPrivileged = req.user.role === "admin";
  if (!isSelf && !isPrivileged) return res.status(403).json({ error: "Action non autorisée." });

  const patch = req.body || {};
  // Un utilisateur ne peut jamais changer son propre rôle/statut/vérification — seul l'admin le peut.
  const allowedFields = isPrivileged
    ? ["firstName", "lastName", "email", "phone", "city", "role", "status", "verified"]
    : ["firstName", "lastName", "phone", "city"];
  const colMap = { firstName: "first_name", lastName: "last_name", email: "email", phone: "phone", city: "city", role: "role", status: "status", verified: "verified" };

  const setCols = [];
  const values = [];
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      values.push(field === "email" ? String(patch[field]).toLowerCase() : patch[field]);
      setCols.push(`${colMap[field]} = $${values.length}`);
    }
  }
  if (!setCols.length) return res.status(400).json({ error: "Aucun champ modifiable fourni." });
  values.push(req.params.id);
  const { rows } = await pool.query(`UPDATE users SET ${setCols.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
  if (!rows.length) return res.status(404).json({ error: "Utilisateur introuvable." });
  res.json(toClientUser(rows[0]));
});

module.exports = router;
