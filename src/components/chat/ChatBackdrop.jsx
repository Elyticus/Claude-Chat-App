// Decorative, static per-room-type backdrop for the chat window. A dense, faint
// line-art "doodle wallpaper" on a universe theme — flat outlines (no shading),
// tiled across the ENTIRE message area, in the spirit of a WhatsApp-style doodle
// background. Each conversation type uses a different icon mix + accent colour,
// echoing the app's notification language (dm = rose, group = amber,
// channel = emerald):
//   • dm      → planet, crescent moon, comet, sparkles
//   • group   → a little planet constellation + a rocket
//   • channel → a ringed planet + comet + a small moon
//
// Tiles via <pattern> + a full-size <rect>; every motif sits inside its tile
// with margin so the repeat is seamless. Kept low-contrast so message bubbles
// stay readable.
//
// IMPORTANT: no CSS filter / transform / animation / will-change here. Those
// promote a GPU compositor layer that breaks the composer's caret blink and
// hurts rendering perf (see src/CLAUDE.md "Rendering / GPU"). SVG-internal
// transforms (the ring/rocket tilts) are layer-safe.

const PALETTE = {
  dm: "251,113,133", // rose
  group: "251,191,36", // amber
  channel: "52,211,153", // emerald
};

function Planet({ x, y, r, s }) {
  return <circle cx={x} cy={y} r={r} fill="none" stroke={s} strokeWidth="1.2" />;
}

function RingedPlanet({ x, y, r, s }) {
  return (
    <g transform={`rotate(-18 ${x} ${y})`}>
      <ellipse cx={x} cy={y} rx={r * 2.4} ry={r * 0.8} fill="none" stroke={s} strokeWidth="1.1" />
      <circle cx={x} cy={y} r={r} fill="none" stroke={s} strokeWidth="1.2" />
    </g>
  );
}

function Crescent({ x, y, r, s }) {
  return (
    <path
      d={`M ${x} ${y - r} A ${r} ${r} 0 1 0 ${x} ${y + r} A ${r * 0.78} ${r} 0 1 1 ${x} ${y - r} Z`}
      fill="none"
      stroke={s}
      strokeWidth="1.2"
    />
  );
}

function Sparkle({ x, y, s, f }) {
  const i = s * 0.32;
  return (
    <path
      d={`M ${x} ${y - s} L ${x + i} ${y - i} L ${x + s} ${y} L ${x + i} ${y + i} L ${x} ${y + s} L ${x - i} ${y + i} L ${x - s} ${y} L ${x - i} ${y - i} Z`}
      fill={f}
    />
  );
}

function Comet({ x, y, s, f }) {
  return (
    <g>
      <circle cx={x} cy={y} r="2.4" fill={f} />
      <path
        d={`M ${x - 2} ${y - 2} l -9 -9 M ${x + 1} ${y - 3} l -6 -8 M ${x - 3} ${y + 1} l -8 -6`}
        stroke={s}
        strokeWidth="1"
        fill="none"
      />
    </g>
  );
}

function Rocket({ x, y, s }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M 0 -10 Q 5 -3 5 6 L -5 6 Q -5 -3 0 -10 Z" fill="none" stroke={s} strokeWidth="1.2" />
      <circle cx="0" cy="-2" r="2" fill="none" stroke={s} strokeWidth="1" />
      <path d="M -5 4 L -9 10 L -5 6 M 5 4 L 9 10 L 5 6" fill="none" stroke={s} strokeWidth="1.1" />
      <path d="M -2 6 L 0 11 L 2 6" fill="none" stroke={s} strokeWidth="1" />
    </g>
  );
}

function Dot({ x, y, r = 1.3, f }) {
  return <circle cx={x} cy={y} r={r} fill={f} />;
}

export function ChatBackdrop({ kind, isDark }) {
  const rgb = PALETTE[kind];
  if (!rgb) return null;
  const line = `rgba(${rgb},${isDark ? 0.16 : 0.13})`;
  const star = `rgba(${rgb},${isDark ? 0.22 : 0.17})`;
  const id = `cbd-${kind}`;

  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none overflow-hidden"
    >
      <svg width="100%" height="100%">
        <defs>
          <pattern id={id} width="190" height="190" patternUnits="userSpaceOnUse">
            {kind === "dm" && (
              <>
                <Planet x={58} y={56} r={14} s={line} />
                <Crescent x={150} y={42} r={10} s={line} />
                <Comet x={158} y={150} s={line} f={star} />
                <Sparkle x={108} y={96} s={6} f={star} />
                <Sparkle x={30} y={132} s={4} f={star} />
                <Dot x={96} y={30} f={star} />
                <Dot x={40} y={96} r={1} f={star} />
                <Dot x={172} y={100} f={star} />
                <Dot x={120} y={164} r={1} f={star} />
                <Dot x={74} y={158} f={star} />
              </>
            )}
            {kind === "group" && (
              <>
                <path d="M45 50 L100 40 L78 92 Z" fill="none" stroke={line} strokeWidth="0.9" />
                <Planet x={45} y={50} r={10} s={line} />
                <Planet x={100} y={40} r={7} s={line} />
                <Planet x={78} y={92} r={12} s={line} />
                <Rocket x={152} y={138} s={line} />
                <Sparkle x={160} y={54} s={5} f={star} />
                <Dot x={25} y={120} f={star} />
                <Dot x={126} y={150} r={1} f={star} />
                <Dot x={174} y={172} f={star} />
                <Dot x={60} y={160} r={1} f={star} />
                <Dot x={120} y={110} f={star} />
              </>
            )}
            {kind === "channel" && (
              <>
                <RingedPlanet x={68} y={68} r={16} s={line} />
                <Comet x={150} y={40} s={line} f={star} />
                <Planet x={150} y={140} r={6} s={line} />
                <Sparkle x={40} y={140} s={6} f={star} />
                <Dot x={110} y={30} f={star} />
                <Dot x={30} y={40} r={1} f={star} />
                <Dot x={172} y={96} f={star} />
                <Dot x={96} y={166} r={1} f={star} />
                <Dot x={138} y={172} f={star} />
              </>
            )}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}
