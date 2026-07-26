<?php
require_once __DIR__ . '/db.php';

/**
 * Écrit une entrée d'audit. Comme côté Node, la route dédiée POST /api/audit-log
 * écrase toujours les champs acteur avec l'identité de la session authentifiée
 * — jamais celle fournie par le client — pour empêcher toute usurpation du
 * journal d'audit.
 */
function dc_record_audit(array $entry): void {
  $stmt = dc_pdo()->prepare(
    'INSERT INTO audit_log (id, actor_id, actor_name, actor_role, module, action, target_type, target_id, before_data, after_data, result, details)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  $stmt->execute([
    dc_next_id('audit'),
    $entry['actorId'] ?? null,
    $entry['actorName'] ?? null,
    $entry['actorRole'] ?? null,
    $entry['module'] ?? ($entry['targetType'] ?? null),
    $entry['action'],
    $entry['targetType'] ?? null,
    $entry['targetId'] ?? null,
    isset($entry['before']) && $entry['before'] !== null ? json_encode($entry['before'], JSON_UNESCAPED_UNICODE) : null,
    isset($entry['after']) && $entry['after'] !== null ? json_encode($entry['after'], JSON_UNESCAPED_UNICODE) : null,
    $entry['result'] ?? 'success',
    $entry['details'] ?? null,
  ]);
}
