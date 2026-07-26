<?php
require_once __DIR__ . '/../lib/auth.php';

// Ressource singleton (une seule ligne, key='app') : DataStore.getSettings() attend un objet, pas un tableau.
function dc_route_settings(array $segments, string $method): void {
  $key = $segments[0] ?? null;
  if (!$key) dc_error('Clé de paramètres requise.', 400);
  $pdo = dc_pdo();

  if ($method === 'GET') {
    dc_require_auth();
    dc_require_rbac('settings', 'read');
    $stmt = $pdo->prepare('SELECT data FROM settings WHERE `key` = ?');
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    if (!$row) dc_error('Paramètres introuvables.', 404);
    dc_json(json_decode($row['data'], true));
  }

  if ($method === 'PUT') {
    dc_require_auth();
    dc_require_rbac('settings', 'update');
    $stmt = $pdo->prepare('SELECT data FROM settings WHERE `key` = ?');
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    if (!$row) dc_error('Paramètres introuvables.', 404);
    $merged = array_merge(json_decode($row['data'], true), dc_body());
    $pdo->prepare('UPDATE settings SET data = ? WHERE `key` = ?')->execute([json_encode($merged, JSON_UNESCAPED_UNICODE), $key]);
    dc_json($merged);
  }

  dc_error('Route API introuvable.', 404);
}
