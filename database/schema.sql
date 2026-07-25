-- ============================================================================
-- DiaspoConnect — schéma relationnel de référence (PostgreSQL 15+)
-- ============================================================================
-- Ce schéma est la cible backend du prototype frontend. Les entités et
-- statuts correspondent 1:1 aux fichiers JSON de /assets/data et aux règles
-- métier implémentées côté frontend (quota de 2 mentorés actifs par mentor,
-- statuts de mentorat, modération logement/emploi, RBAC interne, Kanban).
--
-- Conventions :
--   - PK           : BIGSERIAL (identifiants internes simples et lisibles)
--   - Horodatage   : created_at / updated_at sur toutes les tables,
--                    deleted_at (soft delete) sur les tables à forte sensibilité
--   - Enums        : types PostgreSQL natifs pour les statuts métier fermés
--   - Nommage      : snake_case, tables au pluriel
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- pour gen_random_uuid() si besoin côté API

-- ============================================================================
-- TYPES ÉNUMÉRÉS
-- ============================================================================

CREATE TYPE user_role_enum            AS ENUM ('mentore', 'mentor', 'proprietaire', 'staff', 'admin');
CREATE TYPE staff_access_level_enum   AS ENUM ('super_admin', 'direction_admin', 'secretariat_admin', 'advisor_admin', 'housing_admin', 'career_admin', 'moderation_admin', 'support_admin', 'partnership_admin', 'content_admin', 'compliance_admin', 'technical_admin');
CREATE TYPE account_status_enum       AS ENUM ('active', 'suspended', 'pending_verification', 'archived');
CREATE TYPE gender_enum               AS ENUM ('homme', 'femme', 'autre', 'non_precise');
CREATE TYPE mentorship_status_enum    AS ENUM ('en_attente', 'validee', 'active', 'suspendue', 'terminee');
CREATE TYPE moderation_status_enum    AS ENUM ('brouillon', 'soumise', 'en_attente', 'validee', 'rejetee', 'archivee');
CREATE TYPE opportunity_type_enum     AS ENUM ('stage', 'alternance', 'job_saisonnier');
CREATE TYPE ticket_status_enum        AS ENUM ('nouveau', 'en_cours', 'en_attente_reponse', 'resolu', 'ferme');
CREATE TYPE priority_enum             AS ENUM ('basse', 'normale', 'haute', 'urgente');
CREATE TYPE report_reason_enum        AS ENUM ('harcelement', 'comportement_inapproprie', 'faux_profil', 'arnaque', 'proposition_deplacee', 'autre');
CREATE TYPE moderation_action_enum    AS ENUM ('avertissement', 'suspension', 'reactivation', 'contenu_supprime', 'compte_banni', 'aucune_action');
CREATE TYPE collaborator_status_enum  AS ENUM ('benevole', 'actif', 'en_pause', 'prestataire', 'permanent', 'en_formation', 'suspendu', 'archive');
CREATE TYPE position_type_enum        AS ENUM ('direction', 'coordination', 'accompagnement', 'support', 'moderation', 'partenariats', 'contenu', 'technique', 'conformite');
CREATE TYPE visibility_enum           AS ENUM ('public_complet', 'public_partiel', 'interne', 'cache');
CREATE TYPE verification_status_enum  AS ENUM ('en_attente', 'verifie', 'rejete');
CREATE TYPE document_status_enum      AS ENUM ('en_attente', 'valide', 'rejete');
CREATE TYPE request_category_enum     AS ENUM ('information_generale', 'dossier_etudiant', 'matching_mentorat', 'logement', 'emploi', 'probleme_relationnel', 'support_technique', 'signalement_securite', 'partenariat', 'benevolat', 'presse_media');
CREATE TYPE board_scope_enum          AS ENUM ('personal', 'pole', 'global');
CREATE TYPE rbac_action_enum          AS ENUM ('read', 'create', 'update', 'delete', 'assign', 'validate', 'moderate', 'export', 'impersonate');

-- ============================================================================
-- A. UTILISATEURS ET ACCÈS
-- ============================================================================

