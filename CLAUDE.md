# Chatloop — Real-Time Chat App

## What This Is

A fully functional real-time chat application. Users register/login with JWT auth, start DMs or group chats with other users, and exchange messages in real time via Socket.io. Built with Vite + React on the frontend and Express + Socket.io on the backend, with SQLite as the database.

## Architecture

```
/
├── server/
│   ├── index.js     # Express app + Socket.io server (entry point)
│   ├── db.js        # better-sqlite3 setup, schema creation, prepared statements
│   └── auth.js      # JWT sign / verify helpers
├── src/
│   ├── App.jsx            # Auth gate → ChatApp (all UI: OrbitalHub, chat panel, modals)
│   ├── globals.css        # Tailwind v4 entry + dark theme tokens + keyframes
│   ├── main.jsx           # React root (imports globals.css)
│   ├── components/
│   │   ├── AuthScreen.jsx           # Login / Register form
│   │   └── ui/
│   │       ├── badge.jsx            # shadcn-pattern Badge (cva + cn)
│   │       ├── button.jsx           # shadcn-pattern Button (cva + cn + Radix Slot)
│   │       └── card.jsx             # shadcn-pattern Card family
│   └── lib/
│       ├── api.js     # fetch() wrappers for every REST endpoint
│       ├── socket.js  # socket.io-client singleton (connect / disconnect)
│       └── utils.js   # cn() helper (clsx + tailwind-merge)
├── chatloop.db      # SQLite database file (auto-created on first run, gitignored)
├── .env             # Local env vars (never commit)
├── .env.example     # Template to copy
├── vite.config.js   # Vite + Tailwind plugin + @ alias + proxy to port 4000
└── package.json     # Unified deps for both client and server
```

## Tech Stack

| Layer     | Technology                                           |
| --------- | ---------------------------------------------------- |
| Frontend  | React 19 + Vite 8                                    |
| Styling   | Tailwind CSS v4 via `@tailwindcss/vite` (no config file — uses `@theme {}` in `globals.css`) |
| UI        | shadcn-pattern components in `src/components/ui/` (JSX, not TSX) |
| Real-time | Socket.io v4 (client + server)                       |
| Backend   | Node.js + Express 5                                  |
| Database  | SQLite via `better-sqlite3` (file-based, no setup)   |
| Auth      | JWT (7-day token, stored in localStorage)            |

## Dev Commands

```bash
npm install          # installs all deps (client + server)
npm run dev          # starts both server (port 4000) and Vite (port 5173) concurrently
npm run dev:server   # server only
npm run dev:client   # Vite only
npm run build        # production build
```

## Environment Variables

Copy `.env.example` → `.env` before running.

```
PORT=4000
JWT_SECRET=change-this-to-a-long-random-string-in-production
CLIENT_ORIGIN=http://localhost:5173
```

Never commit `.env`. Do not log JWT tokens.

## Database Schema

Tables created automatically in `server/db.js` on first run:

- **users** — `id, username, email, password_hash, created_at, last_seen`
- **rooms** — `id, name, is_group, created_at`
- **room_members** — `room_id, user_id` (pivot, PK on both; FK cascade delete)
- **messages** — `id, room_id, user_id, text, reaction, created_at` (FK cascade delete)

DM rooms have `is_group = 0` and exactly two members. Group rooms have `is_group = 1`.
The SQLite file (`chatloop.db`) lives at the project root and is git-ignored.

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

## UI Architecture

The app uses a **radial orbital timeline** layout:

- `OrbitalHub` — full-screen black canvas with rotating room nodes. Center orb opens the new-chat modal. Clicking a node opens that chat.
- Chat panel — slides in from the right (`translate-x-full` → `translate-x-0`). Covers the orbital view.
- `NewChatModal` — sheet overlay for DM or group creation.
- `ContextMenu` — right-click context menu on messages (react, copy, delete own messages).

### Z-index layer map

```
Orbital nodes:   zIndex 50–150  (computed per-node via sinusoidal trig)
Chat panel:      z-[200]        — always covers orbital nodes
NewChatModal:    z-[500]        — always covers chat panel and orbital nodes
ContextMenu:     z-50           — rendered inside the panel's stacking context (effectively z-[250])
```

**Critical:** If you add new overlays, keep them above z-[500] or they will render behind the modal.

## Optimistic Messaging

1. User hits Enter / Send — temp message (`id: "temp_<timestamp>"`) added to local state immediately.
2. `message:send` emitted to server.
3. Server persists → `message:ack` back to sender (replaces temp), `message:new` to others.

Message deletion is also optimistic: message removed from state immediately, then `DELETE /api/messages/:messageId` is called. The server broadcasts `message:deleted` to sync other clients.

## Presence / Online Status

- `online` Map in `server/index.js` tracks `userId → Set<socketId>` (handles multiple tabs).
- On `connection`: user joins all their rooms, `user:status { online: true }` broadcast.
- On `disconnect`: if no remaining sockets, `user:status { online: false }` broadcast.

## Common Pitfalls

- **ESLint unused import errors** — ESLint is strict. Never import a Lucide icon (or anything) you don't use in JSX. Remove imports immediately when removing the element that uses them.
- **Ref access during render** — never read `someRef.current` inline in JSX. Use state (e.g., `containerSize`) updated via `ResizeObserver` in a `useEffect`.
- **SQLite booleans in JSX** — SQLite returns `0`/`1` for booleans. Using `!!value` is required before using them in JSX `&&` conditions to avoid rendering literal `0`.
- **Tailwind v4 syntax** — this project uses `@import "tailwindcss"` + `@theme {}` blocks in `globals.css`. There is no `tailwind.config.js`. Do not add one.
- **`@` path alias** — configured in `vite.config.js` via `resolve.alias`. Import as `@/lib/utils`, `@/components/ui/button`, etc.
- **Socket listeners accumulate on reconnect** — all `.on()` in the socket `useEffect` must have matching `.off()` in the cleanup return.
- **Rotation transition drift on hover** — orbital nodes use `transition-none` when any node is hovered (`hoveredId !== null`) and `transition-transform duration-[50ms]` otherwise. Never use long durations (e.g., `duration-700`) on the transform — it causes the node to drift after hover starts.
- **JWT stored in `localStorage`** — acceptable for a learning project. For production, use httpOnly cookies + refresh token rotation.
- **Vite proxy** — `/api` and `/socket.io` are proxied to `localhost:4000` in dev only. In production, serve the Vite build from Express directly.
- **Mobile input zoom (iOS Safari)** — iOS Safari auto-zooms any focused input whose `font-size` is below 16px. Always add `@media (max-width: 767px) { input, textarea, select { font-size: 16px; } }` in `globals.css`. Never use only `text-sm` (14px) on inputs without this guard.
- **Mobile overflow / scrollbar** — `html` and `body` must have `height: 100%; overflow: hidden;` and `#root` must have `height: 100%` so the page never scrolls on mobile (especially when the virtual keyboard opens). Scrollable areas inside the app use their own `overflow-y-auto`.
- **`autoFocus` on mobile** — never use `autoFocus` on inputs inside modals or sheets; it opens the virtual keyboard immediately and can trigger iOS zoom. Omit it entirely on mobile-facing UI.
