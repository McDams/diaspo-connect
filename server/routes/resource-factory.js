const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const RBAC = require("../../assets/js/core/rbac.js");

/**
 * Fabrique de routeur REST générique pour les tables "document" (id + quelques
 * colonnes indexées + data JSONB). Couvre la majorité des ressources qui,
 * côté frontend, étaient de simples fichiers JSON statiques : `DataStore`
 * continue de recevoir exactement la même forme de tableau d'objets, mais
 * désormais authentifiée et validée côté serveur au lieu d'être un fichier
 * public.
 *
 * options:
 *  - table: nom de la table SQL.
 *  - publicRead: si true, GET ne nécessite pas d'authentification (pages publiques : logements, offres, ressources...).
 *  - moderationColumn: colonne à filtrer sur 'validee' pour les visiteurs non authentifiés / non staff.
 *  - ownerColumn / ownerField: colonne SQL et champ JSON portant le propriétaire d'une ligne (ex. 'owner_id' / 'ownerId').
 *  - scopeOwnerForRoles: rôles simples pour lesquels la LECTURE est TOUJOURS filtrée sur ownerColumn = req.user.id (ex. notifications).
 *  - rbacModule: module RBAC.MATRIX utilisé par le check 'rbac' (voir writePolicy).
 *  - writePolicy: { create, update, delete } — chacun un tableau de vérifications parmi
 *      'any' (tout utilisateur authentifié), 'staff' (admin/staff uniquement),
 *      'rbac' (RBAC.can(rbacKey, rbacModule, action)), 'owner' (propriétaire de la ligne,
 *      ou du futur enregistrement à la création). Une seule vérification qui passe suffit (OR).
 *      Par défaut : ['rbac'] pour les trois verbes.
 *  - allowWrite: si false, aucune route d'écriture n'est montée (ressources gérées uniquement via seed, ex. org_chart/public_team/boards/lists/labels).
 *  - indexExtractor(record): dérive les colonnes indexées à partir de l'enregistrement JSON (id compris) pour l'INSERT/UPDATE.
 */
function createResourceRouter(options) {
  const {
    table, publicRead = false, moderationColumn = null,
    ownerColumn = null, ownerField = null, scopeOwnerForRoles = [],
    rbacModule = null, writePolicy = {}, allowWrite = true,
    indexExtractor = () => ({}),
  } = options;
  const router = express.Router();

  const policy = {
    create: writePolicy.create || ["rbac"],
    update: writePolicy.update || ["rbac"],
    delete: writePolicy.delete || ["rbac"],
  };

  function maybeAuth(req, res, next) {
    if (publicRead) return next();
    return requireAuth(req, res, next);
  }

  async function checkOwner(req) {
    if (!ownerColumn) return false;
    if (req.params.id) {
      const { rows } = await pool.query(`SELECT ${ownerColumn} AS owner FROM ${table} WHERE id = $1`, [req.params.id]);
      return rows.length && rows[0].owner === req.user.id;
    }
    return !!(ownerField && req.body && req.body[ownerField] === req.user.id);
  }

  function writeGuard(action) {
    const checks = policy[action];
    return async (req, res, next) => {
      for (const check of checks) {
        if (check === "any") return next();
        if (check === "staff" && (req.user.role === "admin" || req.user.role === "staff")) return next();
        if (check === "rbac" && rbacModule && RBAC.can(req.rbacKey, rbacModule, action)) return next();
        if (check === "owner" && (await checkOwner(req))) return next();
      }
      return res.status(403).json({ error: `Action non autorisée (${table}/${action}).` });
    };
  }

  router.get("/", maybeAuth, async (req, res) => {
    const clauses = [];
    const values = [];
    const isPrivileged = req.user && (req.user.role === "admin" || req.user.role === "staff");

    if (moderationColumn && !isPrivileged) {
      values.push("validee");
      clauses.push(`${moderationColumn} = $${values.length}`);
    }
    if (ownerColumn && req.user && scopeOwnerForRoles.includes(req.user.role)) {
      values.push(req.user.id);
      clauses.push(`${ownerColumn} = $${values.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const { rows } = await pool.query(`SELECT data FROM ${table} ${where}`, values);
    res.json(rows.map((r) => r.data));
  });

  if (!allowWrite) return router;

  router.post("/", requireAuth, writeGuard("create"), async (req, res) => {
    const record = req.body;
    if (!record || !record.id) return res.status(400).json({ error: "id requis." });
    const extra = indexExtractor(record);
    const cols = ["id", ...Object.keys(extra), "data"];
    const values = [record.id, ...Object.values(extra), JSON.stringify(record)];
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");
    try {
      await pool.query(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`, values);
      res.status(201).json(record);
    } catch (err) {
      if (err.code === "23505") return res.status(409).json({ error: "Identifiant déjà utilisé." });
      throw err;
    }
  });

  router.put("/:id", requireAuth, writeGuard("update"), async (req, res) => {
    const patch = req.body || {};
    const current = await pool.query(`SELECT data FROM ${table} WHERE id = $1`, [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ error: "Introuvable." });
    const merged = { ...current.rows[0].data, ...patch };
    const extra = indexExtractor(merged);
    const setCols = Object.keys(extra);
    const setClause = setCols.map((c, i) => `${c} = $${i + 2}`).join(", ");
    const query = setCols.length
      ? `UPDATE ${table} SET data = $1, ${setClause} WHERE id = $${setCols.length + 2} RETURNING data`
      : `UPDATE ${table} SET data = $1 WHERE id = $2 RETURNING data`;
    const values = setCols.length
      ? [JSON.stringify(merged), ...Object.values(extra), req.params.id]
      : [JSON.stringify(merged), req.params.id];
    const { rows } = await pool.query(query, values);
    res.json(rows[0].data);
  });

  router.delete("/:id", requireAuth, writeGuard("delete"), async (req, res) => {
    const { rowCount } = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Introuvable." });
    res.status(204).end();
  });

  return router;
}

module.exports = createResourceRouter;
