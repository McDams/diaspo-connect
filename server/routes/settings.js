const express = require("express");
const pool = require("../db/pool");
const { requireAuth, requireRbac } = require("../middleware/auth");

const router = express.Router();

// Ressource singleton (une seule ligne, key='app') : DataStore.getSettings() attend un objet, pas un tableau.
router.get("/:key", requireAuth, requireRbac("settings", "read"), async (req, res) => {
  const { rows } = await pool.query("SELECT data FROM settings WHERE key = $1", [req.params.key]);
  if (!rows.length) return res.status(404).json({ error: "Paramètres introuvables." });
  res.json(rows[0].data);
});

router.put("/:key", requireAuth, requireRbac("settings", "update"), async (req, res) => {
  const current = await pool.query("SELECT data FROM settings WHERE key = $1", [req.params.key]);
  if (!current.rows.length) return res.status(404).json({ error: "Paramètres introuvables." });
  const merged = { ...current.rows[0].data, ...req.body };
  await pool.query("UPDATE settings SET data = $1 WHERE key = $2", [JSON.stringify(merged), req.params.key]);
  res.json(merged);
});

module.exports = router;
