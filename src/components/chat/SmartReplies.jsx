import { Sparkles, X } from "lucide-react";

// ─── Smart replies (Linkloop Pro) ────────────────────────────────────────────
// A compact strip above the composer. Idle: a single "Suggest a reply" button so
// the user opts in (no AI call until asked). Loaded: tappable suggestion chips
// that fill the input. Cost-conscious by design — never auto-fetches.
export function SmartReplies({ enabled, replies, isDark, onLoad, onClear, onPick }) {
  if (!enabled) return null;

  const chipBg = isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)";
  const chipColor = isDark ? "#c7d2fe" : "#4f46e5";
  const chipBorder = isDark ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.2)";

  // Idle — show the opt-in trigger.
  if (!replies) {
    return (
      <div className="px-4 pt-2 pb-2 shrink-0 w-fit">
        <button
          onClick={onLoad}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all"
          style={{ background: chipBg, color: chipColor, border: `1px solid ${chipBorder}` }}
        >
          <Sparkles size={12} /> Suggest a reply
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-2 pb-2 shrink-0 flex items-center gap-2 flex-wrap w-fit max-w-full">
      {replies.loading ? (
        <span className="inline-flex items-center gap-2 text-xs px-3 py-1.5" style={{ color: chipColor }}>
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" /> Thinking of replies…
        </span>
      ) : replies.error ? (
        <span className="text-xs px-2 py-1.5 text-red-400">{replies.error}</span>
      ) : (
        replies.items.map((s, i) => (
          <button
            key={i}
            onClick={() => onPick(s)}
            className="text-xs px-3 py-1.5 rounded-full transition-all hover:opacity-80 text-left"
            style={{ background: chipBg, color: chipColor, border: `1px solid ${chipBorder}` }}
          >
            {s}
          </button>
        ))
      )}
      <button
        onClick={onClear}
        aria-label="Dismiss suggestions"
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
        style={{ color: isDark ? "rgba(238,242,255,0.4)" : "#94a3b8" }}
      >
        <X size={13} />
      </button>
    </div>
  );
}
