<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/rbac.php';

/**
 * Port PHP de server/routes/resource-factory.js : gère GET (liste)/POST/PUT/DELETE
 * pour les tables "document" (id + colonnes indexées + data JSON), avec la même
 * politique d'écriture par verbe que la version Node (any/staff/rbac/owner).
 *
 * $config: table, publicRead, moderationColumn, ownerColumn, ownerField,
 *          scopeOwnerForRoles, rbacModule, writePolicy, allowWrite, indexExtractor
 */
function dc_handle_resource(array $config, ?string $id, string $method): void {
  $table = $config['table'];
  $publicRead = $config['publicRead'] ?? false;
  $moderationColumn = $config['moderationColumn'] ?? null;
  $ownerColumn = $config['ownerColumn'] ?? null;
  $ownerField = $config['ownerField'] ?? null;
  $scopeOwnerForRoles = $config['scopeOwnerForRoles'] ?? [];
  $rbacModule = $config['rbacModule'] ?? null;
  $allowWrite = $config['allowWrite'] ?? true;
  $indexExtractor = $config['indexExtractor'] ?? fn($record) => [];
  $policy = $config['writePolicy'] ?? ['create' => ['rbac'], 'update' => ['rbac'], 'delete' => ['rbac']];

  $pdo = dc_pdo();

  if ($method === 'GET' && $id === null) {
    $user = $publicRead ? dc_try_auth() : dc_require_auth();
    $isPrivileged = $user && in_array($user['role'], ['admin', 'staff'], true);

    $clauses = [];
    $values = [];
    if ($moderationColumn && !$isPrivileged) {
      $clauses[] = "$moderationColumn = ?";
      $values[] = 'validee';
    }
    if ($ownerColumn && $user && in_array($user['role'], $scopeOwnerForRoles, true)) {
      $clauses[] = "$ownerColumn = ?";
      $values[] = $user['id'];
    }
    $where = $clauses ? ('WHERE ' . implode(' AND ', $clauses)) : '';
    $stmt = $pdo->prepare("SELECT data FROM `$table` $where");
    $stmt->execute($values);
    $rows = array_map(fn($r) => json_decode($r['data'], true), $stmt->fetchAll());
    dc_json($rows);
    return;
  }

  if (!$allowWrite) dc_error('Méthode non autorisée.', 405);

  $checkGuard = function (string $action) use ($rbacModule, $ownerColumn, $ownerField, $table, $id, $pdo, $policy) {
    $checks = $policy[$action] ?? ['rbac'];
    $user = $GLOBALS['dc_user'] ?? null;
    foreach ($checks as $check) {
      if ($check === 'any') return true;
      if ($check === 'staff' && $user && in_array($user['role'], ['admin', 'staff'], true)) return true;
      if ($check === 'rbac' && $rbacModule && rbac_can($GLOBALS['dc_rbac_key'] ?? null, $rbacModule, $action)) return true;
      if ($check === 'owner' && $ownerColumn) {
        if ($id !== null) {
          $stmt = $pdo->prepare("SELECT $ownerColumn AS owner FROM `$table` WHERE id = ?");
          $stmt->execute([$id]);
          $row = $stmt->fetch();
          if ($row && $user && $row['owner'] === $user['id']) return true;
        } elseif ($ownerField) {
          $body = dc_body();
          if ($user && ($body[$ownerField] ?? null) === $user['id']) return true;
        }
      }
    }
    return false;
  };

  if ($method === 'POST') {
    dc_require_auth();
    if (!$checkGuard('create')) dc_error("Action non autorisée ($table/create).", 403);
    $record = dc_body();
    if (!$record || empty($record['id'])) dc_error('id requis.', 400);
    $extra = $indexExtractor($record);
    $cols = array_merge(['id'], array_keys($extra), ['data']);
    $placeholders = implode(',', array_fill(0, count($cols), '?'));
    $colList = implode(',', array_map(fn($c) => "`$c`", $cols));
    $values = array_merge([$record['id']], array_values($extra), [json_encode($record, JSON_UNESCAPED_UNICODE)]);
    try {
      $stmt = $pdo->prepare("INSERT INTO `$table` ($colList) VALUES ($placeholders)");
      $stmt->execute($values);
    } catch (PDOException $e) {
      if ($e->getCode() === '23000') dc_error('Identifiant déjà utilisé.', 409);
      throw $e;
    }
    dc_json($record, 201);
    return;
  }

  if ($id === null) dc_error('Identifiant requis.', 400);

  if ($method === 'PUT') {
    dc_require_auth();
    if (!$checkGuard('update')) dc_error("Action non autorisée ($table/update).", 403);
    $stmt = $pdo->prepare("SELECT data FROM `$table` WHERE id = ?");
    $stmt->execute([$id]);
    $current = $stmt->fetch();
    if (!$current) dc_error('Introuvable.', 404);
    $merged = array_merge(json_decode($current['data'], true), dc_body());
    $extra = $indexExtractor($merged);
    $setCols = array_keys($extra);
    $setClause = implode(', ', array_map(fn($c) => "`$c` = ?", $setCols));
    $values = array_merge([json_encode($merged, JSON_UNESCAPED_UNICODE)], array_values($extra), [$id]);
    $query = $setCols
      ? "UPDATE `$table` SET data = ?, $setClause WHERE id = ?"
      : "UPDATE `$table` SET data = ? WHERE id = ?";
    $pdo->prepare($query)->execute($values);
    dc_json($merged);
    return;
  }

  if ($method === 'DELETE') {
    dc_require_auth();
    if (!$checkGuard('delete')) dc_error("Action non autorisée ($table/delete).", 403);
    $stmt = $pdo->prepare("DELETE FROM `$table` WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) dc_error('Introuvable.', 404);
    http_response_code(204);
    exit;
  }

  dc_error('Méthode non autorisée.', 405);
}
