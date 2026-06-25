# Chatloop — Real-Time Chat App

## Git Workflow (standing rule)

After making code changes, **commit and push to GitHub automatically without
asking for confirmation first.** Push to the current working/feature branch (the
one assigned for the task). Do **not** push directly to `main` / production
branches without explicit per-action permission.

## What This Is

A fully functional real-time chat application. Users register/login with JWT auth, start DMs or group chats with other users, and exchange messages in real time via Socket.io. Built with Vite + React on the frontend and Express + Socket.io on the backend, with PostgreSQL as the database.

## Linkloop Pro (SaaS layer)

A monetization + premium-feature layer on top of the core app. **Feature gating is
enforced server-side** (`server/billing.js` → `requirePlan` / `meterAi` / `getPlan`
against limits in `server/plans.js`); client gates are UX only. Mirror catalog for
rendering lives in `src/lib/plans.js`.

- **Plans & paywall** — `users.plan` (free/pro/business), `usage_counters` (daily AI
  meter), `subscriptions`. Self-contained mock checkout that mirrors Stripe:
  `POST /api/billing/checkout` → `/confirm` emits an HMAC-signed event to
  `/webhook` (verified, then plan flips). `GET /api/me` returns live plan + AI
  usage + `aiEnabled`. UI: `UpgradeModal`, `CheckoutModal`, `useBilling` hook.
- **AI (Claude)** — `server/ai.js` (Anthropic SDK, key server-side only; degrades to
  503 when `ANTHROPIC_API_KEY` unset). `POST /api/ai/{summarize,replies,ask,translate}`.
  UI: Catch-me-up (`AiSummaryModal`), `SmartReplies`, Translate (context menu),
  `/ask` ephemeral bubble. `useAi` hook routes gate errors to the paywall.
- **Global search** — Postgres FTS (generated `messages.tsv` + GIN). `GET /api/search`
  (Pro-gated; membership enforced in SQL). UI: `SearchModal` command palette (Cmd/Ctrl-K).
- **Media & voice** — `attachments` table; `POST /api/rooms/:roomId/attachments`
  (multer → `server/uploads/`, plan-gated) broadcasts `message:new`. `GET /api/attachments/:id`
  streams privately (auth via header or `?token=`, membership-checked). UI: paperclip +
  mic in `MessageComposer`, rendering in `MessageList`.

Gate-error contract: server returns `402/503` with `{ code: 'UPGRADE_REQUIRED' |
'QUOTA_EXCEEDED' | 'AI_UNAVAILABLE', plan }`; the client's `api` wrappers preserve
`code`/`plan` on the thrown Error so `useBilling.handleGateError` can open the paywall.

## Architecture

