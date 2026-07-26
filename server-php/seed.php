<?php
/**
 * Migre les données mock assets/data/*.json vers MySQL. Idempotent : vide
 * toutes les tables avant réinsertion (usage dev/premier déploiement
 * uniquement — ne JAMAIS relancer sur une base contenant de vraies données).
 * Tous les comptes seedés reçoivent le mot de passe démo "demo1234" (hashé).
 *
 * Lancement recommandé en CLI : php seed.php
 * (server-php/ est bloqué en accès web par .htaccess — voir server-php/README.md
 * si SSH n'est pas disponible sur l'hébergement.)
 */
require_once __DIR__ . '/lib/db.php';

const DC_DATA_DIR = __DIR__ . '/../assets/data';
const DC_DEMO_PASSWORD = 'demo1234';

function dc_read_json(string $name): array {
  $raw = file_get_contents(DC_DATA_DIR . "/$name.json");
  return json_decode($raw, true);
}

function dc_truncate_all(PDO $pdo): void {
  $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
  $tables = [
    'conversation_messages', 'conversations', 'audit_log',
    'mentors', 'mentees', 'housing', 'opportunities', 'reports', 'matchings', 'resources',
    'notifications', 'staff', 'departments', 'tickets', 'contact_requests', 'public_team',
    'permissions', 'org_chart', 'boards', 'lists', 'cards', 'labels', 'card_activity',
    'documents', 'announcements', 'settings', 'users',
  ];
  foreach ($tables as $t) $pdo->exec("TRUNCATE TABLE `$t`");
  $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
}

function dc_seed_users(PDO $pdo): void {
  $users = dc_read_json('users');
  $hash = password_hash(DC_DEMO_PASSWORD, PASSWORD_BCRYPT);
  $stmt = $pdo->prepare(
    'INSERT INTO users (id, role, first_name, last_name, email, password_hash, phone, city, status, verified, avatar_initials, avatar_color, created_at, last_login_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  foreach ($users as $u) {
    $stmt->execute([
      $u['id'], $u['role'], $u['firstName'], $u['lastName'], strtolower($u['email']), $hash,
      $u['phone'] ?? null, $u['city'] ?? null, $u['status'] ?? 'actif', !empty($u['verified']) ? 1 : 0,
      $u['avatarInitials'] ?? null, $u['avatarColor'] ?? null,
      $u['createdAt'] ?? date('c'), $u['lastLoginAt'] ?? null,
    ]);
  }
  echo '  users: ' . count($users) . "\n";
}

function dc_seed_document_table(PDO $pdo, string $table, string $jsonName, ?callable $extraCols = null, string $idField = 'id'): void {
  $rows = dc_read_json($jsonName);
  foreach ($rows as $r) {
    $extra = $extraCols ? $extraCols($r) : [];
    $cols = array_merge(['id'], array_keys($extra), ['data']);
    $colList = implode(',', array_map(fn($c) => "`$c`", $cols));
    $placeholders = implode(',', array_fill(0, count($cols), '?'));
    $values = array_merge([$r[$idField]], array_values($extra), [json_encode($r, JSON_UNESCAPED_UNICODE)]);
    $pdo->prepare("INSERT INTO `$table` ($colList) VALUES ($placeholders)")->execute($values);
  }
  echo "  $table: " . count($rows) . "\n";
}

function dc_seed_permissions(PDO $pdo): void {
  $rows = dc_read_json('permissions');
  $stmt = $pdo->prepare('INSERT INTO permissions (access_level, data) VALUES (?,?)');
  foreach ($rows as $r) $stmt->execute([$r['accessLevel'], json_encode($r, JSON_UNESCAPED_UNICODE)]);
  echo '  permissions: ' . count($rows) . "\n";
}

function dc_seed_settings(PDO $pdo): void {
  $settings = dc_read_json('settings');
  $pdo->prepare('INSERT INTO settings (`key`, data) VALUES (\'app\', ?)')->execute([json_encode($settings, JSON_UNESCAPED_UNICODE)]);
  echo "  settings: 1\n";
}

function dc_seed_messages(PDO $pdo): void {
  $conversations = dc_read_json('messages');
  $msgCount = 0;
  $convStmt = $pdo->prepare('INSERT INTO conversations (id, matching_id, participants, last_message_at) VALUES (?,?,?,?)');
  $msgStmt = $pdo->prepare('INSERT INTO conversation_messages (id, conversation_id, sender_id, text, sent_at, is_read, read_at, flagged) VALUES (?,?,?,?,?,?,?,?)');
  foreach ($conversations as $c) {
    $convStmt->execute([$c['id'], $c['matchingId'] ?? null, json_encode($c['participants']), $c['lastMessageAt'] ?? null]);
    foreach ($c['messages'] ?? [] as $m) {
      $msgStmt->execute([
        $m['id'], $c['id'], $m['senderId'], $m['text'], $m['sentAt'],
        !empty($m['read']) ? 1 : 0, $m['readAt'] ?? null, !empty($m['flagged']) ? 1 : 0,
      ]);
      $msgCount++;
    }
  }
  echo '  conversations: ' . count($conversations) . " (messages: $msgCount)\n";
}

