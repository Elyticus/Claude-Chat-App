// Decorative, static per-room-type backdrop for the chat window. Flat line-art
// SVG (no 3D / shading) on a universe theme — planets, orbits, rings and star
// sparkles — tiled across the ENTIRE message area, so each conversation type
// reads differently at a glance and echoes the app's notification colour
// language (dm = rose, group = amber, channel = emerald):
//   • dm      → a planet with an orbit + a moon
//   • group   → a little constellation of planets
//   • channel → a ringed (Saturn-style) planet
//
// Each motif tiles via <pattern> + a full-size <rect>, kept faint so message
// bubbles stay readable. Motifs sit inside their tile with margin so the
// repeat is seamless.
//
// IMPORTANT: no CSS filter / transform / animation / will-change here. Those
// promote a GPU compositor layer that breaks the composer's caret blink and
// hurts rendering perf (see src/CLAUDE.md "Rendering / GPU"). SVG-internal
// transforms (the ring/orbit tilts) are layer-safe.

const PALETTE = {
  dm: "251,113,133", // rose
  group: "251,191,36", // amber
  channel: "52,211,153", // emerald
};

export function ChatBackdrop({ kind, isDark }) {
  const rgb = PALETTE[kind];
  if (!rgb) return null;
  const line = `rgba(${rgb},${isDark ? 0.16 : 0.13})`;
  const star = `rgba(${rgb},${isDark ? 0.26 : 0.2})`;
  const id = `cbd-${kind}`;

  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none overflow-hidden"
    >
      <svg width="100%" height="100%">
        <defs>
          {kind === "dm" && (
            <pattern id={id} width="132" height="132" patternUnits="userSpaceOnUse">
              {/* orbit + planet + moon */}
              <ellipse
                cx="66"
                cy="66"
                rx="42"
                ry="16"
                fill="none"
                stroke={line}
                strokeWidth="1.1"
                transform="rotate(-20 66 66)"
              />
              <circle cx="66" cy="66" r="12" fill="none" stroke={line} strokeWidth="1.3" />
              <circle cx="105" cy="55" r="2.6" fill={star} />
              {/* stars */}
              <circle cx="20" cy="26" r="1.3" fill={star} />
              <circle cx="116" cy="110" r="1.3" fill={star} />
              <circle cx="26" cy="104" r="1" fill={star} />
              <path d="M108 19 v6 M105 22 h6" stroke={star} strokeWidth="1" />
            </pattern>
          )}
          {kind === "group" && (
            <pattern id={id} width="132" height="132" patternUnits="userSpaceOnUse">
              {/* constellation of planets */}
              <path d="M40 44 L92 60 L66 100 Z" fill="none" stroke={line} strokeWidth="0.9" />
              <circle cx="40" cy="44" r="9" fill="none" stroke={line} strokeWidth="1.3" />
              <circle cx="92" cy="60" r="6" fill="none" stroke={line} strokeWidth="1.2" />
              <circle cx="66" cy="100" r="11" fill="none" stroke={line} strokeWidth="1.3" />
              {/* stars */}
              <circle cx="112" cy="26" r="1.3" fill={star} />
              <circle cx="20" cy="96" r="1.2" fill={star} />
              <circle cx="118" cy="112" r="1" fill={star} />
            </pattern>
          )}
          {kind === "channel" && (
            <pattern id={id} width="132" height="132" patternUnits="userSpaceOnUse">
              {/* ringed planet */}
              <g transform="rotate(-18 66 66)">
                <ellipse cx="66" cy="66" rx="40" ry="13" fill="none" stroke={line} strokeWidth="1.1" />
                <circle cx="66" cy="66" r="16" fill="none" stroke={line} strokeWidth="1.3" />
              </g>
              <circle cx="104" cy="34" r="3" fill="none" stroke={line} strokeWidth="1.1" />
              {/* stars */}
              <circle cx="22" cy="28" r="1.3" fill={star} />
              <circle cx="26" cy="108" r="1.1" fill={star} />
              <path d="M112 103 v6 M109 106 h6" stroke={star} strokeWidth="1" />
            </pattern>
          )}
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}
