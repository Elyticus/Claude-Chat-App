# Chatloop — Real-Time Chat App

## What This Is

A fully functional real-time chat application. Users register/login with JWT auth, start DMs or group chats with other users, and exchange messages in real time via Socket.io. Built with Vite + React on the frontend and Express + Socket.io on the backend, with PostgreSQL as the database.

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
│   │   ├── AuthScreen.jsx           # Login / Register form
│   │   ├── ContextMenu.jsx          # Right-click menu (react, copy, delete messages)
│   │   ├── ConfirmModal.jsx         # Generic confirmation dialog
│   │   ├── EditChannelModal.jsx     # Edit channel name / settings
│   │   ├── GroupMembersPanel.jsx    # Group member list + role management
│   │   ├── NewChatModal.jsx         # Sheet overlay for DM / group creation
│   │   ├── OrbitalHub.jsx           # Full-screen radial orbital canvas (room nodes)
│   │   └── ui/
│   │       ├── Avatar.jsx                # User avatar with gradient bg + initials
│   │       ├── badge.jsx                 # shadcn-pattern Badge (cva + cn)
│   │       ├── button.jsx                # shadcn-pattern Button (cva + cn + Radix Slot)
│   │       ├── card.jsx                  # shadcn-pattern Card family
│   │       ├── ContactStatusButton.jsx   # Add / remove contact button (status-aware)
│   │       ├── shader-background.jsx     # Three.js GLSL shader canvas background
│   │       ├── star-field.jsx            # Canvas starfield + comets (dark) / sunrise + birds (light)
│   │       └── TypingIndicator.jsx       # "X is typing…" label
│   └── lib/
│       ├── api.js        # fetch() wrappers for every REST endpoint
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
