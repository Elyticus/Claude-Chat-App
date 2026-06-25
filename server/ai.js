// ─── AI features (Claude) ────────────────────────────────────────────────────
// Server-side Anthropic calls — the API key never reaches the browser. Powers
// the Pro tier's "Catch me up" summaries, smart-reply suggestions, the in-chat
// /ask assistant, and message translation. Degrades gracefully when no key is
// configured (aiReady=false → callers return 503 and the client hides the UI),
// mirroring the existing VAPID/SMTP "not configured" pattern.

import Anthropic from "@anthropic-ai/sdk";

export const aiReady = !!process.env.ANTHROPIC_API_KEY;

// Default to the most capable Opus model; an operator can switch to
// claude-haiku-4-5 / claude-sonnet-4-6 for lower cost/latency via env without a
// code change. All three support adaptive thinking and structured outputs.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const client = aiReady ? new Anthropic() : null;

if (!aiReady) {
  console.warn("[ai] ANTHROPIC_API_KEY not set — AI features disabled");
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
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
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
    model: MODEL,
    max_tokens: 400,
    thinking: { type: "disabled" },
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
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
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
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "disabled" },
    system:
      `Translate the user's message into ${targetLang}. ` +
      "Return ONLY the translated text — no quotes, no preamble, no notes. " +
      "Preserve tone and any emoji.",
    messages: [{ role: "user", content: text }],
  });
  return textOf(message);
}
