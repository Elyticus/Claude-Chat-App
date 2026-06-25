// ─── Billing & feature gating (Linkloop Pro) ────────────────────────────────
// Self-contained mock billing that mirrors a real Stripe flow without any
// external account: checkout → (mock) provider payment → HMAC-signed webhook →
// plan flip. Feature gating is enforced HERE (server-side) against the limits
// in plans.js; the client's gates are UX only.

import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import {
  PLANS,
  planConfig,
  planAtLeast,
  todayKey,
} from "./plans.js";
import { aiReady } from "./ai.js";

// A signing secret is required to verify webhook authenticity. Falls back to a
// dev-only constant so the app runs out of the box, with a warning — production
// must set BILLING_WEBHOOK_SECRET.
const WEBHOOK_SECRET =
  process.env.BILLING_WEBHOOK_SECRET || "dev-billing-secret-change-me";
if (!process.env.BILLING_WEBHOOK_SECRET) {
  console.warn("[billing] BILLING_WEBHOOK_SECRET not set — using an insecure dev default");
}

const THIRTY_DAYS = 30 * 24 * 3600;
const nowSec = () => Math.floor(Date.now() / 1000);

function sign(rawBody) {
  return createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
}

function signaturesMatch(expected, given) {
  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(given));
  return a.length === b.length && timingSafeEqual(a, b);
}

// The user's *effective* plan: a paid plan whose billing period has elapsed
// (cancelled and lapsed) drops back to free. Pass the row from getUserPlan.
export function effectivePlan(row) {
  if (!row) return "free";
  const { plan, current_period_end } = row;
  if (plan && plan !== "free") {
    if (current_period_end && Number(current_period_end) < nowSec()) return "free";
    return plan;
  }
  return "free";
}

export async function getPlan(queries, userId) {
  const row = await queries.getUserPlan.get(userId);
  return effectivePlan(row);
}

// ── Middleware: require at least `min` plan ──────────────────────────────────
export function requirePlan(queries, min) {
  return async (req, res, next) => {
    const plan = await getPlan(queries, req.user.id);
    if (!planAtLeast(plan, min)) {
      return res.status(402).json({
        error: `This feature requires the ${PLANS[min].name} plan`,
        code: "UPGRADE_REQUIRED",
        plan,
        required: min,
      });
    }
    req.plan = plan;
    next();
  };
}

// ── Middleware: meter a daily action and enforce the plan's quota ────────────
// Increments today's bucket and 402s once the plan's per-day cap is reached.
// Plans with an Infinity cap still record usage (for analytics) but never block.
export function consumeQuota(queries, metric) {
  return async (req, res, next) => {
    const plan = await getPlan(queries, req.user.id);
    const limit = planConfig(plan).aiActionsPerDay;
    const count = await queries.incrementUsage.run(req.user.id, metric, todayKey());
    if (count > limit) {
      return res.status(402).json({
        error: "You've reached today's AI limit on the Free plan",
        code: "QUOTA_EXCEEDED",
        plan,
        used: count - 1,
        limit,
      });
    }
    req.plan = plan;
    req.usage = { metric, count, limit };
    next();
  };
}

// Meter a single AI action after the request has been authorized (membership
// checked). Increments today's bucket and reports whether the plan's daily cap
// is exceeded. Pro/Business have an Infinity cap → always allowed.
export async function meterAi(queries, userId) {
  const plan = await getPlan(queries, userId);
  const limit = planConfig(plan).aiActionsPerDay;
  const count = await queries.incrementUsage.run(userId, "ai", todayKey());
  return { allowed: count <= limit, plan, limit, count };
}

// Apply a confirmed subscription event to a user. Shared by the public webhook
// route and the confirm route (which emits the same signed event internally).
async function applyCheckoutCompleted(queries, event) {
  const { userId, plan, checkoutId } = event;
  if (!PLANS[plan] || plan === "free") return;
  const periodEnd = nowSec() + THIRTY_DAYS;
  await queries.setUserPlan.run(userId, plan, "active", periodEnd);
  await queries.createSubscription.run(
    randomUUID(), userId, plan, "active", checkoutId, periodEnd,
  );
}