function dc_seed_audit_log(PDO $pdo): void {
  $rows = dc_read_json('audit-log');
  $stmt = $pdo->prepare(
    'INSERT INTO audit_log (id, actor_id, actor_name, actor_role, module, action, target_type, target_id, before_data, after_data, result, details, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  foreach ($rows as $r) {
    $stmt->execute([
      $r['id'], $r['actorId'] ?? null, $r['actorName'] ?? null, $r['actorRole'] ?? null, $r['module'] ?? null, $r['action'],
      $r['targetType'] ?? null, $r['targetId'] ?? null,
      isset($r['before']) ? json_encode($r['before'], JSON_UNESCAPED_UNICODE) : null,
      isset($r['after']) ? json_encode($r['after'], JSON_UNESCAPED_UNICODE) : null,
      $r['result'] ?? 'success', $r['details'] ?? null, $r['date'] ?? date('c'),
    ]);
  }
  echo '  audit_log: ' . count($rows) . "\n";
}

function dc_run_seed(): void {
  $pdo = dc_pdo();
  echo "Truncating existing data...\n";
  dc_truncate_all($pdo);

  echo "Seeding...\n";
  dc_seed_users($pdo);
  dc_seed_document_table($pdo, 'mentors', 'mentors', fn($r) => ['user_id' => $r['userId']]);
  dc_seed_document_table($pdo, 'mentees', 'mentees', fn($r) => ['user_id' => $r['userId']]);
  dc_seed_document_table($pdo, 'housing', 'housing', fn($r) => ['owner_id' => $r['ownerId'], 'moderation_status' => $r['moderationStatus']]);
  dc_seed_document_table($pdo, 'opportunities', 'opportunities', fn($r) => ['publisher_id' => $r['publisherId'], 'moderation_status' => $r['moderationStatus']]);
  dc_seed_document_table($pdo, 'reports', 'reports', fn($r) => ['reporter_id' => $r['reporterId'], 'status' => $r['status']]);
  dc_seed_document_table($pdo, 'matchings', 'matchings', fn($r) => ['mentor_id' => $r['mentorId'], 'mentee_id' => $r['menteeId'], 'status' => $r['status']]);
  dc_seed_document_table($pdo, 'resources', 'resources');
  dc_seed_document_table($pdo, 'notifications', 'notifications', fn($r) => ['user_id' => $r['userId']]);
  dc_seed_document_table($pdo, 'staff', 'staff', fn($r) => ['user_id' => $r['userId'], 'department' => $r['department'], 'access_level' => $r['accessLevel']]);
  dc_seed_document_table($pdo, 'departments', 'departments');
  dc_seed_document_table($pdo, 'tickets', 'tickets', fn($r) => ['assigned_to' => $r['assignedTo'], 'target_service' => $r['targetService'], 'status' => $r['status']]);
  dc_seed_document_table($pdo, 'contact_requests', 'contact-requests');
  dc_seed_document_table($pdo, 'public_team', 'public-team', null, 'staffId');
  dc_seed_permissions($pdo);
  dc_seed_document_table($pdo, 'org_chart', 'org-chart');
  dc_seed_document_table($pdo, 'boards', 'boards');
  dc_seed_document_table($pdo, 'lists', 'lists', fn($r) => ['board_id' => $r['boardId']]);
  dc_seed_document_table($pdo, 'cards', 'cards', fn($r) => ['board_id' => $r['boardId'], 'list_id' => $r['listId'], 'owner_id' => $r['ownerId'], 'status' => $r['status']]);
  dc_seed_document_table($pdo, 'labels', 'labels');
  dc_seed_document_table($pdo, 'card_activity', 'card_activity', fn($r) => ['card_id' => $r['cardId']]);
  dc_seed_document_table($pdo, 'documents', 'documents', fn($r) => ['owner_id' => $r['ownerId'], 'status' => $r['status']]);
  dc_seed_document_table($pdo, 'announcements', 'announcements');
  dc_seed_settings($pdo);
  dc_seed_messages($pdo);
  dc_seed_audit_log($pdo);

  echo "\nSeed terminé. Mot de passe démo pour tous les comptes : \"" . DC_DEMO_PASSWORD . "\"\n";
}

// CLI direct : php seed.php. Web (déconseillé, .htaccess bloque server-php/ de toute façon) :
// nécessiterait de retirer temporairement le "Require all denied" et d'ajouter un jeton.
if (php_sapi_name() === 'cli') {
  dc_run_seed();
}
