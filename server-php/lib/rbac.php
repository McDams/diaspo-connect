<?php
/**
 * Port PHP de assets/js/core/rbac.js — même grille MATRIX, même sémantique.
 * Contrairement à la version Node (qui `require()` le fichier JS partagé tel
 * quel), PHP ne peut pas exécuter du JavaScript : cette copie doit être tenue
 * à jour manuellement si assets/js/core/rbac.js change. Gardée volontairement
 * identique champ pour champ pour minimiser ce risque de dérive.
 */

const RBAC_FULL_ACCESS_ROLES = ['admin', 'super_admin'];

const RBAC_MATRIX = [
  'direction_admin' => [
    'users' => ['read', 'update', 'validate', 'export'],
    'mentorship' => ['read', 'assign', 'validate', 'export'],
    'housing' => ['read', 'validate', 'export'],
    'opportunities' => ['read', 'validate', 'export'],
    'tickets' => ['read', 'assign', 'export'],
    'moderation' => ['read', 'moderate', 'export'],
    'content' => ['read', 'export'],
    'documents' => ['read', 'validate', 'export'],
    'kanban' => ['read', 'create', 'update', 'assign', 'export'],
    'settings' => ['read'],
    'permissions' => ['read'],
    'audit' => ['read', 'export'],
    'reports' => ['read', 'export'],
    'calendar' => ['read'],
  ],
  'secretariat_admin' => [
    'users' => ['read'],
    'mentorship' => ['read', 'assign'],
    'housing' => ['read'],
    'opportunities' => ['read'],
    'tickets' => ['read', 'create', 'update', 'assign'],
    'documents' => ['read', 'update'],
    'kanban' => ['read', 'create', 'update', 'assign'],
    'calendar' => ['read'],
  ],
  'advisor_admin' => [
    'mentorship' => ['read', 'update'],
    'tickets' => ['read', 'update'],
    'documents' => ['read'],
    'kanban' => ['read', 'create', 'update'],
    'calendar' => ['read'],
  ],
  'housing_admin' => [
    'housing' => ['read', 'update', 'validate', 'moderate'],
    'tickets' => ['read', 'update'],
    'documents' => ['read'],
    'kanban' => ['read', 'create', 'update'],
    'calendar' => ['read'],
  ],
  'career_admin' => [
    'opportunities' => ['read', 'update', 'validate', 'moderate'],
    'tickets' => ['read', 'update'],
    'documents' => ['read'],
    'kanban' => ['read', 'create', 'update'],
    'calendar' => ['read'],
  ],
  'moderation_admin' => [
    'moderation' => ['read', 'create', 'update', 'moderate'],
    'users' => ['read', 'update'],
    'tickets' => ['read', 'update'],
    'kanban' => ['read', 'create', 'update'],
    'calendar' => ['read'],
  ],
  'support_admin' => [
    'tickets' => ['read', 'create', 'update', 'assign'],
    'users' => ['read'],
    'kanban' => ['read', 'create', 'update'],
    'calendar' => ['read'],
  ],
  'partnership_admin' => [
    'tickets' => ['read', 'update'],
    'kanban' => ['read', 'create', 'update'],
    'calendar' => ['read'],
  ],
  'content_admin' => [
    'content' => ['read', 'create', 'update', 'delete'],
    'kanban' => ['read', 'create', 'update'],
    'calendar' => ['read'],
  ],
  'compliance_admin' => [
    'documents' => ['read', 'update', 'validate'],
    'users' => ['read', 'validate'],
    'housing' => ['read', 'validate'],
    'opportunities' => ['read', 'validate'],
    'kanban' => ['read', 'create', 'update'],
    'calendar' => ['read'],
  ],
  'technical_admin' => [
    'settings' => ['read', 'update'],
    'audit' => ['read'],
    'kanban' => ['read', 'create', 'update'],
    'calendar' => ['read'],
  ],
  'mentore' => ['kanban' => ['read', 'create', 'update']],
  'mentor' => ['kanban' => ['read', 'create', 'update']],
  'proprietaire' => ['kanban' => ['read', 'create', 'update']],
];

function rbac_role_key_for(?array $user, ?array $staffRecord): ?string {
  if (!$user) return null;
  if ($user['role'] === 'admin') return 'admin';
  if ($user['role'] === 'staff' && $staffRecord) return $staffRecord['access_level'];
  return $user['role'];
}

function rbac_can(?string $roleKey, string $module, string $action): bool {
  if (!$roleKey) return false;
  if (in_array($roleKey, RBAC_FULL_ACCESS_ROLES, true)) return true;
  $modulePerms = RBAC_MATRIX[$roleKey][$module] ?? null;
  return $modulePerms !== null && in_array($action, $modulePerms, true);
}

function rbac_has_full_access(?string $roleKey): bool {
  return $roleKey !== null && in_array($roleKey, RBAC_FULL_ACCESS_ROLES, true);
}
