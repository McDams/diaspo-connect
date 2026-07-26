<?php
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/audit.php';

function dc_audit_row(array $row): array {
  return [
    'id' => $row['id'], 'actorId' => $row['actor_id'], 'actorName' => $row['actor_name'], 'actorRole' => $row['actor_role'],
    'module' => $row['module'], 'action' => $row['action'], 'targetType' => $row['target_type'], 'targetId' => $row['target_id'],
    'before' => $row['before_data'] ? json_decode($row['before_data'], true) : null,
    'after' => $row['after_data'] ? json_decode($row['after_data'], true) : null,
    'result' => $row['result'], 'details' => $row['details'], 'date' => $row['created_at'],
  ];
}

function dc_route_audit_log(array $segments, string $method): void {
  if ($method === 'GET') {
    dc_require_auth();
    dc_require_rbac('audit', 'read');
    $stmt = dc_pdo()->query('SELECT * FROM audit_log ORDER BY created_at DESC');
    dc_json(array_map('dc_audit_row', $stmt->fetchAll()));
  }

  if ($method === 'POST') {
    $user = dc_require_auth();
    $body = dc_body();
    if (empty($body['action'])) dc_error('action requise.', 400);
    dc_record_audit([
      'actorId' => $user['id'], 'actorName' => "{$user['firstName']} {$user['lastName']}", 'actorRole' => $user['role'],
      'module' => $body['module'] ?? null, 'action' => $body['action'], 'targetType' => $body['targetType'] ?? null,
      'targetId' => $body['targetId'] ?? null, 'before' => $body['before'] ?? null, 'after' => $body['after'] ?? null,
      'result' => $body['result'] ?? null, 'details' => $body['details'] ?? null,
    ]);
    dc_json(['ok' => true], 201);
  }

  dc_error('Route API introuvable.', 404);
}
