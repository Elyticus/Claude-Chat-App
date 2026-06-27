import { X, Check, Sparkles } from "lucide-react";
import { PLAN_LIST } from "@/lib/plans.js";
import { darkBg1, darkBorderMid, lightBg1, lightBorderMid } from "@/lib/constants.js";

// ─── Upgrade / pricing modal ─────────────────────────────────────────────────
// Opened whenever a Pro feature is gated (reason carries the server message) or
// from the account sheet. Selecting a paid tier hands off to the checkout sheet.
export function UpgradeModal({ currentPlan, reason, isDark, onSelect, onClose }) {
  const headerColor = isDark ? "#eef2ff" : "#0f172a";
  const subColor = isDark ? "rgba(165,180,252,0.55)" : "#64748b";

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center p-3 sm:p-4"
      style={{ zIndex: 700 }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: isDark ? "rgba(7,13,28,0.9)" : "rgba(15,23,42,0.35)",
          backdropFilter: "blur(10px)",
        }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Upgrade your plan"
        className="relative w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl animate-scale-in"
        style={{
          background: isDark ? darkBg1 : lightBg1,
          border: `1px solid ${isDark ? darkBorderMid : lightBorderMid}`,
          boxShadow: "0 40px 100px rgba(0,0,0,0.55)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ color: isDark ? "rgba(238,242,255,0.45)" : "#64748b" }}
        >
          <X size={18} />
        </button>

        <div className="text-center px-6 pt-9 pb-3">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3"
            style={{ background: "rgba(129,140,248,0.15)", color: "#a5b4fc" }}
          >
            <Sparkles size={13} /> Linkloop Pro
          </div>
          <h2 className="text-2xl font-bold" style={{ color: headerColor }}>
            Upgrade your conversations
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: subColor }}>
            Unlock AI, voice, files, and global search.
          </p>
          {reason && (
            <div
              className="mt-4 mx-auto max-w-md text-sm rounded-xl px-4 py-2.5"
              style={{ background: "rgba(251,191,36,0.12)", color: isDark ? "#fcd34d" : "#b45309" }}
            >
              {reason}
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-3 px-5 pb-6 pt-3">
          {PLAN_LIST.map((p) => {
            const isCurrent = p.id === currentPlan;
            const isFree = p.id === "free";
            return (
              <div
                key={p.id}
                className="relative flex flex-col rounded-2xl p-4"
                style={{
                  background: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.02)",
                  border: `1px solid ${p.popular ? "rgba(129,140,248,0.5)" : isDark ? darkBorderMid : lightBorderMid}`,
                }}
              >
                {p.popular && (
                  <div
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
                    style={{ background: "#818cf8", color: "#0b1020" }}
                  >
                    MOST POPULAR
                  </div>
                )}
                {/* Plan name is the big title on every card (same size across
                    plans). Paid plans add the price as a secondary line. */}
                <div className="text-3xl font-bold" style={{ color: headerColor }}>
                  {p.name}
                </div>
                {p.price !== 0 && (
                  <div className="mt-0.5 flex items-baseline gap-1" style={{ color: subColor }}>
                    <span className="text-base font-semibold" style={{ color: headerColor }}>
                      {p.price}€
                    </span>
                    <span className="text-xs">/mo</span>
                  </div>
                )}
                <div className="text-xs mb-3" style={{ color: subColor }}>{p.tagline}</div>

                <ul className="flex-1 space-y-2 mb-4">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs" style={{ color: headerColor }}>
                      <Check size={14} className="mt-0.5 shrink-0" style={{ color: p.accent }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  disabled={isCurrent || isFree}
                  onClick={() => onSelect(p.id)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-default"
                  style={
                    isCurrent
                      ? { background: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)", color: subColor }
                      : isFree
                        ? { background: "transparent", color: subColor }
                        : { background: "linear-gradient(135deg,#6366f1,#3b82f6)", color: "#fff" }
                  }
                >
                  {isCurrent ? "Current plan" : isFree ? "Free forever" : `Upgrade to ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
