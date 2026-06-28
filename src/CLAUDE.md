# Chatloop — Frontend

## File Tree

```
src/
├── App.jsx            # Auth gate; lazy-loads ChatApp on login
├── ChatApp.jsx        # Main chat UI: message list, chat panel, socket state
├── globals.css        # Tailwind v4 entry + dark theme tokens + keyframes
├── main.jsx           # React root (imports globals.css)
├── hooks/
│   ├── useChatSocket.js     # All Socket.io event wiring (extracted from ChatApp; takes setters/refs as params)
│   ├── useContactActions.js # Friend/contact handlers (send / accept / remove)
│   ├── useChannelActions.js # Channel create/join + member moderation (kick/role/mute/add/transfer) + edit/pin
│   ├── useMessageActions.js # Per-message handlers (context menu, react, copy, optimistic delete)
│   ├── useAvatarUpload.js   # Avatar file → downscaled 256px JPEG, local + server persist
│   ├── useNotificationState.js # channelNotifs/friendNotifs state + add/clear helpers + socket-facing refs
│   ├── useRoomNavigation.js # Open/close/delete rooms, open DM/members/new-chat/profile sheets, add user to group/channel
│   └── useChatDerivedState.js # Pure derived values (contacts, avatarMap, activeRoom + metadata, divider index, profile context); exports MAX_MESSAGE_LENGTH
├── components/
│   ├── AccountModal.jsx         # Current user's own profile — tap avatar to enlarge, change-picture button, sign out (opens from hub avatar)
│   ├── CustomizePanel.jsx       # Pro: live controls for the Lightfall Special-mode background (colors/speed/glow/…), persisted to localStorage
│   ├── GalaxyCustomizePanel.jsx # Pro: live controls for the Galaxy Dark-mode background (hue/saturation/density/glow/twinkle/speed/rotation), persisted to localStorage (lib/galaxy.js)
│   ├── ManageSubscriptionModal.jsx # Paid plan: status + renewal date, cancel/resume, change plan
│   ├── AllChatsPanel.jsx        # Slide-up "All Chats" sheet (requests + channel activity + room list) — used by OrbitalHub. Room list uses AnimatedList (scroll-reveal) via renderRoom
│   ├── AuthScreen.jsx           # Login / Register form
│   ├── ContextMenu.jsx          # Right-click menu (react, copy, delete messages)
│   ├── ConfirmModal.jsx         # Generic confirmation dialog
│   ├── EditChannelModal.jsx     # Edit channel name / settings
│   ├── FriendsModal.jsx         # Friends list + incoming requests (own surface, opened from the hub)
│   ├── GroupMembersPanel.jsx    # Member list; each row opens UserProfileModal
│   ├── NewChatModal.jsx         # Group / channel creation + Find (add friends)
│   ├── OrbitalHub.jsx           # Full-screen radial orbital canvas (room nodes) — renders AllChatsPanel
│   ├── UserProfileModal.jsx     # User profile sheet — all per-user actions live here
│   ├── chat/                    # ChatApp's chat-panel render pieces
│   │   ├── ChatBackdrop.jsx         # Static per-room-type faint geometric pattern; rendered in ChatPanel behind the WHOLE chat box (zIndex -1 under the isolate:isolate column) so it spans header→messages→composer (bars are translucent via withAlpha). dm=rose diamond lattice, group=amber chevrons, channel=emerald diagonal crosshatch. Tiled <pattern> + full-size <rect>. No CSS filter/transform/animation (caret-blink/perf safe)
│   │   ├── ChatHeader.jsx           # Conversation header (back, identity, action buttons)
│   │   ├── MessageComposer.jsx      # Input row + mute/error banner + length counter
│   │   ├── MessageList.jsx          # Scrollable message area (bubbles, separators, divider)
│   │   ├── ChatPanel.jsx            # Open-conversation surface: backdrop + header + search bar + pinned banner + MessageList + MessageComposer (iOS --vvt/--vvh sizing)
│   │   └── ChatModals.jsx           # All top-level overlays (friends, account, new chat, members, profile, context menu, edit channel, confirm, toast)
│   └── ui/
│       ├── Avatar.jsx                # User avatar with gradient bg + initials
│       ├── AnimatedList.jsx          # React Bits scroll-reveal list (motion useInView): rows scale/fade in as they enter view + top/bottom fade overlays + arrow-key nav. Generalised with renderItem(item,index,selected) for rich rows. Used by AllChatsPanel
│       ├── AnimatedList.css          # AnimatedList styles (al- prefixed; --al-gradient drives the fade colour)
│       ├── badge.jsx                 # shadcn-pattern Badge (cva + cn)
│       ├── button.jsx                # shadcn-pattern Button (cva + cn + Radix Slot)
│       ├── card.jsx                  # shadcn-pattern Card family
│       ├── Galaxy.jsx                # WebGL animated galaxy/starfield (React Bits, ogl) — the Dark-mode hub background. `paused` prop freezes (skips draw) for play/stop + while hidden
│       ├── Galaxy.css                # Galaxy container styles
│       ├── Lightfall.jsx             # WebGL falling-light-streaks background (React Bits, ogl) — the Special-mode background
│       ├── Lightfall.css             # Lightfall container styles
│       ├── ContactStatusButton.jsx   # Add / remove contact button (status-aware)
│       ├── shader-background.jsx     # Three.js GLSL shader canvas background
│       ├── star-field.jsx            # Canvas starfield + comets (dark) / sunrise + birds (light)
│       └── TypingIndicator.jsx       # "X is typing…" label
└── lib/
    ├── api.js        # fetch() wrappers for every REST endpoint
    ├── lightfall.js   # Lightfall background defaults + localStorage load/save
    ├── galaxy.js      # Galaxy (dark-mode) background defaults + localStorage load/save
    ├── constants.js  # Shared style tokens (COLORS, REACTIONS, ROLE_LEVEL, theme vars)
    ├── helpers.js    # userBg, initials, formatTime, formatDateSeparator, toSlug
    ├── room-helpers.js # isChannel(room) + unreadBadgeStyle(room) — shared by OrbitalHub + AllChatsPanel
    ├── socket.js     # socket.io-client singleton (connect / disconnect)
    └── utils.js      # cn() helper (clsx + tailwind-merge)
```

