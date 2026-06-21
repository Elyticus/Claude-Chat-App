// Decorative, static per-room-type backdrop for the chat window. Flat geometric
// SVG patterns (no 3D / shading) tiled across the WHOLE chat box — it's rendered
// in ChatPanel behind the header, messages and composer, so the pattern fills
// the entire window. Each conversation type uses a different geometry + accent
// colour, echoing the app's notification language (dm = rose, group = amber,
// channel = emerald):
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
            <pattern id={id} width="44" height="44" patternUnits="userSpaceOnUse">
              <path
                d="M22 0 L44 22 L22 44 L0 22 Z"
                fill="none"
                stroke={stroke}
                strokeWidth="1.4"
              />
            </pattern>
          )}
          {kind === "group" && (
            // Chevrons — a V per tile; rows stack into a continuous zigzag field.
            <pattern id={id} width="52" height="26" patternUnits="userSpaceOnUse">
              <path
                d="M0 26 L26 0 L52 26"
                fill="none"
                stroke={stroke}
                strokeWidth="1.4"
              />
            </pattern>
          )}
          {kind === "channel" && (
            // Square grid (top+left edges per cell) with a smaller nested square.
            <pattern id={id} width="52" height="52" patternUnits="userSpaceOnUse">
              <path d="M52 0 H0 V52" fill="none" stroke={stroke} strokeWidth="1.1" />
              <rect
                x="17"
                y="17"
                width="18"
                height="18"
                fill="none"
                stroke={stroke}
                strokeWidth="1.4"
              />
            </pattern>
          )}
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}
