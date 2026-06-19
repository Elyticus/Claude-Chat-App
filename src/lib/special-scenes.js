// ─── Special mode — time-of-day scenes ───────────────────────────────────────
// Special mode is no longer a single aurora. It now picks ONE of three visually
// distinct canvas scenes from the real clock:
//   • Blue hour   (dawn / early morning) — cool pre-sunrise haze + fading stars
//   • Golden hour (late afternoon)       — warm low sun, god rays, drifting dust
//   • Aurora      (twilight → night)     — the original flowing curtains + motes
// Shared between SpecialField (the canvas) and the hub's text-contrast helper.

// The three scenes tile the whole day. Each flows naturally into the next:
// the dawn blues brighten, the afternoon warms to gold, then night brings the
// aurora. Boundaries are deliberately broad so every hour maps to a scene.
export function getScene(h) {
  if (h >= 5 && h < 11) return "blue"; // dawn → late morning: blue hour
  if (h >= 11 && h < 18) return "golden"; // midday → late afternoon: golden hour
  return "aurora"; // dusk, twilight, night
}

// Per-scene palette. `sky` is the vertical backdrop gradient (top → bottom);
// the remaining colors are "r,g,b" strings consumed with rgba() in the canvas.
export const SCENES = {
  // Pre-sunrise: deep navy climbing to a cool steel blue at the horizon.
  blue: {
    sky: [
      [0, "#060f24"],
      [0.45, "#0e2148"],
      [0.78, "#22416f"],
      [1, "#3a648f"],
    ],
    glow: "150,196,255", // brightening horizon (the coming sun, still cool)
    mote: "200,224,255", // cool rising motes + the fading dawn stars
  },
  // Late afternoon: dusky violet up top melting into amber and gold at the sun.
  golden: {
    sky: [
      [0, "#241433"],
      [0.4, "#5e2f50"],
      [0.66, "#a85436"],
      [0.85, "#d9863a"],
      [1, "#f2b85a"],
    ],
    glow: "255,184,92", // the low sun, its rays and glow
    mote: "255,226,170", // drifting warm dust
  },
  // Twilight → night: the original aurora palette (dark sky, green ribbons).
  aurora: {
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

// Whether the current scene's sky reads as light (average relative luminance of
// its gradient stops > 0.5). The hub uses this to pick black or white text over
// the scene. All three scenes are dark-skied (the UI inherits the dark
// palette), so this returns false today, but it keeps text correct if a
// brighter palette is ever added.
export function isSpecialSkyLight(hour) {
  const p = SCENES[getScene(hour)];
  const lum =
    p.sky.reduce((sum, [, hex]) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return sum + (0.2126 * r + 0.7152 * g + 0.0722 * b);
    }, 0) / p.sky.length;
  return lum > 0.5;
}
