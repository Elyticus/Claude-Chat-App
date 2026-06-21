// Decorative, static per-room-type backdrop for the chat window. A dense, faint
// line-art "doodle wallpaper" on a universe theme — flat outlines (no shading),
// tiled across the ENTIRE message area, in the spirit of a WhatsApp-style doodle
// background. Each conversation type uses a different icon mix + accent colour,
// echoing the app's notification language (dm = rose, group = amber,
// channel = emerald).
//
// Tiles via <pattern> + a full-size <rect>; every motif sits inside its tile
// with margin so the repeat is seamless. Kept low-contrast so message bubbles
// stay readable.
//
// IMPORTANT: no CSS filter / transform / animation / will-change here. Those
// promote a GPU compositor layer that breaks the composer's caret blink and
// hurts rendering perf (see src/CLAUDE.md "Rendering / GPU"). SVG-internal
// transforms (ring/rocket/satellite tilts) are layer-safe.

const PALETTE = {
  dm: "251,113,133", // rose
  group: "251,191,36", // amber
  channel: "52,211,153", // emerald
};

const TILE = 300;

function Planet({ x, y, r, s }) {
  return <circle cx={x} cy={y} r={r} fill="none" stroke={s} strokeWidth="1.5" />;
}

function RingedPlanet({ x, y, r, s }) {
  return (
    <g transform={`rotate(-18 ${x} ${y})`}>
      <ellipse cx={x} cy={y} rx={r * 2.4} ry={r * 0.8} fill="none" stroke={s} strokeWidth="1.4" />
      <circle cx={x} cy={y} r={r} fill="none" stroke={s} strokeWidth="1.5" />
    </g>
  );
}

