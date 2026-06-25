import { useState } from "react";
import { X, Lock, CreditCard, ShieldCheck } from "lucide-react";
import { PLANS } from "@/lib/plans.js";
import { darkBg1, darkBorderMid, lightBg1, lightBorderMid } from "@/lib/constants.js";

// ─── Mock checkout sheet ─────────────────────────────────────────────────────
// A self-contained "Stripe-like" payment form. No real card is charged — on
// submit it calls the billing confirm endpoint (which emits a signed webhook
// server-side) and the plan flips. The demo banner makes the mock explicit.
export function CheckoutModal({ plan, price, isDark, onPay, onClose }) {
  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const headerColor = isDark ? "#eef2ff" : "#0f172a";
  const subColor = isDark ? "rgba(165,180,252,0.55)" : "#64748b";
  const fieldBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)";
  const fieldBorder = isDark ? darkBorderMid : lightBorderMid;
  const planName = PLANS[plan]?.name ?? plan;

  // Light formatting so the mock feels real — not validation (no real charge).
  const fmtCard = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const fmtExp = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (processing) return;
    setError("");
    setProcessing(true);
    try {
      await onPay();
    } catch (err) {
      setError(err.message || "Payment failed");
      setProcessing(false);
    }
  }

  const inputStyle = {
    background: fieldBg,
    border: `1px solid ${fieldBorder}`,
    color: headerColor,
  };

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center p-3 sm:p-4"
      style={{ zIndex: 720 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: isDark ? "rgba(7,13,28,0.92)" : "rgba(15,23,42,0.4)", backdropFilter: "blur(10px)" }}
        onClick={processing ? undefined : onClose}
      />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="Checkout"
        className="relative w-full sm:max-w-sm rounded-3xl p-6 animate-scale-in"
        style={{
          background: isDark ? darkBg1 : lightBg1,
          border: `1px solid ${fieldBorder}`,
          boxShadow: "0 40px 100px rgba(0,0,0,0.55)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          disabled={processing}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-40"
          style={{ color: subColor }}
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-1" style={{ color: headerColor }}>
          <CreditCard size={18} style={{ color: "#818cf8" }} />
          <span className="text-lg font-bold">Subscribe to {planName}</span>
        </div>
        <div className="text-sm mb-4" style={{ color: subColor }}>
          <span className="text-xl font-bold" style={{ color: headerColor }}>{price}€</span> / month, cancel anytime
        </div>

        <div
          className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 mb-4"
          style={{ background: "rgba(45,212,191,0.1)", color: isDark ? "#5eead4" : "#0d9488" }}
        >
          <ShieldCheck size={14} /> Demo checkout — no real card is charged.
        </div>

        <label className="block text-xs font-medium mb-1" style={{ color: subColor }}>Card number</label>
        <input
          value={card}
          onChange={(e) => setCard(fmtCard(e.target.value))}
          placeholder="4242 4242 4242 4242"
          inputMode="numeric"
          className="w-full rounded-xl px-3 py-2.5 mb-3 text-sm outline-none"
          style={inputStyle}
        />
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1" style={{ color: subColor }}>Expiry</label>
            <input
              value={exp}
              onChange={(e) => setExp(fmtExp(e.target.value))}
              placeholder="12/29"
              inputMode="numeric"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium mb-1" style={{ color: subColor }}>CVC</label>
            <input
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="123"
              inputMode="numeric"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </div>
        </div>

        {error && <div className="text-xs text-red-400 mb-3">{error}</div>}

        <button
          type="submit"
          disabled={processing}
          className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#6366f1,#3b82f6)", color: "#fff" }}
        >
          <Lock size={14} />
          {processing ? "Processing…" : `Pay ${price}€/mo`}
        </button>
      </form>
    </div>
  );
}
