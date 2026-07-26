<?php
/**
 * Front controller de l'API PHP — équivalent de server/index.js (mais sans
 * servir le frontend statique : sur un hébergement mutualisé, Apache sert
 * directement les fichiers HTML/CSS/JS depuis le docroot, seul /api/* passe
 * par ce script via .htaccess).
 */
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/auth.php';

header('Content-Type: application/json; charset=utf-8');

set_exception_handler(function (Throwable $e) {
  error_log($e->getMessage() . "\n" . $e->getTraceAsString());
  http_response_code(500);
  echo json_encode(['error' => 'Erreur serveur.']);
  exit;
});

// PATH_INFO est le chemin après index.php (ex. "/mentors" ou "/auth/login").
// Certains hébergeurs le désactivent : on retombe sur REQUEST_URI en repli.
$pathInfo = $_SERVER['PATH_INFO'] ?? null;
if ($pathInfo === null) {
  $uri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
  $pathInfo = preg_replace('#^.*/api#', '', $uri);
}
$segments = array_values(array_filter(explode('/', trim($pathInfo, '/')), fn($s) => $s !== ''));
$method = $_SERVER['REQUEST_METHOD'];

$resource = array_shift($segments) ?? '';

switch ($resource) {
  case 'auth':
    require_once __DIR__ . '/../routes/auth.php';
    dc_route_auth($segments, $method);
    break;
  case 'users':
    require_once __DIR__ . '/../routes/users.php';
    dc_route_users($segments, $method);
    break;
  case 'messages':
    require_once __DIR__ . '/../routes/messages.php';
    dc_route_messages($segments, $method);
    break;
  case 'audit-log':
    require_once __DIR__ . '/../routes/audit-log.php';
    dc_route_audit_log($segments, $method);
    break;
  case 'settings':
    require_once __DIR__ . '/../routes/settings.php';
    dc_route_settings($segments, $method);
    break;
  case '':
    dc_error('Route API introuvable.', 404);
    break;
  default:
    require_once __DIR__ . '/../routes/resources.php';
    $id = $segments[0] ?? null;
    dc_dispatch_resource($resource, $id, $method);
    break;
}
