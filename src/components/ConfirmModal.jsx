import { darkBg2, darkBorderMid, lightBg1, lightBorderMid } from "@/lib/constants.js";

export function ConfirmModal({ title, body, confirmLabel, onConfirm, onClose, isDark }) {
  return (
    <div className="fixed inset-0 z-600 flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{
          background: isDark ? "rgba(7,13,28,0.85)" : "rgba(15,23,42,0.35)",
          backdropFilter: "blur(8px)",
        }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full sm:w-96 overflow-hidden rounded-2xl animate-scale-in"
        style={{
          background: isDark ? darkBg2 : lightBg1,
          border: `1px solid ${isDark ? darkBorderMid : lightBorderMid}`,
          boxShadow: isDark
            ? "0 24px 64px rgba(0,0,0,0.75)"
            : "0 24px 64px rgba(99,102,241,0.12)",
        }}
      >
        <div className="px-6 pt-6 pb-4">
          <p className={`font-semibold text-base ${isDark ? "text-white" : "text-black"}`}>
            {title}
          </p>
          <p className={`text-sm mt-2 leading-relaxed ${isDark ? "text-white/50" : "text-black/60"}`}>
            {body}
          </p>
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: isDark ? "rgba(238,242,255,0.06)" : "#f1f5f9",
              color: isDark ? "rgba(238,242,255,0.7)" : "#475569",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all bg-red-500/15 text-red-400 hover:bg-red-500/25"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
