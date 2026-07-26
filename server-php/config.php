<?php
/**
 * Charge server-php/.env (mini-parser, sans dépendance externe — pensé pour
 * un hébergement mutualisé où composer n'est pas garanti). Ne modifie jamais
 * une variable déjà présente dans l'environnement réel (mêmes règles que
 * dotenv côté Node : l'environnement du serveur a toujours priorité).
 */
function dc_load_env(string $path): void {
  if (!is_file($path)) return;
  foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $line = trim($line);
    if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;
    [$key, $value] = explode('=', $line, 2);
    $key = trim($key);
    $value = trim($value);
    if (getenv($key) === false) {
      putenv("$key=$value");
      $_ENV[$key] = $value;
    }
  }
}

dc_load_env(__DIR__ . '/.env');

function dc_env(string $key, $default = null) {
  $value = getenv($key);
  return $value === false ? $default : $value;
}
