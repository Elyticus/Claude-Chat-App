import pkg from "pg";
import { v4 as uuidv4 } from "uuid";
const { Pool } = pkg;

// TLS for the database connection. The default (managed providers such as
// Render/Supabase terminate TLS with their own CA) keeps `rejectUnauthorized:
// false` for backward compatibility, but operators can — and in production
// should — opt into real certificate validation so the link carrying password
// hashes and message contents can't be silently MITM'd:
//   DATABASE_SSL=strict   → validate the server cert (supply DATABASE_CA if the
//                           provider uses a private/self-signed root)
//   DATABASE_SSL=disable  → no TLS (local Postgres only)
//   unset / anything else → TLS on, cert not verified (previous behaviour)
function buildSsl() {
  if (!process.env.DATABASE_URL) return false;
  const mode = (process.env.DATABASE_SSL || "").toLowerCase();
  if (["disable", "false", "off", "0"].includes(mode)) return false;
  if (["strict", "verify", "true", "1"].includes(mode)) {
    return process.env.DATABASE_CA
      ? { rejectUnauthorized: true, ca: process.env.DATABASE_CA }
      : { rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: buildSsl(),
  min: 0,
  max: 10,
  idleTimeoutMillis: 30_000,
  // Connect timeout is env-tunable — a remote managed DB (Supabase/Render) on a
  // slow link or cold pooler can take longer than the previous fixed 5s, which
  // crashed startup. Default stays 5s; raise via DB_CONNECT_TIMEOUT_MS.
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 5_000,
});

// One-time migration: converts the original SERIAL integer ids (and every
// foreign key referencing them) to UUIDs generated with the `uuid` package.
// Runs inside a single transaction — on any failure the database is left
// untouched. Detected via the data type of users.id; skipped on fresh
// databases (no users table yet) and on already-migrated ones.
async function migrateToUuid() {
  const { rows } = await pool.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_name = 'users' AND column_name = 'id'`,
  );
  if (rows.length === 0 || rows[0].data_type === "uuid") return;

  console.log("[db] Migrating integer ids to UUIDs…");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Parent tables: add the new uuid id, backfilled with uuidv4().
    for (const table of ["users", "rooms", "messages", "pinned_messages", "push_subscriptions"]) {
      await client.query(`ALTER TABLE ${table} ADD COLUMN id_new UUID`);
      const ids = (await client.query(`SELECT id FROM ${table}`)).rows.map((r) => r.id);
      if (ids.length > 0) {
        const uuids = ids.map(() => uuidv4());
        await client.query(
          `UPDATE ${table} t SET id_new = v.uid
           FROM (SELECT unnest($1::int[]) AS oid, unnest($2::uuid[]) AS uid) v
           WHERE t.id = v.oid`,
          [ids, uuids],
        );
      }
    }

    // 2) Remap every foreign key through its parent's new id, drop the old
    //    integer columns (CASCADE removes their PKs/FKs/indexes), rename the
    //    uuid columns into place and restore all constraints.
    await client.query(`
      ALTER TABLE room_members ADD COLUMN room_id_new UUID;
      ALTER TABLE room_members ADD COLUMN user_id_new UUID;
      UPDATE room_members c SET room_id_new = p.id_new FROM rooms p WHERE c.room_id = p.id;
      UPDATE room_members c SET user_id_new = p.id_new FROM users p WHERE c.user_id = p.id;

      ALTER TABLE messages ADD COLUMN room_id_new UUID;
      ALTER TABLE messages ADD COLUMN user_id_new UUID;
      UPDATE messages c SET room_id_new = p.id_new FROM rooms p WHERE c.room_id = p.id;
      UPDATE messages c SET user_id_new = p.id_new FROM users p WHERE c.user_id = p.id;

      ALTER TABLE contacts ADD COLUMN user_id_new UUID;
      ALTER TABLE contacts ADD COLUMN contact_id_new UUID;
      UPDATE contacts c SET user_id_new = p.id_new FROM users p WHERE c.user_id = p.id;
      UPDATE contacts c SET contact_id_new = p.id_new FROM users p WHERE c.contact_id = p.id;

      ALTER TABLE pinned_messages ADD COLUMN room_id_new UUID;
      ALTER TABLE pinned_messages ADD COLUMN message_id_new UUID;
      ALTER TABLE pinned_messages ADD COLUMN pinned_by_new UUID;
      UPDATE pinned_messages c SET room_id_new = p.id_new FROM rooms p WHERE c.room_id = p.id;
      UPDATE pinned_messages c SET message_id_new = p.id_new FROM messages p WHERE c.message_id = p.id;
      UPDATE pinned_messages c SET pinned_by_new = p.id_new FROM users p WHERE c.pinned_by = p.id;

      ALTER TABLE push_subscriptions ADD COLUMN user_id_new UUID;
      UPDATE push_subscriptions c SET user_id_new = p.id_new FROM users p WHERE c.user_id = p.id;

      ALTER TABLE room_members DROP COLUMN room_id CASCADE;
      ALTER TABLE room_members DROP COLUMN user_id CASCADE;
      ALTER TABLE contacts DROP COLUMN user_id CASCADE;
      ALTER TABLE contacts DROP COLUMN contact_id CASCADE;
      ALTER TABLE pinned_messages DROP COLUMN id CASCADE;
      ALTER TABLE pinned_messages DROP COLUMN room_id CASCADE;
      ALTER TABLE pinned_messages DROP COLUMN message_id CASCADE;
      ALTER TABLE pinned_messages DROP COLUMN pinned_by CASCADE;
      ALTER TABLE push_subscriptions DROP COLUMN id CASCADE;
      ALTER TABLE push_subscriptions DROP COLUMN user_id CASCADE;
      ALTER TABLE messages DROP COLUMN id CASCADE;
      ALTER TABLE messages DROP COLUMN room_id CASCADE;
      ALTER TABLE messages DROP COLUMN user_id CASCADE;
      ALTER TABLE rooms DROP COLUMN id CASCADE;
      ALTER TABLE users DROP COLUMN id CASCADE;

      ALTER TABLE users RENAME COLUMN id_new TO id;
      ALTER TABLE rooms RENAME COLUMN id_new TO id;
      ALTER TABLE messages RENAME COLUMN id_new TO id;
      ALTER TABLE messages RENAME COLUMN room_id_new TO room_id;
      ALTER TABLE messages RENAME COLUMN user_id_new TO user_id;
      ALTER TABLE room_members RENAME COLUMN room_id_new TO room_id;
      ALTER TABLE room_members RENAME COLUMN user_id_new TO user_id;
      ALTER TABLE contacts RENAME COLUMN user_id_new TO user_id;
      ALTER TABLE contacts RENAME COLUMN contact_id_new TO contact_id;
      ALTER TABLE pinned_messages RENAME COLUMN id_new TO id;
      ALTER TABLE pinned_messages RENAME COLUMN room_id_new TO room_id;
      ALTER TABLE pinned_messages RENAME COLUMN message_id_new TO message_id;
      ALTER TABLE pinned_messages RENAME COLUMN pinned_by_new TO pinned_by;
      ALTER TABLE push_subscriptions RENAME COLUMN id_new TO id;
      ALTER TABLE push_subscriptions RENAME COLUMN user_id_new TO user_id;

      ALTER TABLE users ALTER COLUMN id SET NOT NULL;
      ALTER TABLE rooms ALTER COLUMN id SET NOT NULL;
      ALTER TABLE messages ALTER COLUMN id SET NOT NULL;
      ALTER TABLE pinned_messages ALTER COLUMN id SET NOT NULL;
      ALTER TABLE push_subscriptions ALTER COLUMN id SET NOT NULL;
      ALTER TABLE users ADD PRIMARY KEY (id);
      ALTER TABLE rooms ADD PRIMARY KEY (id);
      ALTER TABLE messages ADD PRIMARY KEY (id);
      ALTER TABLE pinned_messages ADD PRIMARY KEY (id);
      ALTER TABLE push_subscriptions ADD PRIMARY KEY (id);

      ALTER TABLE room_members ALTER COLUMN room_id SET NOT NULL;
      ALTER TABLE room_members ALTER COLUMN user_id SET NOT NULL;
      ALTER TABLE room_members ADD PRIMARY KEY (room_id, user_id);
      ALTER TABLE contacts ALTER COLUMN user_id SET NOT NULL;
      ALTER TABLE contacts ALTER COLUMN contact_id SET NOT NULL;
      ALTER TABLE contacts ADD PRIMARY KEY (user_id, contact_id);
      ALTER TABLE messages ALTER COLUMN room_id SET NOT NULL;
      ALTER TABLE messages ALTER COLUMN user_id SET NOT NULL;
      ALTER TABLE pinned_messages ALTER COLUMN room_id SET NOT NULL;
      ALTER TABLE pinned_messages ALTER COLUMN message_id SET NOT NULL;
      ALTER TABLE pinned_messages ALTER COLUMN pinned_by SET NOT NULL;
      ALTER TABLE push_subscriptions ALTER COLUMN user_id SET NOT NULL;

      ALTER TABLE room_members ADD FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
      ALTER TABLE room_members ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE messages ADD FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
      ALTER TABLE messages ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE contacts ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE contacts ADD FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE pinned_messages ADD FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
      ALTER TABLE pinned_messages ADD FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;
      ALTER TABLE pinned_messages ADD FOREIGN KEY (pinned_by) REFERENCES users(id);
      ALTER TABLE pinned_messages ADD UNIQUE (room_id, message_id);
      ALTER TABLE push_subscriptions ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    `);

    await client.query("COMMIT");
    console.log("[db] UUID migration complete");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function initDb() {
  await migrateToUuid();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
      last_seen     BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
    -- ── Plans & billing (Linkloop Pro) ──────────────────────────────────────
    -- plan is the source of truth for feature gating; it can change within a
    -- token's 7-day life, so gating middleware reads it from the DB (not JWT).
    ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'active';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_since BIGINT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS current_period_end BIGINT;
    -- Per-user, per-day usage meter (e.g. free-tier AI actions). period_day is
    -- a 'YYYY-MM-DD' string so a simple UPSERT increments today's bucket.
    CREATE TABLE IF NOT EXISTS usage_counters (
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      metric     TEXT NOT NULL,
      period_day TEXT NOT NULL,
      count      INT  NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, metric, period_day)
    );
    -- Mock-billing audit trail — one row per checkout (mirrors a Stripe sub).
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                 UUID PRIMARY KEY,
      user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan               TEXT NOT NULL,
      status             TEXT NOT NULL DEFAULT 'pending',
      checkout_id        TEXT NOT NULL,
      started_at         BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
      current_period_end BIGINT
    );
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
    CREATE TABLE IF NOT EXISTS pending_verifications (
      email         TEXT PRIMARY KEY,
      username      TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      code          TEXT NOT NULL,
      expires_at    BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id          UUID PRIMARY KEY,
      name        TEXT,
      is_group    SMALLINT DEFAULT 0,
      type        TEXT DEFAULT 'room',
      slug        TEXT,
      description TEXT,
      created_at  BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'room';
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS slug TEXT;
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_slug ON rooms(slug) WHERE slug IS NOT NULL;
    CREATE TABLE IF NOT EXISTS room_members (
      room_id   UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
      is_new    SMALLINT DEFAULT 0,
      added_by  TEXT,
      role      TEXT DEFAULT 'member',
      PRIMARY KEY (room_id, user_id)
    );
    ALTER TABLE room_members ADD COLUMN IF NOT EXISTS is_new SMALLINT DEFAULT 0;
    ALTER TABLE room_members ADD COLUMN IF NOT EXISTS added_by TEXT;
    ALTER TABLE room_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';
    ALTER TABLE room_members ADD COLUMN IF NOT EXISTS muted_until BIGINT;
    ALTER TABLE room_members ADD COLUMN IF NOT EXISTS role_notification TEXT;
    -- Default NOW() so the column backfills existing memberships to a clean
    -- slate (no flood of historical "unread") and new memberships floor unread
    -- at join time.
    ALTER TABLE room_members ADD COLUMN IF NOT EXISTS last_read_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT;
    CREATE TABLE IF NOT EXISTS messages (
      id         UUID PRIMARY KEY,
      room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text       TEXT NOT NULL,
      reaction   TEXT,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_system SMALLINT DEFAULT 0;
    CREATE TABLE IF NOT EXISTS pinned_messages (
      id         UUID PRIMARY KEY,
      room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      pinned_by  UUID NOT NULL REFERENCES users(id),
      pinned_at  BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
      UNIQUE (room_id, message_id)
    );
    CREATE TABLE IF NOT EXISTS contacts (
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
      PRIMARY KEY (user_id, contact_id)
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      email      TEXT PRIMARY KEY,
      code       TEXT NOT NULL,
      expires_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         UUID PRIMARY KEY,
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint   TEXT NOT NULL UNIQUE,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );
    -- Message attachments (Linkloop Pro media & voice). One row per uploaded
    -- file; storage_path is the on-disk name under server/uploads (files are
    -- served only through the auth+membership-gated stream route, never public).
    CREATE TABLE IF NOT EXISTS attachments (
      id           UUID PRIMARY KEY,
      message_id   UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      room_id      UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      kind         TEXT NOT NULL,            -- image | file | voice
      filename     TEXT NOT NULL,            -- original (display) name
      mime         TEXT NOT NULL,
      size         BIGINT NOT NULL,
      storage_path TEXT NOT NULL,
      duration     INT,                      -- seconds, voice only
      width        INT,
      height       INT,
      created_at   BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );
    CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
    -- Full-text search (Linkloop Pro global search). A generated tsvector +
    -- GIN index makes ranked search across a user's rooms fast. PG12+ (Supabase).
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS tsv tsvector
      GENERATED ALWAYS AS (to_tsvector('english', text)) STORED;
    CREATE INDEX IF NOT EXISTS idx_messages_tsv ON messages USING GIN(tsv);
    CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_contact ON contacts(contact_id);
    CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
    -- Enable RLS on every table so Supabase's public REST API (anon/authenticated
    -- roles) cannot read or write rows directly. The Node backend connects as the
    -- postgres superuser which has BYPASSRLS, so this change is invisible to the
    -- application and does not require any policies to be created.
    ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
    ALTER TABLE pending_verifications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE rooms                 ENABLE ROW LEVEL SECURITY;
    ALTER TABLE room_members          ENABLE ROW LEVEL SECURITY;
    ALTER TABLE messages              ENABLE ROW LEVEL SECURITY;
    ALTER TABLE pinned_messages       ENABLE ROW LEVEL SECURITY;
    ALTER TABLE contacts              ENABLE ROW LEVEL SECURITY;
    ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
    ALTER TABLE push_subscriptions    ENABLE ROW LEVEL SECURITY;
    ALTER TABLE usage_counters        ENABLE ROW LEVEL SECURITY;
    ALTER TABLE subscriptions         ENABLE ROW LEVEL SECURITY;
    ALTER TABLE attachments           ENABLE ROW LEVEL SECURITY;

    -- One-time, idempotent data migrations, tracked by name so they never re-run.
    CREATE TABLE IF NOT EXISTS app_migrations (
      name       TEXT PRIMARY KEY,
      applied_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );
    ALTER TABLE app_migrations ENABLE ROW LEVEL SECURITY;
    -- Rename plan tiers free/pro/business → free/lite/pro. Guarded by a marker
    -- because it is NOT self-idempotent: re-running would wrongly demote the new
    -- top 'pro' tier back to 'lite'. Order matters (pro→lite before business→pro)
    -- so the two renames don't collide.
    DO $do$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM app_migrations WHERE name = 'rename_plans_lite_pro_v1') THEN
        UPDATE users         SET plan = 'lite' WHERE plan = 'pro';
        UPDATE users         SET plan = 'pro'  WHERE plan = 'business';
        UPDATE subscriptions SET plan = 'lite' WHERE plan = 'pro';
        UPDATE subscriptions SET plan = 'pro'  WHERE plan = 'business';
        INSERT INTO app_migrations (name) VALUES ('rename_plans_lite_pro_v1');
      END IF;
    END $do$;
  `);
}

