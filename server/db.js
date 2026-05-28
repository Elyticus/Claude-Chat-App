import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  min: 2,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
      last_seen     BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
    CREATE TABLE IF NOT EXISTS pending_verifications (
      email         TEXT PRIMARY KEY,
      username      TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      code          TEXT NOT NULL,
      expires_at    BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id          SERIAL PRIMARY KEY,
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
      room_id   INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    CREATE TABLE IF NOT EXISTS messages (
      id         SERIAL PRIMARY KEY,
      room_id    INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text       TEXT NOT NULL,
      reaction   TEXT,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_system SMALLINT DEFAULT 0;
    CREATE TABLE IF NOT EXISTS pinned_messages (
      id         SERIAL PRIMARY KEY,
      room_id    INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      pinned_by  INTEGER NOT NULL REFERENCES users(id),
      pinned_at  BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
      UNIQUE (room_id, message_id)
    );
    CREATE TABLE IF NOT EXISTS contacts (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint   TEXT NOT NULL UNIQUE,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );
    CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_contact ON contacts(contact_id);
    CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
  `);
}

const q = (sql, params) => pool.query(sql, params);

export const queries = {
  getUserByEmail:    { get: (email)    => q("SELECT * FROM users WHERE email = $1", [email]).then(r => r.rows[0] ?? null) },
  getUserByUsername: { get: (username) => q("SELECT * FROM users WHERE username = $1", [username]).then(r => r.rows[0] ?? null) },
  getUserById:       { get: (id)       => q("SELECT id, username, email, last_seen, avatar FROM users WHERE id = $1", [id]).then(r => r.rows[0] ?? null) },
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
      q("INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id", [username, email, hash])
        .then(r => ({ lastInsertRowid: r.rows[0].id })),
  },
  touchUser:      { run: (id)           => q("UPDATE users SET last_seen = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $1", [id]) },
  updateAvatar:   { run: (id, avatar)   => q("UPDATE users SET avatar = $1 WHERE id = $2", [avatar, id]) },
  updatePassword: { run: (hash, email)  => q("UPDATE users SET password_hash = $1 WHERE email = $2", [hash, email]) },

  upsertResetToken: {
    run: (email, code, expiresAt) =>
      q(`INSERT INTO password_reset_tokens (email, code, expires_at) VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at`,
        [email, code, expiresAt]),
  },
  getResetToken:    { get: (email) => q("SELECT * FROM password_reset_tokens WHERE email = $1", [email]).then(r => r.rows[0] ?? null) },
  deleteResetToken: { run: (email) => q("DELETE FROM password_reset_tokens WHERE email = $1", [email]) },

  createRoom: {
    run: (is_group, name) =>
      q("INSERT INTO rooms (is_group, name) VALUES ($1, $2) RETURNING id", [is_group, name])
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
                mu.id AS other_user_id, mu.username AS other_username
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
        `SELECT m.id, m.text, m.reaction, m.created_at, m.is_system AS system, u.id AS user_id, u.username
         FROM messages m JOIN users u ON u.id = m.user_id
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
      q("INSERT INTO messages (room_id, user_id, text, is_system) VALUES ($1, $2, $3, $4) RETURNING id", [roomId, userId, text, isSystem ? 1 : 0])
        .then(r => ({ lastInsertRowid: r.rows[0].id })),
  },

  getMessageById: {
    get: (id) =>
      q(`SELECT m.id, m.text, m.reaction, m.created_at, u.id AS user_id, u.username, m.room_id
         FROM messages m JOIN users u ON u.id = m.user_id WHERE m.id = $1`, [id]).then(r => r.rows[0] ?? null),
  },

  setReaction:    { run: (reaction, id)   => q("UPDATE messages SET reaction = $1 WHERE id = $2", [reaction, id]) },
  deleteMessage:   { run: (id, userId) => q("DELETE FROM messages WHERE id = $1 AND user_id = $2", [id, userId]) },
  deleteMessageById: { run: (id)        => q("DELETE FROM messages WHERE id = $1", [id]) },
  removeMember:   { run: (roomId, userId) => q("DELETE FROM room_members WHERE room_id = $1 AND user_id = $2", [roomId, userId]) },
  memberCount:    { get: (roomId)         => q("SELECT COUNT(*)::INT AS cnt FROM room_members WHERE room_id = $1", [roomId]).then(r => r.rows[0]) },
  deleteRoom:     { run: (roomId)         => q("DELETE FROM rooms WHERE id = $1", [roomId]) },
  getUserRoomIds: { all: (userId)         => q("SELECT room_id FROM room_members WHERE user_id = $1", [userId]).then(r => r.rows) },
  setRoomNew:          { run: (roomId, userId, addedBy) => q("UPDATE room_members SET is_new = 1, added_by = $3 WHERE room_id = $1 AND user_id = $2", [roomId, userId, addedBy]) },
  setRoleNotification: { run: (roomId, userId, text)    => q("UPDATE room_members SET role_notification = $3 WHERE room_id = $1 AND user_id = $2", [roomId, userId, text]) },
  markRoomSeen:        { run: (roomId, userId)          => q("UPDATE room_members SET is_new = 0, role_notification = NULL WHERE room_id = $1 AND user_id = $2", [roomId, userId]) },

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
      q("INSERT INTO pinned_messages (room_id, message_id, pinned_by) VALUES ($1, $2, $3) ON CONFLICT (room_id, message_id) DO NOTHING",
        [roomId, messageId, pinnedBy]),
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
      q("INSERT INTO rooms (name, slug, description, is_group, type) VALUES ($1, $2, $3, 1, $4) RETURNING id",
        [name, slug, description || null, isPrivate ? 'private_channel' : 'channel'])
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
      q(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
        [userId, endpoint, p256dh, auth]),
  },

  deletePushSubscription: {
    run: (userId, endpoint) =>
      q("DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2", [userId, endpoint]),
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
