import { X, RotateCcw, Wand2 } from "lucide-react";

// ─── Galaxy customize panel (Pro) ────────────────────────────────────────────
// Live controls for the Dark-mode Galaxy background. Floats over the hub (no
// opaque backdrop) so every change previews against the real background behind
// it. Changes are lifted to ChatApp via onChange and persisted there. Mirrors
// CustomizePanel (Lightfall) but with Galaxy's parameters.

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

function Toggle({ label, checked, onChange, isDark, disabled }) {
  return (
    <div className="flex items-center justify-between" style={{ opacity: disabled ? 0.4 : 1 }}>
      <span className="text-xs font-medium" style={{ color: isDark ? "rgba(238,242,255,0.75)" : "#475569" }}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative w-9 h-5 rounded-full transition-colors shrink-0 disabled:cursor-default"
        style={{
          background: checked
            ? "#6366f1"
            : isDark
              ? "rgba(255,255,255,0.15)"
              : "rgba(0,0,0,0.15)",
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(16px)" : "none" }}
        />
      </button>
    </div>
  );
}

export function GalaxyCustomizePanel({ settings, onChange, onReset, onClose, isDark }) {
  const set = (patch) => onChange({ ...settings, ...patch });

  const cardBg = isDark ? "rgba(12,18,40,0.92)" : "rgba(255,255,255,0.95)";
  const border = isDark ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.2)";
  const heading = isDark ? "#eef2ff" : "#0f172a";

  // A small hue→colour preview so the Hue slider reads at a glance.
  const hueSwatch = `hsl(${settings.hueShift}, 80%, 65%)`;

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
        <Wand2 size={16} style={{ color: isDark ? "#a5b4fc" : "#6366f1" }} />
        <span className="text-sm font-semibold flex-1" style={{ color: heading }}>
          Customize galaxy
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

      <div className="flex flex-col gap-3">
        <Slider
          label="Hue"
          value={settings.hueShift}
          min={0}
          max={360}
          step={1}
          onChange={(v) => set({ hueShift: v })}
          isDark={isDark}
          format={(v) => `${Math.round(v)}°`}
        />
        <div className="flex items-center gap-2 -mt-1 mb-1">
          <span className="text-[10px]" style={{ color: isDark ? "rgba(238,242,255,0.4)" : "#94a3b8" }}>
            Tint
          </span>
          <span className="flex-1 h-2 rounded-full" style={{ background: hueSwatch }} />
        </div>
        <Slider label="Saturation" value={settings.saturation} min={0} max={1} step={0.05} onChange={(v) => set({ saturation: v })} isDark={isDark} format={(v) => v.toFixed(2)} />
        <Slider label="Density" value={settings.density} min={0.2} max={2} step={0.1} onChange={(v) => set({ density: v })} isDark={isDark} format={(v) => v.toFixed(1)} />
        <Slider label="Glow" value={settings.glowIntensity} min={0} max={1} step={0.05} onChange={(v) => set({ glowIntensity: v })} isDark={isDark} format={(v) => v.toFixed(2)} />
        <Slider label="Twinkle" value={settings.twinkleIntensity} min={0} max={1} step={0.05} onChange={(v) => set({ twinkleIntensity: v })} isDark={isDark} format={(v) => v.toFixed(2)} />
        <Slider label="Star speed" value={settings.starSpeed} min={0} max={2} step={0.1} onChange={(v) => set({ starSpeed: v })} isDark={isDark} format={(v) => `${v.toFixed(1)}×`} />
        <Slider label="Drift speed" value={settings.speed} min={0} max={3} step={0.1} onChange={(v) => set({ speed: v })} isDark={isDark} format={(v) => `${v.toFixed(1)}×`} />
        <Slider label="Rotation" value={settings.rotationSpeed} min={0} max={0.3} step={0.01} onChange={(v) => set({ rotationSpeed: v })} isDark={isDark} format={(v) => v.toFixed(2)} />

        <div
          className="mt-1 pt-3 flex flex-col gap-3 border-t"
          style={{ borderColor: isDark ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.14)" }}
        >
          <Toggle
            label="Mouse interaction"
            checked={!!settings.mouseInteraction}
            onChange={(v) => set({ mouseInteraction: v })}
            isDark={isDark}
          />
          <Toggle
            label="Mouse repulsion"
            checked={!!settings.mouseRepulsion}
            onChange={(v) => set({ mouseRepulsion: v })}
            isDark={isDark}
            disabled={!settings.mouseInteraction}
          />
        </div>
      </div>

      <p className="text-[10px] mt-3" style={{ color: isDark ? "rgba(238,242,255,0.4)" : "#94a3b8" }}>
        Changes preview live and are saved on this device.
      </p>
    </div>
  );
}