## Component Conventions

**Keep components small, single-purpose, and reusable.** When you build or grow
a component, prefer many focused pieces over one large one:

- **One responsibility per component.** A component should render one cohesive
  thing (a header, a message list, a single modal). If it's doing several
  unrelated jobs, split it.
- **Watch the size.** If a component drifts past a few hundred lines, that's the
  signal to extract — pull cohesive render blocks into child components under
  the relevant folder (e.g. `components/chat/`) and move logic/state into hooks
  under `hooks/`. ChatApp was decomposed this way (2924 → 904 lines): render
  pieces became `ChatHeader` / `MessageList` / `MessageComposer` / `ChatPanel` /
  `ChatModals`, and behavior moved into `useChatSocket`, `useChannelActions`,
  `useRoomNavigation`, `useChatDerivedState`, etc.
- **Presentational by default.** Keep components driven by props; own state in
  the parent (or a hook) and pass it down, so the piece stays reusable and
  testable rather than wired to one screen.
- **Extract verbatim.** When splitting an existing component, move the code
  unchanged and pass its dependencies in — behavior and UI must stay identical.
  Verify with `npx eslint src/` (strict — trim now-unused imports) and
  `npm run build` after every extraction.
- **Reuse before adding.** Shared bits live in `components/ui/` (primitives) and
  `lib/` (helpers like `room-helpers.js`); check there before writing a new one.

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
  working, but swaps backgrounds for `specialBg0/1` (deep navy, see
  `constants.js`) and renders the **`Lightfall`** WebGL background (React Bits,
  `ogl`) instead in the hub — a field of falling light streaks, no overlay text.
  The hub background is one canvas per mode, cross-faded by opacity: **`Galaxy`**
  (dark), **`StarField`** sunrise (light), **`Lightfall`** (special). Each is
  paused while it isn't the active mode so only the visible one renders. **Pro**
  users can customise BOTH the special Lightfall (`CustomizePanel`) and the dark
  Galaxy (`GalaxyCustomizePanel`) backgrounds live; each updates its WebGL
  uniforms in place (no GL rebuild per change) and persists to localStorage
  (`linkloop_lightfall` / `linkloop_galaxy`). The mobile Customize (Wand2) button
  shows in dark + special modes and opens the panel for the active mode. Because the background is dark, the hub keeps white top-bar
  text. Special mode is a **Lite** feature (the Sparkles button is hidden below
  Lite). **Pro** users can additionally **customise** the Lightfall look via the
  `CustomizePanel` (colors / speed / streaks / glow / density / twinkle / zoom /
  ambient glow); settings persist in localStorage `linkloop_lightfall` (defaults
  + load/save in `lib/lightfall.js`) and apply live. Lightfall updates its WebGL
  uniforms in place on prop changes — it does NOT rebuild the GL context per
  change, so dragging a slider stays smooth and never exhausts WebGL contexts.
