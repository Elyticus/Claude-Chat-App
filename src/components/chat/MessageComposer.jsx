import { Send, VolumeX } from "lucide-react";
import { darkBg2, darkBorder, lightBorderMid } from "@/lib/constants.js";

// The message input row plus the mute/error banner and the length counter.
// Extracted from ChatApp verbatim — all logic stays in the parent and is passed
// in as props, so behavior and layout are unchanged.
export function MessageComposer({
  inputRef,
  inputText,
  onInputChange,
  onKeyDown,
  onBlur,
  onSend,
  canSend,
  inputError,
  nearLimit,
  overLimit,
  inputLength,
  maxLength,
  isDark,
  bgRaised,
}) {
  return (
    <>
      {/* Mute / input error */}
      {inputError && (
        <div
          className="px-4 py-1.5 shrink-0 flex items-center gap-2"
          style={{ background: "rgba(239,68,68,0.08)" }}
        >
          <VolumeX size={12} style={{ color: "#f87171", flexShrink: 0 }} />
          <span className="text-xs" style={{ color: "#f87171" }}>
            {inputError}
          </span>
        </div>
      )}

      {/* Message length counter — appears near the 4,000-char limit,
          turns into an error when over it (send is blocked then). */}
      {nearLimit && (
        <div
          className="px-4 py-1.5 shrink-0 flex items-center justify-between gap-2"
          style={{
            background: overLimit
              ? "rgba(239,68,68,0.08)"
              : "rgba(245,158,11,0.08)",
          }}
        >
          <span
            className="text-xs"
            style={{ color: overLimit ? "#f87171" : "#f59e0b" }}
          >
            {overLimit
              ? "Message is too long — shorten it to send"
              : "Approaching the message length limit"}
          </span>
          <span
            className="text-xs font-semibold shrink-0"
            style={{
              color: overLimit ? "#f87171" : "#f59e0b",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {inputLength.toLocaleString()} / {maxLength.toLocaleString()}
          </span>
        </div>
      )}

      {/* Message input */}
      <div
        className="px-4 py-3 flex items-end gap-2.5 shrink-0"
        style={{
          borderTop: `1px solid ${isDark ? darkBorder : lightBorderMid}`,
          background: bgRaised,
        }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={inputText}
          onChange={(e) => {
            onInputChange(e);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          aria-label="Message"
          placeholder="Type a message…"
          className="flex-1 rounded-2xl px-4 py-2.5 text-sm outline-none transition-[border-color,box-shadow] duration-150 no-scrollbar"
          style={{
            background: isDark ? darkBg2 : "#f1f5f9",
            border: `1px solid ${isDark ? "rgba(99,102,241,0.15)" : "rgba(226,232,240,1)"}`,
            color: isDark ? "#eef2ff" : "#0f172a",
            resize: "none",
            overflowY: "auto",
            lineHeight: "1.5",
          }}
          onFocus={(e) => {
            e.target.style.border = isDark
              ? "1px solid rgba(99,102,241,0.45)"
              : "1px solid rgba(99,102,241,0.4)";
            e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.10)";
          }}
          onBlurCapture={(e) => {
            e.target.style.border = isDark
              ? "1px solid rgba(99,102,241,0.15)"
              : "1px solid rgba(226,232,240,1)";
            e.target.style.boxShadow = "none";
          }}
        />
        <button
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send message"
          className="w-12 h-12 rounded-full flex items-center justify-center transition-[background,opacity] disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          style={{
            background: canSend
              ? "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)"
              : isDark
                ? "rgba(99,102,241,0.08)"
                : "#f1f5f9",
            // No box-shadow at all — a glow that transitioned to/from here left a
            // ghost on iOS (incl. the home-screen shortcut), so the send button
            // stays flat on every platform.
            boxShadow: "none",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <Send
            size={16}
            style={{
              color: canSend
                ? "#ffffff"
                : isDark
                  ? "rgba(165,180,252,0.4)"
                  : "#94a3b8",
            }}
          />
        </button>
      </div>
    </>
  );
}
