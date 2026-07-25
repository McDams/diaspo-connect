const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function toClientMessage(row) {
  return { id: row.id, senderId: row.sender_id, text: row.text, sentAt: row.sent_at, read: row.read, readAt: row.read_at, flagged: row.flagged };
}

async function toClientConversation(convRow) {
  const { rows } = await pool.query("SELECT * FROM conversation_messages WHERE conversation_id = $1 ORDER BY sent_at ASC", [convRow.id]);
  return {
    id: convRow.id, matchingId: convRow.matching_id, participants: convRow.participants,
    lastMessageAt: convRow.last_message_at, messages: rows.map(toClientMessage),
  };
}

// Un utilisateur ne voit que les conversations dont il est participant — jamais celles des autres (sauf admin/staff, modération via /api/reports).
router.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM conversations WHERE $1 = ANY(participants) ORDER BY last_message_at DESC NULLS LAST", [req.user.id]);
  const conversations = await Promise.all(rows.map(toClientConversation));
  res.json(conversations);
});

router.post("/", requireAuth, async (req, res) => {
  const { id, matchingId, participants } = req.body || {};
  if (!id || !Array.isArray(participants) || !participants.includes(req.user.id)) {
    return res.status(400).json({ error: "Conversation invalide." });
  }
  await pool.query("INSERT INTO conversations (id, matching_id, participants, last_message_at) VALUES ($1,$2,$3,$4)", [id, matchingId || null, participants, null]);
  res.status(201).json({ id, matchingId: matchingId || null, participants, lastMessageAt: null, messages: [] });
});

async function assertParticipant(req, res, conversationId) {
  const { rows } = await pool.query("SELECT * FROM conversations WHERE id = $1", [conversationId]);
  const conv = rows[0];
  if (!conv || !conv.participants.includes(req.user.id)) {
    res.status(403).json({ error: "Vous ne participez pas à cette conversation." });
    return null;
  }
  return conv;
}

router.post("/:id/messages", requireAuth, async (req, res) => {
  const conv = await assertParticipant(req, res, req.params.id);
  if (!conv) return;
  const { id, text } = req.body || {};
  if (!id || !text || !text.trim()) return res.status(400).json({ error: "Message vide." });
  const sentAt = new Date().toISOString();
  await pool.query(
    "INSERT INTO conversation_messages (id, conversation_id, sender_id, text, sent_at, read, read_at, flagged) VALUES ($1,$2,$3,$4,$5,false,null,false)",
    [id, req.params.id, req.user.id, text.trim(), sentAt]
  );
  await pool.query("UPDATE conversations SET last_message_at = $1 WHERE id = $2", [sentAt, req.params.id]);
  res.status(201).json({ id, senderId: req.user.id, text: text.trim(), sentAt, read: false, readAt: null, flagged: false });
});

router.put("/:id/messages/read", requireAuth, async (req, res) => {
  const conv = await assertParticipant(req, res, req.params.id);
  if (!conv) return;
  const { messageIds } = req.body || {};
  if (!Array.isArray(messageIds) || !messageIds.length) return res.json({ ok: true });
  const readAt = new Date().toISOString();
  await pool.query(
    "UPDATE conversation_messages SET read = true, read_at = $1 WHERE conversation_id = $2 AND id = ANY($3)",
    [readAt, req.params.id, messageIds]
  );
  res.json({ ok: true });
});

module.exports = router;
