import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, "../chatloop.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT    UNIQUE NOT NULL,
    email        TEXT    UNIQUE NOT NULL,
    password_hash TEXT   NOT NULL,
    created_at   INTEGER DEFAULT (unixepoch()),
    last_seen    INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT,
    is_group   INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS room_members (
    room_id   INTEGER NOT NULL,
    user_id   INTEGER NOT NULL,
    joined_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id    INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    text       TEXT    NOT NULL,
    reaction   TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
`);

// ─── Prepared statements ──────────────────────────────────────────────────────

export const queries = {
  getUserByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
  getUserByUsername: db.prepare("SELECT * FROM users WHERE username = ?"),
  getUserById: db.prepare("SELECT id, username, email, last_seen FROM users WHERE id = ?"),
  getAllUsersExcept: db.prepare("SELECT id, username, email, last_seen FROM users WHERE id != ?"),

  createUser: db.prepare(
    "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)"
  ),
  touchUser: db.prepare("UPDATE users SET last_seen = unixepoch() WHERE id = ?"),

  createRoom: db.prepare("INSERT INTO rooms (is_group, name) VALUES (?, ?)"),
  addMember: db.prepare("INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)"),

  findDmRoom: db.prepare(`
    SELECT r.id FROM rooms r
    JOIN room_members rm1 ON rm1.room_id = r.id AND rm1.user_id = ?
    JOIN room_members rm2 ON rm2.room_id = r.id AND rm2.user_id = ?
    WHERE r.is_group = 0
    LIMIT 1
  `),

  getUserRooms: db.prepare(`
    SELECT
      r.id,
      r.name,
      r.is_group,
      m.text       AS last_message,
      m.created_at AS last_message_at,
      mu.id        AS other_user_id,
      mu.username  AS other_username
    FROM rooms r
    JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = ?
    LEFT JOIN messages m ON m.id = (
      SELECT id FROM messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1
    )
    LEFT JOIN room_members rm2 ON rm2.room_id = r.id AND rm2.user_id != ? AND r.is_group = 0
    LEFT JOIN users mu ON mu.id = rm2.user_id
    ORDER BY COALESCE(m.created_at, r.created_at) DESC
  `),

  getRoomMessages: db.prepare(`
    SELECT m.id, m.text, m.reaction, m.created_at,
           u.id AS user_id, u.username
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.room_id = ?
    ORDER BY m.created_at ASC
    LIMIT 200
  `),

  isMember: db.prepare(
    "SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?"
  ),

  insertMessage: db.prepare(
    "INSERT INTO messages (room_id, user_id, text) VALUES (?, ?, ?)"
  ),

  getMessageById: db.prepare(`
    SELECT m.id, m.text, m.reaction, m.created_at,
           u.id AS user_id, u.username, m.room_id
    FROM messages m JOIN users u ON u.id = m.user_id
    WHERE m.id = ?
  `),

  setReaction: db.prepare("UPDATE messages SET reaction = ? WHERE id = ?"),

  deleteMessage: db.prepare("DELETE FROM messages WHERE id = ? AND user_id = ?"),

  removeMember: db.prepare("DELETE FROM room_members WHERE room_id = ? AND user_id = ?"),
  memberCount: db.prepare("SELECT COUNT(*) AS cnt FROM room_members WHERE room_id = ?"),
  deleteRoom: db.prepare("DELETE FROM rooms WHERE id = ?"),
};

export { db };
