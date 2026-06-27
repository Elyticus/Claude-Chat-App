// ─── Galaxy (Dark-mode background) settings ──────────────────────────────────
// Defaults + localStorage load/save for the WebGL Galaxy background. Pro users
// tune these live via the Customize panel; everyone else gets the default.

export const GALAXY_DEFAULTS = {
  density: 1.1,
  hueShift: 225,
  saturation: 0.55,
  glowIntensity: 0.4,
  twinkleIntensity: 0.4,
  starSpeed: 0.4,
  speed: 0.8,
  rotationSpeed: 0.04,
  mouseInteraction: false,
  mouseRepulsion: false,
};

const STORAGE_KEY = "linkloop_galaxy";

export function loadGalaxy() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...GALAXY_DEFAULTS };
    const parsed = JSON.parse(raw);
    // Merge over defaults so a partial/old saved blob never drops a prop.
    return { ...GALAXY_DEFAULTS, ...parsed };
  } catch {
    return { ...GALAXY_DEFAULTS };
  }
}

export function saveGalaxy(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable — settings simply won't persist */
  }
}
