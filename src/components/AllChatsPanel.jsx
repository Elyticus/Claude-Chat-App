import { X } from "lucide-react";
import { Avatar } from "./ui/Avatar.jsx";
import { AnimatedList } from "./ui/AnimatedList.jsx";
import { formatTime, userBg, initials } from "@/lib/helpers.js";
import { isChannel, unreadBadgeStyle } from "@/lib/room-helpers.js";
import {
  darkBg1,
  darkBorder,
  darkBorderMid,
  lightBg1,
  lightBorderMid,
} from "@/lib/constants.js";

// The slide-up "All Chats" sheet: pending friend requests, channel activity and
// the room list (most recent first). Extracted from OrbitalHub verbatim — all
// state and handlers are passed in.
export function AllChatsPanel({
  isDark,
  onClose,
  onNewChat,
  pendingUsers,
  onlineIds,
  avatarMap,
  onAcceptContact,
  onRemoveContact,
  channelNotifs,
  channelNotifsCount,
  onClearChannelNotifs,
  rooms,
  sortedRooms,
  unreadCounts,
  nowMs,
  onSelectRoom,
}) {
  // One chat row, rendered inside AnimatedList's scroll-reveal wrapper. `selected`
  // is the hover/keyboard highlight the list tracks; the row's click + close is
  // handled by AnimatedList via onItemSelect.
  const renderRoom = (room, index, selected) => {
    const isRoomChannel = isChannel(room);
    const displayName = isRoomChannel
      ? room.name || `#${room.slug}`
      : room.is_group
        ? room.name || "Group"
        : room.other_username || "User";
    const avatarId = room.is_group ? room.id : room.other_user_id;
    const isOnline = !room.is_group && onlineIds.has(room.other_user_id);
    const unread = unreadCounts[room.id] || 0;
    const isRecent =
      room.last_message_at && nowMs / 1000 - room.last_message_at < 86400;
    const isNewChannel = isRoomChannel && !!room.is_new;
    const isNewGroup = !isRoomChannel && !!room.is_group && !!room.is_new;

    return (
      <div
        role="button"
        tabIndex={-1}
        aria-label={`Open chat ${displayName}`}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors"
        style={{
          background: selected
            ? isDark
              ? "rgba(99,102,241,0.07)"
              : "rgba(99,102,241,0.05)"
            : "transparent",
        }}
      >
        <div className="relative shrink-0">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-sm"
            style={{
              background: userBg(avatarId),
              boxShadow: isRecent
                ? "0 0 0 2px rgba(99,102,241,0.6)"
                : isDark
                  ? "0 0 0 1px rgba(99,102,241,0.15)"
                  : "0 0 0 1px rgba(99,102,241,0.12)",
            }}
          >
            {initials(displayName)}
          </div>
          {isOnline && (
            <span
              className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-400 rounded-full"
              style={{ border: `2px solid ${isDark ? darkBg1 : lightBg1}` }}
            />
          )}
          {unread > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-4 h-4 text-[9px] font-bold rounded-full flex items-center justify-center px-1"
              style={unreadBadgeStyle(room)}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="text-sm font-medium truncate"
              style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
            >
              {displayName}
            </span>
            {!!room.is_group && (
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400">
                {isRoomChannel ? "Channel" : "Group"}
              </span>
            )}
          </div>
          {room.role_notification ? (
            <div className="text-xs truncate mt-0.5" style={{ color: "#4ade80" }}>
              {room.role_notification}
            </div>
          ) : isNewChannel ? (
            <div className="text-xs truncate mt-0.5 text-green-400/90">
              You were added by {room.added_by}
            </div>
          ) : isNewGroup ? (
            <div className="text-xs truncate mt-0.5 text-yellow-400/90">
              You were added by {room.added_by}
            </div>
          ) : room.last_message ? (
            <div
              className="text-xs truncate mt-0.5"
              style={{ color: isDark ? "rgba(165,180,252,0.45)" : "#94a3b8" }}
            >
              {room.last_message}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {room.last_message_at && (
            <span
              className="text-[10px]"
              style={{ color: isDark ? "rgba(165,180,252,0.35)" : "#94a3b8" }}
            >
              {formatTime(room.last_message_at)}
            </span>
          )}
          {room.role_notification ? (
            <span
              className="w-2 h-2 rounded-full bg-green-400"
              style={{ boxShadow: "0 0 6px rgba(74,222,128,0.9)" }}
            />
          ) : isNewChannel ? (
            <span
              className="w-2 h-2 rounded-full bg-green-400"
              style={{ boxShadow: "0 0 6px rgba(74,222,128,0.9)" }}
            />
          ) : isNewGroup ? (
            <span className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.9)]" />
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 z-160" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col overflow-hidden animate-slide-up"
        style={{
          height: "100dvh",
          background: isDark ? darkBg1 : lightBg1,
          borderTop: `1px solid ${isDark ? darkBorderMid : lightBorderMid}`,
          boxShadow: isDark
            ? "0 -32px 80px rgba(0,0,0,0.7)"
            : "0 -32px 80px rgba(99,102,241,0.10)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: isDark ? darkBorder : lightBorderMid }}
        >
          <span
            className="font-semibold text-base"
            style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
          >
            All Chats
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onNewChat();
              }}
              className="flex items-center px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #6366f1)",
                boxShadow: "0 2px 12px rgba(99,102,241,0.4)",
              }}
            >
              New Chat
            </button>
            <button
              onClick={onClose}
              aria-label="Close all chats"
              className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
              style={{ color: isDark ? "rgba(238,242,255,0.4)" : "#64748b" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Pending friend requests — yellow */}
        {pendingUsers.length > 0 && (
          <div
            className="border-b shrink-0"
            style={{ borderColor: isDark ? darkBorder : lightBorderMid }}
          >
            <div
              className="flex items-center gap-2 px-5 py-2"
              style={{
                background: isDark
                  ? "rgba(245,158,11,0.07)"
                  : "rgba(245,158,11,0.06)",
              }}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span
                className="text-[11px] uppercase tracking-widest font-semibold"
                style={{ color: isDark ? "rgba(251,191,36,0.8)" : "#92400e" }}
              >
                Friend Requests ({pendingUsers.length})
              </span>
            </div>
            {pendingUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  background: isDark
                    ? "rgba(245,158,11,0.04)"
                    : "rgba(254,243,199,0.5)",
                }}
              >
                <Avatar
                  userId={u.id}
                  username={u.username}
                  size={40}
                  online={onlineIds.has(u.id)}
                  avatar={avatarMap[u.id]}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-medium truncate"
                    style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
                  >
                    {u.username}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: isDark ? "rgba(251,191,36,0.7)" : "#b45309" }}
                  >
                    wants to connect
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => onAcceptContact(u.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onRemoveContact(u.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Channel Activity — green, auto-dismissed per notif or when opening the channel */}
        {channelNotifsCount > 0 && (
          <div
            className="border-b shrink-0"
            style={{ borderColor: isDark ? darkBorder : lightBorderMid }}
          >
            <div
              className="flex items-center justify-between px-5 py-2"
              style={{
                background: isDark
                  ? "rgba(74,222,128,0.06)"
                  : "rgba(240,253,244,0.7)",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                <span
                  className="text-[11px] uppercase tracking-widest font-semibold"
                  style={{ color: isDark ? "rgba(134,239,172,0.8)" : "#15803d" }}
                >
                  Channel Activity ({channelNotifsCount})
                </span>
              </div>
              <button
                onClick={onClearChannelNotifs}
                className="text-[11px] font-medium"
                style={{ color: isDark ? "rgba(134,239,172,0.6)" : "#16a34a" }}
              >
                Clear all
              </button>
            </div>
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {channelNotifs.map((n) => {
                const dotColor =
                  n.type === "kick"
                    ? "#f87171"
                    : n.type === "mute"
                      ? "#fb923c"
                      : n.type === "unmute" || n.type === "added"
                        ? "#4ade80"
                        : n.type === "leave"
                          ? "#94a3b8"
                          : n.type === "role"
                            ? "#a78bfa"
                            : "#4ade80";
                // eslint-disable-next-line react-hooks/purity
                const secsAgo = Math.floor((Date.now() - n.ts) / 1000);
                const timeStr =
                  secsAgo < 60
                    ? "just now"
                    : secsAgo < 3600
                      ? `${Math.floor(secsAgo / 60)}m ago`
                      : `${Math.floor(secsAgo / 3600)}h ago`;
                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-2.5 px-4 py-2"
                    style={{
                      background: isDark
                        ? "rgba(74,222,128,0.03)"
                        : "rgba(240,253,244,0.4)",
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ background: dotColor }}
                    />
                    <span
                      className="flex-1 text-xs leading-relaxed"
                      style={{
                        color: isDark ? "rgba(238,242,255,0.75)" : "#334155",
                      }}
                    >
                      {n.message}
                    </span>
                    <span
                      className="text-[10px] shrink-0"
                      style={{
                        color: isDark ? "rgba(238,242,255,0.3)" : "#94a3b8",
                      }}
                    >
                      {timeStr}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Room list — AnimatedList scroll-reveal (rows scale/fade in as they
            enter the viewport while scrolling). */}
        <div className="flex-1 min-h-0">
          {rooms.length === 0 ? (
            <p
              className="text-center text-sm py-8"
              style={{ color: isDark ? "rgba(238,242,255,0.22)" : "#94a3b8" }}
            >
              No chats yet — start a new one!
            </p>
          ) : (
            <AnimatedList
              items={sortedRooms}
              getKey={(room) => room.id}
              renderItem={renderRoom}
              gradientColor={isDark ? darkBg1 : lightBg1}
              itemSpacing={2}
              displayScrollbar={false}
              onItemSelect={(room) => {
                onSelectRoom(room.id);
                setTimeout(() => onClose(), 200);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
