// ─── Plan catalog (client presentational mirror) ────────────────────────────
// Display-only copy of server/plans.js. NEVER trusted for enforcement — the
// server re-checks every gated action. Used to render pricing and lock states.

export const PLAN_RANK = { free: 0, pro: 1, business: 2 };

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    tagline: "For getting started",
    accent: "#94a3b8",
    features: [
      "Unlimited 1-1 and group chats",
      "Image sharing up to 5 MB",
      "Groups up to 10 members",
      "1 channel",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 9.99,
    tagline: "For power users",
    accent: "#818cf8",
    popular: true,
    features: [
      "Everything in Free",
      "Unlimited AI: summaries, smart replies, /ask, translate",
      "Files & voice messages up to 100 MB",
      "Global search across all conversations",
      "Special mode — immersive time-of-day themes",
      "Groups up to 50 members",
      "Up to 10 channels",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    price: 24.99,
    tagline: "For teams that ship",
    accent: "#2dd4bf",
    features: [
      "Everything in Pro",
      "Unlimited channels",
      "Highest AI rate limits",
      "Deeper search history",
      "Priority support",
    ],
  },
};

export const PLAN_LIST = [PLANS.free, PLANS.pro, PLANS.business];

export function planAtLeast(plan, min) {
  return (PLAN_RANK[plan] ?? 0) >= (PLAN_RANK[min] ?? 0);
}

export function planLabel(plan) {
  return PLANS[plan]?.name ?? "Free";
}
