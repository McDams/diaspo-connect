-- DiaspoConnect — schéma MySQL/MariaDB pour l'hébergement mutualisé (server-php/).
--
-- Adaptation du schéma pragmatique server/db/schema.sql (Node/PostgreSQL) :
-- mêmes tables, mêmes colonnes indexées pour l'auth/l'appartenance/le RBAC,
-- même contenu métier en JSON. Différences dues au moteur :
--   - id en VARCHAR(64) au lieu de TEXT (MySQL exige une longueur de clé définie)
--   - JSON au lieu de JSONB (MySQL/MariaDB n'ont pas de type binaire dédié)
--   - DATETIME au lieu de TIMESTAMPTZ (pas de type "avec fuseau" natif ; l'app
--     stocke tout en UTC par convention)
--   - `participants` (tableau Postgres) devient une colonne JSON
--   - pas de table de sessions : PHP utilise ses sessions fichier natives

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  role VARCHAR(20) NOT NULL,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  city VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'actif',
  verified TINYINT(1) NOT NULL DEFAULT 0,
  avatar_initials VARCHAR(10),
  avatar_color VARCHAR(20),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_users_role ON users (role);

CREATE TABLE IF NOT EXISTS audit_log (
  id VARCHAR(64) PRIMARY KEY,
  actor_id VARCHAR(64),
  actor_name VARCHAR(200),
  actor_role VARCHAR(30),
  module VARCHAR(60),
  action VARCHAR(120) NOT NULL,
  target_type VARCHAR(60),
  target_id VARCHAR(64),
  before_data JSON,
  after_data JSON,
  result VARCHAR(20) NOT NULL DEFAULT 'success',
  details TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_audit_log_created_at ON audit_log (created_at);

-- --- Tables génériques "document" (id + quelques colonnes indexées + data JSON) ---

CREATE TABLE IF NOT EXISTS mentors (
  id VARCHAR(64) PRIMARY KEY, user_id VARCHAR(64), data JSON NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_mentors_user_id ON mentors (user_id);

CREATE TABLE IF NOT EXISTS mentees (
  id VARCHAR(64) PRIMARY KEY, user_id VARCHAR(64), data JSON NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_mentees_user_id ON mentees (user_id);

CREATE TABLE IF NOT EXISTS housing (
  id VARCHAR(64) PRIMARY KEY, owner_id VARCHAR(64), moderation_status VARCHAR(30), data JSON NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_housing_owner_id ON housing (owner_id);

CREATE TABLE IF NOT EXISTS opportunities (
  id VARCHAR(64) PRIMARY KEY, publisher_id VARCHAR(64), moderation_status VARCHAR(30), data JSON NOT NULL,
  FOREIGN KEY (publisher_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_opportunities_publisher_id ON opportunities (publisher_id);

CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(64) PRIMARY KEY, reporter_id VARCHAR(64), status VARCHAR(30), data JSON NOT NULL,
  FOREIGN KEY (reporter_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS matchings (
  id VARCHAR(64) PRIMARY KEY, mentor_id VARCHAR(64), mentee_id VARCHAR(64), status VARCHAR(30), data JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resources (
  id VARCHAR(64) PRIMARY KEY, data JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY, user_id VARCHAR(64), data JSON NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_notifications_user_id ON notifications (user_id);

CREATE TABLE IF NOT EXISTS staff (
  id VARCHAR(64) PRIMARY KEY, user_id VARCHAR(64), department VARCHAR(60), access_level VARCHAR(60), data JSON NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_staff_user_id ON staff (user_id);

CREATE TABLE IF NOT EXISTS departments (
  id VARCHAR(64) PRIMARY KEY, data JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR(64) PRIMARY KEY, assigned_to VARCHAR(64), target_service VARCHAR(60), status VARCHAR(30), data JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_tickets_assigned_to ON tickets (assigned_to);

CREATE TABLE IF NOT EXISTS contact_requests (
  id VARCHAR(64) PRIMARY KEY, data JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS public_team (
  id VARCHAR(64) PRIMARY KEY, data JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS permissions (
  access_level VARCHAR(60) PRIMARY KEY, data JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS org_chart (
  id VARCHAR(64) PRIMARY KEY, data JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS boards (
  id VARCHAR(64) PRIMARY KEY, data JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lists (
  id VARCHAR(64) PRIMARY KEY, board_id VARCHAR(64), data JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_lists_board_id ON lists (board_id);

CREATE TABLE IF NOT EXISTS cards (
  id VARCHAR(64) PRIMARY KEY, board_id VARCHAR(64), list_id VARCHAR(64), owner_id VARCHAR(64), status VARCHAR(30), data JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_cards_board_id ON cards (board_id);
CREATE INDEX idx_cards_list_id ON cards (list_id);
CREATE INDEX idx_cards_owner_id ON cards (owner_id);

CREATE TABLE IF NOT EXISTS labels (
  id VARCHAR(64) PRIMARY KEY, data JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS card_activity (
  id VARCHAR(64) PRIMARY KEY, card_id VARCHAR(64), data JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_card_activity_card_id ON card_activity (card_id);

CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(64) PRIMARY KEY, owner_id VARCHAR(64), status VARCHAR(30), data JSON NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_documents_owner_id ON documents (owner_id);

CREATE TABLE IF NOT EXISTS announcements (
  id VARCHAR(64) PRIMARY KEY, data JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(50) PRIMARY KEY, data JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --- Messagerie : relationnelle (l'état de lecture par message compte) ---

CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(64) PRIMARY KEY,
  matching_id VARCHAR(64),
  participants JSON NOT NULL,
  last_message_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS conversation_messages (
  id VARCHAR(64) PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL,
  sender_id VARCHAR(64),
  text TEXT NOT NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME NULL,
  flagged TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_conversation_messages_conv_id ON conversation_messages (conversation_id);
