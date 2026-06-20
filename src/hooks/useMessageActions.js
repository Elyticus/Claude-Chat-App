import { api } from "../lib/api.js";

// Per-message actions: open the context menu, react, copy text, and optimistic
// delete. Lifted out of ChatApp verbatim; deps passed in.
export function useMessageActions({
  socketRef,
  activeRoomId,
  setMessages,
  setContextMenu,
}) {
  function handleContextMenu(e, msg) {
    e.preventDefault();
    setContextMenu({ msg, x: e.clientX, y: e.clientY });
  }

  function handleReact(messageId, emoji) {
    socketRef.current?.emit("message:react", { messageId, emoji });
  }

  function handleCopy(text) {
    navigator.clipboard.writeText(text).catch(console.error);
  }

  function handleDeleteMessage(messageId) {
    if (!activeRoomId) return;
    setMessages((prev) => ({
      ...prev,
      [activeRoomId]: (prev[activeRoomId] || []).filter(
        (m) => m.id !== messageId,
      ),
    }));
    api.deleteMessage(messageId).catch(console.error);
  }

  return { handleContextMenu, handleReact, handleCopy, handleDeleteMessage };
}
