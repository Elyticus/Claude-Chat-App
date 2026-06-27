import { X, RotateCcw, Wand2 } from "lucide-react";
import { LIGHTFALL_DEFAULTS } from "@/lib/lightfall.js";

// ─── Customize panel (Pro) ───────────────────────────────────────────────────
// Live controls for the Special-mode Lightfall background. Floats over the hub
// (no opaque backdrop) so every change is previewed against the real background
// behind it. Changes are lifted to ChatApp via onChange and persisted there.

function Slider({ label, value, min, max, step, onChange, isDark, format }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: isDark ? "rgba(238,242,255,0.75)" : "#475569" }}>
          {label}
        </span>
        <span className="text-[11px] tabular-nums" style={{ color: isDark ? "rgba(165,180,252,0.7)" : "#6366f1" }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-indigo-500 cursor-pointer"
      />
    </label>
  );
}

function Swatch({ label, value, onChange, isDark }) {
  return (
    <label className="flex flex-col items-center gap-1">
      <span
        className="relative w-9 h-9 rounded-full overflow-hidden border"
        style={{ borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)", boxShadow: "0 1px 4px rgba(0,0,0,0.25)" }}
      >
        <span className="absolute inset-0" style={{ background: value }} />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
          aria-label={label}
        />
      </span>
      <span className="text-[10px]" style={{ color: isDark ? "rgba(238,242,255,0.5)" : "#94a3b8" }}>
        {label}
      </span>
    </label>
  );
}

export function CustomizePanel({ settings, onChange, onReset, onClose, isDark }) {
  const set = (patch) => onChange({ ...settings, ...patch });
  const setColor = (i, hex) => {
    const colors = [...settings.colors];
    colors[i] = hex;
    set({ colors });
  };

  const cardBg = isDark ? "rgba(12,18,40,0.92)" : "rgba(255,255,255,0.95)";
  const border = isDark ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.2)";
  const heading = isDark ? "#eef2ff" : "#0f172a";

  return (
    <div
      className="fixed inset-x-3 bottom-3 sm:left-auto sm:right-4 sm:bottom-4 sm:w-80 z-[500] rounded-2xl p-4 max-h-[80dvh] overflow-y-auto no-scrollbar"
      style={{
        background: cardBg,
        border: `1px solid ${border}`,
        boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
        backdropFilter: "blur(12px)",
      }}
      role="dialog"
      aria-label="Customize background"
    >
      <div className="flex items-center gap-2 mb-3">
        <Wand2 size={16} style={{ color: isDark ? "#5eead4" : "#0d9488" }} />
        <span className="text-sm font-semibold flex-1" style={{ color: heading }}>
          Customize background
        </span>
        <button
          onClick={onReset}
          title="Reset to default"
          aria-label="Reset to default"
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          style={{ color: isDark ? "rgba(165,180,252,0.7)" : "#64748b" }}
        >
          <RotateCcw size={15} />
        </button>
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          style={{ color: isDark ? "rgba(238,242,255,0.6)" : "#94a3b8" }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Colors */}
      <div className="flex items-center justify-around mb-4">
        <Swatch label="Streak 1" value={settings.colors[0]} onChange={(c) => setColor(0, c)} isDark={isDark} />
        <Swatch label="Streak 2" value={settings.colors[1]} onChange={(c) => setColor(1, c)} isDark={isDark} />
        <Swatch label="Streak 3" value={settings.colors[2]} onChange={(c) => setColor(2, c)} isDark={isDark} />
        <Swatch label="Glow" value={settings.backgroundColor} onChange={(c) => set({ backgroundColor: c })} isDark={isDark} />
      </div>

      {/* Sliders */}
      <div className="flex flex-col gap-3">
        <Slider label="Speed" value={settings.speed} min={0} max={3} step={0.1} onChange={(v) => set({ speed: v })} isDark={isDark} format={(v) => `${v.toFixed(1)}×`} />
        <Slider label="Streaks" value={settings.streakCount} min={1} max={16} step={1} onChange={(v) => set({ streakCount: v })} isDark={isDark} />
        <Slider label="Density" value={settings.density} min={0.2} max={2} step={0.1} onChange={(v) => set({ density: v })} isDark={isDark} format={(v) => v.toFixed(1)} />
        <Slider label="Glow" value={settings.glow} min={0.2} max={2} step={0.1} onChange={(v) => set({ glow: v })} isDark={isDark} format={(v) => v.toFixed(1)} />
        <Slider label="Twinkle" value={settings.twinkle} min={0} max={1} step={0.05} onChange={(v) => set({ twinkle: v })} isDark={isDark} format={(v) => v.toFixed(2)} />
        <Slider label="Zoom" value={settings.zoom} min={1} max={6} step={0.1} onChange={(v) => set({ zoom: v })} isDark={isDark} format={(v) => v.toFixed(1)} />
        <Slider label="Ambient glow" value={settings.backgroundGlow} min={0} max={2} step={0.1} onChange={(v) => set({ backgroundGlow: v })} isDark={isDark} format={(v) => v.toFixed(1)} />
      </div>

      <p className="text-[10px] mt-3" style={{ color: isDark ? "rgba(238,242,255,0.4)" : "#94a3b8" }}>
        Changes preview live and are saved on this device. Default:{" "}
        {LIGHTFALL_DEFAULTS.colors.join(", ")}.
      </p>
    </div>
  );
}