// ── Routes ───────────────────────────────────────────────────────────────────
export function registerBillingRoutes(app, { queries, requireAuth, limiter }) {
  // Public plan catalog (safe subset — no server-only internals).
  app.get("/api/billing/plans", (req, res) => {
    res.json(
      Object.values(PLANS).map((p) => ({
        id: p.id, name: p.name, price: p.price, features: p.features,
      })),
    );
  });

  // Authenticated self-view incl. live plan + today's AI usage. The client
  // calls this after checkout to refresh its cached user.
  app.get("/api/me", requireAuth, async (req, res) => {
    const user = await queries.getSelfById.get(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const plan = effectivePlan(user);
    const used = await queries.getUsage.get(req.user.id, "ai", todayKey());
    res.json({
      ...user,
      plan,
      aiEnabled: aiReady,
      aiUsedToday: used,
      aiLimit: planConfig(plan).aiActionsPerDay === Infinity ? null : planConfig(plan).aiActionsPerDay,
    });
  });

  // Step 1 — begin checkout. Records a pending subscription and returns a
  // checkout id the mock payment sheet will confirm.
  app.post("/api/billing/checkout", requireAuth, limiter, async (req, res) => {
    const { plan } = req.body ?? {};
    if (!PLANS[plan] || plan === "free") {
      return res.status(400).json({ error: "Invalid plan" });
    }
    const checkoutId = randomUUID();
    await queries.createSubscription.run(
      randomUUID(), req.user.id, plan, "pending", checkoutId, null,
    );
    res.json({ checkoutId, plan, price: PLANS[plan].price });
  });

  // Step 2 — the mock provider page reports a completed payment. Server emits a
  // signed webhook event to itself (demonstrating the verify-then-apply pattern
  // a real Stripe integration uses) and returns the new plan.
  app.post("/api/billing/confirm", requireAuth, limiter, async (req, res) => {
    const { checkoutId, plan } = req.body ?? {};
    if (!PLANS[plan] || plan === "free" || typeof checkoutId !== "string") {
      return res.status(400).json({ error: "Invalid checkout" });
    }
    const event = { type: "checkout.completed", userId: req.user.id, plan, checkoutId };
    const rawBody = JSON.stringify(event);
    await processWebhook(queries, rawBody, sign(rawBody));
    const periodEnd = nowSec() + THIRTY_DAYS;
    res.json({ ok: true, plan, current_period_end: periodEnd });
  });

  // Public webhook endpoint — verifies the HMAC signature like a real provider
  // callback would. (Same processor the confirm route invokes internally.)
  app.post("/api/billing/webhook", async (req, res) => {
    try {
      const rawBody = JSON.stringify(req.body ?? {});
      const signature = req.headers["x-billing-signature"];
      await processWebhook(queries, rawBody, signature);
      res.json({ received: true });
    } catch {
      res.status(400).json({ error: "Invalid signature or payload" });
    }
  });

  // Cancel — keep the paid plan until the period ends, then it lapses to free
  // (see effectivePlan).
  app.post("/api/billing/cancel", requireAuth, limiter, async (req, res) => {
    await queries.setPlanStatus.run(req.user.id, "canceled");
    res.json({ ok: true });
  });

  // Resume — re-activate a canceled subscription that is still within its paid
  // period, so it renews instead of lapsing to free. If the period already
  // elapsed (effective plan is free), there's nothing to resume — re-subscribe.
  app.post("/api/billing/resume", requireAuth, limiter, async (req, res) => {
    const user = await queries.getSelfById.get(req.user.id);
    if (!user || effectivePlan(user) === "free") {
      return res.status(400).json({ error: "No active plan to resume — start a new subscription" });
    }
    await queries.setPlanStatus.run(req.user.id, "active");
    res.json({ ok: true, plan: effectivePlan(user) });
  });
}

async function processWebhook(queries, rawBody, signature) {
  if (!signaturesMatch(sign(rawBody), signature)) throw new Error("bad signature");
  const event = JSON.parse(rawBody);
  if (event.type === "checkout.completed") {
    await applyCheckoutCompleted(queries, event);
  }
}