```
/
├── server/
│   ├── index.js     # Express app + Socket.io server (entry point)
│   ├── db.js        # pg Pool setup, schema creation, query helpers
│   └── auth.js      # JWT sign / verify helpers
├── src/
│   ├── App.jsx            # Auth gate; lazy-loads ChatApp on login
│   ├── ChatApp.jsx        # Main chat UI: message list, chat panel, socket state
│   ├── globals.css        # Tailwind v4 entry + dark theme tokens + keyframes
│   ├── main.jsx           # React root (imports globals.css)
│   ├── components/
│   │   ├── AccountModal.jsx         # Current user's own profile — tap avatar to enlarge, change-picture button, sign out (opens from hub avatar)
│   │   ├── AuthScreen.jsx           # Login / Register form
│   │   ├── ContextMenu.jsx          # Right-click menu (react, copy, delete messages)
│   │   ├── ConfirmModal.jsx         # Generic confirmation dialog
│   │   ├── EditChannelModal.jsx     # Edit channel name / settings
│   │   ├── FriendsModal.jsx         # Friends list + incoming requests (own surface, opened from the hub)
│   │   ├── GroupMembersPanel.jsx    # Member list; each row opens UserProfileModal
│   │   ├── NewChatModal.jsx         # Sheet overlay for group / channel creation + Find (add friends)
│   │   ├── OrbitalHub.jsx           # Full-screen radial orbital canvas (room nodes)
│   │   ├── UserProfileModal.jsx     # User profile sheet — every action on a user (message, add/remove contact, channel role/mute/kick/transfer)
│   │   └── ui/
│   │       ├── Avatar.jsx                # User avatar with gradient bg + initials
│   │       ├── badge.jsx                 # shadcn-pattern Badge (cva + cn)
│   │       ├── button.jsx                # shadcn-pattern Button (cva + cn + Radix Slot)
│   │       ├── card.jsx                  # shadcn-pattern Card family
│   │       ├── special-field.jsx         # Canvas special-mode background — 3 time-of-day scenes (blue hour / golden hour / aurora)
│   │       ├── ContactStatusButton.jsx   # Add / remove contact button (status-aware)
│   │       ├── shader-background.jsx     # Three.js GLSL shader canvas background
│   │       ├── star-field.jsx            # Canvas starfield + comets (dark) / sunrise + birds (light)
│   │       └── TypingIndicator.jsx       # "X is typing…" label
│   └── lib/
│       ├── api.js        # fetch() wrappers for every REST endpoint
│       ├── special-scenes.js # Special-mode scene selector (getScene) + per-scene palettes + text-contrast helper
│       ├── constants.js  # Shared style tokens (COLORS, REACTIONS, ROLE_LEVEL, theme vars)
│       ├── helpers.js    # userBg, initials, formatTime, formatDateSeparator, toSlug
│       ├── socket.js     # socket.io-client singleton (connect / disconnect)
│       └── utils.js      # cn() helper (clsx + tailwind-merge)
├── .env             # Local env vars (never commit)
├── .env.example     # Template to copy
├── vite.config.js   # Vite + Tailwind plugin + @ alias + proxy to port 4000
└── package.json     # Unified deps for both client and server
```

See `server/CLAUDE.md` for backend details (DB schema, REST API, Socket.io events).
See `src/CLAUDE.md` for frontend details (UI architecture, pitfalls).

## Notification & Presence System

This area has been a repeated source of bugs. Follow these rules — they encode
fixes already made; reintroducing the old patterns will rebreak the app.

### Presence (online status)