function Crescent({ x, y, r, s }) {
  return (
    <path
      d={`M ${x} ${y - r} A ${r} ${r} 0 1 0 ${x} ${y + r} A ${r * 0.78} ${r} 0 1 1 ${x} ${y - r} Z`}
      fill="none"
      stroke={s}
      strokeWidth="1.5"
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

function fiveStarPath(cx, cy, R) {
  const r = R * 0.4;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

function FiveStar({ x, y, r, s }) {
  return <path d={fiveStarPath(x, y, r)} fill="none" stroke={s} strokeWidth="1.4" />;
}

function Comet({ x, y, s, f }) {
  return (
    <g>
      <circle cx={x} cy={y} r="3" fill={f} />
      <path
        d={`M ${x - 3} ${y - 3} l -13 -13 M ${x + 1} ${y - 4} l -9 -12 M ${x - 4} ${y + 1} l -12 -9`}
        stroke={s}
        strokeWidth="1.2"
        fill="none"
      />
    </g>
  );
}

function Rocket({ x, y, s }) {
  return (
    <g transform={`translate(${x} ${y}) scale(1.6)`}>
      <path d="M 0 -10 Q 5 -3 5 6 L -5 6 Q -5 -3 0 -10 Z" fill="none" stroke={s} strokeWidth="0.9" />
      <circle cx="0" cy="-2" r="2" fill="none" stroke={s} strokeWidth="0.8" />
      <path d="M -5 4 L -9 10 L -5 6 M 5 4 L 9 10 L 5 6" fill="none" stroke={s} strokeWidth="0.85" />
      <path d="M -2 6 L 0 11 L 2 6" fill="none" stroke={s} strokeWidth="0.8" />
    </g>
  );
}

function Ufo({ x, y, s, f }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="0" rx="20" ry="7" fill="none" stroke={s} strokeWidth="1.5" />
      <path d="M -10 -3 A 10 8 0 0 1 10 -3" fill="none" stroke={s} strokeWidth="1.4" />
      <circle cx="-8" cy="1" r="1.3" fill={f} />
      <circle cx="0" cy="2.4" r="1.3" fill={f} />
      <circle cx="8" cy="1" r="1.3" fill={f} />
    </g>
  );
}

function Satellite({ x, y, s }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(-15)`}>
      <rect x="-6" y="-8" width="12" height="16" rx="2" fill="none" stroke={s} strokeWidth="1.5" />
      <rect x="-24" y="-5" width="14" height="10" fill="none" stroke={s} strokeWidth="1.3" />
      <rect x="10" y="-5" width="14" height="10" fill="none" stroke={s} strokeWidth="1.3" />
      <path d="M -10 0 H -6 M 6 0 H 10" stroke={s} strokeWidth="1.3" />
      <path d="M 0 -8 q 8 -7 15 -2" fill="none" stroke={s} strokeWidth="1.2" />
    </g>
  );
}

function Orbit({ x, y, rx, s, f }) {
  return (
    <g transform={`rotate(-22 ${x} ${y})`}>
      <ellipse cx={x} cy={y} rx={rx} ry={rx * 0.4} fill="none" stroke={s} strokeWidth="1.4" />
      <circle cx={x + rx} cy={y} r="3" fill={f} />
    </g>
  );
}

function Dot({ x, y, r = 1.6, f }) {
  return <circle cx={x} cy={y} r={r} fill={f} />;
}

function Scene({ kind, line, star }) {
  if (kind === "dm") {
    return (
      <>
        <Planet x={62} y={66} r={22} s={line} />
        <Crescent x={232} y={56} r={18} s={line} />
        <RingedPlanet x={250} y={210} r={18} s={line} />
        <Orbit x={150} y={150} rx={40} s={line} f={star} />
        <Comet x={70} y={250} s={line} f={star} />
        <FiveStar x={210} y={120} r={12} s={line} />
        <Sparkle x={120} y={250} s={10} f={star} />
        <Sparkle x={285} y={285} s={7} f={star} />
        <Sparkle x={40} y={170} s={7} f={star} />
        <Dot x={150} y={40} f={star} />
        <Dot x={110} y={110} r={1.2} f={star} />
        <Dot x={210} y={270} f={star} />
        <Dot x={285} y={120} r={1.2} f={star} />
        <Dot x={45} y={285} f={star} />
        <Dot x={175} y={205} r={1.2} f={star} />
      </>
    );
  }
  if (kind === "group") {
    return (
      <>
        <path d="M58 64 L128 46 L100 120 Z" fill="none" stroke={line} strokeWidth="1" />
        <Planet x={58} y={64} r={16} s={line} />
        <Planet x={128} y={46} r={11} s={line} />
        <Planet x={100} y={120} r={20} s={line} />
        <Rocket x={246} y={74} s={line} />
        <Ufo x={70} y={236} s={line} f={star} />
        <Satellite x={244} y={224} s={line} />
        <FiveStar x={200} y={170} r={13} s={line} />
        <Sparkle x={270} y={150} s={9} f={star} />
        <Sparkle x={36} y={150} s={7} f={star} />
        <Sparkle x={160} y={270} s={7} f={star} />
        <Dot x={210} y={40} f={star} />
        <Dot x={130} y={210} r={1.2} f={star} />
        <Dot x={285} y={285} f={star} />
        <Dot x={40} y={250} r={1.2} f={star} />
      </>
    );
  }
  // channel
  return (
    <>
      <RingedPlanet x={74} y={84} r={26} s={line} />
      <Satellite x={236} y={70} s={line} />
      <Ufo x={150} y={236} s={line} f={star} />
      <Comet x={262} y={186} s={line} f={star} />
      <FiveStar x={48} y={210} r={13} s={line} />
      <Planet x={214} y={262} r={13} s={line} />
      <Sparkle x={168} y={120} s={10} f={star} />
      <Sparkle x={280} y={270} s={7} f={star} />
      <Dot x={130} y={36} f={star} />
      <Dot x={40} y={70} r={1.2} f={star} />
      <Dot x={285} y={130} f={star} />
      <Dot x={100} y={180} r={1.2} f={star} />
      <Dot x={220} y={150} f={star} />
    </>
  );
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
          <pattern id={id} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
            <Scene kind={kind} line={line} star={star} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}
