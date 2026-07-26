<?php
require_once __DIR__ . '/../lib/auth.php';

const DC_USERS_TEMP_PASSWORD = 'changeme123'; // compte créé par un admin : à faire changer par l'utilisateur (hors périmètre de ce prototype)

function dc_route_users(array $segments, string $method): void {
  $sub = $segments[0] ?? null;

  if ($sub === 'me' && $method === 'GET') {
    $user = dc_require_auth();
    dc_json($user);
  }

  if ($sub === null && $method === 'GET') {
    $user = dc_require_auth();
    $isPrivileged = in_array($user['role'], ['admin', 'staff'], true);
    $stmt = dc_pdo()->query('SELECT * FROM users ORDER BY created_at');
    $rows = array_map(function ($row) use ($isPrivileged, $user) {
      $u = dc_to_client_user($row);
      if (!$isPrivileged && $row['id'] !== $user['id']) {
        unset($u['email'], $u['phone']);
      }
      return $u;
    }, $stmt->fetchAll());
    dc_json($rows);
  }

  if ($sub === null && $method === 'POST') {
    dc_require_auth();
    dc_require_rbac('users', 'create');
    $body = dc_body();
    $firstName = $body['firstName'] ?? '';
    $lastName = $body['lastName'] ?? '';
    $email = $body['email'] ?? '';
    $role = $body['role'] ?? '';
    if (!$firstName || !$lastName || !$email || !$role) dc_error('Champs requis manquants.', 400);

    $pdo = dc_pdo();
    $existing = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $existing->execute([strtolower($email)]);
    if ($existing->fetch()) dc_error('Un compte existe déjà avec cet email.', 409);

    $id = dc_next_id('u');
    $initials = strtoupper(($firstName[0] ?? '') . ($lastName[0] ?? ''));
    $passwordHash = password_hash(DC_USERS_TEMP_PASSWORD, PASSWORD_BCRYPT);
    $avatarColor = sprintf('hsl(%d,45%%,35%%)', random_int(0, 359));

    $stmt = $pdo->prepare(
      'INSERT INTO users (id, role, first_name, last_name, email, password_hash, phone, city, status, verified, avatar_initials, avatar_color, created_at, last_login_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NULL)'
    );
    $stmt->execute([
      $id, $role, $firstName, $lastName, strtolower($email), $passwordHash,
      $body['phone'] ?? null, $body['city'] ?? null, $body['status'] ?? 'actif', !empty($body['verified']) ? 1 : 0,
      $initials, $avatarColor,
    ]);
    $userStmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $userStmt->execute([$id]);
    dc_json(dc_to_client_user($userStmt->fetch()), 201);
  }

  if ($sub !== null && $method === 'PUT') {
    $user = dc_require_auth();
    $targetId = $sub;
    $isSelf = $targetId === $user['id'];
    $isPrivileged = $user['role'] === 'admin';
    if (!$isSelf && !$isPrivileged) dc_error('Action non autorisée.', 403);

    $body = dc_body();
    $allowedFields = $isPrivileged
      ? ['firstName', 'lastName', 'email', 'phone', 'city', 'role', 'status', 'verified']
      : ['firstName', 'lastName', 'phone', 'city'];
    $colMap = [
      'firstName' => 'first_name', 'lastName' => 'last_name', 'email' => 'email', 'phone' => 'phone',
      'city' => 'city', 'role' => 'role', 'status' => 'status', 'verified' => 'verified',
    ];

    $setCols = [];
    $values = [];
    foreach ($allowedFields as $field) {
      if (array_key_exists($field, $body)) {
        $values[] = $field === 'email' ? strtolower($body[$field]) : $body[$field];
        $setCols[] = "{$colMap[$field]} = ?";
      }
    }
    if (!$setCols) dc_error('Aucun champ modifiable fourni.', 400);
    $values[] = $targetId;
    $pdo = dc_pdo();
    $pdo->prepare('UPDATE users SET ' . implode(', ', $setCols) . ' WHERE id = ?')->execute($values);
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$targetId]);
    $row = $stmt->fetch();
    if (!$row) dc_error('Utilisateur introuvable.', 404);
    dc_json(dc_to_client_user($row));
  }

  dc_error('Route API introuvable.', 404);
}
