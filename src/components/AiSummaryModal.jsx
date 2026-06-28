import { X, Sparkles } from "lucide-react";
import { darkBg1, darkBorderMid, lightBg1, lightBorderMid } from "@/lib/constants.js";

// ─── "Catch me up" summary modal ─────────────────────────────────────────────
// Shows the Claude-generated thread summary. Renders bullet lines (the model is
// prompted to lead with short bullets) as-is in a readable monospace-free block.
export function AiSummaryModal({ summary, isDark, onClose }) {
  if (!summary) return null;
  const headerColor = isDark ? "#eef2ff" : "#0f172a";
  const bodyColor = isDark ? "rgba(238,242,255,0.82)" : "#334155";

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center p-3 sm:p-4" style={{ zIndex: 700 }}>
      <div
        className="absolute inset-0"
        style={{ background: isDark ? "rgba(7,13,28,0.9)" : "rgba(15,23,42,0.35)", backdropFilter: "blur(10px)" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Conversation summary"
        className="relative w-full sm:max-w-md rounded-3xl p-6 animate-scale-in"
        style={{
          background: isDark ? darkBg1 : lightBg1,
          border: `1px solid ${isDark ? darkBorderMid : lightBorderMid}`,
          boxShadow: "0 40px 100px rgba(0,0,0,0.55)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ color: isDark ? "rgba(238,242,255,0.45)" : "#64748b" }}
        >
          <X size={22} />
        </button>

        <div className="flex items-center gap-2 mb-4" style={{ color: headerColor }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#6366f1,#3b82f6,#14b8a6)" }}
          >
            <Sparkles size={15} color="#fff" />
          </div>
          <div>
            <div className="text-sm font-bold">Catch me up</div>
            {summary.roomName && (
              <div className="text-xs" style={{ color: isDark ? "rgba(165,180,252,0.5)" : "#94a3b8" }}>
                {summary.roomName}
              </div>
            )}
          </div>
        </div>

        {summary.loading ? (
          <div className="flex items-center gap-2 py-6 text-sm" style={{ color: bodyColor }}>
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Summarizing the conversation…
          </div>
        ) : summary.error ? (
          <div className="text-sm py-4 text-red-400">{summary.error}</div>
        ) : (
          <div
            className="text-sm leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto no-scrollbar"
            style={{ color: bodyColor }}
          >
            {summary.text}
          </div>
        )}
      </div>
    </div>
  );
}
