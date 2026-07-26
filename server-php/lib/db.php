<?php
require_once __DIR__ . '/../config.php';

function dc_pdo(): PDO {
  static $pdo = null;
  if ($pdo === null) {
    $host = dc_env('DB_HOST', 'localhost');
    $port = dc_env('DB_PORT', '3306');
    $name = dc_env('DB_NAME', 'diaspoconnect');
    $user = dc_env('DB_USER', 'root');
    $pass = dc_env('DB_PASSWORD', '');
    $dsn = "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES => false,
    ]);
  }
  return $pdo;
}

/** Génère un identifiant du même format que côté Node ("préfixe-timestamp-alea"). */
function dc_next_id(string $prefix): string {
  return $prefix . '-' . (int) (microtime(true) * 1000) . '-' . random_int(100, 999);
}
