import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  MessageCircle,
  LogOut,
  Sun,
  Moon,
  X,
  Sparkles,
  Check,
} from "lucide-react";
import StarField from "./ui/star-field.jsx";
import SpecialField from "./ui/special-field.jsx";
import { isSpecialSkyLight } from "@/lib/special-scenes.js";
import { Avatar } from "./ui/Avatar.jsx";
import { formatTime, userBg, initials } from "@/lib/helpers.js";
import {
  darkBg0,
  darkBg1,
  darkBorder,
  darkBorderMid,
  lightBg0,
  lightBg1,
  lightBorderMid,
  specialBg0,
} from "@/lib/constants.js";

const isChannel = (r) => r.type === "channel" || r.type === "private_channel";

// Unread-count badge color by room type: DM = red, group = yellow, channel =
// green. Mirrors the per-type ring colors on the orbital nodes.
const unreadBadgeStyle = (room) => {
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

export function OrbitalHub({
  rooms,
  hasGroupNewNotif,
  onSelectRoom,
  onNewChat,
  onRequestLogout,
  currentUser,
  onlineIds,
  unreadCounts,
  isDark,
  theme,
  onToggleTheme,
  onToggleSpecial,
  pendingCount,
  pendingUsers,
  onAcceptContact,
  onRemoveContact,
  avatarMap,
  myAvatar,
  onAvatarClick,
  channelNotifs,
  onClearChannelNotifs,
  friendNotifs = [],
  onClearFriendNotif,
  onClearFriendNotifs,
}) {
  // Green badge: channel activity notifs (live socket events for this session).
  const channelNotifsCount = channelNotifs.length;

  // Channels with unseen activity directed at this user. Combines persisted
  // markers (is_new = just added, role_notification = role/privilege change),
  // which survive a reload, with this session's live channel notifs. Drives the
  // green activity dot on channel bubbles and the green badge on the main hub.
  const channelActivityRoomIds = useMemo(() => {
    const ids = new Set();
    const channelIds = new Set(rooms.filter(isChannel).map((r) => r.id));
    for (const r of rooms) {
      if (isChannel(r) && (!!r.is_new || !!r.role_notification)) ids.add(r.id);
    }
    // Only count notifs that belong to actual channels, never groups or DMs
    for (const n of channelNotifs) {
      if (n.roomId && channelIds.has(n.roomId)) ids.add(n.roomId);
    }
    return ids;
  }, [rooms, channelNotifs]);

  // Show the green hub dot for live notifs, falling back to the persisted
  // channel-activity markers so the indicator survives a reload. Plain dot,
  // no count — only the red unread badge shows numbers.
  const hasChannelActivity =
    channelNotifsCount > 0 || channelActivityRoomIds.size > 0;

  const [rotationAngle, setRotationAngle] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);
  const [containerSize, setContainerSize] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  const containerRef = useRef(null);
  const angleRef = useRef(0);
  const [showContactsList, setShowContactsList] = useState(false);
  const [nowMs] = useState(Date.now);
  const isSpecial = theme === "special";
  const bg0 = isSpecial ? specialBg0 : isDark ? darkBg0 : lightBg0;

  // In special mode the text color follows the active scene's sky brightness,
  // which shifts with the time of day: light sky → black text, dark sky →
  // white. Track the hour with a minute tick so the derived value stays current.
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60000);
    return () => clearInterval(id);
  }, []);
  const specialSkyLight = isSpecialSkyLight(hour);

  // Strong text color for names over the background canvas: white on dark,
  // black on light, brightness-dependent in special mode.
  const textStrong = isSpecial
    ? specialSkyLight
      ? "#000000"
      : "#ffffff"
    : isDark
      ? "#ffffff"
      : "#000000";
  const textStrongShadow =
    textStrong === "#ffffff"
      ? "0 1px 8px rgba(0,0,0,0.7)"
      : "0 1px 8px rgba(255,255,255,0.7)";

  const orbitRooms = useMemo(() => {
    const cutoff = nowMs / 1000 - 86400;
    return rooms.filter((r) => r.last_message_at && r.last_message_at > cutoff);
  }, [rooms, nowMs]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (hoveredId !== null) return;
    const timer = setInterval(() => {
      angleRef.current = (angleRef.current + 0.3) % 360;
      setRotationAngle(Number(angleRef.current.toFixed(3)));
    }, 50);
    return () => clearInterval(timer);
  }, [hoveredId]);

  const getNodePosition = useCallback(
    (index, total) => {
      const { w, h } = containerSize;
      const radius = Math.min(w * 0.32, h * 0.35, 240);
      const angle = ((index / total) * 360 + rotationAngle) % 360;
      const radian = (angle * Math.PI) / 180;
      return {
        x: radius * Math.cos(radian),
        y: radius * Math.sin(radian),
        zIndex: Math.round(100 + 50 * Math.cos(radian)),
        opacity: Math.max(
          0.35,
          Math.min(1, 0.35 + 0.65 * ((1 + Math.sin(radian)) / 2)),
        ),
      };
    },
    [rotationAngle, containerSize],
  );

  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((a, b) => a + b, 0),
    [unreadCounts],
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-dvh flex items-center justify-center overflow-hidden"
      style={{ background: bg0 }}
    >
      {/* Background canvas — all glow drawn on canvas, zero CSS blur layers.
          Special mode swaps the starfield for the time-of-day aurora scene. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {isSpecial ? <SpecialField /> : <StarField isDark={isDark} />}
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 z-30">
        <div className="flex items-center gap-2.5">
          <span
            className="font-bold tracking-wide text-xl"
            style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
          >
            Linkloop
            <span style={{ color: "#818cf8" }}>.</span>
          </span>
          {totalUnread > 0 && (
            <span
              className="text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none"
              style={{
                background: "linear-gradient(135deg,#ef4444,#dc2626)",
                boxShadow: "0 2px 8px rgba(239,68,68,0.45)",
              }}
            >
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAvatarClick}
            title="Change profile picture"
            aria-label="Change profile picture"
            className="flex items-center gap-2 rounded-full focus:outline-none group cursor-pointer"
          >
            <div className="relative">
              <Avatar
                userId={currentUser.id}
                username={currentUser.username}
                size={42}
                avatar={myAvatar}
              />
              <span
                className="absolute inset-0 rounded-full flex items-center justify-center transition-all"
                style={{ background: "rgba(0,0,0,0)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(0,0,0,0.35)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "rgba(0,0,0,0)")
                }
              >
                <span className="text-white text-[9px] opacity-0 group-hover:opacity-100 font-semibold leading-none">
                  Edit
                </span>
              </span>
            </div>
            <span
              className="text-sm font-semibold hidden sm:block"
              style={{ color: textStrong, textShadow: textStrongShadow }}
            >
              {currentUser.username}
            </span>
          </button>
          <button
            onClick={onToggleSpecial}
            title={isSpecial ? "Exit special mode" : "Special mode"}
            aria-label={
              isSpecial ? "Exit special mode" : "Switch to special mode"
            }
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            style={
              isSpecial
                ? {
                    background: "rgba(45,212,191,0.18)",
                    border: "1px solid rgba(45,212,191,0.45)",
                    color: "#5eead4",
                    boxShadow: "0 0 14px rgba(45,212,191,0.3)",
                  }
                : {
                    background: isDark
                      ? "rgba(45,212,191,0.10)"
                      : "rgba(13,148,136,0.08)",
                    border: `1px solid ${isDark ? "rgba(45,212,191,0.28)" : "rgba(13,148,136,0.22)"}`,
                    color: isDark ? "#2dd4bf" : "#0d9488",
                    boxShadow: isDark
                      ? "0 0 10px rgba(45,212,191,0.12)"
                      : "0 2px 8px rgba(13,148,136,0.10)",
                  }
            }
          >
            <Sparkles size={16} />
          </button>
          <button
            onClick={onToggleTheme}
            title={isDark ? "Light mode" : "Dark mode"}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            style={{
              background: isDark
                ? "rgba(129,140,248,0.14)"
                : "rgba(99,102,241,0.10)",
              border: `1px solid ${isDark ? "rgba(129,140,248,0.35)" : "rgba(99,102,241,0.28)"}`,
              color: isDark ? "#a5b4fc" : "#4f46e5",
              boxShadow: isDark
                ? "0 0 12px rgba(129,140,248,0.2)"
                : "0 2px 8px rgba(99,102,241,0.12)",
            }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={onRequestLogout}
            title="Sign out"
            aria-label="Sign out"
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            style={{
              background: isDark
                ? "rgba(239,68,68,0.10)"
                : "rgba(239,68,68,0.07)",
              border: `1px solid ${isDark ? "rgba(239,68,68,0.28)" : "rgba(239,68,68,0.22)"}`,
              color: isDark ? "#fca5a5" : "#ef4444",
              boxShadow: isDark
                ? "0 0 10px rgba(239,68,68,0.14)"
                : "0 2px 8px rgba(239,68,68,0.08)",
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Outer orbit ring */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: "min(64vmin, 500px)",
          height: "min(64vmin, 500px)",
          boxShadow: isDark
            ? [
                "0 0 0 1px rgba(99,102,241,0.30)",
                "0 0 0 3px rgba(99,102,241,0.08)",
                "0 0 0 10px rgba(99,102,241,0.03)",
                "0 0 80px rgba(99,102,241,0.12)",
                "inset 0 0 80px rgba(99,102,241,0.07)",
              ].join(", ")
            : "0 0 0 1px rgba(99,102,241,0.18), 0 0 28px rgba(99,102,241,0.07)",
        }}
      >
        <div className="absolute inset-0 rounded-full rotate-slow">
          <div
            style={{
              position: "absolute",
              top: -5,
              left: "50%",
              transform: "translateX(-50%)",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: isDark ? "#818cf8" : "#6366f1",
              boxShadow: isDark
                ? "0 0 12px 3px rgba(129,140,248,0.9), 0 0 28px rgba(99,102,241,0.7)"
                : "0 0 10px rgba(99,102,241,0.9), 0 0 20px rgba(99,102,241,0.5)",
            }}
          />
        </div>
      </div>

      {/* Inner orbit ring */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: "min(44vmin, 340px)",
          height: "min(44vmin, 340px)",
          boxShadow: isDark
            ? [
                "0 0 0 1px rgba(139,92,246,0.22)",
                "0 0 0 3px rgba(139,92,246,0.06)",
                "0 0 0 8px rgba(139,92,246,0.02)",
                "0 0 50px rgba(139,92,246,0.09)",
                "inset 0 0 50px rgba(139,92,246,0.05)",
              ].join(", ")
            : "0 0 0 1px rgba(99,102,241,0.12), 0 0 16px rgba(99,102,241,0.05)",
        }}
      >
        <div className="absolute inset-0 rounded-full rotate-slow-rev">
          <div
            style={{
              position: "absolute",
              top: -4,
              left: "50%",
              transform: "translateX(-50%)",
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: isDark ? "#a78bfa" : "#7c3aed",
              boxShadow: isDark
                ? "0 0 9px 2px rgba(167,139,250,0.9), 0 0 20px rgba(139,92,246,0.7)"
                : "0 0 8px rgba(124,58,237,0.8)",
            }}
          />
        </div>
      </div>

      {/* Center hub */}
      <button
        type="button"
        className="absolute w-20 h-20 rounded-full flex items-center justify-center cursor-pointer z-20 select-none hub-breathe"
        style={{
          background: "linear-gradient(145deg, #9f7aea, #6366f1, #3b82f6)",
        }}
        onClick={() => setShowContactsList((v) => !v)}
        title="See all chats"
        aria-label={showContactsList ? "Close all chats" : "Open all chats"}
        aria-expanded={showContactsList}
      >
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 45%, transparent 100%)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 94,
            height: 94,
            animation: "ping 2s cubic-bezier(0,0,0.2,1) infinite",
            border: isDark
              ? "1.5px solid rgba(99,102,241,0.6)"
              : "1.5px solid rgba(99,102,241,0.65)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 116,
            height: 116,
            animation: "ping 2s cubic-bezier(0,0,0.2,1) infinite",
            animationDelay: "0.75s",
            border: isDark
              ? "1px solid rgba(99,102,241,0.32)"
              : "1px solid rgba(99,102,241,0.38)",
          }}
        />
        <MessageCircle
          size={26}
          className="text-white relative z-10"
          strokeWidth={1.8}
        />
        {/* Unread messages — red (DMs, groups, channels) */}
        {totalUnread > 0 && (
          <span
            className="absolute -top-1 -left-1 min-w-5 h-5 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 z-20 animate-pulse"
            style={{
              background: "linear-gradient(135deg,#ef4444,#dc2626)",
              boxShadow: "0 2px 8px rgba(239,68,68,0.5)",
            }}
            aria-label={`${totalUnread} unread message${totalUnread === 1 ? "" : "s"}`}
          >
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
        {/* Friend activity — red: incoming requests + accepted-request
            confirmations. Both surface in the All Chats panel. */}
        {pendingCount + friendNotifs.length > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-5 h-5 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 z-20"
            style={{
              background: "linear-gradient(135deg,#ef4444,#dc2626)",
              boxShadow: "0 2px 8px rgba(239,68,68,0.5)",
            }}
            aria-label={`${pendingCount + friendNotifs.length} friend notifications`}
          >
            {pendingCount + friendNotifs.length > 9
              ? "9+"
              : pendingCount + friendNotifs.length}
          </span>
        )}
        {/* Group notification — yellow (plain groups only, not channels) */}
        {hasGroupNewNotif && (
          <span
            className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full z-20 animate-pulse"
            style={{
              boxShadow: "0 0 8px rgba(250,204,21,0.7)",
            }}
          />
        )}
        {/* Channel notification — green dot (no count) */}
        {hasChannelActivity && (
          <span
            className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full z-20 animate-pulse"
            style={{
              background: "linear-gradient(135deg,#22c55e,#4ade80)",
              boxShadow: "0 0 8px rgba(74,222,128,0.7)",
            }}
          />
        )}
      </button>

      {/* Room nodes */}
      {orbitRooms.map((room, index) => {
        const pos = getNodePosition(index, orbitRooms.length);
        const isRoomChannel = isChannel(room);
        const displayName = isRoomChannel
          ? room.name || `#${room.slug}`
          : room.is_group
            ? room.name || "Group"
            : room.other_username || "User";
        const avatarId = room.is_group ? room.id : room.other_user_id;
        const isOnline = !room.is_group && onlineIds.has(room.other_user_id);
        const unread = unreadCounts[room.id] || 0;
        const ringNormal = isRoomChannel
          ? "rgba(74,222,128,0.55)"
          : room.is_group
            ? "rgba(250,204,21,0.55)"
            : isDark
              ? "rgba(99,102,241,0.22)"
              : "rgba(99,102,241,0.18)";
        const ringHover = isRoomChannel
          ? "rgba(74,222,128,0.9)"
          : room.is_group
            ? "rgba(250,204,21,0.9)"
            : isDark
              ? "rgba(99,102,241,0.5)"
              : "rgba(99,102,241,0.45)";
        const glowHover = isRoomChannel
          ? "rgba(74,222,128,0.4)"
          : room.is_group
            ? "rgba(250,204,21,0.4)"
            : isDark
              ? "rgba(99,102,241,0.4)"
              : "rgba(99,102,241,0.3)";

        return (
          <div
            key={room.id}
            className={`absolute cursor-pointer flex flex-col items-center select-none active:scale-95 ${hoveredId === null ? "transition-transform duration-50" : "transition-none"}`}
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              zIndex: pos.zIndex,
            }}
            onMouseEnter={() => setHoveredId(room.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelectRoom(room.id)}
          >
            <div
              className="absolute rounded-full pointer-events-none transition-all duration-300"
              style={{
                width: 86,
                height: 86,
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                background:
                  "radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 68%)",
                filter: "blur(10px)",
                opacity: hoveredId === room.id ? 1 : 0,
              }}
            />
            <div
              className={`relative w-12 h-12 transition-transform duration-200 ${hoveredId === room.id ? "scale-110" : ""}`}
            >
              {/* Bubble fill — per-user gradient only, no initials; the name
                  shows in the hover label. Fades with orbit depth. */}
              <div
                className="w-full h-full rounded-full"
                style={{
                  background: userBg(avatarId),
                  opacity: pos.opacity,
                  boxShadow: isDark
                    ? "0 4px 16px rgba(0,0,0,0.5)"
                    : "0 4px 16px rgba(0,0,0,0.08)",
                }}
              />
              {/* Ring — rendered after fill so it sits on top; always full opacity */}
              <div
                className="absolute inset-0 rounded-full pointer-events-none transition-all duration-200"
                style={{
                  border: `2px solid ${hoveredId === room.id ? ringHover : ringNormal}`,
                  boxShadow:
                    hoveredId === room.id ? `0 0 16px ${glowHover}` : "none",
                }}
              />
              {isOnline && (
                <span
                  className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-400 rounded-full"
                  style={{
                    border: `2px solid ${bg0}`,
                    boxShadow: "0 0 6px rgba(52,211,153,0.6)",
                  }}
                />
              )}
              {unread > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-5 h-5 text-[10px] font-bold rounded-full flex items-center justify-center px-1"
                  style={unreadBadgeStyle(room)}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
              {/* Green channel-activity dot — added to channel / role change /
                  mute affecting this user (bottom-left, clear of the count). */}
              {isRoomChannel && channelActivityRoomIds.has(room.id) && (
                <span
                  className="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 rounded-full animate-pulse"
                  style={{
                    background: "linear-gradient(135deg,#22c55e,#4ade80)",
                    border: `2px solid ${bg0}`,
                    boxShadow: "0 0 8px rgba(74,222,128,0.7)",
                  }}
                />
              )}
            </div>
            <span
              className="mt-2 text-[11px] font-semibold max-w-19 truncate text-center leading-tight"
              style={{
                color: textStrong,
                textShadow: textStrongShadow,
                // Keep the orbit-depth fade but floor it so names stay legible
                // even at the back of the orbit.
                opacity: Math.max(0.75, pos.opacity),
              }}
            >
              {displayName}
            </span>
          </div>
        );
      })}

      {/* All-chats bottom panel */}
      {showContactsList && (
        <div
          className="absolute inset-0 z-160"
          onClick={() => setShowContactsList(false)}
        >
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
                    setShowContactsList(false);
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
                  onClick={() => setShowContactsList(false)}
                  aria-label="Close all chats"
                  className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
                  style={{
                    color: isDark ? "rgba(238,242,255,0.4)" : "#64748b",
                  }}
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
                    style={{
                      color: isDark ? "rgba(251,191,36,0.8)" : "#92400e",
                    }}
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
                        style={{
                          color: isDark ? "rgba(251,191,36,0.7)" : "#b45309",
                        }}
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

            {/* New friends — green. Confirmation that a request you sent was
                accepted. Persists until cleared (per item or all). */}
            {friendNotifs.length > 0 && (
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
                      style={{
                        color: isDark ? "rgba(134,239,172,0.8)" : "#15803d",
                      }}
                    >
                      New Friends ({friendNotifs.length})
                    </span>
                  </div>
                  <button
                    onClick={onClearFriendNotifs}
                    className="text-[11px] font-medium"
                    style={{
                      color: isDark ? "rgba(134,239,172,0.6)" : "#16a34a",
                    }}
                  >
                    Clear all
                  </button>
                </div>
                {friendNotifs.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center gap-2.5 px-5 py-2.5"
                    style={{
                      background: isDark
                        ? "rgba(74,222,128,0.03)"
                        : "rgba(240,253,244,0.4)",
                    }}
                  >
                    <Check
                      size={14}
                      className="shrink-0"
                      style={{ color: isDark ? "#4ade80" : "#16a34a" }}
                    />
                    <span
                      className="flex-1 text-xs leading-relaxed"
                      style={{
                        color: isDark ? "rgba(238,242,255,0.75)" : "#334155",
                      }}
                    >
                      {n.message}
                    </span>
                    <button
                      onClick={() => onClearFriendNotif(n.id)}
                      aria-label="Clear notification"
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
                      style={{
                        color: isDark ? "rgba(238,242,255,0.4)" : "#94a3b8",
                      }}
                    >
                      <X size={13} />
                    </button>
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
                      style={{
                        color: isDark ? "rgba(134,239,172,0.8)" : "#15803d",
                      }}
                    >
                      Channel Activity ({channelNotifsCount})
                    </span>
                  </div>
                  <button
                    onClick={onClearChannelNotifs}
                    className="text-[11px] font-medium"
                    style={{
                      color: isDark ? "rgba(134,239,172,0.6)" : "#16a34a",
                    }}
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
                            color: isDark
                              ? "rgba(238,242,255,0.75)"
                              : "#334155",
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

            {/* Room list */}
            <div className="flex-1 min-h-0 overflow-y-auto py-2">
              {rooms.length === 0 ? (
                <p
                  className="text-center text-sm py-8"
                  style={{
                    color: isDark ? "rgba(238,242,255,0.22)" : "#94a3b8",
                  }}
                >
                  No chats yet — start a new one!
                </p>
              ) : (
                <div className="space-y-0.5 px-2">
                  {rooms.map((room) => {
                    const isRoomChannel = isChannel(room);
                    const displayName = isRoomChannel
                      ? room.name || `#${room.slug}`
                      : room.is_group
                        ? room.name || "Group"
                        : room.other_username || "User";
                    const avatarId = room.is_group
                      ? room.id
                      : room.other_user_id;
                    const isOnline =
                      !room.is_group && onlineIds.has(room.other_user_id);
                    const unread = unreadCounts[room.id] || 0;
                    const isRecent =
                      room.last_message_at &&
                      nowMs / 1000 - room.last_message_at < 86400;
                    // is_new on a channel → green; on a plain group → yellow
                    const isNewChannel = isRoomChannel && !!room.is_new;
                    const isNewGroup =
                      !isRoomChannel && !!room.is_group && !!room.is_new;

                    return (
                      <button
                        key={room.id}
                        onClick={() => {
                          onSelectRoom(room.id);
                          setTimeout(() => setShowContactsList(false), 200);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left"
                        style={{ background: "transparent" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isDark
                            ? "rgba(99,102,241,0.07)"
                            : "rgba(99,102,241,0.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
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
                              style={{
                                border: `2px solid ${isDark ? darkBg1 : lightBg1}`,
                              }}
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
                            <div
                              className="text-xs truncate mt-0.5"
                              style={{ color: "#4ade80" }}
                            >
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
                              style={{
                                color: isDark
                                  ? "rgba(165,180,252,0.45)"
                                  : "#94a3b8",
                              }}
                            >
                              {room.last_message}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {room.last_message_at && (
                            <span
                              className="text-[10px]"
                              style={{
                                color: isDark
                                  ? "rgba(165,180,252,0.35)"
                                  : "#94a3b8",
                              }}
                            >
                              {formatTime(room.last_message_at)}
                            </span>
                          )}
                          {room.role_notification ? (
                            <span
                              className="w-2 h-2 rounded-full bg-green-400"
                              style={{
                                boxShadow: "0 0 6px rgba(74,222,128,0.9)",
                              }}
                            />
                          ) : isNewChannel ? (
                            <span
                              className="w-2 h-2 rounded-full bg-green-400"
                              style={{
                                boxShadow: "0 0 6px rgba(74,222,128,0.9)",
                              }}
                            />
                          ) : isNewGroup ? (
                            <span className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.9)]" />
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
