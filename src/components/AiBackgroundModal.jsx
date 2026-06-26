import { useState } from "react";
import { X, Wand2 } from "lucide-react";
import { darkBg1, darkBorderMid, lightBg1, lightBorderMid } from "@/lib/constants.js";

// ─── AI background generator (Business) ──────────────────────────────────────
// Business users describe a vibe; Claude returns a custom color palette for the
// landscape scene (server/ai.js → generateBackgroundScene), applied to Special
// mode. Claude can't make raster images, so this recolours the vector scene.

const IDEAS = [
  "Misty mountain valley at dawn",
  "Golden sunset over the hills",
  "Moonlit river under the stars",
  "Cherry-blossom spring morning",
  "Autumn alpine afternoon",
];

export function AiBackgroundModal({
  isDark,
  activeName,
  onGenerate,
  onApply,
  onReset,
  onClose,
  onGateError,
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const headerColor = isDark ? "#eef2ff" : "#0f172a";
  const subColor = isDark ? "rgba(165,180,252,0.6)" : "#64748b";
  const fieldBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)";
  const fieldBorder = isDark ? darkBorderMid : lightBorderMid;

  async function generate() {
    const p = prompt.trim();
    if (!p || busy) return;
    setBusy(true);
    setError("");
    try {
      const palette = await onGenerate(p);
      onApply(palette);
      onClose();
    } catch (err) {
      if (!onGateError?.(err)) setError(err.message || "Couldn't generate that — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center p-4" style={{ zIndex: 800 }}>
      <div
        className="absolute inset-0"
        style={{ background: isDark ? "rgba(7,13,28,0.9)" : "rgba(15,23,42,0.35)", backdropFilter: "blur(10px)" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI background"
        className="relative w-full sm:max-w-md rounded-3xl overflow-hidden animate-scale-in"
        style={{
          background: isDark ? darkBg1 : lightBg1,
          border: `1px solid ${isDark ? darkBorderMid : lightBorderMid}`,
          boxShadow: "0 40px 100px rgba(0,0,0,0.5)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ color: isDark ? "rgba(238,242,255,0.45)" : "#64748b" }}
        >
          <X size={18} />
        </button>

        <div className="px-6 pt-6 pb-6">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(45,212,191,0.16)", color: "#5eead4" }}>
              <Wand2 size={17} />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight" style={{ color: headerColor }}>AI background</h2>
              <p className="text-xs font-medium" style={{ color: subColor }}>Describe a vibe — Claude paints your landscape</p>
            </div>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="e.g. stormy emerald valley at twilight"
            className="mt-4 w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: fieldBg, border: `1px solid ${fieldBorder}`, color: headerColor }}
          />

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {IDEAS.map((idea) => (
              <button
                key={idea}
                onClick={() => setPrompt(idea)}
                disabled={busy}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                style={{ background: fieldBg, border: `1px solid ${fieldBorder}`, color: subColor }}
              >
                {idea}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-3 text-xs" style={{ color: "#fb7185" }}>{error}</p>
          )}

          <button
            onClick={generate}
            disabled={busy || !prompt.trim()}
            className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#14b8a6,#0ea5e9)", color: "#fff" }}
          >
            {busy ? "Painting…" : "Generate background"}
          </button>

          {activeName && (
            <button
              onClick={() => { onReset(); onClose(); }}
              disabled={busy}
              className="mt-2 w-full py-2 rounded-xl text-xs font-medium transition-all"
              style={{ background: fieldBg, color: subColor }}
            >
              Using “{activeName}” — switch back to time of day
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
