// Decorative, static per-room-type backdrop for the chat window. A dense, faint
// line-art "doodle wallpaper" on a universe theme — flat outlines (no shading),
// tiled across the ENTIRE message area, in the spirit of a WhatsApp-style doodle
// background. Many icon types are scattered on a packed grid; each conversation
// type uses a different icon mix + accent colour, echoing the app's notification
// language (dm = rose, group = amber, channel = emerald).
//
// Tiles via <pattern> + a full-size <rect>; everything sits inside the tile with
// margin so the repeat is seamless. Kept low-contrast so messages stay readable.
//
// IMPORTANT: no CSS filter / transform / animation / will-change here. Those
// promote a GPU compositor layer that breaks the composer's caret blink and
// hurts rendering perf (see src/CLAUDE.md "Rendering / GPU"). SVG-internal
// transforms are layer-safe.

const PALETTE = {
  dm: "251,113,133", // rose
  group: "251,191,36", // amber
  channel: "52,211,153", // emerald
};

const TILE = 320;

const TYPE_SETS = {
  dm: ["planet", "crescent", "orbit", "star5", "galaxy", "atom", "comet", "ringed", "asteroid", "alien", "sun", "sparkle"],
  group: ["planet", "rocket", "ufo", "satellite", "star5", "galaxy", "atom", "comet", "alien", "asteroid", "sparkle", "planet"],
  channel: ["ringed", "satellite", "ufo", "comet", "planet", "star5", "galaxy", "atom", "sun", "asteroid", "alien", "sparkle"],
};

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

const ASTEROID = [
  [-1, -0.45], [-0.4, -1], [0.5, -0.85], [1, -0.2],
  [0.8, 0.6], [0.2, 1], [-0.6, 0.82], [-1, 0.2],
];
function asteroidPath(x, y, r) {
  return `M${ASTEROID.map(([dx, dy]) => `${(x + dx * r).toFixed(1)} ${(y + dy * r).toFixed(1)}`).join(" L")} Z`;
}

function sunPath(x, y, r) {
  let d = "";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    d += `M ${(x + 0.62 * r * Math.cos(a)).toFixed(1)} ${(y + 0.62 * r * Math.sin(a)).toFixed(1)} L ${(x + r * Math.cos(a)).toFixed(1)} ${(y + r * Math.sin(a)).toFixed(1)} `;
  }
  return d;
}

