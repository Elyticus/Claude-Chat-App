// ─── Lightfall (Special-mode background) settings ────────────────────────────
// Defaults + localStorage load/save for the WebGL Lightfall background. Pro
// users tune these live via the Customize panel; everyone else gets the default.

export const LIGHTFALL_DEFAULTS = {
  colors: ["#A6C8FF", "#5227FF", "#FF9FFC"],
  backgroundColor: "#0A29FF",
  speed: 0.5,
  streakCount: 4,
  glow: 1,
  density: 0.6,
  twinkle: 1,
  zoom: 3,
  backgroundGlow: 0.6,
};

const STORAGE_KEY = "linkloop_lightfall";

export function loadLightfall() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...LIGHTFALL_DEFAULTS };
    const parsed = JSON.parse(raw);
    // Merge over defaults so a partial/old saved blob never drops a prop.
    return {
      ...LIGHTFALL_DEFAULTS,
      ...parsed,
      colors:
        Array.isArray(parsed?.colors) && parsed.colors.length
          ? parsed.colors.slice(0, 3)
          : LIGHTFALL_DEFAULTS.colors,
    };
  } catch {
    return { ...LIGHTFALL_DEFAULTS };
  }
}

export function saveLightfall(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable — settings simply won't persist */
  }
}
