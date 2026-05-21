import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
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
    CREATE TABLE IF NOT EXISTS rooms (
      id         SERIAL PRIMARY KEY,
      name       TEXT,
      is_group   SMALLINT DEFAULT 0,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );
    CREATE TABLE IF NOT EXISTS room_members (
      room_id   INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
      PRIMARY KEY (room_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id         SERIAL PRIMARY KEY,
      room_id    INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text       TEXT NOT NULL,
      reaction   TEXT,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );
    CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
  `);
}

const q = (sql, params) => pool.query(sql, params);

export const queries = {
  getUserByEmail:    { get: (email)    => q("SELECT * FROM users WHERE email = $1", [email]).then(r => r.rows[0] ?? null) },
  getUserByUsername: { get: (username) => q("SELECT * FROM users WHERE username = $1", [username]).then(r => r.rows[0] ?? null) },
  getUserById:       { get: (id)       => q("SELECT id, username, email, last_seen FROM users WHERE id = $1", [id]).then(r => r.rows[0] ?? null) },
  getAllUsersExcept:  { all: (id)       => q("SELECT id, username, email, last_seen FROM users WHERE id != $1", [id]).then(r => r.rows) },

  createUser: {
    run: (username, email, hash) =>
      q("INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id", [username, email, hash])
        .then(r => ({ lastInsertRowid: r.rows[0].id })),
  },
  touchUser: { run: (id) => q("UPDATE users SET last_seen = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $1", [id]) },

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
      q(`SELECT r.id, r.name, r.is_group,
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
    all: (roomId) =>
      q(`SELECT m.id, m.text, m.reaction, m.created_at, u.id AS user_id, u.username
         FROM messages m JOIN users u ON u.id = m.user_id
         WHERE m.room_id = $1 ORDER BY m.created_at ASC LIMIT 200`, [roomId]).then(r => r.rows),
  },

  isMember:      { get: (roomId, userId) => q("SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2", [roomId, userId]).then(r => r.rows[0] ?? null) },

  insertMessage: {
    run: (roomId, userId, text) =>
      q("INSERT INTO messages (room_id, user_id, text) VALUES ($1, $2, $3) RETURNING id", [roomId, userId, text])
        .then(r => ({ lastInsertRowid: r.rows[0].id })),
  },

  getMessageById: {
    get: (id) =>
      q(`SELECT m.id, m.text, m.reaction, m.created_at, u.id AS user_id, u.username, m.room_id
         FROM messages m JOIN users u ON u.id = m.user_id WHERE m.id = $1`, [id]).then(r => r.rows[0] ?? null),
  },

  setReaction:    { run: (reaction, id)   => q("UPDATE messages SET reaction = $1 WHERE id = $2", [reaction, id]) },
  deleteMessage:  { run: (id, userId)     => q("DELETE FROM messages WHERE id = $1 AND user_id = $2", [id, userId]) },
  removeMember:   { run: (roomId, userId) => q("DELETE FROM room_members WHERE room_id = $1 AND user_id = $2", [roomId, userId]) },
  memberCount:    { get: (roomId)         => q("SELECT COUNT(*)::INT AS cnt FROM room_members WHERE room_id = $1", [roomId]).then(r => r.rows[0]) },
  deleteRoom:     { run: (roomId)         => q("DELETE FROM rooms WHERE id = $1", [roomId]) },
  getUserRoomIds: { all: (userId)         => q("SELECT room_id FROM room_members WHERE user_id = $1", [userId]).then(r => r.rows) },
};

export { pool as db };