const q = (sql, params) => pool.query(sql, params);

export const queries = {
  getUserByEmail:    { get: (email)    => q("SELECT * FROM users WHERE email = $1", [email]).then(r => r.rows[0] ?? null) },
  getUserByUsername: { get: (username) => q("SELECT * FROM users WHERE username = $1", [username]).then(r => r.rows[0] ?? null) },
  // No email here — this feeds GET /api/users/:id (readable by any
  // authenticated user) and internal username lookups; returning other
  // users' email addresses would leak PII.
  getUserById:       { get: (id)       => q("SELECT id, username, last_seen, avatar FROM users WHERE id = $1", [id]).then(r => r.rows[0] ?? null) },
  // Self-view for GET /api/me — includes email + plan (only ever returned to
  // the authenticated owner, never via the public /api/users/:id route).
  getSelfById:       { get: (id)       => q("SELECT id, username, email, avatar, plan, plan_status, current_period_end FROM users WHERE id = $1", [id]).then(r => r.rows[0] ?? null) },
  getUsersWithStatus: {
    all: (currentUserId) =>
      q(`SELECT u.id, u.username, u.last_seen, u.avatar,
                CASE
                  WHEN c_sent.status = 'accepted'  THEN 'accepted'
                  WHEN c_recv.status = 'accepted'  THEN 'accepted'
                  WHEN c_sent.status = 'pending'   THEN 'pending_sent'
                  WHEN c_recv.status = 'pending'   THEN 'pending_received'
                  ELSE NULL
                END AS contact_status
         FROM users u
         LEFT JOIN contacts c_sent ON c_sent.user_id    = $1 AND c_sent.contact_id = u.id
         LEFT JOIN contacts c_recv ON c_recv.contact_id = $1 AND c_recv.user_id    = u.id
         WHERE u.id != $1
         ORDER BY u.username ASC`, [currentUserId]).then(r => r.rows),
  },
  getContactStatus: {
    get: (uid1, uid2) =>
      q(`SELECT status FROM contacts WHERE (user_id = $1 AND contact_id = $2) OR (user_id = $2 AND contact_id = $1) LIMIT 1`,
        [uid1, uid2]).then(r => r.rows[0] ?? null),
  },
  // Full row (incl. direction) for a pair — lets the delete handler tell a
  // "decline incoming request" apart from "cancel my request" / "unfriend".
  getContactPair: {
    get: (uid1, uid2) =>
      q(`SELECT user_id, contact_id, status FROM contacts WHERE (user_id = $1 AND contact_id = $2) OR (user_id = $2 AND contact_id = $1) LIMIT 1`,
        [uid1, uid2]).then(r => r.rows[0] ?? null),
  },
  sendContactRequest: {
    run: (userId, contactId) =>
      q(`INSERT INTO contacts (user_id, contact_id, status) VALUES ($1, $2, 'pending') ON CONFLICT (user_id, contact_id) DO NOTHING`,
        [userId, contactId]),
  },
  acceptContactRequest: {
    run: (userId, requesterId) =>
      q(`UPDATE contacts SET status = 'accepted' WHERE user_id = $1 AND contact_id = $2 AND status = 'pending'`,
        [requesterId, userId]),
  },
  removeContact: {
    run: (uid1, uid2) =>
      q(`DELETE FROM contacts WHERE (user_id = $1 AND contact_id = $2) OR (user_id = $2 AND contact_id = $1)`,
        [uid1, uid2]),
  },

  upsertPending: {
    run: (email, username, hash, code, expiresAt) =>
      q(`INSERT INTO pending_verifications (email, username, password_hash, code, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET
           username = EXCLUDED.username,
           password_hash = EXCLUDED.password_hash,
           code = EXCLUDED.code,
           expires_at = EXCLUDED.expires_at`,
        [email, username, hash, code, expiresAt]),
  },
  getPending:    { get: (email) => q("SELECT * FROM pending_verifications WHERE email = $1", [email]).then(r => r.rows[0] ?? null) },
  deletePending: { run: (email) => q("DELETE FROM pending_verifications WHERE email = $1", [email]) },

  createUser: {
    run: (username, email, hash) =>
      q("INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id", [uuidv4(), username, email, hash])
        .then(r => ({ lastInsertRowid: r.rows[0].id })),
  },
  touchUser:      { run: (id)           => q("UPDATE users SET last_seen = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $1", [id]) },
  updateAvatar:   { run: (id, avatar)   => q("UPDATE users SET avatar = $1 WHERE id = $2", [avatar, id]) },
  updatePassword: { run: (hash, email)  => q("UPDATE users SET password_hash = $1 WHERE email = $2", [hash, email]) },

  // ── Plans & billing ──────────────────────────────────────────────────────
  // Lightweight plan lookup for gating middleware (one indexed PK read).
  getUserPlan: {
    get: (id) =>
      q("SELECT plan, plan_status, plan_since, current_period_end FROM users WHERE id = $1", [id])
        .then(r => r.rows[0] ?? null),
  },
  setUserPlan: {
    run: (id, plan, status, periodEnd) =>
      q(`UPDATE users SET plan = $2, plan_status = $3,
                plan_since = EXTRACT(EPOCH FROM NOW())::BIGINT, current_period_end = $4
         WHERE id = $1`, [id, plan, status, periodEnd]),
  },
  setPlanStatus: {
    run: (id, status) => q("UPDATE users SET plan_status = $2 WHERE id = $1", [id, status]),
  },
  createSubscription: {
    run: (id, userId, plan, status, checkoutId, periodEnd) =>
      q(`INSERT INTO subscriptions (id, user_id, plan, status, checkout_id, current_period_end)
         VALUES ($1, $2, $3, $4, $5, $6)`, [id, userId, plan, status, checkoutId, periodEnd]),
  },

  // ── Usage metering ───────────────────────────────────────────────────────
  // Atomic increment of today's bucket; returns the new count so the caller
  // can enforce a per-day quota in one round-trip.
  incrementUsage: {
    run: (userId, metric, periodDay) =>
      q(`INSERT INTO usage_counters (user_id, metric, period_day, count)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (user_id, metric, period_day)
         DO UPDATE SET count = usage_counters.count + 1
         RETURNING count`, [userId, metric, periodDay]).then(r => r.rows[0].count),
  },
  getUsage: {
    get: (userId, metric, periodDay) =>
      q("SELECT count FROM usage_counters WHERE user_id = $1 AND metric = $2 AND period_day = $3",
        [userId, metric, periodDay]).then(r => r.rows[0]?.count ?? 0),
  },

  upsertResetToken: {
    run: (email, code, expiresAt) =>
      q(`INSERT INTO password_reset_tokens (email, code, expires_at) VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at`,
        [email, code, expiresAt]),
  },
  getResetToken:    { get: (email) => q("SELECT * FROM password_reset_tokens WHERE email = $1", [email]).then(r => r.rows[0] ?? null) },
  deleteResetToken: { run: (email) => q("DELETE FROM password_reset_tokens WHERE email = $1", [email]) },

  // Sweep stale rows so unfinished signups / reset requests don't leave password
  // hashes and verification codes sitting in the DB forever. `expires_at` is
  // epoch milliseconds, matching how the auth handlers write it.
  deleteExpiredPending:     { run: () => q("DELETE FROM pending_verifications WHERE expires_at < $1", [Date.now()]) },
  deleteExpiredResetTokens: { run: () => q("DELETE FROM password_reset_tokens WHERE expires_at < $1", [Date.now()]) },

  createRoom: {
    run: (is_group, name) =>
      q("INSERT INTO rooms (id, is_group, name) VALUES ($1, $2, $3) RETURNING id", [uuidv4(), is_group, name])
        .then(r => ({ lastInsertRowid: r.rows[0].id })),
  },
  addMember: {
    run: (room_id, user_id) =>
      q("INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [room_id, user_id]),
  },

  findDmRoom: {
    get: (uid1, uid2) =>
      q(`SELECT r.id FROM rooms r
         JOIN room_members rm1 ON rm1.room_id = r.id AND rm1.user_id = $1
         JOIN room_members rm2 ON rm2.room_id = r.id AND rm2.user_id = $2
         WHERE r.is_group = 0 LIMIT 1`, [uid1, uid2]).then(r => r.rows[0] ?? null),
  },

  getUserRooms: {
    all: (uid) =>
      q(`SELECT r.id, r.name, r.is_group, r.type, r.slug, r.description,
                rm.is_new, rm.added_by, rm.role, rm.role_notification,
                m.text AS last_message, m.created_at AS last_message_at,
                mu.id AS other_user_id, mu.username AS other_username,
                (SELECT COUNT(*) FROM messages um
                  WHERE um.room_id = r.id
                    AND um.user_id != $1
                    AND um.is_system = 0
                    AND um.created_at > COALESCE(rm.last_read_at, rm.joined_at, 0)
                )::INT AS unread_count
         FROM rooms r
         JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = $1
         LEFT JOIN messages m ON m.id = (
           SELECT id FROM messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1
         )
         LEFT JOIN room_members rm2 ON rm2.room_id = r.id AND rm2.user_id != $1 AND r.is_group = 0
         LEFT JOIN users mu ON mu.id = rm2.user_id
         ORDER BY COALESCE(m.created_at, r.created_at) DESC`, [uid]).then(r => r.rows),
  },

  getRoomMessages: {
    // Returns the 50 most recent messages before `before` (epoch seconds), plus a hasMore flag.
    // Fetches 51 rows; if exactly 51 come back there are older messages to load.
    page: (roomId, before) => {
      const params = before ? [roomId, before] : [roomId];
      const cursor = before ? "AND m.created_at < $2" : "";
      return q(
        `SELECT m.id, m.text, m.reaction, m.created_at, m.is_system AS system, u.id AS user_id, u.username,
                CASE WHEN a.id IS NOT NULL THEN json_build_object(
                  'id', a.id, 'kind', a.kind, 'name', a.filename, 'mime', a.mime,
                  'size', a.size, 'duration', a.duration, 'width', a.width, 'height', a.height
                ) END AS attachment
         FROM messages m JOIN users u ON u.id = m.user_id
         LEFT JOIN attachments a ON a.message_id = m.id
         WHERE m.room_id = $1 ${cursor}
         ORDER BY m.created_at DESC LIMIT 51`,
        params,
      ).then((r) => {
        const hasMore = r.rows.length > 50;
        return { messages: r.rows.slice(0, 50).reverse(), hasMore };
      });
    },
  },

  isMember:      { get: (roomId, userId) => q("SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2", [roomId, userId]).then(r => r.rows[0] ?? null) },

  insertMessage: {
    run: (roomId, userId, text, isSystem = false) =>
      q("INSERT INTO messages (id, room_id, user_id, text, is_system) VALUES ($1, $2, $3, $4, $5) RETURNING id", [uuidv4(), roomId, userId, text, isSystem ? 1 : 0])
        .then(r => ({ lastInsertRowid: r.rows[0].id })),
  },

  getMessageById: {
    get: (id) =>
      q(`SELECT m.id, m.text, m.reaction, m.created_at, u.id AS user_id, u.username, m.room_id,
                CASE WHEN a.id IS NOT NULL THEN json_build_object(
                  'id', a.id, 'kind', a.kind, 'name', a.filename, 'mime', a.mime,
                  'size', a.size, 'duration', a.duration, 'width', a.width, 'height', a.height
                ) END AS attachment
         FROM messages m JOIN users u ON u.id = m.user_id
         LEFT JOIN attachments a ON a.message_id = m.id
         WHERE m.id = $1`, [id]).then(r => r.rows[0] ?? null),
  },

  setReaction:    { run: (reaction, id)   => q("UPDATE messages SET reaction = $1 WHERE id = $2", [reaction, id]) },
  deleteMessage:   { run: (id, userId) => q("DELETE FROM messages WHERE id = $1 AND user_id = $2", [id, userId]) },
  deleteMessageById: { run: (id)        => q("DELETE FROM messages WHERE id = $1", [id]) },
  removeMember:   { run: (roomId, userId) => q("DELETE FROM room_members WHERE room_id = $1 AND user_id = $2", [roomId, userId]) },
  memberCount:    { get: (roomId)         => q("SELECT COUNT(*)::INT AS cnt FROM room_members WHERE room_id = $1", [roomId]).then(r => r.rows[0]) },
  deleteRoom:     { run: (roomId)         => q("DELETE FROM rooms WHERE id = $1", [roomId]) },
  getUserRoomIds: { all: (userId)         => q("SELECT room_id FROM room_members WHERE user_id = $1", [userId]).then(r => r.rows) },
  getSharedRoomIds: { all: (userA, userB) => q("SELECT room_id FROM room_members WHERE user_id = $1 AND room_id IN (SELECT room_id FROM room_members WHERE user_id = $2)", [userA, userB]).then(r => r.rows) },
  setRoomNew:          { run: (roomId, userId, addedBy) => q("UPDATE room_members SET is_new = 1, added_by = $3 WHERE room_id = $1 AND user_id = $2", [roomId, userId, addedBy]) },
  setRoleNotification: { run: (roomId, userId, text)    => q("UPDATE room_members SET role_notification = $3 WHERE room_id = $1 AND user_id = $2", [roomId, userId, text]) },
  markRoomSeen:        { run: (roomId, userId)          => q("UPDATE room_members SET is_new = 0, role_notification = NULL, last_read_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE room_id = $1 AND user_id = $2", [roomId, userId]) },

  getRoomMembers: {
    all: (roomId) =>
      q(`SELECT u.id, u.username, u.avatar, rm.role, rm.muted_until FROM users u
         JOIN room_members rm ON rm.user_id = u.id
         WHERE rm.room_id = $1 ORDER BY u.username ASC`, [roomId]).then(r => r.rows),
  },

  getRoomOwner: {
    get: (roomId) =>
      q("SELECT user_id FROM room_members WHERE room_id = $1 AND role = 'owner'", [roomId])
        .then(r => r.rows[0]?.user_id ?? null),
  },

  // How many channels this user currently owns — drives the per-plan channel cap.
  countOwnedChannels: {
    get: (userId) =>
      q(`SELECT COUNT(*)::int AS n
           FROM room_members rm
           JOIN rooms r ON r.id = rm.room_id
          WHERE rm.user_id = $1 AND rm.role = 'owner'
            AND r.type IN ('channel', 'private_channel')`, [userId])
        .then(r => r.rows[0]?.n ?? 0),
  },

  updateRoom: {
    run: (roomId, name, description, slug = null) =>
      q("UPDATE rooms SET name = $1, description = $2, slug = COALESCE($3, slug) WHERE id = $4", [name, description ?? null, slug, roomId]),
  },

  getMuted: {
    get: (roomId, userId) =>
      q("SELECT muted_until FROM room_members WHERE room_id = $1 AND user_id = $2", [roomId, userId])
        .then(r => r.rows[0]?.muted_until ?? null),
  },

  setMuted: {
    run: (roomId, userId, mutedUntil) =>
      q("UPDATE room_members SET muted_until = $1 WHERE room_id = $2 AND user_id = $3", [mutedUntil, roomId, userId]),
  },

  pinMessage: {
    run: (roomId, messageId, pinnedBy) =>
      q("INSERT INTO pinned_messages (id, room_id, message_id, pinned_by) VALUES ($1, $2, $3, $4) ON CONFLICT (room_id, message_id) DO NOTHING",
        [uuidv4(), roomId, messageId, pinnedBy]),
  },

  unpinMessage: {
    run: (roomId, messageId) =>
      q("DELETE FROM pinned_messages WHERE room_id = $1 AND message_id = $2", [roomId, messageId]),
  },

  getPin: {
    get: (roomId, messageId) =>
      q("SELECT id FROM pinned_messages WHERE room_id = $1 AND message_id = $2", [roomId, messageId])
        .then(r => r.rows[0] ?? null),
  },

  getPinnedMessages: {
    all: (roomId) =>
      q(`SELECT pm.pinned_at, m.id AS message_id, m.text, m.created_at,
                u.username AS author, pu.username AS pinned_by
         FROM pinned_messages pm
         JOIN messages m  ON m.id  = pm.message_id
         JOIN users u     ON u.id  = m.user_id
         JOIN users pu    ON pu.id = pm.pinned_by
         WHERE pm.room_id = $1
         ORDER BY pm.pinned_at DESC`, [roomId]).then(r => r.rows),
  },

  getRoomById: {
    get: (roomId) =>
      q("SELECT id, name, is_group, type, slug, description FROM rooms WHERE id = $1", [roomId])
        .then(r => r.rows[0] ?? null),
  },

  createChannel: {
    run: (name, slug, description, isPrivate) =>
      q("INSERT INTO rooms (id, name, slug, description, is_group, type) VALUES ($1, $2, $3, $4, 1, $5) RETURNING id",
        [uuidv4(), name, slug, description || null, isPrivate ? 'private_channel' : 'channel'])
        .then(r => ({ lastInsertRowid: r.rows[0].id })),
  },

  getChannelBySlug: {
    get: (slug) =>
      q("SELECT id, name, slug, description, type, created_at FROM rooms WHERE slug = $1", [slug])
        .then(r => r.rows[0] ?? null),
  },

  getMemberRole: {
    get: (roomId, userId) =>
      q("SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2", [roomId, userId])
        .then(r => r.rows[0]?.role ?? null),
  },

  setMemberRole: {
    run: (roomId, userId, role) =>
      q("UPDATE room_members SET role = $1 WHERE room_id = $2 AND user_id = $3", [role, roomId, userId]),
  },

  addMemberWithRole: {
    run: (roomId, userId, role) =>
      q("INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (room_id, user_id) DO NOTHING",
        [roomId, userId, role]),
  },

  upsertPushSubscription: {
    run: (userId, endpoint, p256dh, auth) =>
      q(`INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
        [uuidv4(), userId, endpoint, p256dh, auth]),
  },

  deletePushSubscription: {
    run: (userId, endpoint) =>
      q("DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2", [userId, endpoint]),
  },

  // ── Full-text message search (Pro: global, Free: single room) ──────────────
  // Joins room_members so only the requester's own conversations are searched —
  // never leaks messages from rooms they aren't in. `roomId` (optional) scopes
  // to one room for the Free tier. Returns a highlighted snippet (« » markers)
  // ranked by relevance then recency.
  searchMessages: {
    all: (userId, query, limit, roomId = null) => {
      const params = roomId ? [userId, query, limit, roomId] : [userId, query, limit];
      const roomFilter = roomId ? "AND m.room_id = $4" : "";
      return q(
        `SELECT m.id AS message_id, m.room_id, m.created_at,
                u.username AS author, r.name AS room_name, r.is_group, r.type,
                ts_headline('english', m.text, websearch_to_tsquery('english', $2),
                  'StartSel=«,StopSel=»,MaxFragments=1,MaxWords=14,MinWords=4,ShortWord=2') AS snippet
         FROM messages m
         JOIN room_members rm ON rm.room_id = m.room_id AND rm.user_id = $1
         JOIN users u  ON u.id = m.user_id
         JOIN rooms r  ON r.id = m.room_id
         WHERE m.is_system = 0
           AND m.tsv @@ websearch_to_tsquery('english', $2)
           ${roomFilter}
         ORDER BY ts_rank(m.tsv, websearch_to_tsquery('english', $2)) DESC, m.created_at DESC
         LIMIT $3`,
        params,
      ).then((r) => r.rows);
    },
  },

  // ── Attachments ────────────────────────────────────────────────────────────
  insertAttachment: {
    run: (id, messageId, userId, roomId, kind, filename, mime, size, storagePath, duration, width, height) =>
      q(`INSERT INTO attachments
            (id, message_id, user_id, room_id, kind, filename, mime, size, storage_path, duration, width, height)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id, messageId, userId, roomId, kind, filename, mime, size, storagePath, duration, width, height]),
  },
  getAttachmentById: {
    get: (id) =>
      q("SELECT id, room_id, kind, filename, mime, size, storage_path FROM attachments WHERE id = $1", [id])
        .then(r => r.rows[0] ?? null),
  },

  getPushSubscriptionsForRoom: {
    all: (roomId, excludeUserId) =>
      q(`SELECT ps.user_id, ps.endpoint, ps.p256dh, ps.auth
         FROM push_subscriptions ps
         JOIN room_members rm ON rm.user_id = ps.user_id AND rm.room_id = $1
         WHERE ps.user_id != $2`,
        [roomId, excludeUserId]).then(r => r.rows),
  },
};

export { pool as db };
