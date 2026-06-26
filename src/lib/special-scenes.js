// ─── Special mode — time-of-day landscape scene (vector) ─────────────────────
// A macOS-style "Dynamic Desktop" in SVG (SpecialField): ONE stylised valley —
// layered mountains with a snow-capped peak, rolling green hills, a winding
// river, scattered cypress/round trees and a sun or moon — recoloured by the
// real clock into FOUR atmospheres (see getScene). Inspired by flat vector
// landscape wallpaper art; the geometry is fixed and only the palette changes.

export function getScene(h) {
  if (h >= 5 && h < 10) return "morning"; // dawn — pink/peach sunrise
  if (h >= 10 && h < 17) return "afternoon"; // day — bright blue
  if (h >= 17 && h < 20) return "evening"; // sunset — orange/red
  return "night"; // moon + stars
}

// Palette roles consumed by SpecialField:
//   sky       — vertical gradient stops [offset 0..1, color] (top → horizon)
//   orb       — the sun (day/dawn/sunset) or moon (night) disc color
//   orbGlow   — soft halo color/strength around the orb
//   mountains — [far/hazy, mid, near] receding ridge layers
//   snow      — snow cap on the prominent peak
//   hills     — [back/hazy, mid, front] rolling hill bands (front = nearest)
//   river     — [water, sheen] the winding river + its highlight
//   trees     — cypress + round-tree foliage
//   clouds    — wispy cloud color (false → none, e.g. clear night)
//   stars     — scatter stars across the upper sky + render a moon (night)
export const SCENES = {
  // Dawn — soft blue-purple top warming to a peach horizon, low warm sun.
  morning: {
    sky: [[0, "#5d76b0"], [0.4, "#9d8fc0"], [0.72, "#f1b39a"], [1, "#ffd9b0"]],
    orb: "#fff3d6",
    orbGlow: "rgba(255,221,170,0.55)",
    mountains: ["#b9aecf", "#9b8fc0", "#7d6fae"],
    snow: "#fbeede",
    hills: ["#a7b886", "#8aa86a", "#6f9656"],
    river: ["#cdc0dc", "#efe4ec"],
    trees: "#4d6b4a",
    clouds: "#ffe6d0",
    stars: false,
  },
  // Day — vivid blue sky, white sun, blue-haze mountains, lush green hills.
  afternoon: {
    sky: [[0, "#1f7fd6"], [0.45, "#3f9ae6"], [0.78, "#8fc8f2"], [1, "#d2ecfb"]],
    orb: "#fffdf2",
    orbGlow: "rgba(255,255,235,0.5)",
    mountains: ["#9fc2e6", "#7aa6d8", "#5b86c0"],
    snow: "#eef6ff",
    hills: ["#7fb06a", "#5e9e4e", "#3f8a36"],
    river: ["#9fd2f0", "#cfeafa"],
    trees: "#2f6f34",
    clouds: "#ffffff",
    stars: false,
  },
  // Sunset — deep purple top, fiery orange band, bright yellow horizon, the sun
  // setting low; hills fall into warm silhouette and the river catches the glow.
  evening: {
    sky: [[0, "#3a2350"], [0.4, "#7a2f63"], [0.66, "#d8542f"], [0.86, "#f59a2e"], [1, "#ffd24a"]],
    orb: "#fff1c4",
    orbGlow: "rgba(255,168,74,0.6)",
    mountains: ["#7a4a66", "#5e3556", "#412445"],
    snow: "#f7d9c4",
    hills: ["#5a3a52", "#3f2742", "#281a30"],
    river: ["#e8863a", "#ffd06a"],
    trees: "#241a30",
    clouds: "#f6a25a",
    stars: false,
  },
  // Night — deep navy with a faint warm horizon glow, a bright moon, stars, the
  // peak catching moonlight and a moonlit river threading the dark hills.
  night: {
    sky: [[0, "#070c24"], [0.5, "#0e1640"], [0.8, "#1a2456"], [0.93, "#2a2f5e"], [1, "#574a52"]],
    orb: "#eaf0ff",
    orbGlow: "rgba(200,214,255,0.45)",
    mountains: ["#26335f", "#1b2750", "#121b3c"],
    snow: "#c6d2f0",
    hills: ["#1a2750", "#121d3e", "#0b1430"],
    river: ["#2f4a86", "#86a0dc"],
    trees: "#0a1430",
    clouds: false,
    stars: true,
  },
};

// Relative luminance of a #rrggbb color > 0.55 → "light" (use dark text over it).
export function isHexLight(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
}

// Whether the hub should use dark text over the scene — decided from the TOP of
// the sky (where the top-bar text sits). All four built-in skies are dark/medium
// at the top, so the hub keeps white text; a bright custom (AI) sky flips it.
export function isSpecialSkyLight(hour) {
  return isHexLight(SCENES[getScene(hour)].sky[0][1]);
}
