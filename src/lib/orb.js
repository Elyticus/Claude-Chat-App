// ─── Orb (Light-mode background) settings ────────────────────────────────────
// Defaults + localStorage load/save for the WebGL Orb background. Pro users tune
// these live via the Customize panel; everyone else gets the default. The
// background stays white (set by OrbitalHub), so it isn't part of the settings.

export const ORB_DEFAULTS = {
  hue: 0,
  hoverIntensity: 0.5,
  rotateOnHover: true,
  forceHoverState: false,
};

const STORAGE_KEY = "linkloop_orb";

export function loadOrb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...ORB_DEFAULTS };
    return { ...ORB_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...ORB_DEFAULTS };
  }
}

export function saveOrb(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable — settings simply won't persist */
  }
}
