import { useState } from "react";
import { X, Crown, Calendar } from "lucide-react";
import { planLabel } from "@/lib/plans.js";
import { darkBg1, darkBorderMid, lightBg1, lightBorderMid } from "@/lib/constants.js";

// ─── Manage subscription sheet ───────────────────────────────────────────────
// Opened from the account modal for paid users. Shows the current plan, its
// status and renewal/expiry date, and lets the user change plan (→ pricing) or
// cancel (kept Pro until period end). Replaces the old button that silently
// POSTed /billing/cancel with no confirmation or feedback. Sits above the
// account modal (z-600) and the pricing modal (z-700).

function fmtDate(epochSec) {
  if (!epochSec) return null;
  try {
    return new Date(Number(epochSec) * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

export function ManageSubscriptionModal({
  plan,
  planStatus,
  periodEnd,
  isDark,
  onCancel,
  onResume,
  onChangePlan,
  onClose,
}) {
  const [view, setView] = useState("idle"); // idle | confirming
  // Track status changes the user makes in-session so the sheet updates without
  // a re-fetch: null = unchanged, "canceled" / "active" = the new local status.
  const [localStatus, setLocalStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const headerColor = isDark ? "#eef2ff" : "#0f172a";
  const subColor = isDark ? "rgba(165,180,252,0.6)" : "#64748b";
  const endsOn = fmtDate(periodEnd);
  const canceled = (localStatus ?? planStatus) === "canceled";

  async function confirmCancel() {
    setBusy(true);
    try {
      await onCancel();
      setLocalStatus("canceled");
      setView("idle");
    } catch {
      // leave the confirm step up so the user can retry
    } finally {
      setBusy(false);
    }
  }

  async function handleResume() {
    setBusy(true);
    try {
      await onResume();
      setLocalStatus("active");
    } catch {
      // ignore — status stays canceled, user can retry
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 800 }}
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
        aria-label="Manage subscription"
        className="relative w-full sm:max-w-sm rounded-3xl overflow-hidden animate-scale-in"
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
          <X size={22} />
        </button>

        <div className="px-6 pt-6 pb-6">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(129,140,248,0.16)", color: "#a5b4fc" }}
            >
              <Crown size={17} />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight" style={{ color: headerColor }}>
                {planLabel(plan)} plan
              </h2>
              <p
                className="text-xs font-semibold"
                style={{ color: canceled ? "#f59e0b" : "#34d399" }}
              >
                {canceled ? "Canceled" : "Active"}
              </p>
            </div>
          </div>

          {endsOn && (
            <div
              className="mt-3.5 flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl"
              style={{
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
                color: subColor,
              }}
            >
              <Calendar size={14} />
              {canceled ? `Access until ${endsOn}` : `Renews on ${endsOn}`}
            </div>
          )}

          {view === "confirming" ? (
            <div className="mt-4">
              <p className="text-sm font-medium" style={{ color: headerColor }}>
                Cancel your {planLabel(plan)} subscription?
              </p>
              <p className="text-xs mt-1" style={{ color: subColor }}>
                You&apos;ll keep {planLabel(plan)} features until{" "}
                {endsOn || "the period ends"}, then it returns to Free.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setView("idle")}
                  disabled={busy}
                  className="py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)",
                    color: headerColor,
                  }}
                >
                  Keep it
                </button>
                <button
                  onClick={confirmCancel}
                  disabled={busy}
                  className="py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: "rgba(244,63,94,0.14)", color: "#fb7185" }}
                >
                  {busy ? "Canceling…" : "Yes, cancel"}
                </button>
              </div>
            </div>
          ) : canceled ? (
            <div className="mt-5 space-y-2">
              <p className="text-xs mb-1" style={{ color: subColor }}>
                Your subscription is canceled. Resume to keep {planLabel(plan)} and
                let it renew.
              </p>
              <button
                onClick={handleResume}
                disabled={busy}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff" }}
              >
                {busy ? "Resuming…" : "Resume subscription"}
              </button>
              <button
                onClick={onChangePlan}
                disabled={busy}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
                  color: subColor,
                }}
              >
                Change plan
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              <button
                onClick={onChangePlan}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "linear-gradient(135deg,#6366f1,#3b82f6)", color: "#fff" }}
              >
                Change plan
              </button>
              <button
                onClick={() => setView("confirming")}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
                  color: subColor,
                }}
              >
                Cancel subscription
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
