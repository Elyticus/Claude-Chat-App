# Chatloop — Real-Time Chat App

## What This Is

A fully functional real-time chat application. Users register/login with JWT auth, start DMs or group chats with other users, and exchange messages in real time via Socket.io. Built with Vite + React on the frontend and Express + Socket.io on the backend, with SQLite as the database.

## Architecture

```
/
├── server/
│   ├── index.js     # Express app + Socket.io server (entry point)
│   ├── db.js        # pg Pool setup, schema creation, query helpers
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
```

`DATABASE_URL` is required — the server will fail to connect to the DB and return empty responses (causing `JSON.parse` errors on the client) if it is missing. Get your connection string from TablePlus: open your connection → Edit → copy Host, Port, User, Password, Database and compose the URL above.

Never commit `.env`. Do not log JWT tokens.

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
- **PostgreSQL booleans in JSX** — PostgreSQL `SMALLINT` columns (`is_group`) return `0`/`1`. Using `!!value` is required before using them in JSX `&&` conditions to avoid rendering literal `0`.
- **Tailwind v4 syntax** — this project uses `@import "tailwindcss"` + `@theme {}` blocks in `globals.css`. There is no `tailwind.config.js`. Do not add one.
- **`@` path alias** — configured in `vite.config.js` via `resolve.alias`. Import as `@/lib/utils`, `@/components/ui/button`, etc.
- **Socket listeners accumulate on reconnect** — all `.on()` in the socket `useEffect` must have matching `.off()` in the cleanup return.
- **Context menu on mobile** — mobile browsers do not reliably fire `contextmenu` on long press, and when they do `clientX`/`clientY` may be 0. Use `onTouchStart` with a 500 ms timer to capture real touch coordinates, and always clamp the menu position with both a min (`8px`) and max (`window.innerWidth - menuWidth - 8`) bound on `left`.
- **Rotation transition drift on hover** — orbital nodes use `transition-none` when any node is hovered (`hoveredId !== null`) and `transition-transform duration-[50ms]` otherwise. Never use long durations (e.g., `duration-700`) on the transform — it causes the node to drift after hover starts.
- **JWT stored in `localStorage`** — acceptable for a learning project. For production, use httpOnly cookies + refresh token rotation.
- **Vite proxy** — `/api` and `/socket.io` are proxied to `localhost:4000` in dev only. In production, serve the Vite build from Express directly.
- **Mobile input zoom (iOS Safari)** — iOS Safari auto-zooms any focused input whose `font-size` is below 16px. Always add `@media (max-width: 767px) { input, textarea, select { font-size: 16px; } }` in `globals.css`. Never use only `text-sm` (14px) on inputs without this guard.
- **Mobile overflow / scrollbar** — `html` and `body` must have `height: 100%; overflow: hidden;` and `#root` must have `height: 100%` so the page never scrolls on mobile (especially when the virtual keyboard opens). Scrollable areas inside the app use their own `overflow-y-auto`.
- **`autoFocus` on mobile** — never use `autoFocus` on inputs inside modals or sheets; it opens the virtual keyboard immediately and can trigger iOS zoom. Omit it entirely on mobile-facing UI.
- **`filter: blur()` on large elements causes sustained rendering lag** — CSS `filter: blur()` on any element (even a static div) creates a separate GPU compositor layer. When multiple large blurred divs (e.g. 60–70 px blur, 50–70% of viewport) are visible alongside a canvas `requestAnimationFrame` animation, all compositor layers are re-composited every frame, causing dark-mode-style lag. **Fix:** render atmospheric glows directly inside the canvas. Pre-bake `createRadialGradient` objects in a `resize()` function (allocated once) and draw them with `ctx.fillRect(0, 0, w, h)` each frame — zero extra compositor layers, zero per-frame heap allocation. Never add `filter: blur()` divs to the OrbitalHub background; put all visual effects on the StarField canvas.
- **Software keyboard on mobile — keeping header visible and messages in view** — this is the single hardest mobile-web layout problem. The correct, tested solution for this app:
  1. `index.html` viewport meta includes `interactive-widget=resizes-visual` so Chrome/Android resizes `dvh` natively when the keyboard opens.
  2. A `visualViewport` `useEffect` in `ChatApp` tracks **both** `--vvt` (`vv.offsetTop`) and `--vvh` (`vv.height`), updated on **both** `resize` and `scroll` events in the same handler so they are always in sync.
  3. The outer chat panel wrapper uses `top: var(--vvt, 0px); height: 100dvh` — `--vvt` counteracts iOS Safari's visual-viewport pan so the panel stays anchored to what the user sees; `100dvh` is the CSS fallback.
  4. The **inner** flex column (header + messages + input) uses `height: var(--vvh, 100dvh)` — this is critical. Without it, `justify-end` on the message list pushes messages to the bottom of a full-screen-tall container, hiding them below the keyboard fold.
  5. After updating the CSS variables, a `requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: "instant" }))` call keeps the last message in view once the panel has reflowed to its new height.
  - **What does NOT work:** `fixed inset-0` alone (iOS pans viewport, header disappears). `visualViewport resize` only without `scroll` (misses the pan). Tracking only `--vvt` without `--vvh` (messages hidden under keyboard). A short `setTimeout` on `onFocus` (fires before `--vvh` settles). Tracking `--vvh` separately from `--vvt` (they fall out of sync, causing jitter).
- **Native caret blinking suppressed by GPU compositor layers** — WebKit/iOS Safari does not blink the text cursor inside inputs or textareas that are rendered in a GPU compositor layer owned by an ancestor or sibling element. Any of the following on an ancestor OR a sibling in the same stacking context will suppress blinking: `backdrop-filter`, `filter`, `will-change: transform`, an active CSS `animation`, or `transform` (when it promotes to a layer). **Diagnosis:** if the cursor is visible but not blinking, audit every ancestor and same-stacking-context sibling for these properties. **Fix:** remove the triggering property, or restructure so the inputs are not inside any element whose stacking context is promoted to a compositor layer. In this app the culprits were (1) a `backdropFilter: blur(24px)` sibling div that promoted the parent wrapper to a compositor layer and (2) the `hub-breathe` CSS animation on the logo div inside the same card. **Never use CSS `focus:` pseudo-class utilities (e.g. Tailwind `focus:ring-*`, `focus:border-*`) on inputs** — WebKit pre-allocates a compositor layer for elements with focus pseudo-class style rules, which also suppresses blinking. Use `onFocus`/`onBlur` handlers to set `borderColor` and `boxShadow` as inline styles instead. **Never use `transition-all` on inputs** — WebKit intercepts its own caret blink timer when `transition-property: all` is active. Use `transition-[border-color,box-shadow]` or no transition at all. **CSS `animation` on `caret-color` (e.g. a custom caretBlink keyframe) causes iOS to dismiss the native paste/autofill menu** — each animation step fires a repaint; iOS treats any repaint as a page change and closes its native menus. Do not animate `caret-color`; rely on the browser's native blink once compositor layer issues are resolved.
