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
