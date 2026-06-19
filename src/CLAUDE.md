# Chatloop — Frontend

## File Tree

```
src/
├── App.jsx            # Auth gate; lazy-loads ChatApp on login
├── ChatApp.jsx        # Main chat UI: message list, chat panel, socket state
├── globals.css        # Tailwind v4 entry + dark theme tokens + keyframes
├── main.jsx           # React root (imports globals.css)
├── components/
│   ├── AuthScreen.jsx           # Login / Register form
│   ├── ContextMenu.jsx          # Right-click menu (react, copy, delete messages)
│   ├── ConfirmModal.jsx         # Generic confirmation dialog
│   ├── EditChannelModal.jsx     # Edit channel name / settings
│   ├── FriendsModal.jsx         # Friends list + incoming requests (own surface, opened from the hub)
│   ├── GroupMembersPanel.jsx    # Member list; each row opens UserProfileModal
│   ├── NewChatModal.jsx         # Group / channel creation + Find (add friends)
│   ├── OrbitalHub.jsx           # Full-screen radial orbital canvas (room nodes)
│   ├── UserProfileModal.jsx     # User profile sheet — all per-user actions live here
│   └── ui/
│       ├── Avatar.jsx                # User avatar with gradient bg + initials
│       ├── badge.jsx                 # shadcn-pattern Badge (cva + cn)
│       ├── button.jsx                # shadcn-pattern Button (cva + cn + Radix Slot)
│       ├── card.jsx                  # shadcn-pattern Card family
│       ├── special-field.jsx         # Canvas special-mode background — 3 time-of-day scenes (blue hour / golden hour / aurora)
│       ├── ContactStatusButton.jsx   # Add / remove contact button (status-aware)
│       ├── shader-background.jsx     # Three.js GLSL shader canvas background
│       ├── star-field.jsx            # Canvas starfield + comets (dark) / sunrise + birds (light)
│       └── TypingIndicator.jsx       # "X is typing…" label
└── lib/
    ├── api.js        # fetch() wrappers for every REST endpoint
    ├── special-scenes.js # Special-mode scene selector (getScene) + per-scene palettes + isSpecialSkyLight() contrast helper
    ├── constants.js  # Shared style tokens (COLORS, REACTIONS, ROLE_LEVEL, theme vars)
    ├── helpers.js    # userBg, initials, formatTime, formatDateSeparator, toSlug
    ├── socket.js     # socket.io-client singleton (connect / disconnect)
    └── utils.js      # cn() helper (clsx + tailwind-merge)
```

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
UserProfileModal:z-[600]        — opens ABOVE NewChatModal / GroupMembersPanel (z-500); its own ConfirmModal also z-[600], stacked by DOM order
ContextMenu:     z-50           — rendered inside the panel's stacking context (effectively z-[250])
```

**Critical:** If you add new overlays, keep them above z-[500] or they will render behind the modal.

## Optimistic Messaging

1. User hits Enter / Send — temp message (`id: "temp_<timestamp>"`) added to local state immediately.
2. `message:send` emitted to server.
3. Server persists → `message:ack` back to sender (replaces temp), `message:new` to others.

Message deletion is also optimistic: message removed from state immediately, then `DELETE /api/messages/:messageId` is called. The server broadcasts `message:deleted` to sync other clients.

## Frontend Pitfalls

### Code Quality

- **ESLint unused import errors** — ESLint is strict. Never import a Lucide icon (or anything) you don't use in JSX. Remove imports immediately when removing the element that uses them.
- **Ref access during render** — never read `someRef.current` inline in JSX. Use state (e.g., `containerSize`) updated via `ResizeObserver` in a `useEffect`.
- **PostgreSQL booleans in JSX** — PostgreSQL `SMALLINT` columns (`is_group`) return `0`/`1`. Using `!!value` is required before using them in JSX `&&` conditions to avoid rendering literal `0`. This is NOT needed inside ternary `? :` expressions — the ternary already coerces to bool.
- **Socket listeners accumulate on reconnect** — all `.on()` in the socket `useEffect` must have matching `.off()` in the cleanup return.

### Styling / Config

- **Theme system — three modes**, stored in localStorage `linkloop_theme`:
  `"dark"`, `"light"`, `"special"`. Two hub buttons: a Sun/Moon light↔dark
  toggle, and a separate Sparkles button that toggles special mode on/off
  (exiting returns to the previous mode). `special` mode **inherits the dark UI
  palette** (`isDark = theme !== "light"`) so all `isDark` styling keeps
  working, but swaps backgrounds for `specialBg0/1` (teal-black, see
  `constants.js`) and renders `SpecialField` instead of `StarField` in the hub.
  `SpecialField` picks one of **three distinct time-of-day scenes** from the
  real clock (`getScene` in `lib/special-scenes.js`): **blue hour** at dawn
  (5–11, cool haze + fading stars), **golden hour** in the late afternoon
  (11–18, low sun + god rays + warm dust), and the original **aurora** from
  twilight into night (18–5, sine curtains + rising motes). It re-checks the
  clock every 30s and re-bakes its gradients when the scene flips. There is no
  separate clock screen — that was removed.
- **Tailwind v4 syntax** — this project uses `@import "tailwindcss"` + `@theme {}` blocks in `globals.css`. There is no `tailwind.config.js`. Do not add one.
- **`@` path alias** — configured in `vite.config.js` via `resolve.alias`. Import as `@/lib/utils`, `@/components/ui/button`, etc.

### Mobile

- **Mobile input zoom (iOS Safari)** — iOS Safari auto-zooms any focused input whose `font-size` is below 16px. Always add `@media (max-width: 767px) { input, textarea, select { font-size: 16px; } }` in `globals.css`. Never use only `text-sm` (14px) on inputs without this guard.
- **Mobile overflow / scrollbar** — `html` and `body` must have `height: 100%; overflow: hidden;` and `#root` must have `height: 100%` so the page never scrolls on mobile (especially when the virtual keyboard opens). Scrollable areas inside the app use their own `overflow-y-auto`.
- **`autoFocus` on mobile** — never use `autoFocus` on inputs inside modals or sheets; it opens the virtual keyboard immediately and can trigger iOS zoom. Omit it entirely on mobile-facing UI.
- **Context menu on mobile** — mobile browsers do not reliably fire `contextmenu` on long press, and when they do `clientX`/`clientY` may be 0. Use `onTouchStart` with a 500 ms timer to capture real touch coordinates, and always clamp the menu position with both a min (`8px`) and max (`window.innerWidth - menuWidth - 8`) bound on `left`.
- **Software keyboard on mobile — keeping header visible and messages in view** — this is the single hardest mobile-web layout problem. The correct, tested solution for this app:
  1. `index.html` viewport meta includes `interactive-widget=resizes-visual` so Chrome/Android resizes `dvh` natively when the keyboard opens.
  2. A `visualViewport` `useEffect` in `ChatApp` tracks **both** `--vvt` (`vv.offsetTop`) and `--vvh` (`vv.height`), updated on **both** `resize` and `scroll` events in the same handler so they are always in sync.
  3. The outer chat panel wrapper uses `top: var(--vvt, 0px); height: 100dvh` — `--vvt` counteracts iOS Safari's visual-viewport pan so the panel stays anchored to what the user sees; `100dvh` is the CSS fallback.
  4. The **inner** flex column (header + messages + input) uses `height: var(--vvh, 100dvh)` — this is critical. Without it, `justify-end` on the message list pushes messages to the bottom of a full-screen-tall container, hiding them below the keyboard fold.
  5. After updating the CSS variables, a `requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: "instant" }))` call keeps the last message in view once the panel has reflowed to its new height.
  - **What does NOT work:** `fixed inset-0` alone (iOS pans viewport, header disappears). `visualViewport resize` only without `scroll` (misses the pan). Tracking only `--vvt` without `--vvh` (messages hidden under keyboard). A short `setTimeout` on `onFocus` (fires before `--vvh` settles). Tracking `--vvh` separately from `--vvt` (they fall out of sync, causing jitter).

