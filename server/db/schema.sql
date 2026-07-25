-- DiaspoConnect - schéma pragmatique du backend réel.
--
-- Approche hybride : les colonnes qui comptent pour l'authentification, les
-- relations d'appartenance (owner/assignee) et le RBAC sont de vraies colonnes
-- indexées ; le reste du contenu métier (titres, descriptions, listes
-- imbriquées...) est stocké en JSONB dans une colonne `data`, qui reproduit
-- exactement la forme des anciens fichiers assets/data/*.json. Le frontend
-- (DataStore) continue donc de recevoir des tableaux d'objets à la forme
-- identique à avant, seule la source change.
--
-- Distinct de database/schema.sql (modèle relationnel complet à 74 tables,
-- conservé comme référence de conception plus riche pour une V2 future).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  status TEXT NOT NULL DEFAULT 'actif',
  verified BOOLEAN NOT NULL DEFAULT false,
  avatar_initials TEXT,
  avatar_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- Table de sessions attendue par connect-pg-simple (nom/forme imposés par la lib).
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_name TEXT,
  actor_role TEXT,
  module TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  before JSONB,
  after JSONB,
  result TEXT NOT NULL DEFAULT 'success',
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);

-- --- Tables génériques "document" (id + quelques colonnes indexées + data JSONB) ---

CREATE TABLE IF NOT EXISTS mentors (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS mentees (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS housing (id TEXT PRIMARY KEY, owner_id TEXT REFERENCES users(id), moderation_status TEXT, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS opportunities (id TEXT PRIMARY KEY, publisher_id TEXT REFERENCES users(id), moderation_status TEXT, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, reporter_id TEXT REFERENCES users(id), status TEXT, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS matchings (id TEXT PRIMARY KEY, mentor_id TEXT, mentee_id TEXT, status TEXT, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS resources (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS staff (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, department TEXT, access_level TEXT, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, assigned_to TEXT, target_service TEXT, status TEXT, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS contact_requests (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS public_team (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS permissions (access_level TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS org_chart (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS boards (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS lists (id TEXT PRIMARY KEY, board_id TEXT, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, board_id TEXT, list_id TEXT, owner_id TEXT, status TEXT, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS labels (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS card_activity (id TEXT PRIMARY KEY, card_id TEXT, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, owner_id TEXT REFERENCES users(id), status TEXT, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS announcements (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, data JSONB NOT NULL);

CREATE INDEX IF NOT EXISTS idx_mentors_user_id ON mentors (user_id);
CREATE INDEX IF NOT EXISTS idx_mentees_user_id ON mentees (user_id);
CREATE INDEX IF NOT EXISTS idx_housing_owner_id ON housing (owner_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_publisher_id ON opportunities (publisher_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff (user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets (assigned_to);
CREATE INDEX IF NOT EXISTS idx_cards_board_id ON cards (board_id);
CREATE INDEX IF NOT EXISTS idx_cards_list_id ON cards (list_id);
CREATE INDEX IF NOT EXISTS idx_cards_owner_id ON cards (owner_id);
CREATE INDEX IF NOT EXISTS idx_lists_board_id ON lists (board_id);
CREATE INDEX IF NOT EXISTS idx_card_activity_card_id ON card_activity (card_id);
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents (owner_id);

-- --- Messagerie : relationnelle (l'état de lecture par message compte) ---

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  matching_id TEXT,
  participants TEXT[] NOT NULL,
  last_message_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT REFERENCES users(id),
  text TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  flagged BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conv_id ON conversation_messages (conversation_id);
