import { useCallback } from "react";
import { api } from "../lib/api.js";

// Per-message actions: open the context menu, react, copy text, and optimistic
// delete. Lifted out of ChatApp verbatim; deps passed in. Handlers are
// useCallback'd so the memoized MessageList keeps a stable onContextMenu prop
// across keystrokes.
export function useMessageActions({
  socketRef,
  activeRoomId,
  setMessages,
  setContextMenu,
}) {
  const handleContextMenu = useCallback(
    (e, msg) => {
      e.preventDefault();
      setContextMenu({ msg, x: e.clientX, y: e.clientY });
    },
    [setContextMenu],
  );

  const handleReact = useCallback(
    (messageId, emoji) => {
      socketRef.current?.emit("message:react", { messageId, emoji });
    },
    [socketRef],
  );

  const handleCopy = useCallback((text) => {
    navigator.clipboard.writeText(text).catch(console.error);
  }, []);

  const handleDeleteMessage = useCallback(
    (messageId) => {
      if (!activeRoomId) return;
      setMessages((prev) => ({
        ...prev,
        [activeRoomId]: (prev[activeRoomId] || []).filter(
          (m) => m.id !== messageId,
        ),
      }));
      api.deleteMessage(messageId).catch(console.error);
    },
    [activeRoomId, setMessages],
  );

  return { handleContextMenu, handleReact, handleCopy, handleDeleteMessage };
}