function drawIcon(type, x, y, r, L, S) {
  switch (type) {
    case "planet":
      return <circle cx={x} cy={y} r={r} fill="none" stroke={L} strokeWidth="1.5" />;
    case "ringed":
      return (
        <g transform={`rotate(-18 ${x} ${y})`}>
          <ellipse cx={x} cy={y} rx={r * 2.1} ry={r * 0.72} fill="none" stroke={L} strokeWidth="1.4" />
          <circle cx={x} cy={y} r={r} fill="none" stroke={L} strokeWidth="1.5" />
        </g>
      );
    case "crescent":
      return (
        <path
          d={`M ${x} ${y - r} A ${r} ${r} 0 1 0 ${x} ${y + r} A ${r * 0.78} ${r} 0 1 1 ${x} ${y - r} Z`}
          fill="none"
          stroke={L}
          strokeWidth="1.5"
        />
      );
    case "comet":
      return (
        <g>
          <circle cx={x} cy={y} r={r * 0.26} fill={S} />
          <path
            d={`M ${x - 3} ${y - 3} l ${-r} ${-r} M ${x + 1} ${y - 4} l ${-r * 0.7} ${-r} M ${x - 4} ${y + 1} l ${-r} ${-r * 0.7}`}
            stroke={L}
            strokeWidth="1.2"
            fill="none"
          />
        </g>
      );
    case "rocket":
      return (
        <g transform={`translate(${x} ${y}) scale(${(r / 9).toFixed(2)})`}>
          <path d="M 0 -10 Q 5 -3 5 6 L -5 6 Q -5 -3 0 -10 Z" fill="none" stroke={L} strokeWidth="0.9" />
          <circle cx="0" cy="-2" r="2" fill="none" stroke={L} strokeWidth="0.8" />
          <path d="M -5 4 L -9 10 L -5 6 M 5 4 L 9 10 L 5 6" fill="none" stroke={L} strokeWidth="0.85" />
          <path d="M -2 6 L 0 11 L 2 6" fill="none" stroke={L} strokeWidth="0.8" />
        </g>
      );
    case "ufo":
      return (
        <g transform={`translate(${x} ${y}) scale(${(r / 13).toFixed(2)})`}>
          <ellipse cx="0" cy="0" rx="20" ry="7" fill="none" stroke={L} strokeWidth="1.5" />
          <path d="M -10 -3 A 10 8 0 0 1 10 -3" fill="none" stroke={L} strokeWidth="1.4" />
          <circle cx="-8" cy="1" r="1.3" fill={S} />
          <circle cx="0" cy="2.4" r="1.3" fill={S} />
          <circle cx="8" cy="1" r="1.3" fill={S} />
        </g>
      );
    case "satellite":
      return (
        <g transform={`translate(${x} ${y}) rotate(-15) scale(${(r / 12).toFixed(2)})`}>
          <rect x="-6" y="-8" width="12" height="16" rx="2" fill="none" stroke={L} strokeWidth="1.5" />
          <rect x="-24" y="-5" width="14" height="10" fill="none" stroke={L} strokeWidth="1.3" />
          <rect x="10" y="-5" width="14" height="10" fill="none" stroke={L} strokeWidth="1.3" />
          <path d="M -10 0 H -6 M 6 0 H 10" stroke={L} strokeWidth="1.3" />
          <path d="M 0 -8 q 8 -7 15 -2" fill="none" stroke={L} strokeWidth="1.2" />
        </g>
      );
    case "orbit":
      return (
        <g transform={`rotate(-22 ${x} ${y})`}>
          <ellipse cx={x} cy={y} rx={r * 1.8} ry={r * 0.7} fill="none" stroke={L} strokeWidth="1.4" />
          <circle cx={x + r * 1.8} cy={y} r="3" fill={S} />
        </g>
      );
    case "star5":
      return <path d={fiveStarPath(x, y, r)} fill="none" stroke={L} strokeWidth="1.4" />;
    case "sparkle": {
      const s = r * 0.85;
      const i = s * 0.32;
      return (
        <path
          d={`M ${x} ${y - s} L ${x + i} ${y - i} L ${x + s} ${y} L ${x + i} ${y + i} L ${x} ${y + s} L ${x - i} ${y + i} L ${x - s} ${y} L ${x - i} ${y - i} Z`}
          fill={S}
        />
      );
    }
    case "galaxy":
      return (
        <g transform={`rotate(24 ${x} ${y})`}>
          <ellipse cx={x} cy={y} rx={r} ry={r * 0.42} fill="none" stroke={L} strokeWidth="1.4" />
          <ellipse cx={x} cy={y} rx={r * 0.5} ry={r * 0.2} fill="none" stroke={L} strokeWidth="1.2" />
          <circle cx={x} cy={y} r="1.6" fill={S} />
        </g>
      );
    case "atom":
      return (
        <g>
          <ellipse cx={x} cy={y} rx={r} ry={r * 0.38} fill="none" stroke={L} strokeWidth="1.3" />
          <ellipse cx={x} cy={y} rx={r} ry={r * 0.38} fill="none" stroke={L} strokeWidth="1.3" transform={`rotate(60 ${x} ${y})`} />
          <ellipse cx={x} cy={y} rx={r} ry={r * 0.38} fill="none" stroke={L} strokeWidth="1.3" transform={`rotate(120 ${x} ${y})`} />
          <circle cx={x} cy={y} r="2" fill={S} />
        </g>
      );
    case "alien":
      return (
        <g>
          <ellipse cx={x} cy={y} rx={r * 0.72} ry={r} fill="none" stroke={L} strokeWidth="1.5" />
          <ellipse cx={x - r * 0.3} cy={y + r * 0.05} rx={r * 0.15} ry={r * 0.3} fill={S} transform={`rotate(18 ${x - r * 0.3} ${y})`} />
          <ellipse cx={x + r * 0.3} cy={y + r * 0.05} rx={r * 0.15} ry={r * 0.3} fill={S} transform={`rotate(-18 ${x + r * 0.3} ${y})`} />
        </g>
      );
    case "sun":
      return (
        <g>
          <circle cx={x} cy={y} r={r * 0.45} fill="none" stroke={L} strokeWidth="1.5" />
          <path d={sunPath(x, y, r)} stroke={L} strokeWidth="1.2" fill="none" />
        </g>
      );
    case "asteroid":
      return <path d={asteroidPath(x, y, r)} fill="none" stroke={L} strokeWidth="1.4" />;
    default:
      return null;
  }
}

function Scene({ kind, line, star }) {
  const types = TYPE_SETS[kind];
  const margin = 30;
  const cols = 4;
  const rows = 5;
  const stepX = (TILE - 2 * margin) / cols;
  const stepY = (TILE - 2 * margin) / rows;

  const nodes = [];
  let i = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const jx = ((i * 37) % 19) - 9;
      const jy = ((i * 23) % 19) - 9;
      const x = margin + stepX * (col + 0.5) + jx;
      const y = margin + stepY * (row + 0.5) + jy;
      const r = 10 + (i % 4) * 2;
      const type = types[(i * 7) % types.length];
      nodes.push(<g key={`i${i}`}>{drawIcon(type, x, y, r, line, star)}</g>);
      i++;
    }
  }

  // Filler layer — tiny stars/sparkles in the gaps between the icon cells.
  let j = 0;
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const x = margin + stepX * (col + 1);
      const y = margin + stepY * (row + 1);
      nodes.push(
        j % 3 === 0 ? (
          <g key={`f${j}`}>{drawIcon("sparkle", x, y, 6, line, star)}</g>
        ) : (
          <circle key={`f${j}`} cx={x} cy={y} r="1.5" fill={star} />
        ),
      );
      j++;
    }
  }

  return <>{nodes}</>;
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
