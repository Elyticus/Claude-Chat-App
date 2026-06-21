// Decorative, static per-room-type backdrop for the chat window. Flat geometric
// SVG patterns (no 3D / shading) tiled across the ENTIRE message area, so each
// conversation type reads differently at a glance — and echoing the app's
// notification colour language (dm = rose, group = amber, channel = emerald):
//   • dm      → diamond lattice
//   • group   → chevrons
//   • channel → square grid with nested squares
//
// Each pattern fills the box via <rect width="100%" height="100%">. Kept faint
// so message bubbles stay readable.
//
// IMPORTANT: no CSS filter / transform / animation / will-change here. Those
// promote a GPU compositor layer that breaks the composer's caret blink and
// hurts rendering perf (see src/CLAUDE.md "Rendering / GPU").

const PALETTE = {
  dm: "251,113,133", // rose
  group: "251,191,36", // amber
  channel: "52,211,153", // emerald
};

export function ChatBackdrop({ kind, isDark }) {
  const rgb = PALETTE[kind];
  if (!rgb) return null;
  const stroke = `rgba(${rgb},${isDark ? 0.16 : 0.13})`;
  const id = `cbd-${kind}`;

  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none overflow-hidden"
    >
      <svg width="100%" height="100%">
        <defs>
          {kind === "dm" && (
            // Diamond lattice — vertices on tile-edge midpoints so it tiles seamlessly.
            <pattern id={id} width="34" height="34" patternUnits="userSpaceOnUse">
              <path
                d="M17 0 L34 17 L17 34 L0 17 Z"
                fill="none"
                stroke={stroke}
                strokeWidth="1.25"
              />
            </pattern>
          )}
          {kind === "group" && (
            // Chevrons — a V per tile; rows stack into a continuous zigzag field.
            <pattern id={id} width="40" height="20" patternUnits="userSpaceOnUse">
              <path
                d="M0 20 L20 0 L40 20"
                fill="none"
                stroke={stroke}
                strokeWidth="1.25"
              />
            </pattern>
          )}
          {kind === "channel" && (
            // Square grid (top+left edges per cell) with a smaller nested square.
            <pattern id={id} width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0 H0 V40" fill="none" stroke={stroke} strokeWidth="1" />
              <rect
                x="13"
                y="13"
                width="14"
                height="14"
                fill="none"
                stroke={stroke}
                strokeWidth="1.25"
              />
            </pattern>
          )}
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}