- **Background animation play/stop** — a play/pause button on the hub top-right
  (below the Sun/Moon toggle) freezes only the **current mode's animated
  background** — `StarField` (dark/light) or `Lightfall` (special) — while the
  orbit bubbles keep spinning. State lives in `OrbitalHub` (`bgPaused`), persists
  in localStorage `linkloop_bg_paused`, and is passed as `paused` to both canvases
  (Lightfall gets `!isSpecial || bgPaused`). `StarField` honours `paused` by not
  scheduling its rAF and leaving the last frame on the canvas (no clear), so the
  background freezes in place; the effect re-runs when `paused` flips.
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

- **Orbit rotation is driven by `requestAnimationFrame`, not `setInterval` + CSS transition** — the rotation loop updates `rotationAngle` (and thus each node's inline `translate`) once per animation frame (~60 fps) with a 50 ms delta cap (so an iOS background/resume cycle can't jump the angle). The orbital node MUST therefore use `transition-none` on its transform. Do NOT add `transition-transform duration-[…]` back: a CSS transition restarts every frame before it finishes, so each node chases its target with uneven velocity — the motion looks glitchy/wobbly instead of smooth. At 60 fps the per-frame position updates are already smooth and need no CSS easing. Rotation is paused (rAF cancelled) while a node is hovered or while a mode-switch view transition is cross-fading (`freezeRotation`).
- **Animation loops are capped to ~30fps to limit battery/heat on mobile** — the
  hub keeps several always-on `requestAnimationFrame` loops while open: the orbit
  rotation (which re-renders the whole hub each tick), the background canvas
  (`StarField`) and the WebGL backgrounds (`Galaxy`, `Lightfall`). At the
  display's full 60fps these pegged CPU+GPU and overheated phones. Each loop now
  gates work behind a `1000/30` ms frame interval (still scheduling via rAF, so
  the browser can throttle when hidden). Motion stays correct because it's
  dt-/elapsed-time-based, not per-frame. `Lightfall`'s renderer dpr is also
  clamped to 2 (high-DPI phones report 3 → 9× shader work). Don't remove these
  caps; if you add another hub animation loop, gate it the same way.
- **`filter: blur()` on large elements causes sustained rendering lag** — CSS `filter: blur()` on any element (even a static div) creates a separate GPU compositor layer. When multiple large blurred divs (e.g. 60–70 px blur, 50–70% of viewport) are visible alongside a canvas `requestAnimationFrame` animation, all compositor layers are re-composited every frame, causing dark-mode-style lag. **Fix:** render atmospheric glows directly inside the canvas. Pre-bake `createRadialGradient` objects in a `resize()` function (allocated once) and draw them with `ctx.fillRect(0, 0, w, h)` each frame — zero extra compositor layers, zero per-frame heap allocation. Never add `filter: blur()` divs to the OrbitalHub background; put all visual effects on the StarField canvas.
- **Native caret blinking suppressed by GPU compositor layers** — WebKit/iOS Safari does not blink the text cursor inside inputs or textareas that are rendered in a GPU compositor layer owned by an ancestor or sibling element. Any of the following on an ancestor OR a sibling in the same stacking context will suppress blinking: `backdrop-filter`, `filter`, `will-change: transform`, an active CSS `animation`, or `transform` (when it promotes to a layer). **Diagnosis:** if the cursor is visible but not blinking, audit every ancestor and same-stacking-context sibling for these properties. **Fix:** remove the triggering property, or restructure so the inputs are not inside any element whose stacking context is promoted to a compositor layer. In this app the culprits were (1) a `backdropFilter: blur(24px)` sibling div that promoted the parent wrapper to a compositor layer and (2) the `hub-breathe` CSS animation on the logo div inside the same card. **Never use CSS `focus:` pseudo-class utilities (e.g. Tailwind `focus:ring-*`, `focus:border-*`) on inputs** — WebKit pre-allocates a compositor layer for elements with focus pseudo-class style rules, which also suppresses blinking. Use `onFocus`/`onBlur` handlers to set `borderColor` and `boxShadow` as inline styles instead. **Never use `transition-all` on inputs** — WebKit intercepts its own caret blink timer when `transition-property: all` is active. Use `transition-[border-color,box-shadow]` or no transition at all. **CSS `animation` on `caret-color` (e.g. a custom caretBlink keyframe) causes iOS to dismiss the native paste/autofill menu** — each animation step fires a repaint; iOS treats any repaint as a page change and closes its native menus. Do not animate `caret-color`; rely on the browser's native blink once compositor layer issues are resolved.
