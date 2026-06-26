// ─── AI features (Claude) ────────────────────────────────────────────────────
// Server-side Anthropic calls — the API key never reaches the browser. Powers
// the Pro tier's "Catch me up" summaries, smart-reply suggestions, the in-chat
// /ask assistant, and message translation. Degrades gracefully when no key is
// configured (aiReady=false → callers return 503 and the client hides the UI),
// mirroring the existing VAPID/SMTP "not configured" pattern.

import Anthropic from "@anthropic-ai/sdk";

export const aiReady = !!process.env.ANTHROPIC_API_KEY;

// Two model tiers, both configurable via env without a code change:
//   • QUALITY_MODEL (ANTHROPIC_MODEL) — deeper reasoning for "Catch me up"
//     summaries and the /ask assistant. Default: claude-opus-4-8.
//   • FAST_MODEL (ANTHROPIC_MODEL_FAST) — latency-first smart replies and
//     translation; falls back to the quality model when unset. Set e.g.
//     claude-haiku-4-5 here for cheap, snappy responses.
const QUALITY_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const FAST_MODEL = process.env.ANTHROPIC_MODEL_FAST || QUALITY_MODEL;

const client = aiReady ? new Anthropic() : null;

if (!aiReady) {
  console.warn("[ai] ANTHROPIC_API_KEY not set — AI features disabled");
}

// Adaptive thinking and the `effort` control are Claude 4.6+ features; older
// models (e.g. Haiku 4.5) reject them. Conservative allowlist — any model not
// known to support it runs as a plain request, so an unfamiliar id never 400s.
function supportsAdaptiveThinking(model) {
  const m = String(model).toLowerCase();
  return (
    m.includes("fable") ||
    m.includes("mythos") ||
    m.includes("opus-4-6") ||
    m.includes("opus-4-7") ||
    m.includes("opus-4-8") ||
    m.includes("sonnet-4-6")
  );
}

// Reasoning params for a "thoughtful" call (summaries, /ask): adaptive thinking
// + medium effort on capable models, nothing on older ones.
function reasoningParams(model) {
  return supportsAdaptiveThinking(model)
    ? { thinking: { type: "adaptive" }, output_config: { effort: "medium" } }
    : {};
}

// Params for a latency-first call (replies, translate): disable thinking for
// speed. Fable/Mythos always think (a "disabled" request 400s), so omit it there.
function fastParams(model) {
  const m = String(model).toLowerCase();
  if (m.includes("fable") || m.includes("mythos")) return {};
  return { thinking: { type: "disabled" } };
}

// Collapse the message rows into a compact transcript the model can reason over.
// System/event messages ("X joined") are dropped; only real chat lines remain.
// Caps length so a huge room can't blow up the prompt.
function transcript(messages, max = 40) {
  return messages
    .filter((m) => !m.system && m.text)
    .slice(-max)
    .map((m) => `${m.username || "User"}: ${m.text}`)
    .join("\n")
    .slice(0, 12000);
}

function textOf(message) {
  return message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// "Catch me up" — a tight summary of what was discussed. Streamed internally so
// a longer thread doesn't risk an HTTP timeout; adaptive thinking lets the model
// decide how much to reason.
export async function summarizeThread(messages, { roomName } = {}) {
  const convo = transcript(messages, 60);
  if (!convo) return "There aren't any messages to summarize yet.";
  const stream = client.messages.stream({
    model: QUALITY_MODEL,
    max_tokens: 1024,
    ...reasoningParams(QUALITY_MODEL),
    system:
      "You are a concise chat assistant. Summarize the conversation for someone " +
      "catching up. Lead with the key points as 3-6 short bullet lines, then a " +
      "one-line 'Bottom line'. Be factual, neutral, and brief. No preamble.",
    messages: [
      {
        role: "user",
        content: `Summarize this ${roomName ? `"${roomName}" ` : ""}conversation:\n\n${convo}`,
      },
    ],
  });
  const message = await stream.finalMessage();
  return textOf(message);
}

// Three short, ready-to-send reply suggestions for the current user. Latency-
// sensitive, so thinking is off and the output is schema-constrained JSON.
export async function suggestReplies(messages, { selfName } = {}) {
  const convo = transcript(messages, 20);
  if (!convo) return [];
  const message = await client.messages.create({
    model: FAST_MODEL,
    max_tokens: 400,
    ...fastParams(FAST_MODEL),
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            suggestions: { type: "array", items: { type: "string" } },
          },
          required: ["suggestions"],
        },
      },
    },
    system:
      `You suggest short replies for ${selfName || "the user"} to send next in a chat. ` +
      "Give exactly 3 distinct, natural, casual one-line replies (under ~10 words each) " +
      "that fit the conversation. Do not include quotes or numbering.",
    messages: [{ role: "user", content: `Conversation so far:\n\n${convo}` }],
  });
  try {
    const parsed = JSON.parse(textOf(message));
    return (parsed.suggestions || []).slice(0, 3);
  } catch {
    return [];
  }
}

