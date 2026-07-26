<?php
require_once __DIR__ . '/../lib/auth.php';

function dc_message_row(array $row): array {
  return [
    'id' => $row['id'], 'senderId' => $row['sender_id'], 'text' => $row['text'], 'sentAt' => $row['sent_at'],
    'read' => (bool) $row['is_read'], 'readAt' => $row['read_at'], 'flagged' => (bool) $row['flagged'],
  ];
}

function dc_conversation_row(array $convRow, PDO $pdo): array {
  $stmt = $pdo->prepare('SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY sent_at ASC');
  $stmt->execute([$convRow['id']]);
  return [
    'id' => $convRow['id'], 'matchingId' => $convRow['matching_id'],
    'participants' => json_decode($convRow['participants'], true),
    'lastMessageAt' => $convRow['last_message_at'],
    'messages' => array_map('dc_message_row', $stmt->fetchAll()),
  ];
}

function dc_route_messages(array $segments, string $method): void {
  $pdo = dc_pdo();
  $convId = $segments[0] ?? null;
  $sub = $segments[1] ?? null; // 'messages' or 'messages'/'read'

  if ($convId === null && $method === 'GET') {
    $user = dc_require_auth();
    $stmt = $pdo->prepare('SELECT * FROM conversations WHERE JSON_CONTAINS(participants, JSON_QUOTE(?)) ORDER BY last_message_at DESC');
    $stmt->execute([$user['id']]);
    dc_json(array_map(fn($row) => dc_conversation_row($row, $pdo), $stmt->fetchAll()));
  }

  if ($convId === null && $method === 'POST') {
    $user = dc_require_auth();
    $body = dc_body();
    $id = $body['id'] ?? null;
    $participants = $body['participants'] ?? null;
    if (!$id || !is_array($participants) || !in_array($user['id'], $participants, true)) dc_error('Conversation invalide.', 400);
    $pdo->prepare('INSERT INTO conversations (id, matching_id, participants, last_message_at) VALUES (?,?,?,NULL)')
      ->execute([$id, $body['matchingId'] ?? null, json_encode($participants)]);
    dc_json(['id' => $id, 'matchingId' => $body['matchingId'] ?? null, 'participants' => $participants, 'lastMessageAt' => null, 'messages' => []], 201);
  }

  // Toutes les routes suivantes portent sur une conversation précise : vérifier l'appartenance.
  if ($convId !== null) {
    $user = dc_require_auth();
    $stmt = $pdo->prepare('SELECT * FROM conversations WHERE id = ?');
    $stmt->execute([$convId]);
    $conv = $stmt->fetch();
    $participants = $conv ? json_decode($conv['participants'], true) : [];
    if (!$conv || !in_array($user['id'], $participants, true)) {
      dc_error('Vous ne participez pas à cette conversation.', 403);
    }

    if ($sub === 'messages' && $method === 'POST') {
      $body = dc_body();
      $msgId = $body['id'] ?? null;
      $text = trim($body['text'] ?? '');
      if (!$msgId || !$text) dc_error('Message vide.', 400);
      $sentAt = date('Y-m-d H:i:s');
      $pdo->prepare('INSERT INTO conversation_messages (id, conversation_id, sender_id, text, sent_at, is_read, read_at, flagged) VALUES (?,?,?,?,?,0,NULL,0)')
        ->execute([$msgId, $convId, $user['id'], $text, $sentAt]);
      $pdo->prepare('UPDATE conversations SET last_message_at = ? WHERE id = ?')->execute([$sentAt, $convId]);
      dc_json(['id' => $msgId, 'senderId' => $user['id'], 'text' => $text, 'sentAt' => $sentAt, 'read' => false, 'readAt' => null, 'flagged' => false], 201);
    }

    if ($sub === 'messages' && ($segments[2] ?? null) === 'read' && $method === 'PUT') {
      $body = dc_body();
      $messageIds = $body['messageIds'] ?? [];
      if (!$messageIds) dc_json(['ok' => true]);
      $readAt = date('Y-m-d H:i:s');
      $placeholders = implode(',', array_fill(0, count($messageIds), '?'));
      $pdo->prepare("UPDATE conversation_messages SET is_read = 1, read_at = ? WHERE conversation_id = ? AND id IN ($placeholders)")
        ->execute(array_merge([$readAt, $convId], $messageIds));
      dc_json(['ok' => true]);
    }
  }

  dc_error('Route API introuvable.', 404);
}