### Rendering / GPU

- **Rotation transition drift on hover** — orbital nodes use `transition-none` when any node is hovered (`hoveredId !== null`) and `transition-transform duration-[50ms]` otherwise. Never use long durations (e.g., `duration-700`) on the transform — it causes the node to drift after hover starts.
- **`filter: blur()` on large elements causes sustained rendering lag** — CSS `filter: blur()` on any element (even a static div) creates a separate GPU compositor layer. When multiple large blurred divs (e.g. 60–70 px blur, 50–70% of viewport) are visible alongside a canvas `requestAnimationFrame` animation, all compositor layers are re-composited every frame, causing dark-mode-style lag. **Fix:** render atmospheric glows directly inside the canvas. Pre-bake `createRadialGradient` objects in a `resize()` function (allocated once) and draw them with `ctx.fillRect(0, 0, w, h)` each frame — zero extra compositor layers, zero per-frame heap allocation. Never add `filter: blur()` divs to the OrbitalHub background; put all visual effects on the StarField canvas.
- **Native caret blinking suppressed by GPU compositor layers** — WebKit/iOS Safari does not blink the text cursor inside inputs or textareas that are rendered in a GPU compositor layer owned by an ancestor or sibling element. Any of the following on an ancestor OR a sibling in the same stacking context will suppress blinking: `backdrop-filter`, `filter`, `will-change: transform`, an active CSS `animation`, or `transform` (when it promotes to a layer). **Diagnosis:** if the cursor is visible but not blinking, audit every ancestor and same-stacking-context sibling for these properties. **Fix:** remove the triggering property, or restructure so the inputs are not inside any element whose stacking context is promoted to a compositor layer. In this app the culprits were (1) a `backdropFilter: blur(24px)` sibling div that promoted the parent wrapper to a compositor layer and (2) the `hub-breathe` CSS animation on the logo div inside the same card. **Never use CSS `focus:` pseudo-class utilities (e.g. Tailwind `focus:ring-*`, `focus:border-*`) on inputs** — WebKit pre-allocates a compositor layer for elements with focus pseudo-class style rules, which also suppresses blinking. Use `onFocus`/`onBlur` handlers to set `borderColor` and `boxShadow` as inline styles instead. **Never use `transition-all` on inputs** — WebKit intercepts its own caret blink timer when `transition-property: all` is active. Use `transition-[border-color,box-shadow]` or no transition at all. **CSS `animation` on `caret-color` (e.g. a custom caretBlink keyframe) causes iOS to dismiss the native paste/autofill menu** — each animation step fires a repaint; iOS treats any repaint as a page change and closes its native menus. Do not animate `caret-color`; rely on the browser's native blink once compositor layer issues are resolved.
