import { useRef, useState, useEffect } from "react";
import { Send, VolumeX, Paperclip, Mic, Trash2 } from "lucide-react";
import { darkBg2, darkBorder, lightBorderMid } from "@/lib/constants.js";

function fmtDur(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// The message input row plus the mute/error banner, the length counter, and the
// Pro attach (image/file) + voice-message controls. Text behavior is unchanged
// from the original; media controls call onUploadAttachment(file, opts).
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
  onUploadAttachment,
  voiceEnabled,
  onRequireUpgrade,
}) {
  const fileRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startRef = useRef(0);
  const cancelRef = useRef(false);

  // Stop any active recording / timer when the composer unmounts.
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      const mr = recorderRef.current;
      if (mr && mr.state !== "inactive") {
        cancelRef.current = true;
        try { mr.stop(); } catch { /* already stopped */ }
      }
    };
  }, []);

  function pickFile() {
    fileRef.current?.click();
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        onUploadAttachment(file, { kind: "image", width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        onUploadAttachment(file, { kind: "image" });
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } else {
      onUploadAttachment(file, { kind: "file" });
    }
  }

  async function startRecording() {
    if (!voiceEnabled) {
      onRequireUpgrade?.("Voice messages are a Pro feature — upgrade to record and send audio.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      cancelRef.current = false;
      mr.ondataavailable = (ev) => { if (ev.data.size) chunksRef.current.push(ev.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(timerRef.current);
        setRecording(false);
        if (cancelRef.current) { cancelRef.current = false; return; }
        const duration = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
        const mime = mr.mimeType || "audio/webm";
        const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "mp4" : "webm";
        const file = new File(chunksRef.current, `voice-${Date.now()}.${ext}`, { type: mime });
        onUploadAttachment(file, { kind: "voice", duration });
      };
      mr.start();
      recorderRef.current = mr;
      startRef.current = Date.now();
      setRecSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      onRequireUpgrade?.("Microphone access was blocked — allow it to record a voice message.");
    }
  }

  function stopRecording(cancel) {
    cancelRef.current = !!cancel;
    const mr = recorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  }

  const iconBtnColor = isDark ? "rgba(165,180,252,0.65)" : "#64748b";

  return (
    <>
      {/* Mute / input error */}
      {inputError && (
        <div className="px-4 py-1.5 shrink-0 flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)" }}>
          <VolumeX size={12} style={{ color: "#f87171", flexShrink: 0 }} />
          <span className="text-xs" style={{ color: "#f87171" }}>{inputError}</span>
        </div>
      )}

      {/* Message length counter */}
      {nearLimit && (
        <div
          className="px-4 py-1.5 shrink-0 flex items-center justify-between gap-2"
          style={{ background: overLimit ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)" }}
        >
          <span className="text-xs" style={{ color: overLimit ? "#f87171" : "#f59e0b" }}>
            {overLimit ? "Message is too long — shorten it to send" : "Approaching the message length limit"}
          </span>
          <span
            className="text-xs font-semibold shrink-0"
            style={{ color: overLimit ? "#f87171" : "#f59e0b", fontVariantNumeric: "tabular-nums" }}
          >
            {inputLength.toLocaleString()} / {maxLength.toLocaleString()}
          </span>
        </div>
      )}

      <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />

      {/* Input row */}
      <div
        className="px-4 py-3 flex items-end gap-2 shrink-0"
        style={{ borderTop: `1px solid ${isDark ? darkBorder : lightBorderMid}`, background: bgRaised }}
      >
        {recording ? (
          // Recording bar — cancel, live timer, stop-and-send.
          <>
            <button
              onClick={() => stopRecording(true)}
              aria-label="Cancel recording"
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              style={{ color: "#f87171" }}
            >
              <Trash2 size={18} />
            </button>
            <div className="flex-1 flex items-center gap-2 px-2 text-sm" style={{ color: isDark ? "#eef2ff" : "#0f172a" }}>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span style={{ fontVariantNumeric: "tabular-nums" }}>Recording {fmtDur(recSeconds)}</span>
            </div>
            <button
              onClick={() => stopRecording(false)}
              aria-label="Send voice message"
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)" }}
            >
              <Send size={16} color="#fff" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={pickFile}
              aria-label="Attach a photo or file"
              title="Attach a photo or file"
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all"
              style={{ color: iconBtnColor }}
            >
              <Paperclip size={18} />
            </button>

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
                e.target.style.border = isDark ? "1px solid rgba(99,102,241,0.45)" : "1px solid rgba(99,102,241,0.4)";
                e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.10)";
              }}
              onBlurCapture={(e) => {
                e.target.style.border = isDark ? "1px solid rgba(99,102,241,0.15)" : "1px solid rgba(226,232,240,1)";
                e.target.style.boxShadow = "none";
              }}
            />

            {/* Mic when there's no text to send; Send otherwise. */}
            {inputText.trim() ? (
              <button
                onClick={onSend}
                disabled={!canSend}
                aria-label="Send message"
                className="w-12 h-12 rounded-full flex items-center justify-center transition-[background,opacity] disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                style={{
                  background: canSend
                    ? "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)"
                    : isDark ? "rgba(99,102,241,0.08)" : "#f1f5f9",
                  boxShadow: "none",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <Send size={16} style={{ color: canSend ? "#ffffff" : isDark ? "rgba(165,180,252,0.4)" : "#94a3b8" }} />
              </button>
            ) : (
              <button
                onClick={startRecording}
                aria-label="Record a voice message"
                title="Record a voice message"
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all"
                style={{ color: iconBtnColor }}
              >
                <Mic size={18} />
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
