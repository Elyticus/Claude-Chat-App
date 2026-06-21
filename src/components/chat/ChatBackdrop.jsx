// Decorative, static per-room-type backdrop for the chat window. Purely
// presentational SVG painted faintly behind the message list so each
// conversation type reads differently at a glance — and echoing the app's
// notification colour language (dm = rose, group = amber, channel = emerald):
//   • dm      → a calm rose world + a crescent moon
//   • group   → a warm amber cluster of little planets
//   • channel → an emerald ringed planet broadcasting among stars
//
// IMPORTANT: no CSS filter / transform / animation / will-change here. Those
// promote a GPU compositor layer that breaks the composer's caret blink and
// hurts rendering perf (see src/CLAUDE.md "Rendering / GPU"). SVG-internal
// transforms (the ring tilt below) are safe — they don't create a layer.

const STARS = [
  [40, 90], [120, 50], [200, 110], [330, 70], [360, 180],
  [70, 250], [300, 300], [180, 360], [40, 470], [360, 430],
  [250, 520], [90, 600], [330, 620], [160, 660], [300, 690],
];

function Stars({ color }) {
  return STARS.map(([cx, cy], i) => (
    <circle key={i} cx={cx} cy={cy} r={i % 4 === 0 ? 1.7 : 1} fill={color} />
  ));
}

function DmScene({ isDark, starColor }) {
  return (
    <>
      <defs>
        <radialGradient id="dm-planet" cx="34%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fda4af" stopOpacity={isDark ? 0.28 : 0.2} />
          <stop offset="60%" stopColor="#fb7185" stopOpacity={isDark ? 0.15 : 0.12} />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity={isDark ? 0.05 : 0.05} />
        </radialGradient>
        <radialGradient id="dm-moon" cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#ffe4e6" stopOpacity={isDark ? 0.5 : 0.35} />
          <stop offset="100%" stopColor="#fda4af" stopOpacity={isDark ? 0.12 : 0.1} />
        </radialGradient>
        <mask id="dm-crescent">
          <circle cx="80" cy="96" r="34" fill="#fff" />
          <circle cx="95" cy="86" r="30" fill="#000" />
        </mask>
      </defs>
      <Stars color={starColor} />
      <circle cx="360" cy="650" r="150" fill="url(#dm-planet)" />
      <circle cx="80" cy="96" r="34" fill="url(#dm-moon)" mask="url(#dm-crescent)" />
    </>
  );
}

function GroupScene({ isDark, starColor }) {
  return (
    <>
      <defs>
        <radialGradient id="grp-a" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fcd34d" stopOpacity={isDark ? 0.26 : 0.2} />
          <stop offset="65%" stopColor="#fbbf24" stopOpacity={isDark ? 0.14 : 0.12} />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity={isDark ? 0.05 : 0.05} />
        </radialGradient>
        <radialGradient id="grp-b" cx="38%" cy="32%" r="78%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity={isDark ? 0.3 : 0.22} />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity={isDark ? 0.1 : 0.09} />
        </radialGradient>
      </defs>
      <Stars color={starColor} />
      {/* cluster, top-right */}
      <circle cx="330" cy="120" r="72" fill="url(#grp-a)" />
      <circle cx="248" cy="58" r="34" fill="url(#grp-b)" />
      <circle cx="372" cy="226" r="22" fill="url(#grp-b)" />
      {/* a companion, bottom-left */}
      <circle cx="58" cy="648" r="92" fill="url(#grp-a)" />
      <circle cx="150" cy="602" r="26" fill="url(#grp-b)" />
    </>
  );
}

function ChannelScene({ isDark, starColor }) {
  const ring = isDark ? "rgba(52,211,153,0.18)" : "rgba(16,185,129,0.16)";
  return (
    <>
      <defs>
        <radialGradient id="ch-planet" cx="34%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#6ee7b7" stopOpacity={isDark ? 0.28 : 0.2} />
          <stop offset="60%" stopColor="#34d399" stopOpacity={isDark ? 0.15 : 0.12} />
          <stop offset="100%" stopColor="#10b981" stopOpacity={isDark ? 0.05 : 0.05} />
        </radialGradient>
        <radialGradient id="ch-moon" cx="38%" cy="32%" r="78%">
          <stop offset="0%" stopColor="#a7f3d0" stopOpacity={isDark ? 0.24 : 0.18} />
          <stop offset="100%" stopColor="#10b981" stopOpacity={isDark ? 0.08 : 0.07} />
        </radialGradient>
      </defs>
      <Stars color={starColor} />
      {/* ringed planet, top-right (SVG transform is layer-safe) */}
      <g transform="rotate(-18 322 150)">
        <ellipse cx="322" cy="150" rx="132" ry="34" fill="none" stroke={ring} strokeWidth="7" />
        <circle cx="322" cy="150" r="66" fill="url(#ch-planet)" />
      </g>
      {/* a smaller world, bottom-left */}
      <circle cx="66" cy="636" r="78" fill="url(#ch-moon)" />
    </>
  );
}

export function ChatBackdrop({ kind, isDark }) {
  const starColor = isDark ? "rgba(226,232,240,0.16)" : "rgba(100,116,139,0.14)";
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none overflow-hidden"
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 400 720"
        preserveAspectRatio="xMidYMid slice"
      >
        {kind === "dm" && <DmScene isDark={isDark} starColor={starColor} />}
        {kind === "group" && <GroupScene isDark={isDark} starColor={starColor} />}
        {kind === "channel" && (
          <ChannelScene isDark={isDark} starColor={starColor} />
        )}
      </svg>
    </div>
  );
}
