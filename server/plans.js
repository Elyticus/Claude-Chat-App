// ─── Plan catalog (server source of truth) ──────────────────────────────────
// Feature gating is enforced against these limits server-side. The client keeps
// a presentational mirror in src/lib/plans.js (labels/prices for rendering) but
// is NEVER trusted for enforcement — every gated route re-checks here.

export const PLAN_RANK = { free: 0, pro: 1, business: 2 };

// `Infinity` means "no cap". maxUploadBytes is in bytes; aiActionsPerDay is the
// free-tier-style daily meter (Pro/Business effectively unlimited).
export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    aiActionsPerDay: 0, // AI is a Pro feature — the free tier has none
    searchScope: "room", // in-current-room only
    searchLimit: 15,
    maxUploadBytes: 5 * 1024 * 1024, // 5 MB
    allowedUploadKinds: ["image"], // images only
    voiceMessages: false,
    specialTheme: false, // Special mode (time-of-day themes) is a Pro perk
    maxGroupSize: 10,
    maxChannels: 1, // channels the user can own/create
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
    price: 9,
    aiActionsPerDay: Infinity,
    searchScope: "global",
    searchLimit: 50,
    maxUploadBytes: 100 * 1024 * 1024, // 100 MB
    allowedUploadKinds: ["image", "file", "voice"],
    voiceMessages: true,
    specialTheme: true,
    maxGroupSize: 50,
    maxChannels: 10,
    features: [
      "Everything in Free",
      "Unlimited AI: summaries, smart replies, /ask, translate",
      "Files & voice messages up to 100 MB",
      "Global search across all conversations",
      "Special mode — immersive time-of-day themes",
      "Up to 10 channels",
      "Priority AI model",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    price: 24,
    aiActionsPerDay: Infinity,
    searchScope: "global",
    searchLimit: 100,
    maxUploadBytes: 100 * 1024 * 1024,
    allowedUploadKinds: ["image", "file", "voice"],
    voiceMessages: true,
    specialTheme: true,
    maxGroupSize: 50,
    maxChannels: Infinity,
    features: [
      "Everything in Pro",
      "Unlimited channels",
      "Highest AI rate limits",
      "Deeper search history",
      "Priority support",
    ],
  },
};

// Resolve a plan config from a (possibly stale/expired) plan id, defaulting to
// free. Callers pass the plan string straight from the DB.
export function planConfig(plan) {
  return PLANS[plan] || PLANS.free;
}

// True when `plan` is at least `min` in the rank order.
export function planAtLeast(plan, min) {
  return (PLAN_RANK[plan] ?? 0) >= (PLAN_RANK[min] ?? 0);
}

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}