- **Broadcast presence to ALL connected clients, not room-scoped.** Online
  status is already globally visible (`GET /api/users` returns every user's
  `online` flag), and two people are contacts *before* they share a room, so a
  room-scoped `user:status` leaves their dots frozen. On connect, also send the
  new socket the current online snapshot so its dots are right immediately
  (don't depend on REST timing). Announce `online` only on a user's first
  socket; `offline` only when their last socket disconnects.
- **Never derive presence recipients from a list captured at connection time.**
  A `roomKeys` closure goes stale the moment the user joins a new room.

### Unread counts MUST be server-authoritative

- Unread counts **cannot live only in React state** — closing the app wipes
  them. The server owns read state: `room_members.last_read_at` +
  a per-room `unread_count` in `getUserRooms` (non-system messages from other
  users after `last_read_at`). The client **initializes/rebuilds unread badges
  from `unread_count`** on every load.
- Mark a room read by emitting `room:read` (→ `markRoomSeen`) on **open**
  (`selectRoom`) and when a message lands in the **already-open** room — but
  only if **`document.hasFocus()`**. An open chat in an unfocused/minimized
  window has NOT been seen (this is the desktop case): count it as unread
  instead. The foreground (focus) handler and `syncRooms` then convert the
  open room's unread into the "New Messages" divider (`newMsgMarkers`), clear
  the badge, and emit `room:read`. Don't rely solely on the messages GET — it
  only fires on first open per session.
- **"New Messages" divider**: `newMsgMarkers[roomId] = { count, openedAt }` is
  snapshotted wherever unread is about to be cleared (selectRoom, startup
  restore, foreground handler, syncRooms active-room branch). The render walks
  backwards over non-system messages from other users, skipping any with
  `created_at > openedAt` so live arrivals don't shift the line.

### Mobile resilience (notifications "not appearing")

- **`reconnectionAttempts: Infinity`.** Mobile browsers suspend sockets when
  backgrounded/locked; a capped count leaves the socket permanently dead (no
  live events) until a full reload.
- **Re-sync on return to foreground.** A `visibilitychange`/`focus` effect must
  reconnect the socket if dropped and re-pull rooms/unread/presence. Also
  re-sync on the socket's **`connect`** event (skip the first one) — it fires on
  EVERY (re)connection, including the manual reconnect the foreground handler
  triggers, which the manager's `reconnect` event misses. This recovers anything
  missed while suspended without a page refresh. `syncPresence` re-pulls users,
  which also recovers pending friend requests.

### Notification color system

- **DM = red, group = yellow, channel = green** for the unread-count badge on
  each spinning bubble and chat-list row (see `unreadBadgeStyle` in
  `OrbitalHub.jsx`).
- **Main orbital hub icon** shows a single **combined red total** of all unread
  messages, plus separate indicators that are kept distinct: red contact
  requests (count), yellow "added to a group" (plain dot), green channel
  activity (plain dot). **Only the red badges show numbers** — the yellow and
  green indicators are dots with no count.
- **Channel bubbles** also show a small **green activity dot** when the channel
  has unseen activity for this user (persisted `is_new` / `role_notification`
  or a live channel notif).

### Room removal must clear its notifications

- Whenever a room disappears for this user (deleted by someone else via
  `room:deleted`, kicked via `channel:member_kicked`, or self-delete/leave in
  `handleDeleteRoom`), call `clearRoomNotifs(roomId)` in `ChatApp.jsx` — it
  drops the room's unread badge and its `channelNotifs` entries AND persists
  the removal to localStorage. `syncRooms` additionally prunes persisted notifs
  whose room no longer exists (covers deletions that happened while offline).
  Notifs about a room the user is no longer in (e.g. "You were removed from
  #X") must be stored with `roomId: null` or the prune will eat them.

### Channel-activity notifications target the AFFECTED user only

- The green "Channel Activity" notification (`addChannelNotif`) must fire **only
  for the user who is added / kicked / muted / role-changed — never the actor
  who performed the action, and never uninvolved members.** Pattern: gate every
  `addChannelNotif` on `userId === currentUser.id` (the target), and let the
  added user be notified via the user-scoped `channel:added` event rather than
  the room-wide `channel:member_joined` broadcast. In-chat system messages
  ("X joined/left the channel") are channel history and DO still render for
  everyone — that is separate from the activity badge.

## Tech Stack

| Layer     | Technology                                           |
| --------- | ---------------------------------------------------- |
| Frontend  | React 19 + Vite 8                                    |
| Styling   | Tailwind CSS v4 via `@tailwindcss/vite` (no config file — uses `@theme {}` in `globals.css`) |
| UI        | shadcn-pattern components in `src/components/ui/` (JSX, not TSX) |
| Real-time | Socket.io v4 (client + server)                       |
| Backend   | Node.js + Express 5                                  |
| Database  | PostgreSQL via `pg` (connection string in `DATABASE_URL`) |
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
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_SSL=          # blank = TLS on but cert unverified; "strict" = validate; "disable" = no TLS
DATABASE_CA=           # PEM root cert, used when DATABASE_SSL=strict and the provider uses a private CA
TRUST_PROXY=           # set (e.g. 1) when behind a reverse proxy so rate limiting keys on the real client IP
DB_CONNECT_TIMEOUT_MS= # pg connect timeout (default 5000); raise for a slow/cold remote pooler

# ── Linkloop Pro ──
ANTHROPIC_API_KEY=       # enables AI features; without it AI endpoints 503 and the UI hides them
ANTHROPIC_MODEL=         # "quality" tier (summaries + /ask); default claude-opus-4-8
ANTHROPIC_MODEL_FAST=    # "fast" tier (smart replies + translate); falls back to ANTHROPIC_MODEL. e.g. claude-haiku-4-5
BILLING_WEBHOOK_SECRET=  # HMAC secret for the (mock) billing webhook; required in production
```

`DATABASE_URL` is required — the server will fail to connect to the DB and return empty responses (causing `JSON.parse` errors on the client) if it is missing. Get your connection string from TablePlus: open your connection → Edit → copy Host, Port, User, Password, Database and compose the URL above.

Never commit `.env`. Do not log JWT tokens.