// In-chat /ask assistant — answers a question, using the recent conversation as
// optional context. Streamed internally for robustness on longer answers.
export async function assistantAsk(messages, question, { roomName } = {}) {
  const convo = transcript(messages, 40);
  const stream = client.messages.stream({
    model: QUALITY_MODEL,
    max_tokens: 1024,
    ...reasoningParams(QUALITY_MODEL),
    system:
      "You are Linkloop's in-chat AI assistant. Answer the user's question " +
      "helpfully and concisely. If the conversation context is relevant, use it; " +
      "otherwise answer from general knowledge. Keep it short unless asked for detail.",
    messages: [
      {
        role: "user",
        content: convo
          ? `Recent conversation${roomName ? ` in "${roomName}"` : ""}:\n${convo}\n\nQuestion: ${question}`
          : question,
      },
    ],
  });
  const message = await stream.finalMessage();
  return textOf(message);
}

// Translate a single message. Thinking off for speed; returns only the
// translation.
export async function translate(text, targetLang) {
  const message = await client.messages.create({
    model: FAST_MODEL,
    max_tokens: 1024,
    ...fastParams(FAST_MODEL),
    system:
      `Translate the user's message into ${targetLang}. ` +
      "Return ONLY the translated text — no quotes, no preamble, no notes. " +
      "Preserve tone and any emoji.",
    messages: [{ role: "user", content: text }],
  });
  return textOf(message);
}

// ─── AI-generated background (Business) ──────────────────────────────────────
// Claude can't produce raster images, so the "AI background" is a designed COLOR
// PALETTE for the same vector LANDSCAPE (SpecialField: mountains with a snow-capped
// peak, rolling hills, a winding river, trees, a sun/moon). The user describes a
// vibe; the model returns harmonious, contrasted colors for each scene role.
const HEX = /^#[0-9a-fA-F]{6}$/;
const isHex = (v, fallback) => (typeof v === "string" && HEX.test(v) ? v : fallback);

// A translucent halo color for the sun/moon, derived from the orb hex.
function glowOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.5)`;
}

// Coerce the model's flat color arrays into SpecialField's exact palette shape,
// guaranteeing valid hex everywhere (a bad value falls back to a sane default).
function normalizePalette(raw = {}) {
  const sky = Array.isArray(raw.sky) ? raw.sky.slice(0, 4) : [];
  while (sky.length < 4) sky.push(sky[sky.length - 1]);
  const s = sky.map((c, i) => isHex(c, ["#1b2a5c", "#46487f", "#7a6aa0", "#b9a6cf"][i]));
  const orb = isHex(raw.orb, "#fff3d6");
  const stars = !!raw.stars;
  return {
    name: typeof raw.name === "string" ? raw.name.slice(0, 40) : "Custom",
    sky: [[0, s[0]], [0.45, s[1]], [0.78, s[2]], [1, s[3]]],
    orb,
    orbGlow: glowOf(orb),
    mountains: [
      isHex(raw.mountains?.[0], "#9fc2e6"),
      isHex(raw.mountains?.[1], "#7aa6d8"),
      isHex(raw.mountains?.[2], "#5b86c0"),
    ],
    snow: isHex(raw.snow, "#eef6ff"),
    hills: [
      isHex(raw.hills?.[0], "#7fb06a"),
      isHex(raw.hills?.[1], "#5e9e4e"),
      isHex(raw.hills?.[2], "#3f8a36"),
    ],
    river: [isHex(raw.river?.[0], "#9fd2f0"), isHex(raw.river?.[1], "#cfeafa")],
    trees: isHex(raw.trees, "#2f6f34"),
    // No clouds at night; otherwise a soft cloud color (default near-white).
    clouds: stars ? false : isHex(raw.clouds, "#ffffff"),
    stars,
  };
}

// Schema arrays can't constrain length (the API rejects minItems>1), so we ask
// for the counts in the prompt and enforce the exact shape in normalizePalette.
const colorArray = { type: "array", items: { type: "string" } };

export async function generateBackgroundScene(prompt) {
  const message = await client.messages.create({
    model: QUALITY_MODEL,
    max_tokens: 700,
    ...fastParams(QUALITY_MODEL),
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            sky: colorArray, // 4 colors, top → horizon
            orb: { type: "string" }, // sun/moon disc
            mountains: colorArray, // 3: far/hazy → near
            snow: { type: "string" }, // snow cap on the peak
            hills: colorArray, // 3: back/hazy → front
            river: colorArray, // 2: water, sheen
            trees: { type: "string" }, // foliage
            clouds: { type: "string" }, // wispy clouds
            stars: { type: "boolean" }, // night → moon + stars
          },
          required: ["name", "sky", "orb", "mountains", "snow", "hills", "river", "trees", "clouds", "stars"],
        },
      },
    },
    system:
      "You design color palettes for a stylized flat-vector LANDSCAPE wallpaper — " +
      "layered mountains with a snow-capped peak, rolling hills, a winding river, " +
      "trees and a sun or moon. Return exactly: sky = 4 colors (top→horizon), " +
      "orb = 1 (sun or moon disc), mountains = 3 (far/hazy→near/dark), snow = 1 " +
      "(light cap, must read against the near mountain), hills = 3 (back/hazy→front/" +
      "near), river = 2 (water, brighter sheen), trees = 1 (foliage), clouds = 1. " +
      "Given a vibe, make a harmonious, well-CONTRASTED palette. Keep the SKY TOP " +
      "fairly dark or medium so light UI text stays readable; push brightness toward " +
      "the horizon. Set stars=true for night/space moods (the orb becomes a moon). " +
      "Every color value is a #rrggbb hex string.",
    messages: [{ role: "user", content: `Background vibe: ${prompt}` }],
  });
  return normalizePalette(JSON.parse(textOf(message)));
}
