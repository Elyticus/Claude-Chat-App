// Small room helpers shared between the OrbitalHub and its AllChatsPanel.

export const isChannel = (r) =>
  r.type === "channel" || r.type === "private_channel";

// Unread-count badge color by room type: DM = red, group = yellow, channel =
// green. Mirrors the per-type ring colors on the orbital nodes.
export const unreadBadgeStyle = (room) => {
  if (isChannel(room)) {
    return {
      background: "linear-gradient(135deg,#22c55e,#16a34a)",
      boxShadow: "0 2px 8px rgba(34,197,94,0.5)",
      color: "#ffffff",
    };
  }
  if (room.is_group) {
    return {
      background: "linear-gradient(135deg,#facc15,#eab308)",
      boxShadow: "0 2px 8px rgba(234,179,8,0.5)",
      color: "#422006",
    };
  }
  return {
    background: "linear-gradient(135deg,#ef4444,#dc2626)",
    boxShadow: "0 2px 8px rgba(239,68,68,0.5)",
    color: "#ffffff",
  };
};
