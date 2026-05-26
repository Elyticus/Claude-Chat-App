import { Copy, Trash2, Pin } from "lucide-react";
import { REACTIONS, ROLE_LEVEL, darkBg1, darkBorder, lightBg1 } from "@/lib/constants.js";

export function ContextMenu({
  msg,
  position,
  onClose,
  onReact,
  onCopy,
  onDelete,
  onPin,
  onUnpin,
  isPinned,
  currentUserId,
  isDark,
  isChannel,
  myRole,
}) {
  const isOwn = Number(msg.user_id) === Number(currentUserId);
  const canPin = isChannel && ROLE_LEVEL[myRole] >= ROLE_LEVEL.moderator;
  const canDelete =
    isOwn || (isChannel && ROLE_LEVEL[myRole] >= ROLE_LEVEL.moderator);
  const cardW = 260;

  const isMobile = window.innerWidth < 640;
  const left = isMobile
    ? (window.innerWidth - cardW) / 2
    : Math.max(8, Math.min(position.x, window.innerWidth - cardW - 8));

  const vvh = window.visualViewport?.height ?? window.innerHeight;
  const vvt = window.visualViewport?.offsetTop ?? 0;
  const totalH = 52 + 8 + 56 + 52 + (isOwn ? 52 : 0);
  const adjustedY = position.y + vvt;
  const top = Math.max(
    vvt + 8,
    Math.min(adjustedY - totalH / 2, vvt + vvh - totalH - 8),
  );

  const divider = (
    <div
      style={{
        height: 1,
        background: isDark ? "rgba(99,102,241,0.08)" : "rgba(226,232,240,0.9)",
      }}
    />
  );

  return (
    <>
      <div
        className="fixed inset-0 z-400"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <div
        className="fixed z-401 animate-scale-in"
        style={{ left, top, width: cardW }}
      >
        {/* Emoji reactions pill */}
        <div
          className="flex items-center justify-between px-2 py-1.5 rounded-2xl mb-2"
          style={{
            background: isDark ? darkBg1 : lightBg1,
            boxShadow: isDark
              ? "0 8px 32px rgba(0,0,0,0.6)"
              : "0 8px 32px rgba(0,0,0,0.12)",
            border: `1px solid ${isDark ? darkBorder : "rgba(226,232,240,0.9)"}`,
          }}
        >
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact(msg.id, emoji);
                onClose();
              }}
              aria-label={`React with ${emoji}`}
              className="w-9 h-9 flex items-center justify-center text-xl rounded-xl transition-all"
              style={
                msg.reaction === emoji
                  ? {
                      background: isDark
                        ? "rgba(99,102,241,0.18)"
                        : "rgba(99,102,241,0.1)",
                      transform: "scale(1.15)",
                    }
                  : {}
              }
              onMouseEnter={(e) => {
                if (msg.reaction !== emoji)
                  e.currentTarget.style.background = isDark
                    ? "rgba(99,102,241,0.1)"
                    : "rgba(0,0,0,0.05)";
                e.currentTarget.style.transform = "scale(1.2)";
              }}
              onMouseLeave={(e) => {
                if (msg.reaction !== emoji)
                  e.currentTarget.style.background = "";
                e.currentTarget.style.transform =
                  msg.reaction === emoji ? "scale(1.15)" : "";
              }}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Action card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: isDark ? darkBg1 : lightBg1,
            boxShadow: isDark
              ? "0 16px 48px rgba(0,0,0,0.7)"
              : "0 16px 48px rgba(0,0,0,0.12)",
            border: `1px solid ${isDark ? darkBorder : "rgba(226,232,240,0.9)"}`,
          }}
        >
          <div
            className="px-4 py-3"
            style={{
              borderBottom: `1px solid ${isDark ? "rgba(99,102,241,0.08)" : "rgba(226,232,240,0.9)"}`,
            }}
          >
            <p
              className="text-sm leading-relaxed line-clamp-2"
              style={{ color: isDark ? "rgba(238,242,255,0.6)" : "#475569" }}
            >
              {msg.text}
            </p>
          </div>

          <button
            onClick={() => {
              onCopy(msg.text);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-sm transition-all"
            style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark
                ? "rgba(99,102,241,0.08)"
                : "rgba(0,0,0,0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "";
            }}
          >
            <Copy size={17} style={{ opacity: 0.55 }} />
            Copy
          </button>

          {canPin && (
            <>
              {divider}
              <button
                onClick={() => {
                  isPinned ? onUnpin(msg.id) : onPin(msg.id);
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm transition-all"
                style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDark
                    ? "rgba(99,102,241,0.08)"
                    : "rgba(0,0,0,0.04)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "";
                }}
              >
                <Pin size={17} style={{ opacity: 0.55 }} />
                {isPinned ? "Unpin" : "Pin"}
              </button>
            </>
          )}

          {canDelete && (
            <>
              {divider}
              <button
                onClick={() => {
                  onDelete(msg.id);
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm transition-all"
                style={{ color: "#ef4444" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239,68,68,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "";
                }}
              >
                <Trash2 size={17} />
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