CREATE TABLE users (
  id                BIGSERIAL PRIMARY KEY,
  email             VARCHAR(255) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  first_name        VARCHAR(120) NOT NULL,
  last_name         VARCHAR(120) NOT NULL,
  phone             VARCHAR(30),
  role              user_role_enum NOT NULL,
  account_status    account_status_enum NOT NULL DEFAULT 'pending_verification',
  email_verified_at TIMESTAMPTZ,
  avatar_url        TEXT,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
COMMENT ON TABLE users IS 'Compte unique, quel que soit le rôle. Le détail par rôle vit dans les tables *_profiles.';
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(account_status);

CREATE TABLE roles (
  id          BIGSERIAL PRIMARY KEY,
  code        VARCHAR(60) NOT NULL UNIQUE,
  label       VARCHAR(120) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE roles IS 'Référentiel des rôles applicatifs (miroir de user_role_enum + staff_access_level_enum) pour permettre une gestion RBAC dynamique côté admin.';

CREATE TABLE permissions (
  id          BIGSERIAL PRIMARY KEY,
  module      VARCHAR(60) NOT NULL,
  action      rbac_action_enum NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module, action)
);
COMMENT ON TABLE permissions IS 'Catalogue des couples (module, action) disponibles dans la plateforme.';

CREATE TABLE role_permissions (
  role_id       BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_by BIGINT REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);
COMMENT ON TABLE user_roles IS 'Permet à terme un utilisateur multi-rôles (ex. staff + mentoré) sans changer le schéma.';

CREATE TABLE profiles (
  user_id            BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  city                VARCHAR(120),
  country             VARCHAR(120),
  languages           TEXT[],
  bio                 TEXT,
  profile_completion  SMALLINT NOT NULL DEFAULT 0 CHECK (profile_completion BETWEEN 0 AND 100),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE profiles IS 'Informations transverses à tous les rôles (score de complétude, langues, bio).';

CREATE TABLE mentee_profiles (
  user_id                 BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  origin_country          VARCHAR(120) NOT NULL DEFAULT 'Bénin',
  target_city             VARCHAR(120),
  target_school           VARCHAR(200),
  study_field             VARCHAR(200),
  budget_monthly          NUMERIC(8,2),
  mentor_gender_preference gender_enum,
  support_needs           TEXT[],
  arrival_date             DATE,
  file_status             VARCHAR(60) NOT NULL DEFAULT 'en_preparation',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE mentee_profiles IS 'Seuls les mentorés peuvent renseigner mentor_gender_preference (règle métier appliquée en API).';

CREATE TABLE mentor_profiles (
  user_id           BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  city               VARCHAR(120),
  school              VARCHAR(200),
  study_field         VARCHAR(200),
  years_in_france     SMALLINT,
  availability_level  VARCHAR(30),
  support_types       TEXT[],
  max_active_mentees  SMALLINT NOT NULL DEFAULT 2 CHECK (max_active_mentees <= 2),
  verified            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE mentor_profiles IS 'max_active_mentees borné à 2 au niveau schéma en plus du contrôle applicatif (règle métier n°1).';

CREATE TABLE landlord_profiles (
  user_id        BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name    VARCHAR(200),
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE staff_profiles (
  user_id           BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_level      staff_access_level_enum NOT NULL,
  position_title    VARCHAR(200) NOT NULL,
  collaborator_status collaborator_status_enum NOT NULL DEFAULT 'benevole',
  consent_public_display BOOLEAN NOT NULL DEFAULT FALSE,
  public_visibility  visibility_enum NOT NULL DEFAULT 'cache',
  joined_at          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE staff_profiles IS 'consent_public_display gouverne l affichage nominatif public (actuellement désactivé produit, mais champ conservé pour réversibilité).';

CREATE TABLE sessions (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    VARCHAR(255) NOT NULL,
  ip_address    INET,
  user_agent    TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE password_resets (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE access_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(120) NOT NULL,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_access_logs_user ON access_logs(user_id, created_at DESC);

-- ============================================================================
-- B. STRUCTURE INTERNE
-- ============================================================================

CREATE TABLE departments (
  id              BIGSERIAL PRIMARY KEY,
  code             VARCHAR(60) NOT NULL UNIQUE,
  name             VARCHAR(200) NOT NULL,
  mission          TEXT,
  position_type    position_type_enum NOT NULL,
  icon             VARCHAR(60),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE internal_positions (
  id             BIGSERIAL PRIMARY KEY,
  department_id   BIGINT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  title           VARCHAR(200) NOT NULL,
  parent_position_id BIGINT REFERENCES internal_positions(id),
  responsibilities TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE internal_positions IS 'Alimente l organigramme fonctionnel public (sans identité) via parent_position_id.';

CREATE TABLE staff_assignments (
  id             BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position_id     BIGINT NOT NULL REFERENCES internal_positions(id) ON DELETE RESTRICT,
  started_at      DATE NOT NULL DEFAULT CURRENT_DATE,
  ended_at        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_staff_assignments_user ON staff_assignments(user_id);

CREATE TABLE availability_slots (
  id           BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday       SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- C. MENTORAT / ACCOMPAGNEMENT
-- ============================================================================

CREATE TABLE mentorship_preferences (
  mentee_id       BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  gender_required BOOLEAN NOT NULL DEFAULT FALSE,
  city_weight     SMALLINT NOT NULL DEFAULT 3,
  school_weight   SMALLINT NOT NULL DEFAULT 2,
  field_weight    SMALLINT NOT NULL DEFAULT 2,
  language_weight SMALLINT NOT NULL DEFAULT 1,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mentorship_requests (
  id            BIGSERIAL PRIMARY KEY,
  mentee_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  compatibility_score SMALLINT CHECK (compatibility_score BETWEEN 0 AND 100),
  status         mentorship_status_enum NOT NULL DEFAULT 'en_attente',
  message        TEXT,
  decision_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mentee_id, mentor_id, created_at)
);
CREATE INDEX idx_mentorship_requests_mentor ON mentorship_requests(mentor_id, status);
CREATE INDEX idx_mentorship_requests_mentee ON mentorship_requests(mentee_id, status);

CREATE TABLE mentorship_matches (
  id             BIGSERIAL PRIMARY KEY,
  request_id      BIGINT REFERENCES mentorship_requests(id),
  mentee_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          mentorship_status_enum NOT NULL DEFAULT 'validee',
  started_at      DATE,
  ended_at        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE mentorship_matches IS 'Le quota de 2 mentorés actifs par mentor (règle métier n°1) est vérifié en base via un index partiel + contrôle applicatif à la création.';
CREATE UNIQUE INDEX uq_one_active_match_per_mentee ON mentorship_matches(mentee_id) WHERE status = 'active';
CREATE INDEX idx_mentorship_matches_mentor_active ON mentorship_matches(mentor_id) WHERE status = 'active';

CREATE TABLE mentorship_match_history (
  id           BIGSERIAL PRIMARY KEY,
  match_id      BIGINT NOT NULL REFERENCES mentorship_matches(id) ON DELETE CASCADE,
  previous_status mentorship_status_enum,
  new_status     mentorship_status_enum NOT NULL,
  changed_by     BIGINT REFERENCES users(id),
  reason         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_match_history_match ON mentorship_match_history(match_id, created_at);

CREATE TABLE follow_up_notes (
  id          BIGSERIAL PRIMARY KEY,
  match_id     BIGINT REFERENCES mentorship_matches(id) ON DELETE CASCADE,
  author_id    BIGINT NOT NULL REFERENCES users(id),
  note         TEXT NOT NULL,
  is_internal  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE progress_steps (
  id            BIGSERIAL PRIMARY KEY,
  mentee_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label          VARCHAR(200) NOT NULL,
  step_order     SMALLINT NOT NULL,
  completed      BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_checklists (
  id          BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE checklist_items (
  id             BIGSERIAL PRIMARY KEY,
  checklist_id    BIGINT NOT NULL REFERENCES user_checklists(id) ON DELETE CASCADE,
  label           VARCHAR(300) NOT NULL,
  done            BOOLEAN NOT NULL DEFAULT FALSE,
  due_date        DATE,
  item_order      SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checklist_items_checklist ON checklist_items(checklist_id);

CREATE TABLE appointments (
  id           BIGSERIAL PRIMARY KEY,
  organizer_id  BIGINT NOT NULL REFERENCES users(id),
  participant_id BIGINT REFERENCES users(id),
  match_id      BIGINT REFERENCES mentorship_matches(id),
  title         VARCHAR(200) NOT NULL,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  duration_minutes SMALLINT NOT NULL DEFAULT 30,
  status        VARCHAR(30) NOT NULL DEFAULT 'planifie',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_appointments_scheduled ON appointments(scheduled_at);

-- ============================================================================
-- D. LOGEMENT
-- ============================================================================

CREATE TABLE housing_listings (
  id                  BIGSERIAL PRIMARY KEY,
  owner_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                VARCHAR(200) NOT NULL,
  city                 VARCHAR(120) NOT NULL,
  housing_type         VARCHAR(60) NOT NULL,
  budget_monthly       NUMERIC(8,2) NOT NULL,
  charges              NUMERIC(8,2) DEFAULT 0,
  deposit              NUMERIC(8,2) DEFAULT 0,
  surface_m2           NUMERIC(6,2),
  available_from       DATE,
  immediate_availability BOOLEAN NOT NULL DEFAULT FALSE,
  description          TEXT,
  moderation_status    moderation_status_enum NOT NULL DEFAULT 'brouillon',
  verified             BOOLEAN NOT NULL DEFAULT FALSE,
  moderated_by         BIGINT REFERENCES users(id),
  moderated_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);
CREATE INDEX idx_housing_city ON housing_listings(city);
CREATE INDEX idx_housing_status ON housing_listings(moderation_status);

CREATE TABLE housing_listing_images (
  id           BIGSERIAL PRIMARY KEY,
  listing_id    BIGINT NOT NULL REFERENCES housing_listings(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  image_order   SMALLINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE housing_applications (
  id           BIGSERIAL PRIMARY KEY,
  listing_id    BIGINT NOT NULL REFERENCES housing_listings(id) ON DELETE CASCADE,
  applicant_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        VARCHAR(30) NOT NULL DEFAULT 'envoyee',
  message       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id, applicant_id)
);

CREATE TABLE housing_favorites (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id BIGINT NOT NULL REFERENCES housing_listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE housing_reviews (
  id          BIGSERIAL PRIMARY KEY,
  listing_id   BIGINT NOT NULL REFERENCES housing_listings(id) ON DELETE CASCADE,
  author_id    BIGINT NOT NULL REFERENCES users(id),
  rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- E. EMPLOI / STAGE / ALTERNANCE
-- ============================================================================

CREATE TABLE opportunities (
  id                BIGSERIAL PRIMARY KEY,
  publisher_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title              VARCHAR(200) NOT NULL,
  opportunity_type   opportunity_type_enum NOT NULL,
  sector             VARCHAR(120),
  city               VARCHAR(120),
  duration           VARCHAR(60),
  compensation       VARCHAR(100),
  description        TEXT,
  requirements       TEXT[],
  moderation_status  moderation_status_enum NOT NULL DEFAULT 'brouillon',
  moderated_by       BIGINT REFERENCES users(id),
  moderated_at       TIMESTAMPTZ,
  published_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);
CREATE INDEX idx_opportunities_type ON opportunities(opportunity_type);
CREATE INDEX idx_opportunities_status ON opportunities(moderation_status);

CREATE TABLE opportunity_applications (
  id             BIGSERIAL PRIMARY KEY,
  opportunity_id  BIGINT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  applicant_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(30) NOT NULL DEFAULT 'envoyee',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, applicant_id)
);

CREATE TABLE opportunity_favorites (
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id  BIGINT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, opportunity_id)
);

CREATE TABLE employer_contacts (
  id             BIGSERIAL PRIMARY KEY,
  opportunity_id  BIGINT REFERENCES opportunities(id) ON DELETE CASCADE,
  company_name    VARCHAR(200) NOT NULL,
  contact_name    VARCHAR(200),
  contact_email   VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- F. COMMUNICATION
-- ============================================================================

CREATE TABLE conversations (
  id           BIGSERIAL PRIMARY KEY,
  match_id      BIGINT REFERENCES mentorship_matches(id) ON DELETE SET NULL,
  subject       VARCHAR(200),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversation_participants (
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id               BIGSERIAL PRIMARY KEY,
  conversation_id   BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id         BIGINT NOT NULL REFERENCES users(id),
  body              TEXT NOT NULL,
  is_flagged        BOOLEAN NOT NULL DEFAULT FALSE,
  moderation_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
COMMENT ON TABLE messages IS 'Messagerie surveillable : is_flagged déclenché par message_reports, moderation_reviewed tracé pour audit (règle métier n°6).';
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE message_reports (
  id           BIGSERIAL PRIMARY KEY,
  message_id    BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reporter_id   BIGINT NOT NULL REFERENCES users(id),
  reason        report_reason_enum NOT NULL,
  details       TEXT,
  status        VARCHAR(30) NOT NULL DEFAULT 'ouvert',
  reviewed_by   BIGINT REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_message_reports_status ON message_reports(status);

CREATE TABLE notifications (
  id           BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(60) NOT NULL,
  title         VARCHAR(200) NOT NULL,
  body          TEXT,
  read_at       TIMESTAMPTZ,
  link_url      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;

CREATE TABLE contact_requests (
  id             BIGSERIAL PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  user_role       VARCHAR(30),
  target_service  VARCHAR(60) NOT NULL,
  category        request_category_enum NOT NULL,
  message         TEXT NOT NULL,
  priority        priority_enum NOT NULL DEFAULT 'normale',
  consent_data_processing BOOLEAN NOT NULL DEFAULT FALSE,
  status          VARCHAR(30) NOT NULL DEFAULT 'nouveau',
  ticket_id       BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
  id             BIGSERIAL PRIMARY KEY,
  ticket_number   VARCHAR(30) NOT NULL UNIQUE,
  requester_id    BIGINT REFERENCES users(id),
  requester_email VARCHAR(255),
  category        request_category_enum NOT NULL,
  channel         VARCHAR(30) NOT NULL DEFAULT 'contact_form',
  target_service  VARCHAR(60) NOT NULL,
  priority        priority_enum NOT NULL DEFAULT 'normale',
  assigned_to     BIGINT REFERENCES users(id),
  status          ticket_status_enum NOT NULL DEFAULT 'nouveau',
  urgent          BOOLEAN NOT NULL DEFAULT FALSE,
  due_at          TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  response_sent   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_assigned ON tickets(assigned_to);
ALTER TABLE contact_requests ADD CONSTRAINT fk_contact_requests_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;

CREATE TABLE ticket_comments (
  id          BIGSERIAL PRIMARY KEY,
  ticket_id    BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id    BIGINT REFERENCES users(id),
  body         TEXT NOT NULL,
  is_internal  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id, created_at);

CREATE TABLE ticket_attachments (
  id          BIGSERIAL PRIMARY KEY,
  ticket_id    BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  file_name    VARCHAR(255) NOT NULL,
  file_url     TEXT NOT NULL,
  uploaded_by  BIGINT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- G. KANBAN / TRELLO INTERNE À LA PLATEFORME
-- ============================================================================

CREATE TABLE workspaces (
  id          BIGSERIAL PRIMARY KEY,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE workspaces IS 'Regroupement de premier niveau (ex. "Espace interne", "Espaces utilisateurs") au-dessus des boards.';

CREATE TABLE boards (
  id             BIGSERIAL PRIMARY KEY,
  workspace_id    BIGINT REFERENCES workspaces(id) ON DELETE SET NULL,
  name            VARCHAR(200) NOT NULL,
  scope           board_scope_enum NOT NULL,
  owner_role      user_role_enum,
  department_id   BIGINT REFERENCES departments(id),
  description     TEXT,
  icon            VARCHAR(60),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE boards IS 'scope=personal -> reproduit par utilisateur (cards.owner_id) ; pole -> par département ; global -> Kanban central admin (agrégation, sans cartes propres).';

CREATE TABLE board_members (
  board_id   BIGINT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(30) NOT NULL DEFAULT 'membre',
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);

CREATE TABLE board_columns (
  id           BIGSERIAL PRIMARY KEY,
  board_id      BIGINT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name          VARCHAR(120) NOT NULL,
  column_order  SMALLINT NOT NULL,
  is_done_column BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (board_id, column_order)
);

CREATE TABLE labels (
  id      BIGSERIAL PRIMARY KEY,
  name     VARCHAR(60) NOT NULL UNIQUE,
  color    VARCHAR(20) NOT NULL
);

CREATE TABLE cards (
  id                BIGSERIAL PRIMARY KEY,
  board_id           BIGINT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  column_id          BIGINT NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
  title              VARCHAR(300) NOT NULL,
  description        TEXT,
  priority           priority_enum NOT NULL DEFAULT 'normale',
  owner_id           BIGINT REFERENCES users(id),
  created_by         BIGINT NOT NULL REFERENCES users(id),
  department_id      BIGINT REFERENCES departments(id),
  linked_record_type VARCHAR(60),
  linked_record_id   BIGINT,
  due_date           DATE,
  is_blocked         BOOLEAN NOT NULL DEFAULT FALSE,
  card_order         SMALLINT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at        TIMESTAMPTZ
);
COMMENT ON TABLE cards IS 'linked_record_type/linked_record_id pointent librement vers mentorship_matches, housing_listings, opportunities, tickets, document_records, etc. (polymorphe, résolu côté application).';
CREATE INDEX idx_cards_board_column ON cards(board_id, column_id, card_order);
CREATE INDEX idx_cards_owner ON cards(owner_id);
CREATE INDEX idx_cards_due_date ON cards(due_date) WHERE archived_at IS NULL;

CREATE TABLE card_assignees (
  card_id    BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, user_id)
);

CREATE TABLE card_labels (
  card_id  BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  label_id BIGINT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
);

CREATE TABLE card_checklists (
  id        BIGSERIAL PRIMARY KEY,
  card_id    BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  title      VARCHAR(200) NOT NULL DEFAULT 'Checklist',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE card_checklist_items (
  id             BIGSERIAL PRIMARY KEY,
  card_checklist_id BIGINT NOT NULL REFERENCES card_checklists(id) ON DELETE CASCADE,
  label           VARCHAR(300) NOT NULL,
  done            BOOLEAN NOT NULL DEFAULT FALSE,
  item_order      SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE card_comments (
  id         BIGSERIAL PRIMARY KEY,
  card_id     BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  author_id   BIGINT NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_card_comments_card ON card_comments(card_id, created_at);

CREATE TABLE card_attachments (
  id          BIGSERIAL PRIMARY KEY,
  card_id      BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  file_name    VARCHAR(255) NOT NULL,
  file_url     TEXT NOT NULL,
  uploaded_by  BIGINT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE card_activity_logs (
  id          BIGSERIAL PRIMARY KEY,
  card_id      BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  actor_id     BIGINT REFERENCES users(id),
  action       VARCHAR(60) NOT NULL,
  detail       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE card_activity_logs IS 'Journal d activité par carte (déplacement, assignation, commentaire, changement de priorité...) — alimente aussi le journal d audit global si action sensible.';
CREATE INDEX idx_card_activity_card ON card_activity_logs(card_id, created_at DESC);

CREATE TABLE card_links (
  card_id        BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  linked_card_id BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  relation_type  VARCHAR(30) NOT NULL DEFAULT 'related',
  PRIMARY KEY (card_id, linked_card_id),
  CHECK (card_id <> linked_card_id)
);

CREATE TABLE calendar_events (
  id           BIGSERIAL PRIMARY KEY,
  card_id       BIGINT REFERENCES cards(id) ON DELETE CASCADE,
  appointment_id BIGINT REFERENCES appointments(id) ON DELETE CASCADE,
  title         VARCHAR(200) NOT NULL,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  created_by    BIGINT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (card_id IS NOT NULL OR appointment_id IS NOT NULL)
);
CREATE INDEX idx_calendar_events_starts ON calendar_events(starts_at);

-- ============================================================================
-- H. ADMIN / GOUVERNANCE / CONFORMITÉ
-- ============================================================================

CREATE TABLE audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  actor_id       BIGINT REFERENCES users(id),
  action         VARCHAR(120) NOT NULL,
  entity_type    VARCHAR(60) NOT NULL,
  entity_id      BIGINT,
  before_state    JSONB,
  after_state     JSONB,
  ip_address     INET,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE audit_logs IS 'Trace toute action sensible (suspension, changement de rôle, validation/rejet, suppression) - avant/après en JSONB pour rester agnostique du type d entité.';
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);

CREATE TABLE moderation_actions (
  id            BIGSERIAL PRIMARY KEY,
  moderator_id   BIGINT NOT NULL REFERENCES users(id),
  target_type    VARCHAR(60) NOT NULL,
  target_id      BIGINT NOT NULL,
  action_type    moderation_action_enum NOT NULL,
  reason         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_moderation_actions_target ON moderation_actions(target_type, target_id);

CREATE TABLE verification_requests (
  id           BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        verification_status_enum NOT NULL DEFAULT 'en_attente',
  reviewed_by   BIGINT REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_verification_requests_status ON verification_requests(status);

CREATE TABLE document_records (
  id                  BIGSERIAL PRIMARY KEY,
  owner_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                VARCHAR(200) NOT NULL,
  document_type        VARCHAR(60) NOT NULL,
  status               document_status_enum NOT NULL DEFAULT 'en_attente',
  related_record_type  VARCHAR(60),
  related_record_id    BIGINT,
  file_url             TEXT,
  uploaded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_document_records_owner ON document_records(owner_id);
CREATE INDEX idx_document_records_status ON document_records(status);

CREATE TABLE document_reviews (
  id           BIGSERIAL PRIMARY KEY,
  document_id   BIGINT NOT NULL REFERENCES document_records(id) ON DELETE CASCADE,
  reviewer_id   BIGINT NOT NULL REFERENCES users(id),
  decision      document_status_enum NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE escalation_logs (
  id             BIGSERIAL PRIMARY KEY,
  source_type     VARCHAR(60) NOT NULL,
  source_id       BIGINT NOT NULL,
  escalated_by    BIGINT REFERENCES users(id),
  escalated_to    BIGINT REFERENCES users(id),
  reason          TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE system_settings (
  key         VARCHAR(100) PRIMARY KEY,
  value        JSONB NOT NULL,
  description  TEXT,
  updated_by   BIGINT REFERENCES users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feature_flags (
  id           BIGSERIAL PRIMARY KEY,
  code          VARCHAR(80) NOT NULL UNIQUE,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by    BIGINT REFERENCES users(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- I. CONTENU / CMS LÉGER
-- ============================================================================

CREATE TABLE faq_categories (
  id     BIGSERIAL PRIMARY KEY,
  name    VARCHAR(150) NOT NULL,
  slug    VARCHAR(150) NOT NULL UNIQUE,
  category_order SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE faqs (
  id           BIGSERIAL PRIMARY KEY,
  category_id   BIGINT REFERENCES faq_categories(id) ON DELETE SET NULL,
  question      VARCHAR(300) NOT NULL,
  answer        TEXT NOT NULL,
  published     BOOLEAN NOT NULL DEFAULT TRUE,
  author_id     BIGINT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE resource_categories (
  id     BIGSERIAL PRIMARY KEY,
  name    VARCHAR(150) NOT NULL,
  slug    VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE resources (
  id           BIGSERIAL PRIMARY KEY,
  category_id   BIGINT REFERENCES resource_categories(id) ON DELETE SET NULL,
  title         VARCHAR(250) NOT NULL,
  summary       TEXT,
  content       TEXT,
  published     BOOLEAN NOT NULL DEFAULT TRUE,
  author_id     BIGINT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_resources_category ON resources(category_id);

CREATE TABLE announcements (
  id           BIGSERIAL PRIMARY KEY,
  title         VARCHAR(250) NOT NULL,
  body          TEXT NOT NULL,
  audience      VARCHAR(30) NOT NULL DEFAULT 'tous',
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  created_by    BIGINT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE help_articles (
  id           BIGSERIAL PRIMARY KEY,
  title         VARCHAR(250) NOT NULL,
  body          TEXT NOT NULL,
  audience      VARCHAR(30) NOT NULL DEFAULT 'tous',
  published     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE onboarding_flows (
  id           BIGSERIAL PRIMARY KEY,
  role          user_role_enum NOT NULL,
  step_order    SMALLINT NOT NULL,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  UNIQUE (role, step_order)
);

-- ============================================================================
-- TRIGGER GÉNÉRIQUE updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Exemple d'application (à répéter sur chaque table possédant updated_at) :
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_mentorship_matches_updated_at BEFORE UPDATE ON mentorship_matches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_housing_listings_updated_at BEFORE UPDATE ON housing_listings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_opportunities_updated_at BEFORE UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_cards_updated_at BEFORE UPDATE ON cards FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Fin du schéma — ~68 tables couvrant : accès (13), structure interne (4),
-- mentorat (9), logement (5), emploi (4), communication (9), Kanban (14),
-- gouvernance/conformité (8), CMS (7).
-- ============================================================================
