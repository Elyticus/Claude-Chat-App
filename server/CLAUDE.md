# Chatloop — Backend

## Database Schema

Tables created automatically in `server/db.js` on first run (`initDb()`):

- **users** — `id, username, email, password_hash, created_at, last_seen`
- **rooms** — `id, name, is_group, created_at`
- **room_members** — `room_id, user_id` (pivot, PK on both; FK cascade delete)
- **messages** — `id, room_id, user_id, text, reaction, created_at` (FK cascade delete)

DM rooms have `is_group = 0` and exactly two members. Group rooms have `is_group = 1`.

### Creating a user directly in the database

Never insert a plain text password into `password_hash` — the login handler uses `bcrypt.compare` so the stored value must always be a bcrypt hash.

1. Generate a hash: `node scripts/generate-hash.js <password>` — copies the hash to your terminal.
2. In TablePlus, run:
   ```sql
   INSERT INTO users (username, email, password_hash)
   VALUES ('username', 'email@example.com', '<paste-hash-here>');
   ```

## REST API

| Method | Path                              | Auth | Description                              |
| ------ | --------------------------------- | ---- | ---------------------------------------- |
| POST   | `/api/auth/register`              | —    | Register; returns `{ token, user }`      |
| POST   | `/api/auth/login`                 | —    | Login; returns `{ token, user }`         |
| GET    | `/api/users`                      | JWT  | All users except self (with online flag) |
| GET    | `/api/rooms`                      | JWT  | All rooms the current user is in         |
| POST   | `/api/rooms/dm`                   | JWT  | Get or create a DM room                  |
| POST   | `/api/rooms/group`                | JWT  | Create a group room                      |
| GET    | `/api/rooms/:id/messages`         | JWT  | Last 200 messages for a room             |
| DELETE | `/api/rooms/:roomId`              | JWT  | Leave (and optionally delete) a room     |
| DELETE | `/api/messages/:messageId`        | JWT  | Delete own message; broadcasts `message:deleted` |

## Socket.io Event Contract

Authentication: token is passed in the handshake `auth` object and validated before connection is accepted.

**Client → Server:**

| Event            | Payload                        | Notes                              |
| ---------------- | ------------------------------ | ---------------------------------- |
| `message:send`   | `{ roomId, text, tempId }`     | Server persists and broadcasts     |
| `message:react`  | `{ messageId, emoji }`         | Toggles — same emoji clears it     |
| `typing:start`   | `{ roomId }`                   | Broadcasts to others in room       |
| `typing:stop`    | `{ roomId }`                   | Broadcasts to others in room       |

**Server → Client:**

| Event               | Payload                                     | Notes                                    |
| ------------------- | ------------------------------------------- | ---------------------------------------- |
| `message:new`       | `{ roomId, message }`                       | Sent to all room members except sender   |
| `message:ack`       | `{ tempId, message, roomId }`               | Sent only to sender; replaces temp msg   |
| `message:reaction`  | `{ roomId, messageId, emoji }`              | Broadcast to all room members            |
| `message:deleted`   | `{ roomId, messageId }`                     | Broadcast to all room members            |
| `typing:update`     | `{ roomId, userId, username, typing }`      | Broadcast to others in room              |
| `user:status`       | `{ userId, online }`                        | Broadcast on connect/disconnect          |

## Presence / Online Status

- `online` Map in `server/index.js` tracks `userId → Set<socketId>` (handles multiple tabs).
- On `connection`: user joins all their rooms, `user:status { online: true }` broadcast.
- On `disconnect`: if no remaining sockets, `user:status { online: false }` broadcast.

## Backend Pitfalls

- **JWT stored in `localStorage`** — acceptable for a learning project. For production, use httpOnly cookies + refresh token rotation.
- **Vite proxy** — `/api` and `/socket.io` are proxied to `localhost:4000` in dev only. In production, serve the Vite build from Express directly.
- **Avatar broadcast scope** — `user:avatar` must be scoped to the user's rooms with `io.to(roomKeys).emit(...)`, never `io.emit(...)` (would broadcast to all connected clients).
- **Group size limit** — `POST /api/rooms/group` enforces a 50-member cap. Never remove this guard.
- **`typing:stop` membership check** — always verify `isMember` before broadcasting typing events, just as `typing:start` does. An unverified stop event would let any socket silence another user's typing indicator.
