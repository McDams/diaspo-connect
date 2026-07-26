<?php
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/audit.php';

const DC_EMAIL_RE = '/^[^\s@]+@[^\s@]+\.[^\s@]+$/';

function dc_route_auth(array $segments, string $method): void {
  dc_session_start();
  $action = $segments[0] ?? '';

  if ($action === 'login' && $method === 'POST') {
    $body = dc_body();
    $email = $body['email'] ?? '';
    $password = $body['password'] ?? '';
    if (!$email || !preg_match(DC_EMAIL_RE, $email)) dc_json(['ok' => false, 'message' => 'Adresse email invalide.'], 400);
    if (!$password || strlen($password) < 6) dc_json(['ok' => false, 'message' => 'Le mot de passe doit contenir au moins 6 caractères.'], 400);

    $pdo = dc_pdo();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([strtolower($email)]);
    $row = $stmt->fetch();
    if (!$row) dc_json(['ok' => false, 'message' => 'Aucun compte ne correspond à cet email sur cette démo.'], 401);
    if ($row['status'] === 'suspendu') dc_json(['ok' => false, 'message' => "Ce compte a été suspendu par l'administration. Contactez le support."], 403);
    if (!password_verify($password, $row['password_hash'])) dc_json(['ok' => false, 'message' => 'Email ou mot de passe incorrect.'], 401);

    $pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$row['id']]);
    $_SESSION['user'] = ['id' => $row['id'], 'role' => $row['role']];
    unset($_SESSION['impersonation']);
    dc_json(['ok' => true, 'user' => dc_to_client_user($row)]);
  }

  if ($action === 'logout' && $method === 'POST') {
    $_SESSION = [];
    session_destroy();
    dc_json(['ok' => true]);
  }

  if ($action === 'register' && $method === 'POST') {
    $body = dc_body();
    $firstName = $body['firstName'] ?? '';
    $lastName = $body['lastName'] ?? '';
    $email = $body['email'] ?? '';
    $password = $body['password'] ?? '';
    $phone = $body['phone'] ?? null;
    $city = $body['city'] ?? null;
    $role = $body['role'] ?? '';

    if (!$firstName || !$lastName || !$email || !preg_match(DC_EMAIL_RE, $email)) dc_json(['ok' => false, 'message' => 'Champs invalides.'], 400);
    if (!$password || strlen($password) < 6) dc_json(['ok' => false, 'message' => 'Le mot de passe doit contenir au moins 6 caractères.'], 400);
    if (!in_array($role, ['mentore', 'mentor', 'proprietaire'], true)) dc_json(['ok' => false, 'message' => 'Rôle invalide.'], 400);

    $pdo = dc_pdo();
    $existing = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $existing->execute([strtolower($email)]);
    if ($existing->fetch()) dc_json(['ok' => false, 'message' => 'Un compte existe déjà avec cet email.'], 409);

    $id = dc_next_id('u');
    $initials = strtoupper(($firstName[0] ?? '') . ($lastName[0] ?? ''));
    $colors = ['#1F3A5F', '#5B4B8A', '#0E7C61', '#B23A48', '#B8860B', '#2F6F4E'];
    $avatarColor = $colors[abs(crc32($email)) % count($colors)];
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);

    $stmt = $pdo->prepare(
      'INSERT INTO users (id, role, first_name, last_name, email, password_hash, phone, city, status, verified, avatar_initials, avatar_color, created_at, last_login_at)
       VALUES (?,?,?,?,?,?,?,?,\'actif\',0,?,?,NOW(),NOW())'
    );
    $stmt->execute([$id, $role, $firstName, $lastName, strtolower($email), $passwordHash, $phone, $city, $initials, $avatarColor]);

    $userStmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $userStmt->execute([$id]);
    $_SESSION['user'] = ['id' => $id, 'role' => $role];
    unset($_SESSION['impersonation']);
    dc_json(['ok' => true, 'user' => dc_to_client_user($userStmt->fetch())]);
  }

  if ($action === 'session' && $method === 'GET') {
    $user = dc_try_auth();
    $impersonation = null;
    if (!empty($_SESSION['impersonation'])) {
      $info = $_SESSION['impersonation'];
      $impersonation = [
        'targetUserId' => $info['targetUserId'], 'targetLabel' => $info['targetLabel'],
        'targetRole' => $info['targetRole'], 'startedAt' => $info['startedAt'],
      ];
    }
    dc_json(['user' => $user, 'impersonation' => $impersonation]);
  }

  if ($action === 'impersonate' && $method === 'POST') {
    $targetId = $segments[1] ?? null;

    // Route spécifique enregistrée AVANT le cas général — sinon /impersonate/stop
    // serait traité comme targetId="stop" (même piège que côté Node, corrigé ici directement).
    if ($targetId === 'stop') {
      $user = dc_require_auth();
      $info = $_SESSION['impersonation'] ?? null;
      if (!$info) dc_json(['ok' => false, 'message' => 'Aucune incarnation en cours.'], 400);

      $_SESSION['user'] = ['id' => $info['adminId'], 'role' => $info['adminRole']];
      unset($_SESSION['impersonation']);

      dc_record_audit([
        'actorId' => $info['adminId'], 'actorName' => $info['adminLabel'], 'actorRole' => $info['adminRole'],
        'module' => 'users', 'action' => 'impersonation_terminee', 'targetType' => 'user', 'targetId' => $info['targetUserId'],
        'before' => ['impersonating' => $info['targetUserId'], 'role' => $info['targetRole']], 'after' => null,
        'details' => "Incarnation de {$info['targetLabel']} ({$info['targetRole']}) terminée, retour au compte administrateur.",
      ]);
      dc_json(['ok' => true]);
    }

    $user = dc_require_auth();
    if ($user['role'] !== 'admin') dc_json(['ok' => false, 'message' => "Seul un administrateur peut incarner un autre compte."], 403);
    if (!empty($_SESSION['impersonation'])) dc_json(['ok' => false, 'message' => 'Une incarnation est déjà en cours.'], 409);

    $pdo = dc_pdo();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$targetId]);
    $target = $stmt->fetch();
    if (!$target) dc_json(['ok' => false, 'message' => 'Utilisateur introuvable.'], 404);
    if ($target['role'] === 'admin') dc_json(['ok' => false, 'message' => "Impossible d'incarner un autre compte administrateur."], 400);

    $_SESSION['impersonation'] = [
      'adminId' => $user['id'], 'adminLabel' => "{$user['firstName']} {$user['lastName']}", 'adminRole' => $user['role'],
      'targetUserId' => $target['id'], 'targetLabel' => "{$target['first_name']} {$target['last_name']}",
      'targetRole' => $target['role'], 'startedAt' => date('c'),
    ];
    $_SESSION['user'] = ['id' => $target['id'], 'role' => $target['role']];

    dc_record_audit([
      'actorId' => $user['id'], 'actorName' => "{$user['firstName']} {$user['lastName']}", 'actorRole' => $user['role'],
      'module' => 'users', 'action' => 'impersonation_demarree', 'targetType' => 'user', 'targetId' => $target['id'],
      'before' => null, 'after' => ['impersonating' => $target['id'], 'role' => $target['role']],
      'details' => "Incarnation de {$target['first_name']} {$target['last_name']} ({$target['role']}) démarrée par l'administration.",
    ]);
    dc_json(['ok' => true, 'target' => dc_to_client_user($target)]);
  }

  dc_error('Route API introuvable.', 404);
}
