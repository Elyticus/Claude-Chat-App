// ─── Special (aurora) mode palettes ──────────────────────────────────────────
// Shared between the AuroraField canvas and the hub (text-contrast helper).
// The scene reacts to the real clock: each period swaps the sky backdrop, the
// aurora ribbon hues and the horizon/mote colors.

export function getPeriod(h) {
  if (h >= 5 && h < 9) return "dawn";
  if (h >= 9 && h < 18) return "day";
  if (h >= 18 && h < 21) return "dusk";
  return "night";
}

// Sky stays dark in every period (the UI inherits the dark palette); the
// period swaps the aurora hues, the horizon glow and the mote color.
export const PALETTES = {
  dawn: {
    sky: [
      [0, "#04111f"],
      [0.55, "#0a2236"],
      [1, "#16344a"],
    ],
    ribbons: ["56,189,248", "45,212,191", "251,191,36"],
    horizon: "251,191,36",
    mote: "165,243,252",
  },
  day: {
    sky: [
      [0, "#03131f"],
      [0.55, "#07283a"],
      [1, "#0c3e4e"],
    ],
    ribbons: ["34,211,238", "52,211,153", "129,140,248"],
    horizon: "34,211,238",
    mote: "186,230,253",
  },
  dusk: {
    sky: [
      [0, "#120724"],
      [0.55, "#2a0f3d"],
      [1, "#46183f"],
    ],
    ribbons: ["244,114,182", "192,132,252", "251,146,60"],
    horizon: "251,146,60",
    mote: "253,186,216",
  },
  night: {
    sky: [
      [0, "#020610"],
      [0.55, "#04101e"],
      [1, "#09202b"],
    ],
    ribbons: ["52,211,153", "45,212,191", "167,139,250"],
    horizon: "52,211,153",
    mote: "167,243,208",
  },
};

// Whether the given hour's sky reads as light (average relative luminance of
// its gradient stops > 0.5). The hub uses this to pick black or white text
// over the aurora scene. All current palettes are dark, but this keeps text
// correct if a lighter palette is ever added.
export function isAuroraSkyLight(hour) {
  const p = PALETTES[getPeriod(hour)];
  const lum =
    p.sky.reduce((sum, [, hex]) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return sum + (0.2126 * r + 0.7152 * g + 0.0722 * b);
    }, 0) / p.sky.length;
  return lum > 0.5;
}
