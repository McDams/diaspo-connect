const express = require("express");
const pool = require("../db/pool");
const { requireAuth, requireRbac } = require("../middleware/auth");
const { recordAudit } = require("../lib/audit");

const router = express.Router();

function toClient(row) {
  return {
    id: row.id, actorId: row.actor_id, actorName: row.actor_name, actorRole: row.actor_role,
    module: row.module, action: row.action, targetType: row.target_type, targetId: row.target_id,
    before: row.before, after: row.after, result: row.result, details: row.details, date: row.created_at,
  };
}

router.get("/", requireAuth, requireRbac("audit", "read"), async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM audit_log ORDER BY created_at DESC");
  res.json(rows.map(toClient));
});

// Écriture : l'identité de l'acteur vient TOUJOURS de la session authentifiée,
// jamais du corps de la requête — un client ne peut pas usurper qui a fait quoi.
router.post("/", requireAuth, async (req, res) => {
  const { module, action, targetType, targetId, before, after, result, details } = req.body || {};
  if (!action) return res.status(400).json({ error: "action requise." });
  await recordAudit({
    actorId: req.user.id, actorName: `${req.user.firstName} ${req.user.lastName}`, actorRole: req.user.role,
    module, action, targetType, targetId, before, after, result, details,
  });
  res.status(201).json({ ok: true });
});

module.exports = router;
