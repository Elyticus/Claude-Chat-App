import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api.js";

// ─── Billing / plan state + the self-contained mock checkout flow ────────────
// Owns the user's effective plan, the Upgrade/Checkout modal state, and a
// gate-error router so any feature can call handleGateError(err) to surface the
// paywall when the server returns UPGRADE_REQUIRED / QUOTA_EXCEEDED.
export function useBilling({ currentUser, onUserUpdate }) {
  const [plan, setPlan] = useState(currentUser.plan || "free");
  const [planStatus, setPlanStatus] = useState(currentUser.plan_status || "active");
  const [periodEnd, setPeriodEnd] = useState(currentUser.current_period_end ?? null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiUsedToday, setAiUsedToday] = useState(0);
  const [aiLimit, setAiLimit] = useState(null);
  // Upgrade (pricing) modal: { reason } | null
  const [upgrade, setUpgrade] = useState(null);
  // Checkout (mock payment) sheet: { checkoutId, plan, price } | null
  const [checkout, setCheckout] = useState(null);

  // Refresh the live plan on mount — localStorage may be stale (plan changed on
  // another device, or lapsed past its period end).
  useEffect(() => {
    let alive = true;
    api.getMe()
      .then((me) => {
        if (!alive) return;
        setPlan(me.plan);
        setPlanStatus(me.plan_status || "active");
        setPeriodEnd(me.current_period_end ?? null);
        setAiEnabled(!!me.aiEnabled);
        setAiUsedToday(me.aiUsedToday ?? 0);
        setAiLimit(me.aiLimit ?? null);
        if (me.plan !== currentUser.plan) onUserUpdate?.({ plan: me.plan });
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openUpgrade = useCallback((reason = null) => setUpgrade({ reason }), []);
  const closeUpgrade = useCallback(() => setUpgrade(null), []);

  // Route a failed request to the paywall when it's a gate error. Returns true
  // if it handled the error (caller can then suppress its own toast).
  const handleGateError = useCallback((err) => {
    if (err?.code === "UPGRADE_REQUIRED" || err?.code === "QUOTA_EXCEEDED") {
      setUpgrade({ reason: err.message });
      return true;
    }
    return false;
  }, []);

  // Begin checkout for a paid plan → opens the mock payment sheet.
  const beginCheckout = useCallback(async (planId) => {
    const { checkoutId, price } = await api.startCheckout(planId);
    setUpgrade(null);
    setCheckout({ checkoutId, plan: planId, price });
  }, []);

  // Complete the mock payment → server flips the plan → refresh + persist.
  const completeCheckout = useCallback(async () => {
    if (!checkout) return;
    const res = await api.confirmCheckout(checkout.checkoutId, checkout.plan);
    setPlan(checkout.plan);
    setPlanStatus("active");
    setPeriodEnd(res?.current_period_end ?? null);
    setAiLimit(null); // paid plans are effectively unlimited
    onUserUpdate?.({ plan: checkout.plan });
    setCheckout(null);
  }, [checkout, onUserUpdate]);

  const cancelCheckout = useCallback(() => setCheckout(null), []);

  // Cancel → stays active until period end; effective plan recomputed
  // server-side. Reflect the canceled status locally so the UI updates at once.
  const cancelPlan = useCallback(async () => {
    await api.cancelPlan();
    setPlanStatus("canceled");
  }, []);

  // Resume a canceled-but-still-active subscription.
  const resumePlan = useCallback(async () => {
    await api.resumePlan();
    setPlanStatus("active");
  }, []);

  return {
    plan,
    planStatus,
    periodEnd,
    aiEnabled,
    aiUsedToday,
    aiLimit,
    // Paid tier (lite or pro) — unlocks AI, search, voice and Special mode.
    isPro: plan === "lite" || plan === "pro",
    // Top tier (pro) — unlocks customising the Special-mode background.
    canCustomize: plan === "pro",
    upgrade,
    checkout,
    openUpgrade,
    closeUpgrade,
    handleGateError,
    beginCheckout,
    completeCheckout,
    cancelCheckout,
    cancelPlan,
    resumePlan,
  };
}
