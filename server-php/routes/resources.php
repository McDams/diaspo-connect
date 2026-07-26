<?php
require_once __DIR__ . '/../lib/resource.php';

/**
 * Table de dispatch des ressources génériques — même politique que
 * server/routes/resources.js, voir ce fichier pour le commentaire détaillé
 * de chaque choix (public/privé, propriétaire, RBAC).
 */
function dc_resource_configs(): array {
  return [
    'mentors' => [
      'table' => 'mentors', 'publicRead' => true, 'ownerColumn' => 'user_id', 'ownerField' => 'userId',
      'writePolicy' => ['create' => ['owner', 'staff'], 'update' => ['owner', 'staff'], 'delete' => ['staff']],
      'indexExtractor' => fn($r) => ['user_id' => $r['userId'] ?? null],
    ],
    'mentees' => [
      'table' => 'mentees', 'ownerColumn' => 'user_id', 'ownerField' => 'userId',
      'writePolicy' => ['create' => ['owner', 'staff'], 'update' => ['owner', 'staff'], 'delete' => ['staff']],
      'indexExtractor' => fn($r) => ['user_id' => $r['userId'] ?? null],
    ],
    'housing' => [
      'table' => 'housing', 'publicRead' => true, 'moderationColumn' => 'moderation_status',
      'ownerColumn' => 'owner_id', 'ownerField' => 'ownerId', 'rbacModule' => 'housing',
      'writePolicy' => ['create' => ['owner', 'rbac'], 'update' => ['owner', 'rbac'], 'delete' => ['rbac']],
      'indexExtractor' => fn($r) => ['owner_id' => $r['ownerId'] ?? null, 'moderation_status' => $r['moderationStatus'] ?? null],
    ],
    'opportunities' => [
      'table' => 'opportunities', 'publicRead' => true, 'moderationColumn' => 'moderation_status',
      'ownerColumn' => 'publisher_id', 'ownerField' => 'publisherId', 'rbacModule' => 'opportunities',
      'writePolicy' => ['create' => ['owner', 'rbac'], 'update' => ['owner', 'rbac'], 'delete' => ['rbac']],
      'indexExtractor' => fn($r) => ['publisher_id' => $r['publisherId'] ?? null, 'moderation_status' => $r['moderationStatus'] ?? null],
    ],
    'reports' => [
      'table' => 'reports', 'rbacModule' => 'moderation',
      'writePolicy' => ['create' => ['any'], 'update' => ['rbac'], 'delete' => ['rbac']],
      'indexExtractor' => fn($r) => ['reporter_id' => $r['reporterId'] ?? null, 'status' => $r['status'] ?? null],
    ],
    'matchings' => [
      'table' => 'matchings', 'rbacModule' => 'mentorship',
      'writePolicy' => ['create' => ['any'], 'update' => ['any'], 'delete' => ['rbac']],
      'indexExtractor' => fn($r) => ['mentor_id' => $r['mentorId'] ?? null, 'mentee_id' => $r['menteeId'] ?? null, 'status' => $r['status'] ?? null],
    ],
    'resources' => ['table' => 'resources', 'publicRead' => true, 'rbacModule' => 'content'],
    'announcements' => ['table' => 'announcements', 'publicRead' => true, 'rbacModule' => 'content'],
    'notifications' => [
      'table' => 'notifications', 'ownerColumn' => 'user_id', 'ownerField' => 'userId',
      'scopeOwnerForRoles' => ['mentore', 'mentor', 'proprietaire', 'staff', 'admin'],
      'writePolicy' => ['create' => ['any'], 'update' => ['owner', 'staff'], 'delete' => ['owner', 'staff']],
      'indexExtractor' => fn($r) => ['user_id' => $r['userId'] ?? null],
    ],
    'staff' => [
      'table' => 'staff', 'rbacModule' => 'users', 'ownerColumn' => 'user_id', 'ownerField' => 'userId',
      'writePolicy' => ['create' => ['rbac'], 'update' => ['rbac', 'owner'], 'delete' => ['rbac']],
      'indexExtractor' => fn($r) => ['user_id' => $r['userId'] ?? null, 'department' => $r['department'] ?? null, 'access_level' => $r['accessLevel'] ?? null],
    ],
    'departments' => ['table' => 'departments', 'allowWrite' => false],
    'org-chart' => ['table' => 'org_chart', 'allowWrite' => false],
    'public-team' => ['table' => 'public_team', 'publicRead' => true, 'allowWrite' => false],
    'tickets' => [
      'table' => 'tickets', 'rbacModule' => 'tickets',
      'writePolicy' => ['create' => ['any'], 'update' => ['rbac'], 'delete' => ['rbac']],
      'indexExtractor' => fn($r) => ['assigned_to' => $r['assignedTo'] ?? null, 'target_service' => $r['targetService'] ?? null, 'status' => $r['status'] ?? null],
    ],
    'contact-requests' => [
      'table' => 'contact_requests', 'publicRead' => true,
      'writePolicy' => ['create' => ['any'], 'update' => ['staff'], 'delete' => ['staff']],
    ],
    'permissions' => ['table' => 'permissions', 'allowWrite' => false],
    'boards' => ['table' => 'boards', 'allowWrite' => false],
    'lists' => ['table' => 'lists', 'allowWrite' => false, 'indexExtractor' => fn($r) => ['board_id' => $r['boardId'] ?? null]],
    'labels' => ['table' => 'labels', 'allowWrite' => false],
    'cards' => [
      'table' => 'cards', 'ownerColumn' => 'owner_id', 'ownerField' => 'ownerId',
      'writePolicy' => ['create' => ['owner', 'staff'], 'update' => ['owner', 'staff'], 'delete' => ['owner', 'staff']],
      'indexExtractor' => fn($r) => ['board_id' => $r['boardId'] ?? null, 'list_id' => $r['listId'] ?? null, 'owner_id' => $r['ownerId'] ?? null, 'status' => $r['status'] ?? null],
    ],
    'card-activity' => [
      'table' => 'card_activity', 'writePolicy' => ['create' => ['any'], 'update' => ['staff'], 'delete' => ['staff']],
      'indexExtractor' => fn($r) => ['card_id' => $r['cardId'] ?? null],
    ],
    'documents' => [
      'table' => 'documents', 'ownerColumn' => 'owner_id', 'ownerField' => 'ownerId', 'rbacModule' => 'documents',
      'scopeOwnerForRoles' => ['mentore', 'mentor', 'proprietaire'],
      'writePolicy' => ['create' => ['owner', 'rbac'], 'update' => ['rbac'], 'delete' => ['rbac']],
      'indexExtractor' => fn($r) => ['owner_id' => $r['ownerId'] ?? null, 'status' => $r['status'] ?? null],
    ],
  ];
}

/** Point d'entrée appelé par api/index.php pour tout ce qui n'est pas une route bespoke. */
function dc_dispatch_resource(string $resource, ?string $id, string $method): void {
  $configs = dc_resource_configs();
  if (!isset($configs[$resource])) dc_error('Route API introuvable.', 404);
  dc_handle_resource($configs[$resource], $id, $method);
}
