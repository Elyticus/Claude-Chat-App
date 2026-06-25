// ─── Special mode — time-of-day coastal scene (vector) ───────────────────────
// A macOS-style "Dynamic Desktop" done in SVG (SpecialField): ONE stylised
// coastline — sea, foamy shoreline, sandy beach, layered cliffs with umbrella
// pines, foreground rocks and wildflowers — recoloured by the real clock into
// three atmospheres (see getScene). Inspired by Apple/Arch "After Dark" style
// coastal art; the geometry is fixed and only the palette changes per time.

export function getScene(h) {
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 18) return "afternoon";
  return "night";
}

// Palette roles consumed by SpecialField:
//   sky      — vertical gradient stops [offset, color] (top → horizon)
//   sea      — [deep, shallow] (vertical gradient toward the shore)
//   foam     — the bright wave line where sea meets sand
//   sand     — [light, shade]
//   cliffs   — [far/hazy, mid, near/dark] headland layers
//   rock     — [face, shade] foreground rocks
//   foliage  — trees + grass
//   flowers  — [warm, cool] wildflower accents
//   stars    — scatter stars across the upper sky (night)
export const SCENES = {
  morning: {
    sky: [[0, "#5b5a96"], [0.5, "#b07ea0"], [0.8, "#ec9e6e"], [1, "#ffd0a4"]],
    sea: ["#2f6f86", "#5a9aa8"],
    foam: "#f4e7e1",
    sand: ["#edc99b", "#d6a877"],
    cliffs: ["#8a6a86", "#6a4a68", "#43304a"],
    rock: ["#6a5a72", "#473a4e"],
    foliage: "#34474a",
    flowers: ["#ef7a44", "#e0566a"],
    stars: false,
  },
  afternoon: {
    sky: [[0, "#3fb6c2"], [0.5, "#76cdd0"], [0.82, "#aee0dd"], [1, "#dcf2ec"]],
    sea: ["#1f6f86", "#3f97ac"],
    foam: "#eef7f2",
    sand: ["#ebc983", "#d4ac61"],
    cliffs: ["#a4727e", "#7c4b54", "#4c3038"],
    rock: ["#6e5560", "#4a3a44"],
    foliage: "#21492c",
    flowers: ["#ea6230", "#dd3a3a"],
    stars: false,
  },
  night: {
    sky: [[0, "#0c1240"], [0.5, "#151c54"], [0.82, "#1f2c6e"], [1, "#2c3c88"]],
    sea: ["#0e1745", "#1d2e68"],
    foam: "#46599a",
    sand: ["#2b3a6c", "#1f2c56"],
    cliffs: ["#1b2856", "#121b40", "#0a1028"],
    rock: ["#172450", "#0e1736"],
    foliage: "#0b1430",
    flowers: ["#4a5ea4", "#5a6eb4"],
    stars: true,
  },
};

// Whether the hub should use dark text over the scene — decided from the TOP of
// the sky (where the top-bar text sits). Morning/night keep dark crowns (white
// text); the bright afternoon sky returns true (dark text).
export function isSpecialSkyLight(hour) {
  const top = SCENES[getScene(hour)].sky[0][1];
  const r = parseInt(top.slice(1, 3), 16) / 255;
  const g = parseInt(top.slice(3, 5), 16) / 255;
  const b = parseInt(top.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
}
