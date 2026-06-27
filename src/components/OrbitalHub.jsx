import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MessageCircle, Sun, Moon, Sparkles, Users, Search, Crown, Wand2, Play, Pause } from "lucide-react";
import StarField from "./ui/star-field.jsx";
import Lightfall from "./ui/Lightfall.jsx";
import { AllChatsPanel } from "./AllChatsPanel.jsx";
import { Avatar } from "./ui/Avatar.jsx";
import { userBg } from "@/lib/helpers.js";
import { isChannel, unreadBadgeStyle } from "@/lib/room-helpers.js";
import { darkBg0, lightBg0, specialBg0 } from "@/lib/constants.js";

export function OrbitalHub({
  rooms,
  hasGroupNewNotif,
  onSelectRoom,
  onNewChat,
  onOpenFriends,
  currentUser,
  onlineIds,
  unreadCounts,
  isDark,
  baseIsDark = isDark,
  theme,
  freezeRotation = false,
  onToggleTheme,
  onToggleSpecial,
  canSpecial = false,
  canSearch = false,
  lightfallSettings,
  canCustomize = false,
  onOpenCustomize,
  onOpenPlans,
  pendingCount,
  pendingUsers,
  onAcceptContact,
  onRemoveContact,
  avatarMap,
  myAvatar,
  onOpenAccount,
  onOpenSearch,
  channelNotifs,
  onClearChannelNotifs,
  friendNotifs = [],
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

  // Friends-icon badge: pending incoming requests + accepted/declined
  // confirmations — every friend notification, all viewable in the Friends modal.
  const friendBadge = pendingCount + friendNotifs.length;

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
  // Background animation play/stop. Freezes only the animated background of the
  // current mode (StarField for dark/light, Lightfall for special) — the orbit
  // bubbles keep spinning. Persisted so the choice sticks across reloads.
  const [bgPaused, setBgPaused] = useState(
    () => localStorage.getItem("linkloop_bg_paused") === "1",
  );
  const toggleBgPaused = () =>
    setBgPaused((v) => {
      const next = !v;
      localStorage.setItem("linkloop_bg_paused", next ? "1" : "0");
      return next;
    });
  const isSpecial = theme === "special";
  const bg0 = isSpecial ? specialBg0 : isDark ? darkBg0 : lightBg0;

  // Special mode now renders the dark Lightfall background, so it follows the
  // dark palette (isDark is true in special mode): white text on dark, black on
  // light theme.
  const textStrong = isDark ? "#ffffff" : "#000000";
  const textStrongShadow =
    textStrong === "#ffffff"
      ? "0 1px 8px rgba(0,0,0,0.7)"
      : "0 1px 8px rgba(255,255,255,0.7)";

  // In Special mode the Lightfall background is dark navy with bright colour
  // streaks, so the translucent dark-theme control chips blend in. Swap in a
  // frosted light chip carrying each button's accent so the controls pop.
  const specialChip = (accent) => ({
    background: "rgba(255,255,255,0.66)",
    border: "1px solid rgba(15,23,42,0.18)",
    color: accent,
    boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
  });

  const orbitRooms = useMemo(() => {
    const cutoff = nowMs / 1000 - 86400;
    return rooms.filter((r) => r.last_message_at && r.last_message_at > cutoff);
  }, [rooms, nowMs]);

  // All-chats list: most recently active conversations first (rooms with no
  // messages yet fall to the bottom).
  const sortedRooms = useMemo(
    () =>
      [...rooms].sort(
        (a, b) => (b.last_message_at || 0) - (a.last_message_at || 0),
      ),
    [rooms],
  );

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
    // Pause while a node is hovered (desktop) or while a mode-switch view
    // transition is cross-fading: during the cross-fade the user sees a frozen
    // snapshot, so the live nodes must stay put or taps land where the bubble
    // has rotated to (empty space / the centre hub) instead of where it's seen.
    if (hoveredId !== null || freezeRotation) return;
    let rafId;
    let lastTime = null;
    const step = (now) => {
      if (lastTime !== null) {
        // Cap delta at 50 ms so that an iOS background/resume cycle (which can
        // deliver a single rAF call spanning seconds of elapsed time) never
        // causes a visible position jump in the orbit nodes.
        const delta = Math.min(now - lastTime, 50);
        angleRef.current = (angleRef.current + delta * 0.006) % 360;
        setRotationAngle(Number(angleRef.current.toFixed(3)));
      }
      lastTime = now;
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [hoveredId, freezeRotation]);

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
      {/* Background — StarField (dark/light) and, for entitled users, the
          Lightfall WebGL canvas. BOTH stay mounted and are cross-faded by
          opacity so switching modes never tears down / re-inits a canvas
          mid-transition (the source of the switch lag). Lightfall is paused
          while hidden so it costs nothing off-screen. No overlay text. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0" style={{ opacity: isSpecial ? 0 : 1 }}>
          <StarField isDark={isDark} paused={bgPaused} />
        </div>
        {(canSpecial || isSpecial) && (
          <div className="absolute inset-0" style={{ opacity: isSpecial ? 1 : 0 }}>
            <Lightfall {...lightfallSettings} paused={!isSpecial || bgPaused} />
          </div>
        )}
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between gap-2 px-3 sm:px-6 py-3 sm:py-4 z-30">
        <div className="flex items-center gap-2.5">
          <span
            className="font-bold tracking-wide text-lg sm:text-xl"
            style={{
              color: isSpecial ? textStrong : isDark ? "#eef2ff" : "#0f172a",
              textShadow: isSpecial ? textStrongShadow : undefined,
            }}
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
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={onOpenAccount}
            title="Your profile"
            aria-label="Your profile"
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
              />
            </div>
            <span
              className="text-sm font-semibold hidden sm:block"
              style={{ color: textStrong, textShadow: textStrongShadow }}
            >
              {currentUser.username}
            </span>
          </button>
          <button
            onClick={onOpenFriends}
            title="Friends"
            aria-label="Friends"
            className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            style={
              isSpecial
                ? specialChip("#4f46e5")
                : {
                    background: isDark
                      ? "rgba(99,102,241,0.12)"
                      : "rgba(99,102,241,0.08)",
                    border: `1px solid ${isDark ? "rgba(129,140,248,0.32)" : "rgba(99,102,241,0.24)"}`,
                    color: isDark ? "#a5b4fc" : "#4f46e5",
                    boxShadow: isDark
                      ? "0 0 10px rgba(99,102,241,0.14)"
                      : "0 2px 8px rgba(99,102,241,0.1)",
                  }
            }
          >
            <Users size={16} />
            {/* Friend activity — incoming requests + accepted/declined
                confirmations, all surfaced inside the Friends modal. */}
            {friendBadge > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-4 h-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1"
                style={{
                  background: "linear-gradient(135deg,#ef4444,#dc2626)",
                  boxShadow: "0 2px 6px rgba(239,68,68,0.5)",
                }}
                aria-label={`${friendBadge} friend notification${friendBadge === 1 ? "" : "s"}`}
              >
                {friendBadge > 9 ? "9+" : friendBadge}
              </span>
            )}
          </button>
          {canSearch && (
            <button
              onClick={onOpenSearch}
              title="Search messages"
              aria-label="Search messages"
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={
                isSpecial
                  ? specialChip("#4f46e5")
                  : {
                      background: isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)",
                      border: `1px solid ${isDark ? "rgba(129,140,248,0.32)" : "rgba(99,102,241,0.24)"}`,
                      color: isDark ? "#a5b4fc" : "#4f46e5",
                      boxShadow: isDark
                        ? "0 0 10px rgba(99,102,241,0.14)"
                        : "0 2px 8px rgba(99,102,241,0.1)",
                    }
              }
            >
              <Search size={16} />
            </button>
          )}
          {onOpenPlans && (
            <button
              onClick={onOpenPlans}
              title="Plans & pricing"
              aria-label="View plans and pricing"
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={
                isSpecial
                  ? specialChip("#ca8a04")
                  : {
                      background: isDark ? "rgba(234,179,8,0.12)" : "rgba(234,179,8,0.1)",
                      border: `1px solid ${isDark ? "rgba(250,204,21,0.34)" : "rgba(202,138,4,0.26)"}`,
                      color: isDark ? "#facc15" : "#ca8a04",
                      boxShadow: isDark
                        ? "0 0 10px rgba(234,179,8,0.14)"
                        : "0 2px 8px rgba(234,179,8,0.12)",
                    }
              }
            >
              <Crown size={16} />
            </button>
          )}
          {canSpecial && (
            <button
              onClick={onToggleSpecial}
              title={isSpecial ? "Exit special mode" : "Special mode"}
              aria-label={isSpecial ? "Exit special mode" : "Switch to special mode"}
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={
                isSpecial
                  ? specialChip("#0d9488")
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
          )}
          <button
            onClick={onToggleTheme}
            title={baseIsDark ? "Light mode" : "Dark mode"}
            aria-label={baseIsDark ? "Switch to light mode" : "Switch to dark mode"}
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            style={
              isSpecial
                ? specialChip("#4f46e5")
                : {
                    background: isDark
                      ? "rgba(129,140,248,0.14)"
                      : "rgba(99,102,241,0.10)",
                    border: `1px solid ${isDark ? "rgba(129,140,248,0.35)" : "rgba(99,102,241,0.28)"}`,
                    color: isDark ? "#a5b4fc" : "#4f46e5",
                    boxShadow: isDark
                      ? "0 0 12px rgba(129,140,248,0.2)"
                      : "0 2px 8px rgba(99,102,241,0.12)",
                  }
            }
          >
            {baseIsDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>

      {/* Background animation play/stop — fixed bottom-left. Freezes only the
          current mode's animated background (StarField / Lightfall); the orbit
          bubbles keep spinning. */}
      <button
        onClick={toggleBgPaused}
        title={bgPaused ? "Play background animation" : "Stop background animation"}
        aria-label={
          bgPaused ? "Play background animation" : "Stop background animation"
        }
        aria-pressed={bgPaused}
        className="absolute left-3 sm:left-6 bottom-6 z-30 w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={
          isSpecial
            ? specialChip("#4f46e5")
            : {
                background: isDark
                  ? "rgba(129,140,248,0.14)"
                  : "rgba(99,102,241,0.10)",
                border: `1px solid ${isDark ? "rgba(129,140,248,0.35)" : "rgba(99,102,241,0.28)"}`,
                color: isDark ? "#a5b4fc" : "#4f46e5",
                boxShadow: isDark
                  ? "0 0 12px rgba(129,140,248,0.2)"
                  : "0 2px 8px rgba(99,102,241,0.12)",
              }
        }
      >
        {bgPaused ? <Play size={16} /> : <Pause size={16} />}
      </button>

      {/* Outer orbit ring */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: "min(64vmin, 500px)",
          height: "min(64vmin, 500px)",
          boxShadow: isSpecial
            ? [
                "0 0 0 1.5px rgba(199,210,254,0.6)",
                "0 0 0 4px rgba(129,140,248,0.2)",
                "0 0 0 11px rgba(99,102,241,0.08)",
                "0 0 90px rgba(129,140,248,0.32)",
                "inset 0 0 80px rgba(129,140,248,0.14)",
              ].join(", ")
            : isDark
              ? [
                  "0 0 0 1.5px rgba(129,140,248,0.6)",
                  "0 0 0 4px rgba(99,102,241,0.18)",
                  "0 0 0 10px rgba(99,102,241,0.06)",
                  "0 0 80px rgba(129,140,248,0.32)",
                  "inset 0 0 80px rgba(99,102,241,0.16)",
                ].join(", ")
              : [
                  "0 0 0 1.5px rgba(99,102,241,0.55)",
                  "0 0 0 4px rgba(99,102,241,0.14)",
                  "0 0 0 10px rgba(99,102,241,0.05)",
                  "0 0 50px rgba(99,102,241,0.2)",
                  "inset 0 0 40px rgba(99,102,241,0.07)",
                ].join(", "),
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
          boxShadow: isSpecial
            ? [
                "0 0 0 1.5px rgba(196,181,253,0.55)",
                "0 0 0 4px rgba(167,139,250,0.18)",
                "0 0 0 9px rgba(139,92,246,0.06)",
                "0 0 60px rgba(167,139,250,0.3)",
                "inset 0 0 50px rgba(167,139,250,0.12)",
              ].join(", ")
            : isDark
              ? [
                  "0 0 0 1.5px rgba(167,139,250,0.55)",
                  "0 0 0 4px rgba(139,92,246,0.16)",
                  "0 0 0 8px rgba(139,92,246,0.05)",
                  "0 0 55px rgba(167,139,250,0.28)",
                  "inset 0 0 50px rgba(139,92,246,0.13)",
                ].join(", ")
              : [
                  "0 0 0 1.5px rgba(139,92,246,0.48)",
                  "0 0 0 3px rgba(139,92,246,0.12)",
                  "0 0 0 8px rgba(139,92,246,0.04)",
                  "0 0 35px rgba(139,92,246,0.18)",
                  "inset 0 0 30px rgba(139,92,246,0.06)",
                ].join(", "),
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
            border: isSpecial
              ? "2px solid rgba(199,210,254,0.9)"
              : isDark
                ? "2px solid rgba(129,140,248,0.9)"
                : "2px solid rgba(99,102,241,0.9)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 116,
            height: 116,
            animation: "ping 2s cubic-bezier(0,0,0.2,1) infinite",
            animationDelay: "0.75s",
            border: isSpecial
              ? "1.5px solid rgba(196,181,253,0.6)"
              : isDark
                ? "1.5px solid rgba(129,140,248,0.6)"
                : "1.5px solid rgba(99,102,241,0.6)",
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
        {/* Friend activity is intentionally NOT shown here — incoming friend
            requests are surfaced only on the Friends icon in the top bar. */}
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
            : isSpecial
              ? "rgba(199,210,254,0.7)"
              : isDark
                ? "rgba(129,140,248,0.55)"
                : "rgba(99,102,241,0.5)";
        const ringHover = isRoomChannel
          ? "rgba(74,222,128,0.9)"
          : room.is_group
            ? "rgba(250,204,21,0.9)"
            : isSpecial
              ? "rgba(224,231,255,0.95)"
              : isDark
                ? "rgba(129,140,248,0.85)"
                : "rgba(99,102,241,0.82)";
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
            className="absolute cursor-pointer flex flex-col items-center select-none active:scale-95 transition-none"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              zIndex: pos.zIndex,
            }}
            onMouseEnter={() => setHoveredId(room.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelectRoom(room.id)}
          >
            {/* Hover glow — mounted ONLY for the hovered node. A `filter: blur()`
                element is promoted to its own GPU compositor layer; keeping one
                per node permanently mounted (even at opacity 0) means N blurred
                layers get re-composited every frame alongside the StarField rAF
                loop, which makes iOS standalone (home-screen) blink under load.
                Mobile has no hover, so this is zero blur layers there. */}
            {hoveredId === room.id && (
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 86,
                  height: 86,
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  background:
                    "radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 68%)",
                  filter: "blur(10px)",
                }}
              />
            )}
            <div
              className={`relative w-12 h-12 transition-transform duration-200 ${hoveredId === room.id ? "scale-110" : ""}`}
            >
              {/* Bubble fill — per-user gradient only, no initials; the name
                  shows in the hover label. Fades with orbit depth. */}
              <div
                className="w-full h-full rounded-full"
                style={{
                  background: userBg(avatarId),
                  // Keep more of the fill in Special mode so bubbles don't wash
                  // out against the bright Lightfall streaks.
                  opacity: isSpecial ? Math.max(0.9, pos.opacity) : pos.opacity,
                  boxShadow: isSpecial
                    ? "0 2px 14px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(255,255,255,0.4)"
                    : isDark
                      ? "0 4px 18px rgba(0,0,0,0.55), 0 0 14px rgba(129,140,248,0.35), 0 0 0 1.5px rgba(199,210,254,0.45)"
                      : "0 4px 20px rgba(0,0,0,0.2), 0 0 0 2px rgba(255,255,255,0.9)",
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

      {/* Mobile-only Customize button — fixed bottom-right */}
      {canCustomize && isSpecial && (
        <button
          onClick={onOpenCustomize}
          title="Customize background"
          aria-label="Customize the Special-mode background"
          className="sm:hidden"
          style={{
            display: "flex",
            position: "fixed",
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: "50%",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 30,
            ...specialChip("#0d9488"),
          }}
        >
          <Wand2 size={22} />
        </button>
      )}

      {/* All-chats bottom panel */}
      {showContactsList && (
        <AllChatsPanel
          isDark={isDark}
          onClose={() => setShowContactsList(false)}
          onNewChat={onNewChat}
          pendingUsers={pendingUsers}
          onlineIds={onlineIds}
          avatarMap={avatarMap}
          onAcceptContact={onAcceptContact}
          onRemoveContact={onRemoveContact}
          channelNotifs={channelNotifs}
          channelNotifsCount={channelNotifsCount}
          onClearChannelNotifs={onClearChannelNotifs}
          rooms={rooms}
          sortedRooms={sortedRooms}
          unreadCounts={unreadCounts}
          nowMs={nowMs}
          onSelectRoom={onSelectRoom}
        />
      )}
    </div>
  );
}
