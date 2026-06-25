import { useState, useCallback } from "react";
import { api } from "../lib/api.js";

// ─── AI feature state + actions (Linkloop Pro) ───────────────────────────────
// Owns the client state for the four Claude-powered features and routes any
// server gate error (UPGRADE_REQUIRED / QUOTA_EXCEEDED) to the paywall via the
// billing hook's handleGateError. The /ask ephemeral-bubble flow lives in
// ChatApp (it needs setMessages); this hook exposes runAsk for it.
export function useAi({ enabled, onGateError }) {
  // "Catch me up" summary modal: { loading, text, error, roomName } | null
  const [summary, setSummary] = useState(null);
  // Smart replies for the open room: { loading, items, roomId, error } | null
  const [replies, setReplies] = useState(null);
  // Per-message translations: { [messageId]: { loading, text, error } }
  const [translations, setTranslations] = useState({});

  // Shared error handling: gate errors open the paywall; everything else is
  // surfaced inline by the caller.
  const handle = useCallback((err) => {
    if (onGateError?.(err)) return "gated";
    return err.message || "Something went wrong";
  }, [onGateError]);

  const openSummary = useCallback(async (roomId, roomName) => {
    setSummary({ loading: true, text: "", error: "", roomName });
    try {
      const { summary: text } = await api.aiSummarize(roomId);
      setSummary({ loading: false, text, error: "", roomName });
    } catch (err) {
      const msg = handle(err);
      if (msg === "gated") setSummary(null);
      else setSummary({ loading: false, text: "", error: msg, roomName });
    }
  }, [handle]);

  const closeSummary = useCallback(() => setSummary(null), []);

  const loadReplies = useCallback(async (roomId) => {
    setReplies({ loading: true, items: [], roomId, error: "" });
    try {
      const { suggestions } = await api.aiReplies(roomId);
      setReplies({ loading: false, items: suggestions, roomId, error: "" });
    } catch (err) {
      const msg = handle(err);
      if (msg === "gated") setReplies(null);
      else setReplies({ loading: false, items: [], roomId, error: msg });
    }
  }, [handle]);

  const clearReplies = useCallback(() => setReplies(null), []);

  const translateMessage = useCallback(async (messageId, targetLang = "English") => {
    setTranslations((prev) => ({ ...prev, [messageId]: { loading: true, text: "", error: "" } }));
    try {
      const { text } = await api.aiTranslate(messageId, targetLang);
      setTranslations((prev) => ({ ...prev, [messageId]: { loading: false, text, error: "" } }));
    } catch (err) {
      const msg = handle(err);
      setTranslations((prev) => {
        if (msg === "gated") {
          const next = { ...prev };
          delete next[messageId];
          return next;
        }
        return { ...prev, [messageId]: { loading: false, text: "", error: msg } };
      });
    }
  }, [handle]);

  const clearTranslation = useCallback((messageId) => {
    setTranslations((prev) => {
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
  }, []);

  // Returns the assistant's answer text, or throws (caller renders the bubble).
  const runAsk = useCallback(async (roomId, question) => {
    const { answer } = await api.aiAsk(roomId, question);
    return answer;
  }, []);

  return {
    enabled,
    summary,
    replies,
    translations,
    openSummary,
    closeSummary,
    loadReplies,
    clearReplies,
    translateMessage,
    clearTranslation,
    runAsk,
    onGateError,
  };
}
