/**
 * Migre les données mock assets/data/*.json vers PostgreSQL.
 * Idempotent : TRUNCATE toutes les tables avant réinsertion (usage dev uniquement).
 * Tous les comptes seedés reçoivent le mot de passe démo "demo1234" (hashé),
 * pour rester compatibles avec les boutons "comptes de démo" de la page de connexion.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const pool = require("../db/pool");

const DATA_DIR = path.join(__dirname, "..", "..", "assets", "data");
const DEMO_PASSWORD = "demo1234";

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${name}.json`), "utf-8"));
}

async function truncateAll(client) {
  await client.query(`
    TRUNCATE TABLE
      conversation_messages, conversations, audit_log,
      mentors, mentees, housing, opportunities, reports, matchings, resources,
      notifications, staff, departments, tickets, contact_requests, public_team,
      permissions, org_chart, boards, lists, cards, labels, card_activity,
      documents, announcements, settings, users
    RESTART IDENTITY CASCADE;
  `);
}

async function seedUsers(client) {
  const users = readJson("users");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const u of users) {
    await client.query(
      `INSERT INTO users (id, role, first_name, last_name, email, password_hash, phone, city, status, verified, avatar_initials, avatar_color, created_at, last_login_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [u.id, u.role, u.firstName, u.lastName, u.email.toLowerCase(), passwordHash, u.phone || null, u.city || null,
        u.status || "actif", !!u.verified, u.avatarInitials || null, u.avatarColor || null,
        u.createdAt || new Date().toISOString(), u.lastLoginAt || null]
    );
  }
  console.log(`  users: ${users.length}`);
}

async function seedDocumentTable(client, table, jsonName, extraCols, idField) {
  const rows = readJson(jsonName);
  for (const r of rows) {
    const extra = extraCols ? extraCols(r) : {};
    const cols = ["id", ...Object.keys(extra), "data"];
    const values = [r[idField || "id"], ...Object.values(extra), JSON.stringify(r)];
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");
    await client.query(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`, values);
  }
  console.log(`  ${table}: ${rows.length}`);
}

async function seedPermissions(client) {
  const rows = readJson("permissions");
  for (const r of rows) {
    await client.query(`INSERT INTO permissions (access_level, data) VALUES ($1,$2)`, [r.accessLevel, JSON.stringify(r)]);
  }
  console.log(`  permissions: ${rows.length}`);
}

async function seedSettings(client) {
  const settings = readJson("settings");
  await client.query(`INSERT INTO settings (key, data) VALUES ('app', $1)`, [JSON.stringify(settings)]);
  console.log(`  settings: 1`);
}

async function seedMessages(client) {
  const conversations = readJson("messages");
  let msgCount = 0;
  for (const c of conversations) {
    await client.query(
      `INSERT INTO conversations (id, matching_id, participants, last_message_at) VALUES ($1,$2,$3,$4)`,
      [c.id, c.matchingId || null, c.participants, c.lastMessageAt || null]
    );
    for (const m of c.messages || []) {
      await client.query(
        `INSERT INTO conversation_messages (id, conversation_id, sender_id, text, sent_at, read, read_at, flagged)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [m.id, c.id, m.senderId, m.text, m.sentAt, !!m.read, m.readAt || null, !!m.flagged]
      );
      msgCount++;
    }
  }
  console.log(`  conversations: ${conversations.length} (messages: ${msgCount})`);
}

async function seedAuditLog(client) {
  const rows = readJson("audit-log");
  for (const r of rows) {
    await client.query(
      `INSERT INTO audit_log (id, actor_id, actor_name, actor_role, module, action, target_type, target_id, before, after, result, details, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [r.id, r.actorId || null, r.actorName || null, r.actorRole || null, r.module || null, r.action,
        r.targetType || null, r.targetId || null, r.before ? JSON.stringify(r.before) : null,
        r.after ? JSON.stringify(r.after) : null, r.result || "success", r.details || null, r.date || new Date().toISOString()]
    );
  }
  console.log(`  audit_log: ${rows.length}`);
}

async function main() {
  const client = await pool.connect();
  try {
    console.log("Truncating existing data...");
    await truncateAll(client);

    console.log("Seeding...");
    await seedUsers(client);
    await seedDocumentTable(client, "mentors", "mentors", (r) => ({ user_id: r.userId }));
    await seedDocumentTable(client, "mentees", "mentees", (r) => ({ user_id: r.userId }));
    await seedDocumentTable(client, "housing", "housing", (r) => ({ owner_id: r.ownerId, moderation_status: r.moderationStatus }));
    await seedDocumentTable(client, "opportunities", "opportunities", (r) => ({ publisher_id: r.publisherId, moderation_status: r.moderationStatus }));
    await seedDocumentTable(client, "reports", "reports", (r) => ({ reporter_id: r.reporterId, status: r.status }));
    await seedDocumentTable(client, "matchings", "matchings", (r) => ({ mentor_id: r.mentorId, mentee_id: r.menteeId, status: r.status }));
    await seedDocumentTable(client, "resources", "resources");
    await seedDocumentTable(client, "notifications", "notifications", (r) => ({ user_id: r.userId }));
    await seedDocumentTable(client, "staff", "staff", (r) => ({ user_id: r.userId, department: r.department, access_level: r.accessLevel }));
    await seedDocumentTable(client, "departments", "departments");
    await seedDocumentTable(client, "tickets", "tickets", (r) => ({ assigned_to: r.assignedTo, target_service: r.targetService, status: r.status }));
    await seedDocumentTable(client, "contact_requests", "contact-requests");
    await seedDocumentTable(client, "public_team", "public-team", null, "staffId");
    await seedPermissions(client);
    await seedDocumentTable(client, "org_chart", "org-chart");
    await seedDocumentTable(client, "boards", "boards");
    await seedDocumentTable(client, "lists", "lists", (r) => ({ board_id: r.boardId }));
    await seedDocumentTable(client, "cards", "cards", (r) => ({ board_id: r.boardId, list_id: r.listId, owner_id: r.ownerId, status: r.status }));
    await seedDocumentTable(client, "labels", "labels");
    await seedDocumentTable(client, "card_activity", "card_activity", (r) => ({ card_id: r.cardId }));
    await seedDocumentTable(client, "documents", "documents", (r) => ({ owner_id: r.ownerId, status: r.status }));
    await seedDocumentTable(client, "announcements", "announcements");
    await seedSettings(client);
    await seedMessages(client);
    await seedAuditLog(client);

    console.log(`\nSeed terminé. Mot de passe démo pour tous les comptes : "${DEMO_PASSWORD}"`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed échoué:", err);
  process.exit(1);
});
