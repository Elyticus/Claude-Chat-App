// ─── Special mode — time-of-day dynamic background (vector) ──────────────────
// A macOS-style "Dynamic Desktop": ONE vector landscape rendered by SpecialField
// (SVG), recoloured by the real clock into three distinct vibes —
//   • morning   (5–11)  — indigo overhead warming to amber/peach at the horizon
//   • afternoon (11–18) — deep blue easing to a pale, hazy horizon
//   • night     (18–5)  — deep navy with a pale moon, stars and dark dunes
// Each scene keeps a dark *upper* sky so the hub's white top-bar text stays
// legible, with the bright "vibe" pushed to the horizon, sun/moon and dunes.

export function getScene(h) {
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 18) return "afternoon";
  return "night";
}

// Per-scene palette consumed by SpecialField:
//   sky   — vertical gradient stops [offset, color] (top → bottom)
//   body  — the sun/moon: position (cx/cy as 0–1 fractions), radius, core + glow
//   dunes — three layered hill colors, back → front (front darkest = silhouette)
//   stars — whether to scatter stars across the upper sky
export const SCENES = {
  morning: {
    sky: [
      [0, "#1b2a5c"],
      [0.4, "#46487f"],
      [0.7, "#d27a4e"],
      [0.88, "#f4a55e"],
      [1, "#ffc987"],
    ],
    body: { kind: "sun", cx: 0.3, cy: 0.66, r: 64, core: "#ffae52", glow: "#ffd08a" },
    dunes: ["#6b4636", "#4c2f24", "#301c15"],
    stars: false,
  },
  afternoon: {
    sky: [
      [0, "#185a96"],
      [0.45, "#2f86c4"],
      [0.78, "#82bce4"],
      [1, "#d6ecf8"],
    ],
    body: { kind: "sun", cx: 0.72, cy: 0.2, r: 58, core: "#fff4c4", glow: "#ffe684" },
    dunes: ["#2f6f54", "#1f4f3b", "#143527"],
    stars: false,
  },
  night: {
    sky: [
      [0, "#05081a"],
      [0.45, "#0a1430"],
      [0.8, "#102447"],
      [1, "#173a5c"],
    ],
    body: { kind: "moon", cx: 0.7, cy: 0.22, r: 50, core: "#eef2ff", glow: "#9db4e6" },
    dunes: ["#15294c", "#0e1d39", "#081227"],
    stars: true,
  },
};

// Whether the hub should use dark text over the scene. Decided from the TOP of
// the sky (where the top-bar text sits) — every scene keeps a dark crown, so
// this is false today, but it keeps text correct if a light-topped scene is
// ever added.
export function isSpecialSkyLight(hour) {
  const top = SCENES[getScene(hour)].sky[0][1];
  const r = parseInt(top.slice(1, 3), 16) / 255;
  const g = parseInt(top.slice(3, 5), 16) / 255;
  const b = parseInt(top.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
}
