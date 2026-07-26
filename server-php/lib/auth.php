<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/rbac.php';
require_once __DIR__ . '/http.php';

/** Démarre la session PHP avec des cookies httpOnly (+ secure en prod, voir SESSION_SECURE dans .env). */
function dc_session_start(): void {
  if (session_status() === PHP_SESSION_ACTIVE) return;
  session_set_cookie_params([
    'lifetime' => 60 * 60 * 8, // 8h, comme la session Node
    'path' => '/',
    'httponly' => true,
    'secure' => dc_env('SESSION_SECURE', '0') === '1',
    'samesite' => 'Lax',
  ]);
  session_start();
}

function dc_to_client_user(array $row): array {
  return [
    'id' => $row['id'], 'role' => $row['role'], 'firstName' => $row['first_name'], 'lastName' => $row['last_name'],
    'email' => $row['email'], 'phone' => $row['phone'], 'city' => $row['city'], 'status' => $row['status'],
    'verified' => (bool) $row['verified'], 'avatarInitials' => $row['avatar_initials'], 'avatarColor' => $row['avatar_color'],
    'createdAt' => $row['created_at'], 'lastLoginAt' => $row['last_login_at'],
  ];
}

/**
 * Charge l'utilisateur (et sa fiche staff le cas échéant) depuis la session
 * active, et remplit $GLOBALS['dc_user'|'dc_staff'|'dc_rbac_key']. Renvoie
 * null si non authentifié ou compte suspendu (n'interrompt jamais la requête
 * elle-même — c'est aux appelants de décider quoi faire de ce null).
 */
function dc_load_session_user(): ?array {
  dc_session_start();
  if (empty($_SESSION['user'])) return null;

  $stmt = dc_pdo()->prepare('SELECT * FROM users WHERE id = ?');
  $stmt->execute([$_SESSION['user']['id']]);
  $row = $stmt->fetch();
  if (!$row || $row['status'] === 'suspendu') return null;

  $user = dc_to_client_user($row);
  $staff = null;
  $rbacKey = null;

  if ($user['role'] === 'admin') {
    $rbacKey = 'admin';
  } elseif ($user['role'] === 'staff') {
    $staffStmt = dc_pdo()->prepare('SELECT * FROM staff WHERE user_id = ?');
    $staffStmt->execute([$user['id']]);
    $staffRow = $staffStmt->fetch();
    $staff = $staffRow ?: null;
    $rbacKey = $staff ? $staff['access_level'] : 'staff';
  } else {
    $rbacKey = $user['role'];
  }

  $GLOBALS['dc_user'] = $user;
  $GLOBALS['dc_staff'] = $staff;
  $GLOBALS['dc_rbac_key'] = $rbacKey;
  return $user;
}

/** Interrompt la requête (401) si non authentifié/suspendu — mêmes règles que server/middleware/auth.js. */
function dc_require_auth(): array {
  $user = dc_load_session_user();
  if (!$user) dc_error('Non authentifié.', 401);
  return $user;
}

/** Comme dc_require_auth(), mais ne bloque jamais : renvoie null si non authentifié (pages/lectures publiques). */
function dc_try_auth(): ?array {
  return dc_load_session_user();
}

function dc_require_role(string ...$roles): void {
  $user = $GLOBALS['dc_user'] ?? null;
  if (!$user || !in_array($user['role'], $roles, true)) {
    dc_error('Accès refusé pour ce rôle.', 403);
  }
}

function dc_require_rbac(string $module, string $action): void {
  $rbacKey = $GLOBALS['dc_rbac_key'] ?? null;
  if (!rbac_can($rbacKey, $module, $action)) {
    dc_error("Action non autorisée ($module/$action) pour ce rôle.", 403);
  }
}
