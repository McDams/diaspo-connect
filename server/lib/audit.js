const pool = require("../db/pool");

function genId() {
  return `audit-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
}

/**
 * Écrit une entrée d'audit. Utilisé directement par les routes qui déclenchent
 * elles-mêmes une action sensible (ex. impersonation) et par la route dédiée
 * POST /api/audit-log (voir routes/audit-log.js), qui écrase toujours les
 * champs acteur avec l'identité de la session authentifiée — jamais celle
 * fournie par le client, pour empêcher toute usurpation du journal d'audit.
 */
async function recordAudit({ actorId, actorName, actorRole, module, action, targetType, targetId, before, after, result, details }) {
  await pool.query(
    `INSERT INTO audit_log (id, actor_id, actor_name, actor_role, module, action, target_type, target_id, before, after, result, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [genId(), actorId || null, actorName || null, actorRole || null, module || targetType || null, action,
      targetType || null, targetId || null, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null,
      result || "success", details || null]
  );
}

module.exports = { recordAudit };
