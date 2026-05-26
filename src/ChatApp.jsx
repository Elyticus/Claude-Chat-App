import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Fragment,
} from "react";
import {
  MessageCircle,
  LogOut,
  ArrowLeft,
  Send,
  Sun,
  Moon,
  Search,
  X,
  Trash2,
  Users,
  Copy,
  Check,
  Globe,
  Lock,
  UserMinus,
  Crown,
  ShieldCheck,
  UserCheck,
  Pencil,
  Pin,
  UserPlus,
  VolumeX,
  Volume2,
} from "lucide-react";
import StarField from "./components/ui/star-field.jsx";
import { api } from "./lib/api.js";
import { connectSocket, disconnectSocket } from "./lib/socket.js";

// ─── Utilities ────────────────────────────────────────────────────────────────

const COLORS = [
  "linear-gradient(135deg,#49AAFF,#2D608B)",
  "linear-gradient(135deg,#f093fb,#f5576c)",
  "linear-gradient(135deg,#4facfe,#00f2fe)",
  "linear-gradient(135deg,#43e97b,#38f9d7)",
  "linear-gradient(135deg,#fa709a,#fee140)",
  "linear-gradient(135deg,#a18cd1,#fbc2eb)",
  "linear-gradient(135deg,#667eea,#764ba2)",
  "linear-gradient(135deg,#f7971e,#ffd200)",
];

function userBg(id) {
  return COLORS[Math.abs(id ?? 0) % COLORS.length];
}

function initials(name = "?") {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(ts) {
  if (!ts) return "";
  const date = new Date(ts * 1000);
  const now = new Date();
  const diff = now - date;
  if (diff < 86_400_000)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 172_800_000) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatFullTime(ts) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayKey(ts) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateSeparator(ts) {
  const date = new Date(ts * 1000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today - msgDay) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "long" });
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const REACTIONS = ["🔥", "🙌", "❤️", "😀", "😝", "👍"];

const ROLE_LEVEL = { owner: 4, admin: 3, moderator: 2, member: 1 };

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function roleBadge(role, isDark) {
  const config = {
    owner: {
      bg: isDark ? "rgba(251,191,36,0.15)" : "#FEF9C3",
      color: isDark ? "#fbbf24" : "#92400e",
      Icon: Crown,
    },
    admin: {
      bg: isDark ? "rgba(12,68,124,0.22)" : "#E6F1FB",
      color: isDark ? "#5da8e8" : "#0C447C",
      Icon: ShieldCheck,
    },
    moderator: {
      bg: isDark ? "rgba(8,80,65,0.22)" : "#E1F5EE",
      color: isDark ? "#40c99a" : "#085041",
      Icon: UserCheck,
    },
  };
  const c = config[role];
  if (!c) return null;
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  return (
    <span
      className="inline-flex items-center gap-0.75 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0"
      style={{ background: c.bg, color: c.color }}
    >
      <c.Icon size={9} strokeWidth={2.5} />
      {label}
    </span>
  );
}

// ─── Shared style helpers ─────────────────────────────────────────────────────

const darkBg0 = "#070d1c";
const darkBg1 = "#0b1426";
const darkBg2 = "#10192e";
const darkBorder = "rgba(99,102,241,0.11)";
const darkBorderMid = "rgba(99,102,241,0.14)";

const lightBg0 = "#f5f7ff";
const lightBg1 = "#ffffff";
const lightBorderMid = "rgba(226,232,240,1)";

function ContactStatusButton({ status, onAdd, onRemove, isDark }) {
  if (status === "accepted") {
    return (
      <button
        onClick={onRemove}
        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${isDark ? "bg-white/6 text-white/45 hover:bg-red-500/15 hover:text-red-400" : "bg-black/5 text-slate-500 hover:bg-red-500/10 hover:text-red-500"}`}
      >
        Remove
      </button>
    );
  }
  if (status === "pending_sent") {
    return (
      <span
        className={`px-3 py-1 rounded-lg text-xs font-semibold opacity-50 ${isDark ? "bg-white/6 text-white/40" : "bg-black/5 text-slate-500"}`}
      >
        Pending
      </span>
    );
  }
  if (status === "pending_received") {
    return (
      <button
        onClick={onRemove}
        className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"
      >
        Decline
      </button>
    );
  }
  return (
    <button
      onClick={onAdd}
      className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 transition-all"
    >
      Add
    </button>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  userId,
  username,
  size = 48,
  online = false,
  avatar = null,
}) {
  const dotSize = Math.round(size * 0.28);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {avatar ? (
        <img
          src={avatar}
          alt={username}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white font-semibold"
          style={{
            background: userBg(userId),
            width: size,
            height: size,
            fontSize: Math.round(size * 0.33),
          }}
        >
          {initials(username)}
        </div>
      )}
      {online && (
        <span
          className="absolute rounded-full bg-emerald-400"
          style={{
            width: dotSize,
            height: dotSize,
            bottom: 1,
            right: 1,
            border: "2px solid #070d1c",
            boxShadow: "0 0 6px rgba(52,211,153,0.6)",
          }}
        />
      )}
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ names, isDark }) {
  if (!names.length) return null;
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : `${names.join(", ")} are typing`;
  return (
    <span
      className={`flex items-center gap-1 text-xs ${isDark ? "text-indigo-300/50" : "text-slate-400"}`}
    >
      {label}
      <span className="flex gap-0.5 items-end ml-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`w-1 h-1 rounded-full animate-bounce ${isDark ? "bg-indigo-400/50" : "bg-slate-400"}`}
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
    </span>
  );
}

// ─── Orbital Hub ──────────────────────────────────────────────────────────────

function OrbitalHub({
  rooms,
  onSelectRoom,
  onNewChat,
  onLogout,
  currentUser,
  onlineIds,
  unreadCounts,
  isDark,
  onToggleTheme,
  pendingCount,
  pendingUsers,
  onAcceptContact,
  onRemoveContact,
  avatarMap,
  myAvatar,
  onAvatarClick,
}) {
  const hasGroupNotif = rooms.some((r) => !!r.is_group && !!r.is_new);
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

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-dvh flex items-center justify-center overflow-hidden"
      style={{ background: isDark ? darkBg0 : lightBg0 }}
    >
      {/* Star field + atmosphere — all glow drawn on canvas, zero CSS blur layers */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <StarField isDark={isDark} />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 z-30">
        <div className="flex items-center gap-2.5">
          <span
            className="font-bold tracking-wide text-xl"
            style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
          >
            Chatloop
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
              className="text-sm hidden sm:block"
              style={{ color: isDark ? "rgba(238,242,255,0.5)" : "#64748b" }}
            >
              {currentUser.username}
            </span>
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
            onClick={onLogout}
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

      {/* Outer orbit ring — glowing path with rotating beacon */}
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

      {/* Inner orbit ring — counter-rotating beacon */}
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

      {/* Center hub — breathing glow */}
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
        {/* Specular highlight — makes it look 3-D */}
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
        {pendingCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-5 h-5 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 z-20"
            style={{
              background: "linear-gradient(135deg,#ef4444,#dc2626)",
              boxShadow: "0 2px 8px rgba(239,68,68,0.5)",
            }}
          >
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        )}
        {hasGroupNotif && (
          <span
            className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full z-20 animate-pulse"
            style={{
              border: `2px solid ${isDark ? darkBg0 : lightBg0}`,
              boxShadow: "0 0 8px rgba(250,204,21,0.7)",
            }}
          />
        )}
      </button>

      {/* Room nodes */}
      {orbitRooms.map((room, index) => {
        const pos = getNodePosition(index, orbitRooms.length);
        const isRoomChannel =
          room.type === "channel" || room.type === "private_channel";
        const displayName = isRoomChannel
          ? room.name || `#${room.slug}`
          : room.is_group
            ? room.name || "Group"
            : room.other_username || "User";
        const avatarId = room.is_group ? room.id : room.other_user_id;
        const isOnline = !room.is_group && onlineIds.has(room.other_user_id);
        const unread = unreadCounts[room.id] || 0;

        return (
          <div
            key={room.id}
            className={`absolute cursor-pointer flex flex-col items-center select-none active:scale-95 ${hoveredId === null ? "transition-transform duration-50" : "transition-none"}`}
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              zIndex: pos.zIndex,
              opacity: pos.opacity,
            }}
            onMouseEnter={() => setHoveredId(room.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelectRoom(room.id)}
          >
            {/* Hover glow aura */}
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
            {/* Node circle */}
            <div
              className={`relative w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-semibold transition-all duration-200 ${hoveredId === room.id ? "scale-110" : ""}`}
              style={{
                background: userBg(avatarId),
                boxShadow:
                  hoveredId === room.id
                    ? isDark
                      ? "0 0 0 2px rgba(99,102,241,0.5), 0 0 20px rgba(99,102,241,0.4), 0 4px 16px rgba(0,0,0,0.5)"
                      : "0 0 0 2px rgba(99,102,241,0.45), 0 0 20px rgba(99,102,241,0.3), 0 4px 16px rgba(99,102,241,0.2)"
                    : isDark
                      ? "0 0 0 2px rgba(99,102,241,0.22), 0 4px 16px rgba(0,0,0,0.5)"
                      : "0 0 0 2px rgba(99,102,241,0.18), 0 4px 16px rgba(99,102,241,0.12)",
              }}
            >
              {initials(displayName)}
              {isOnline && (
                <span
                  className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-400 rounded-full"
                  style={{
                    border: `2px solid ${isDark ? darkBg0 : lightBg0}`,
                    boxShadow: "0 0 6px rgba(52,211,153,0.6)",
                  }}
                />
              )}
              {unread > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-5 h-5 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
                  style={{
                    background: "linear-gradient(135deg,#ef4444,#dc2626)",
                    boxShadow: "0 2px 8px rgba(239,68,68,0.5)",
                  }}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </div>
            {/* Name label */}
            <span
              className="mt-2 text-[11px] font-semibold max-w-19 truncate text-center leading-tight"
              style={{ color: isDark ? "rgba(238,242,255,0.9)" : "#1e293b" }}
            >
              {displayName}
            </span>
            {room.last_message_at && (
              <span
                className="text-[10px] mt-0.5"
                style={{ color: isDark ? "rgba(165,180,252,0.55)" : "#94a3b8" }}
              >
                {formatTime(room.last_message_at)}
              </span>
            )}
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
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col overflow-hidden animate-slide-up"
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

            {/* Pending requests */}
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
                    const isRoomChannel =
                      room.type === "channel" ||
                      room.type === "private_channel";
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

                    return (
                      <button
                        key={room.id}
                        onClick={() => {
                          onSelectRoom(room.id);
                          setTimeout(() => setShowContactsList(false), 200);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left"
                        style={{
                          background: "transparent",
                        }}
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
                              className="absolute -top-1 -right-1 min-w-4 h-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1"
                              style={{
                                background:
                                  "linear-gradient(135deg,#ef4444,#dc2626)",
                                boxShadow: "0 2px 6px rgba(239,68,68,0.5)",
                              }}
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
                            <div className="text-xs truncate mt-0.5" style={{ color: "#a5b4fc" }}>
                              {room.role_notification}
                            </div>
                          ) : !!room.is_group && !!room.is_new ? (
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
                              className="w-2 h-2 rounded-full bg-indigo-400"
                              style={{ boxShadow: "0 0 6px rgba(129,140,248,0.9)" }}
                            />
                          ) : !!room.is_group && !!room.is_new ? (
                            <span className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.9)]" />
                          ) : (
                            isRecent && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                                style={{
                                  boxShadow: "0 0 4px rgba(129,140,248,0.7)",
                                }}
                              />
                            )
                          )}
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

// ─── Context Menu ─────────────────────────────────────────────────────────────

function ContextMenu({
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
  const isOwn    = Number(msg.user_id) === Number(currentUserId);
  const canPin   = isChannel && ROLE_LEVEL[myRole] >= ROLE_LEVEL.moderator;
  const canDelete = isOwn || (isChannel && ROLE_LEVEL[myRole] >= ROLE_LEVEL.moderator);
  const cardW = 260;

  // On mobile: center horizontally. On desktop: follow cursor.
  const isMobile = window.innerWidth < 640;
  const left = isMobile
    ? (window.innerWidth - cardW) / 2
    : Math.max(8, Math.min(position.x, window.innerWidth - cardW - 8));

  // Use visualViewport so positioning works correctly when the keyboard is open.
  // touch.clientY is in visual-viewport space; fixed positioning is in layout-viewport
  // space on iOS — add vvt to convert between them.
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
      {/* Backdrop */}
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
          {/* Message preview */}
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

          {/* Copy */}
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

          {/* Pin / Unpin — moderator+ in channels */}
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
                onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "rgba(99,102,241,0.08)" : "rgba(0,0,0,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
              >
                <Pin size={17} style={{ opacity: 0.55 }} />
                {isPinned ? "Unpin" : "Pin"}
              </button>
            </>
          )}

          {/* Delete — own messages, or any message for moderator+ in channels */}
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

// ─── New Chat Modal ───────────────────────────────────────────────────────────

function NewChatModal({
  contacts,
  allUsers,
  onlineIds,
  onSelectUser,
  onCreateGroup,
  onCreateChannel,
  onJoinChannel,
  onSendRequest,
  onAcceptContact,
  onRemoveContact,
  onClose,
  isDark,
  avatarMap,
}) {
  const [mode, setMode] = useState("dm");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [findError, setFindError] = useState("");

  // Channel state
  const [channelMode, setChannelMode] = useState("create"); // "create" | "join"
  const [channelName, setChannelName] = useState("");
  const [channelSlug, setChannelSlug] = useState("");
  const [channelDesc, setChannelDesc] = useState("");
  const [channelPrivate, setChannelPrivate] = useState(false);
  const [slugManual, setSlugManual] = useState(false);
  const [joinSlug, setJoinSlug] = useState("");
  const [channelPreview, setChannelPreview] = useState(null);
  const [channelLookupError, setChannelLookupError] = useState("");
  const [channelError, setChannelError] = useState("");
  const lookupTimer = useRef(null);

  const incoming = allUsers.filter(
    (u) => u.contact_status === "pending_received",
  );

  const filtered = (
    mode === "find"
      ? allUsers.filter((u) => u.contact_status !== "pending_received")
      : contacts
  ).filter((u) => u.username.toLowerCase().includes(search.toLowerCase()));

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function submitGroup() {
    if (!groupName.trim() || selectedIds.length < 1) return;
    setCreating(true);
    await onCreateGroup(selectedIds, groupName.trim());
    setCreating(false);
  }

  function handleChannelNameChange(e) {
    const val = e.target.value;
    setChannelName(val);
    if (!slugManual) setChannelSlug(toSlug(val));
  }

  function handleSlugChange(e) {
    setSlugManual(true);
    setChannelSlug(
      e.target.value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .slice(0, 50),
    );
  }

  async function submitChannel() {
    setChannelError("");
    if (!channelName.trim()) {
      setChannelError("Channel name required");
      return;
    }
    if (!channelSlug.trim()) {
      setChannelError("Channel address required");
      return;
    }
    if (!/^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/.test(channelSlug)) {
      setChannelError(
        "Address must be lowercase letters, numbers, and dashes (e.g. my-channel)",
      );
      return;
    }
    setCreating(true);
    try {
      await onCreateChannel(
        channelName.trim(),
        channelSlug,
        channelDesc.trim(),
        channelPrivate,
      );
    } catch (err) {
      setChannelError(err.message || "Failed to create channel");
    } finally {
      setCreating(false);
    }
  }

  function handleJoinSlugChange(e) {
    const val = e.target.value;
    setJoinSlug(val);
    setChannelPreview(null);
    setChannelLookupError("");
    clearTimeout(lookupTimer.current);
    const clean = val.trim().toLowerCase().replace(/^#/, "");
    if (!clean) return;
    lookupTimer.current = setTimeout(async () => {
      try {
        const data = await api.lookupChannel(clean);
        setChannelPreview(data);
        setChannelLookupError("");
      } catch {
        setChannelPreview(null);
        setChannelLookupError("Channel not found");
      }
    }, 500);
  }

  async function submitJoin() {
    if (!joinSlug.trim()) return;
    setCreating(true);
    try {
      await onJoinChannel(joinSlug.trim());
    } catch (err) {
      setChannelLookupError(err.message || "Failed to join channel");
    } finally {
      setCreating(false);
    }
  }

  const tabs = [
    { id: "dm", label: "Direct" },
    { id: "group", label: "Group" },
    { id: "channel", label: "Channel" },
    { id: "find", label: "Find", badge: incoming.length },
  ];

  const headerTitle =
    mode === "dm"
      ? "New Message"
      : mode === "group"
        ? "New Group"
        : mode === "channel"
          ? "Channel"
          : "Find People";

  const inputCls = `w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all ${
    isDark
      ? "bg-[#10192e] border border-indigo-500/15 text-[#eef2ff] placeholder:text-indigo-300/20 focus:border-indigo-500/45"
      : "bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"
  }`;

  return (
    <div className="fixed inset-0 z-500 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{
          background: isDark ? "rgba(7,13,28,0.88)" : "rgba(15,23,42,0.25)",
          backdropFilter: "blur(8px)",
        }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={headerTitle}
        className="relative w-full sm:w-100 max-h-[85dvh] flex flex-col overflow-hidden rounded-2xl animate-scale-in"
        style={{
          background: isDark ? darkBg1 : lightBg1,
          border: `1px solid ${isDark ? darkBorderMid : lightBorderMid}`,
          boxShadow: isDark
            ? "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.06)"
            : "0 32px 80px rgba(99,102,241,0.12)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: isDark ? darkBorder : lightBorderMid }}
        >
          <span
            className="font-semibold"
            style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
          >
            {headerTitle}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
            style={{ color: isDark ? "rgba(238,242,255,0.4)" : "#64748b" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 p-3 pb-0 shrink-0">
          {tabs.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMode(m.id);
                setSelectedIds([]);
                setSearch("");
                setFindError("");
                setChannelError("");
                setChannelLookupError("");
              }}
              className="flex-1 relative py-2 rounded-xl text-xs font-medium transition-all"
              style={
                mode === m.id
                  ? {
                      background: isDark ? "#6366f1" : "#0f172a",
                      color: "#ffffff",
                      boxShadow: isDark
                        ? "0 2px 12px rgba(99,102,241,0.4)"
                        : "none",
                    }
                  : {
                      color: isDark ? "rgba(238,242,255,0.45)" : "#64748b",
                    }
              }
            >
              {m.label}
              {m.badge > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-4 h-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1"
                  style={{
                    background: "linear-gradient(135deg,#ef4444,#dc2626)",
                    boxShadow: "0 2px 6px rgba(239,68,68,0.5)",
                  }}
                >
                  {m.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Group name input */}
        {mode === "group" && (
          <div className="px-4 pt-3 shrink-0">
            <input
              className={inputCls}
              placeholder="Group name…"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>
        )}

        {/* Channel mode */}
        {mode === "channel" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Sub-mode toggle */}
            <div className="flex gap-1 px-4 pt-3 shrink-0">
              {["create", "join"].map((sub) => (
                <button
                  key={sub}
                  onClick={() => {
                    setChannelMode(sub);
                    setChannelError("");
                    setChannelLookupError("");
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
                  style={
                    channelMode === sub
                      ? {
                          background: isDark
                            ? "rgba(99,102,241,0.18)"
                            : "rgba(99,102,241,0.12)",
                          color: isDark ? "#a5b4fc" : "#4f46e5",
                        }
                      : { color: isDark ? "rgba(238,242,255,0.4)" : "#64748b" }
                  }
                >
                  {sub === "create" ? "Create" : "Join"}
                </button>
              ))}
            </div>

            {channelMode === "create" && (
              <div className="flex-1 overflow-y-auto px-4 pt-3 pb-5 space-y-3">
                <input
                  className={inputCls}
                  placeholder="Channel name…"
                  value={channelName}
                  onChange={handleChannelNameChange}
                />
                <div className="relative">
                  <span
                    className="absolute left-4 top-1/2 -translate-y-1/2 font-bold select-none"
                    style={{
                      color: isDark ? "rgba(165,180,252,0.5)" : "#94a3b8",
                    }}
                  >
                    #
                  </span>
                  <input
                    className={inputCls}
                    style={{ paddingLeft: "1.75rem" }}
                    placeholder="channel-address"
                    value={channelSlug}
                    onChange={handleSlugChange}
                  />
                </div>
                <input
                  className={inputCls}
                  placeholder="Description (optional)…"
                  value={channelDesc}
                  onChange={(e) => setChannelDesc(e.target.value)}
                />
                <button
                  onClick={() => setChannelPrivate((v) => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left"
                  style={{
                    background: channelPrivate
                      ? isDark
                        ? "rgba(99,102,241,0.12)"
                        : "rgba(99,102,241,0.07)"
                      : isDark
                        ? darkBg2
                        : "#f8fafc",
                    border: `1px solid ${isDark ? darkBorder : lightBorderMid}`,
                  }}
                >
                  {channelPrivate ? (
                    <Lock
                      size={15}
                      style={{ color: isDark ? "#a5b4fc" : "#6366f1" }}
                    />
                  ) : (
                    <Globe
                      size={15}
                      style={{
                        color: isDark ? "rgba(165,180,252,0.5)" : "#94a3b8",
                      }}
                    />
                  )}
                  <span
                    className="flex-1 text-sm"
                    style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
                  >
                    {channelPrivate ? "Private" : "Public"}
                  </span>
                  <span
                    className="text-xs"
                    style={{
                      color: isDark ? "rgba(165,180,252,0.4)" : "#94a3b8",
                    }}
                  >
                    {channelPrivate ? "Invite only" : "Anyone with the address"}
                  </span>
                </button>
                {channelError && (
                  <div
                    className="px-3 py-2 rounded-xl text-xs"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: "#f87171",
                    }}
                  >
                    {channelError}
                  </div>
                )}
                <button
                  onClick={submitChannel}
                  disabled={
                    !channelName.trim() || !channelSlug.trim() || creating
                  }
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-35 disabled:cursor-not-allowed transition-all hover:opacity-90"
                  style={{
                    background:
                      "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)",
                    boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
                  }}
                >
                  {creating ? "Creating…" : "Create Channel"}
                </button>
              </div>
            )}

            {channelMode === "join" && (
              <div className="flex-1 overflow-y-auto px-4 pt-3 pb-5 space-y-3">
                <div className="relative">
                  <span
                    className="absolute left-4 top-1/2 -translate-y-1/2 font-bold select-none"
                    style={{
                      color: isDark ? "rgba(165,180,252,0.5)" : "#94a3b8",
                    }}
                  >
                    #
                  </span>
                  <input
                    className={inputCls}
                    style={{ paddingLeft: "1.75rem" }}
                    placeholder="channel-address"
                    value={joinSlug}
                    onChange={handleJoinSlugChange}
                  />
                </div>
                {channelPreview && (
                  <div
                    className="rounded-xl px-4 py-3 space-y-1"
                    style={{
                      background: isDark ? darkBg2 : "#f8fafc",
                      border: `1px solid ${isDark ? darkBorder : lightBorderMid}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {channelPreview.type === "private_channel" ? (
                        <Lock
                          size={13}
                          style={{
                            color: isDark ? "rgba(165,180,252,0.5)" : "#94a3b8",
                          }}
                        />
                      ) : (
                        <Globe
                          size={13}
                          style={{
                            color: isDark ? "rgba(165,180,252,0.5)" : "#94a3b8",
                          }}
                        />
                      )}
                      <span
                        className="font-semibold text-sm"
                        style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
                      >
                        #{channelPreview.slug}
                      </span>
                      <span
                        className="text-xs"
                        style={{
                          color: isDark ? "rgba(165,180,252,0.4)" : "#94a3b8",
                        }}
                      >
                        · {channelPreview.memberCount} member
                        {channelPreview.memberCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {channelPreview.name && (
                      <div
                        className="text-sm font-medium"
                        style={{
                          color: isDark ? "rgba(238,242,255,0.8)" : "#334155",
                        }}
                      >
                        {channelPreview.name}
                      </div>
                    )}
                    {channelPreview.description && (
                      <div
                        className="text-xs"
                        style={{
                          color: isDark ? "rgba(165,180,252,0.5)" : "#64748b",
                        }}
                      >
                        {channelPreview.description}
                      </div>
                    )}
                    {channelPreview.isMember && (
                      <div className="text-xs text-emerald-400 font-medium">
                        You are already a member
                      </div>
                    )}
                  </div>
                )}
                {channelLookupError && (
                  <div
                    className="px-3 py-2 rounded-xl text-xs"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: "#f87171",
                    }}
                  >
                    {channelLookupError}
                  </div>
                )}
                <button
                  onClick={submitJoin}
                  disabled={
                    !joinSlug.trim() ||
                    creating ||
                    channelPreview?.type === "private_channel"
                  }
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-35 disabled:cursor-not-allowed transition-all hover:opacity-90"
                  style={{
                    background:
                      "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)",
                    boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
                  }}
                >
                  {creating
                    ? "Joining…"
                    : channelPreview?.isMember
                      ? "Open Channel"
                      : "Join Channel"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Selected chips */}
        {mode === "group" && selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3 shrink-0">
            {selectedIds.map((id) => {
              const u = contacts.find((x) => x.id === id);
              return u ? (
                <button
                  key={id}
                  onClick={() => toggleSelect(id)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-all"
                  style={{
                    background: isDark
                      ? "rgba(99,102,241,0.15)"
                      : "rgba(99,102,241,0.1)",
                    color: isDark ? "#a5b4fc" : "#4f46e5",
                  }}
                >
                  {u.username} <X size={10} />
                </button>
              ) : null;
            })}
          </div>
        )}

        {/* Search — only for dm/group/find modes */}
        {mode !== "channel" && (
          <div className="px-4 pt-3 shrink-0">
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{
                background: isDark ? darkBg2 : "#f8fafc",
                border: `1px solid ${isDark ? darkBorder : lightBorderMid}`,
              }}
            >
              <Search
                size={14}
                className="shrink-0"
                style={{ color: isDark ? "rgba(165,180,252,0.4)" : "#94a3b8" }}
              />
              <input
                type="text"
                placeholder={
                  mode === "dm"
                    ? "Search contacts…"
                    : mode === "group"
                      ? "Add members…"
                      : "Search people…"
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
              />
            </div>
          </div>
        )}

        {/* User list — only for dm/group/find modes */}
        {mode !== "channel" && (
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 mt-1">
            {mode === "find" ? (
              <div className="space-y-0.5">
                {incoming.length > 0 && !search && (
                  <div className="mb-2">
                    <p
                      className="text-[10px] uppercase tracking-widest px-3 py-1"
                      style={{
                        color: isDark ? "rgba(165,180,252,0.35)" : "#94a3b8",
                      }}
                    >
                      Requests
                    </p>
                    {incoming.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                        style={{
                          background: isDark
                            ? "rgba(99,102,241,0.07)"
                            : "rgba(99,102,241,0.05)",
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
                    <div
                      className="mx-3 my-2 border-t"
                      style={{
                        borderColor: isDark ? darkBorder : lightBorderMid,
                      }}
                    />
                  </div>
                )}

                {filtered.length === 0 && (
                  <p
                    className="text-center text-sm py-8"
                    style={{
                      color: isDark ? "rgba(238,242,255,0.22)" : "#94a3b8",
                    }}
                  >
                    No users found
                  </p>
                )}
                {findError && (
                  <div
                    className="mx-1 mb-2 px-3 py-2 rounded-xl text-xs"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: "#f87171",
                    }}
                  >
                    {findError}
                  </div>
                )}
                {filtered.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDark
                        ? "rgba(99,102,241,0.06)"
                        : "rgba(99,102,241,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "";
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
                    </div>
                    <ContactStatusButton
                      status={u.contact_status}
                      onAdd={async () => {
                        setFindError("");
                        try {
                          await onSendRequest(u.id);
                        } catch (err) {
                          setFindError(err.message || "Failed to send request");
                        }
                      }}
                      onRemove={() => onRemoveContact(u.id)}
                      isDark={isDark}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filtered.length === 0 && (
                  <p
                    className="text-center text-sm py-10"
                    style={{
                      color: isDark ? "rgba(238,242,255,0.22)" : "#94a3b8",
                    }}
                  >
                    {contacts.length === 0
                      ? 'No contacts yet — use "Find People" to add some'
                      : "No contacts match your search"}
                  </p>
                )}
                {filtered.map((u) => {
                  const selected = selectedIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                      style={{
                        background: selected
                          ? isDark
                            ? "rgba(99,102,241,0.14)"
                            : "rgba(99,102,241,0.08)"
                          : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!selected)
                          e.currentTarget.style.background = isDark
                            ? "rgba(99,102,241,0.07)"
                            : "rgba(99,102,241,0.05)";
                      }}
                      onMouseLeave={(e) => {
                        if (!selected)
                          e.currentTarget.style.background = "transparent";
                      }}
                      onClick={() =>
                        mode === "dm" ? onSelectUser(u) : toggleSelect(u.id)
                      }
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
                      </div>
                      {mode === "dm" && onlineIds.has(u.id) && (
                        <span className="text-[10px] text-emerald-400 font-semibold shrink-0">
                          Online
                        </span>
                      )}
                      {mode === "group" && selected && (
                        <span className="text-indigo-400 font-bold shrink-0">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {/* Create group CTA */}
        {mode === "group" && (
          <div
            className="px-4 pb-5 pt-3 border-t shrink-0"
            style={{ borderColor: isDark ? darkBorder : lightBorderMid }}
          >
            <button
              onClick={submitGroup}
              disabled={selectedIds.length < 1 || !groupName.trim() || creating}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-35 disabled:cursor-not-allowed transition-all hover:opacity-90 active:scale-[0.99]"
              style={{
                background:
                  "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)",
                boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
              }}
            >
              {creating
                ? "Creating…"
                : `Create Group${selectedIds.length > 0 ? ` (${selectedIds.length} selected)` : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
  isDark,
}) {
  return (
    <div className="fixed inset-0 z-600 flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{
          background: isDark ? "rgba(7,13,28,0.85)" : "rgba(15,23,42,0.35)",
          backdropFilter: "blur(8px)",
        }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full sm:w-96 overflow-hidden rounded-2xl animate-scale-in"
        style={{
          background: isDark ? darkBg2 : lightBg1,
          border: `1px solid ${isDark ? darkBorderMid : lightBorderMid}`,
          boxShadow: isDark
            ? "0 24px 64px rgba(0,0,0,0.75)"
            : "0 24px 64px rgba(99,102,241,0.12)",
        }}
      >
        <div className="px-6 pt-6 pb-4">
          <p
            className={`font-semibold text-base ${isDark ? "text-white" : "text-black"}`}
          >
            {title}
          </p>
          <p
            className={`text-sm mt-2 leading-relaxed ${isDark ? "text-white/50" : "text-black/60"}`}
          >
            {body}
          </p>
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: isDark ? "rgba(238,242,255,0.06)" : "#f1f5f9",
              color: isDark ? "rgba(238,242,255,0.7)" : "#475569",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all bg-red-500/15 text-red-400 hover:bg-red-500/25"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Channel Modal ───────────────────────────────────────────────────────

function EditChannelModal({ initialName, initialDescription, initialSlug, myRole, onSave, onClose, isDark }) {
  const [name, setName]               = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [slug, setSlug]               = useState(initialSlug || "");
  const [slugManual, setSlugManual]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState("");

  const isOwner = myRole === "owner";

  function handleNameChange(val) {
    setName(val);
    setErr("");
    if (isOwner && !slugManual) setSlug(toSlug(val));
  }

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) { setErr("Name is required"); return; }
    setSaving(true);
    try {
      await onSave(name.trim(), description.trim(), isOwner ? slug : undefined);
    } catch (ex) {
      setErr(ex.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-500 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(7,13,28,0.80)", backdropFilter: "blur(8px)" }} onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-2xl overflow-hidden animate-scale-in"
        style={{ background: isDark ? darkBg1 : lightBg1, border: `1px solid ${isDark ? darkBorderMid : lightBorderMid}`, boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: isDark ? darkBorder : lightBorderMid }}>
          <span className="font-semibold text-sm" style={{ color: isDark ? "#eef2ff" : "#0f172a" }}>Edit Channel</span>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: isDark ? "rgba(238,242,255,0.4)" : "#64748b" }}>
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: isDark ? "rgba(238,242,255,0.5)" : "#64748b" }}>Channel Name</label>
            <input
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.05)", color: isDark ? "#eef2ff" : "#0f172a", border: `1px solid ${isDark ? darkBorder : lightBorderMid}` }}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              maxLength={80}
            />
          </div>
          {isOwner && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: isDark ? "rgba(238,242,255,0.5)" : "#64748b" }}>Channel Address</label>
              <div className="flex items-center rounded-xl overflow-hidden" style={{ background: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.05)", border: `1px solid ${isDark ? darkBorder : lightBorderMid}` }}>
                <span className="pl-3 text-sm select-none" style={{ color: isDark ? "rgba(238,242,255,0.35)" : "#94a3b8" }}>#</span>
                <input
                  className="flex-1 px-2 py-2.5 text-sm outline-none bg-transparent"
                  style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
                  value={slug}
                  onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugManual(true); setErr(""); }}
                  maxLength={50}
                  placeholder="channel-address"
                />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: isDark ? "rgba(238,242,255,0.5)" : "#64748b" }}>Description</label>
            <textarea
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.05)", color: isDark ? "#eef2ff" : "#0f172a", border: `1px solid ${isDark ? darkBorder : lightBorderMid}` }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={280}
            />
          </div>
          {err && <p className="text-xs" style={{ color: "#f87171" }}>{err}</p>}
        </div>
        <div className="flex gap-2.5 px-5 pb-5">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all" style={{ background: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.06)", color: isDark ? "rgba(238,242,255,0.6)" : "#64748b" }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50" style={{ background: "rgba(99,102,241,0.85)", color: "#fff" }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Group Members Panel ──────────────────────────────────────────────────────

const MUTE_DURATIONS = [
  { label: "5m",  seconds: 300 },
  { label: "30m", seconds: 1800 },
  { label: "1h",  seconds: 3600 },
  { label: "8h",  seconds: 28800 },
  { label: "24h", seconds: 86400 },
];

function GroupMembersPanel({
  members,
  onClose,
  onlineIds,
  avatarMap,
  isDark,
  isChannel,
  myRole,
  currentUserId,
  onKick,
  onRoleChange,
  onMute,
  onTransferOwnership,
  onAddMember,
  allUsers,
}) {
  const [actionTarget, setActionTarget] = useState(null);
  const [muteTarget, setMuteTarget]     = useState(null);
  const [showAdd, setShowAdd]           = useState(false);
  const [addSearch, setAddSearch]       = useState("");
  const [nowSec]                        = useState(() => Math.floor(Date.now() / 1000));

  function canManage(targetRole) {
    if (!myRole || !isChannel) return false;
    return (
      ROLE_LEVEL[myRole] >= ROLE_LEVEL.admin &&
      ROLE_LEVEL[myRole] > ROLE_LEVEL[targetRole] &&
      targetRole !== "owner"
    );
  }

  function canMuteTarget(targetRole) {
    if (!myRole || !isChannel) return false;
    return (
      ROLE_LEVEL[myRole] >= ROLE_LEVEL.moderator &&
      ROLE_LEVEL[myRole] > ROLE_LEVEL[targetRole] &&
      targetRole !== "owner"
    );
  }

  function nextRole(current) {
    if (myRole === "owner") {
      if (current === "member")    return "moderator";
      if (current === "moderator") return "admin";
      if (current === "admin")     return "member";
    } else if (myRole === "admin") {
      if (current === "member")    return "moderator";
      if (current === "moderator") return "member";
    }
    return null;
  }

  const sortedMembers = isChannel
    ? [...members].sort((a, b) => (ROLE_LEVEL[b.role] || 0) - (ROLE_LEVEL[a.role] || 0))
    : members;

  const memberIdSet = new Set(members.map((m) => m.id));
  const addableUsers = (allUsers || [])
    .filter((u) => !memberIdSet.has(u.id) && u.id !== currentUserId)
    .filter((u) => !addSearch || u.username.toLowerCase().includes(addSearch.toLowerCase()))
    .slice(0, 8);

  const btnBase = { color: isDark ? "rgba(165,180,252,0.5)" : "#94a3b8" };
  const btnActive = { background: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)", color: isDark ? "#a5b4fc" : "#6366f1" };

  return (
    <div className="fixed inset-0 z-500 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: isDark ? "rgba(7,13,28,0.88)" : "rgba(15,23,42,0.25)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Members"
        className="relative w-full sm:w-80 max-h-[80dvh] flex flex-col overflow-hidden rounded-2xl animate-scale-in"
        style={{
          background: isDark ? darkBg1 : lightBg1,
          border: `1px solid ${isDark ? darkBorderMid : lightBorderMid}`,
          boxShadow: isDark ? "0 32px 80px rgba(0,0,0,0.7)" : "0 32px 80px rgba(99,102,241,0.12)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b shrink-0" style={{ borderColor: isDark ? darkBorder : lightBorderMid }}>
          <span className="font-semibold text-sm" style={{ color: isDark ? "#eef2ff" : "#0f172a" }}>
            {isChannel ? "Channel Members" : "Members"} ({members.length})
          </span>
          <div className="flex items-center gap-1">
            {isChannel && ROLE_LEVEL[myRole] >= ROLE_LEVEL.admin && (
              <button
                onClick={() => { setShowAdd((v) => !v); setAddSearch(""); }}
                title="Add member"
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                style={showAdd ? btnActive : btnBase}
              >
                <UserPlus size={15} />
              </button>
            )}
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center transition-all" style={btnBase}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Add member search (admin+) */}
        {showAdd && isChannel && ROLE_LEVEL[myRole] >= ROLE_LEVEL.admin && (
          <div className="px-3 pt-2.5 pb-2 border-b shrink-0" style={{ borderColor: isDark ? darkBorder : lightBorderMid }}>
            <input
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.05)", color: isDark ? "#eef2ff" : "#0f172a", border: `1px solid ${isDark ? darkBorder : lightBorderMid}` }}
              placeholder="Search users to add…"
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
            />
            <div className="mt-1.5 max-h-36 overflow-y-auto space-y-0.5">
              {addableUsers.length === 0 ? (
                <p className="text-xs px-2 py-2" style={{ color: isDark ? "rgba(238,242,255,0.3)" : "#94a3b8" }}>
                  {addSearch ? "No users found" : "All users are already members"}
                </p>
              ) : addableUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { onAddMember(u.id); setShowAdd(false); setAddSearch(""); }}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-left transition-all"
                  style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.06)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                >
                  <Avatar userId={u.id} username={u.username} size={28} online={onlineIds.has(u.id)} avatar={avatarMap[u.id]} />
                  <span className="truncate">{u.username}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Member list */}
        <div className="flex-1 min-h-0 overflow-y-auto py-2 px-3 space-y-0.5">
          {sortedMembers.map((m) => {
            const isOnline     = onlineIds.has(m.id);
            const isMe         = m.id === currentUserId;
            const isMuted      = m.muted_until && m.muted_until > nowSec;
            const showManage   = isChannel && !isMe && canManage(m.role);
            const showMuteBtn  = isChannel && !isMe && canMuteTarget(m.role);
            const showActions  = showManage || showMuteBtn;
            const isActing     = actionTarget === m.id;
            const isMutePick   = muteTarget === m.id;
            const promote      = nextRole(m.role);
            const canTransfer  = myRole === "owner" && m.role === "admin";

            return (
              <div key={m.id} className="rounded-xl overflow-hidden">
                {/* Member row */}
                <div
                  className="flex items-center gap-3 px-3 py-2.5 transition-all"
                  onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.04)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                >
                  <Avatar userId={m.id} username={m.username} size={38} online={isOnline} avatar={avatarMap[m.id]} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium truncate" style={{ color: isDark ? "#eef2ff" : "#0f172a" }}>
                        {m.username}
                        {isMe && <span className="ml-1 opacity-40 text-xs">(you)</span>}
                      </span>
                      {isChannel && roleBadge(m.role, isDark)}
                      {isMuted && <VolumeX size={10} style={{ color: "#f87171", flexShrink: 0 }} />}
                    </div>
                    {isOnline && <div className="text-xs text-emerald-400 font-medium">Online</div>}
                  </div>
                  {showActions && (
                    <button
                      onClick={() => { setActionTarget(isActing ? null : m.id); setMuteTarget(null); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 transition-all"
                      style={{ ...btnBase, ...(isActing ? btnActive : {}) }}
                      title="Manage member"
                    >
                      •••
                    </button>
                  )}
                </div>

                {/* Action buttons row */}
                {isActing && showActions && !isMutePick && (
                  <div className="flex flex-wrap gap-1.5 px-3 pb-2.5" style={{ background: isDark ? "rgba(99,102,241,0.04)" : "rgba(99,102,241,0.03)" }}>
                    {showManage && promote && (() => {
                      const isDemotion = ROLE_LEVEL[promote] < ROLE_LEVEL[m.role];
                      return (
                        <button
                          onClick={() => { onRoleChange(m.id, promote); setActionTarget(null); }}
                          className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-all"
                          style={isDemotion
                            ? { background: isDark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)", color: isDark ? "#fca5a5" : "#dc2626" }
                            : { background: isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)", color: isDark ? "#a5b4fc" : "#4f46e5" }}
                        >
                          {isDemotion ? "↓" : "→"} {promote.charAt(0).toUpperCase() + promote.slice(1)}
                        </button>
                      );
                    })()}
                    {canTransfer && (
                      <button
                        onClick={() => { onTransferOwnership(m.id, m.username); setActionTarget(null); onClose(); }}
                        className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}
                      >
                        <Crown size={10} /> Owner
                      </button>
                    )}
                    {showMuteBtn && (
                      <button
                        onClick={() => isMuted ? onMute(m.id, 0) : setMuteTarget(m.id)}
                        className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                        style={isMuted
                          ? { background: "rgba(34,197,94,0.10)", color: "#4ade80" }
                          : { background: "rgba(251,191,36,0.10)", color: "#fbbf24" }}
                      >
                        {isMuted ? <><Volume2 size={10} /> Unmute</> : <><VolumeX size={10} /> Mute</>}
                      </button>
                    )}
                    {showManage && (
                      <button
                        onClick={() => { onKick(m.id); setActionTarget(null); onClose(); }}
                        className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ background: "rgba(239,68,68,0.10)", color: "#f87171" }}
                      >
                        <UserMinus size={10} /> Kick
                      </button>
                    )}
                  </div>
                )}

                {/* Mute duration picker */}
                {isMutePick && (
                  <div className="flex flex-wrap gap-1.5 px-3 pb-2.5" style={{ background: isDark ? "rgba(251,191,36,0.04)" : "rgba(251,191,36,0.03)" }}>
                    {MUTE_DURATIONS.map(({ label, seconds }) => (
                      <button
                        key={label}
                        onClick={() => { onMute(m.id, seconds); setMuteTarget(null); setActionTarget(null); }}
                        className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
                        style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      onClick={() => setMuteTarget(null)}
                      className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                      style={{ color: isDark ? "rgba(238,242,255,0.35)" : "#94a3b8" }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ChatApp({ token, currentUser, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [displayRoomId, setDisplayRoomId] = useState(null);
  const [messages, setMessages] = useState({});
  const [typingMap, setTypingMap] = useState({});
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [allUsers, setAllUsers] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [inputText, setInputText] = useState("");
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearch, setMsgSearch] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem("chatloop_theme") !== "light",
  );
  const [myAvatar, setMyAvatar] = useState(() => currentUser.avatar || null);
  const [groupMembersPanel, setGroupMembersPanel] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState({});
  const [editChannelModal, setEditChannelModal] = useState(null);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [inputError, setInputError] = useState("");
  const [hasMoreMessages, setHasMoreMessages] = useState({});
  const [loadingMore, setLoadingMore] = useState({});
  const [toasts, setToasts] = useState([]);

  function addToast(message) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem("chatloop_theme", next ? "dark" : "light");
      return next;
    });
  }

  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const avatarFileRef = useRef(null);
  const loadedRoomsRef = useRef(new Set());
  const activeRoomIdRef = useRef(null);
  const closeTimerRef = useRef(null);
  const longPressTimerRef = useRef(null);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  }, []);

  // Track the visual viewport so the chat panel stays locked to the visible
  // screen area when the software keyboard opens.
  // --vvt = offsetTop: how far iOS panned the visual viewport upward (panel top)
  // --vvh = height:    actual visible height above keyboard (inner content height)
  // Both update in the same handler so they're always in sync.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const root = document.documentElement;
      root.style.setProperty("--vvt", `${vv.offsetTop}px`);
      root.style.setProperty("--vvh", `${vv.height}px`);
      // After the panel resizes, snap scroll to the last message so it stays visible
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // ── Socket setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = connectSocket(token);
    socketRef.current = s;

    s.on("message:new", ({ roomId, message }) => {
      setMessages((prev) => ({
        ...prev,
        [roomId]: [...(prev[roomId] || []), message],
      }));
      setRooms((prev) =>
        prev
          .map((r) =>
            r.id === roomId
              ? {
                  ...r,
                  last_message: message.text,
                  last_message_at: message.created_at,
                }
              : r,
          )
          .sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0)),
      );
      if (roomId !== activeRoomIdRef.current) {
        setUnreadCounts((prev) => ({
          ...prev,
          [roomId]: (prev[roomId] || 0) + 1,
        }));
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted" &&
          document.hidden
        ) {
          new Notification(message.username, { body: message.text });
        }
      }
    });

    s.on("message:ack", ({ tempId, message, roomId }) => {
      setMessages((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || []).map((m) =>
          m.id === tempId ? message : m,
        ),
      }));
      setRooms((prev) =>
        prev
          .map((r) =>
            r.id === roomId
              ? {
                  ...r,
                  last_message: message.text,
                  last_message_at: message.created_at,
                }
              : r,
          )
          .sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0)),
      );
    });

    s.on("message:reaction", ({ roomId, messageId, emoji }) => {
      setMessages((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || []).map((m) =>
          m.id === messageId ? { ...m, reaction: emoji } : m,
        ),
      }));
    });

    s.on("typing:update", ({ roomId, userId, username, typing }) => {
      setTypingMap((prev) => {
        const current = (prev[roomId] || []).filter((u) => u.userId !== userId);
        return {
          ...prev,
          [roomId]: typing ? [...current, { userId, username }] : current,
        };
      });
    });

    s.on("user:status", ({ userId, online }) => {
      setOnlineIds((prev) => {
        const next = new Set(prev);
        online ? next.add(userId) : next.delete(userId);
        return next;
      });
    });

    s.on("room:new", (data) => {
      api.getRooms().then(setRooms).catch(console.error);
      if (
        data.isGroup &&
        data.addedBy &&
        data.addedBy !== currentUser.username
      ) {
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification(`Added to "${data.groupName}"`, {
            body: `${data.addedBy} added you to this group`,
          });
        }
      }
    });

    s.on("message:deleted", ({ roomId, messageId }) => {
      setMessages((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || []).filter((m) => m.id !== messageId),
      }));
    });

    s.on("room:deleted", ({ roomId }) => {
      loadedRoomsRef.current.delete(roomId);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      if (activeRoomIdRef.current === roomId) {
        setActiveRoomId(null);
        setTimeout(() => setDisplayRoomId(null), 200);
      }
    });

    s.on("room:member_left", ({ roomId, username }) => {
      setMessages((prev) => ({
        ...prev,
        [roomId]: [
          ...(prev[roomId] || []),
          {
            id: `sys_${Date.now()}`,
            text: `${username} left the group`,
            system: true,
            created_at: Math.floor(Date.now() / 1000),
          },
        ],
      }));
    });

    s.on("contact:request", () => {
      api.getUsers().then(setAllUsers).catch(console.error);
    });

    s.on("contact:accepted", () => {
      api
        .getUsers()
        .then((users) => {
          setAllUsers(users);
          setOnlineIds(new Set(users.filter((u) => u.online).map((u) => u.id)));
        })
        .catch(console.error);
    });

    s.on("user:avatar", ({ userId, avatar }) => {
      setAllUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, avatar } : u)),
      );
      if (userId === currentUser.id) setMyAvatar(avatar);
    });

    s.on("message:error", ({ tempId, error }) => {
      setMessages((prev) => {
        const next = { ...prev };
        for (const roomId of Object.keys(next)) {
          if (Array.isArray(next[roomId])) {
            next[roomId] = next[roomId].filter((m) => m.id !== tempId);
          }
        }
        return next;
      });
      if (error) {
        setInputError(error);
        setTimeout(() => setInputError(""), 4000);
      }
    });

    s.on("channel:member_kicked", ({ roomId, kickedUserId }) => {
      if (kickedUserId === currentUser.id) {
        loadedRoomsRef.current.delete(roomId);
        setRooms((prev) => prev.filter((r) => r.id !== roomId));
        if (activeRoomIdRef.current === roomId) {
          setActiveRoomId(null);
          setTimeout(() => setDisplayRoomId(null), 200);
        }
      } else {
        setMessages((prev) => ({
          ...prev,
          [roomId]: [
            ...(prev[roomId] || []),
            {
              id: `sys_${Date.now()}`,
              text: `A member was removed from the channel`,
              system: true,
              created_at: Math.floor(Date.now() / 1000),
            },
          ],
        }));
        setGroupMembersPanel((prev) =>
          prev?.roomId === roomId
            ? {
                ...prev,
                members: prev.members.filter((m) => m.id !== kickedUserId),
              }
            : prev,
        );
      }
    });

    s.on("channel:role_changed", ({ roomId, userId, role, changedBy, channelName, transferredTo }) => {
      setGroupMembersPanel((prev) =>
        prev?.roomId === roomId
          ? {
              ...prev,
              members: prev.members.map((m) =>
                m.id === userId ? { ...m, role } : m,
              ),
            }
          : prev,
      );

      if (userId === currentUser.id) {
        const roleName = role.charAt(0).toUpperCase() + role.slice(1);
        const article = /^[aeiou]/i.test(role) ? "an" : "a";
        const isOwnTransfer = !!(transferredTo && changedBy === currentUser.username);

        // Text stored in rooms state for the sidebar indicator
        const notifText = isOwnTransfer
          ? `You transferred ownership to ${transferredTo}`
          : role === "owner"
            ? `${changedBy} made you the Owner`
            : `${changedBy} made you ${article} ${roleName}`;

        setRooms((prev) =>
          prev.map((r) =>
            r.id === roomId ? { ...r, role, role_notification: notifText } : r,
          ),
        );

        const desktopTitle = isOwnTransfer
          ? `You made ${transferredTo} the Owner of #${channelName}`
          : `Your role in #${channelName} changed`;
        const desktopBody = isOwnTransfer
          ? `You are now an Admin`
          : changedBy
            ? `${changedBy} made you ${article} ${roleName}`
            : `You are now ${article} ${roleName}`;
        const toastMsg = isOwnTransfer
          ? `You made ${transferredTo} the Owner of #${channelName}`
          : changedBy
            ? `${changedBy} made you ${article} ${roleName} in #${channelName}`
            : `You are now ${article} ${roleName} in #${channelName}`;

        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(desktopTitle, { body: desktopBody });
        }
        addToast(toastMsg);
      }
    });

    s.on("channel:member_joined", ({ roomId, username }) => {
      setMessages((prev) => ({
        ...prev,
        [roomId]: [
          ...(prev[roomId] || []),
          {
            id: `sys_${Date.now()}`,
            text: `${username} joined the channel`,
            system: true,
            created_at: Math.floor(Date.now() / 1000),
          },
        ],
      }));
    });

    s.on("channel:member_left", ({ roomId, username }) => {
      setMessages((prev) => ({
        ...prev,
        [roomId]: [
          ...(prev[roomId] || []),
          { id: `sys_${Date.now()}`, text: `${username} left the channel`, system: true, created_at: Math.floor(Date.now() / 1000) },
        ],
      }));
    });

    s.on("channel:member_muted", ({ roomId, userId, mutedUntil }) => {
      setGroupMembersPanel((prev) =>
        prev?.roomId === roomId
          ? { ...prev, members: prev.members.map((m) => m.id === userId ? { ...m, muted_until: mutedUntil } : m) }
          : prev,
      );
    });

    s.on("channel:message_pinned", ({ roomId, pinned }) => {
      setPinnedMessages((prev) => ({
        ...prev,
        [roomId]: [pinned, ...(prev[roomId] || [])],
      }));
    });

    s.on("channel:message_unpinned", ({ roomId, messageId }) => {
      setPinnedMessages((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || []).filter((p) => p.message_id !== messageId),
      }));
    });

    s.on("channel:updated", ({ roomId, name, description, slug }) => {
      setRooms((prev) => prev.map((r) => r.id === roomId ? { ...r, name, description, ...(slug !== undefined && { slug }) } : r));
    });

    s.on("channel:added", ({ room, addedBy }) => {
      if (room) api.getRooms().then(setRooms).catch(console.error);
      if (addedBy && addedBy !== currentUser.username) {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(`Added to "#${room?.name}"`, {
            body: `${addedBy} added you to this channel`,
          });
        }
        addToast(`${addedBy} added you to #${room?.name}`);
      }
    });

    return () => {
      s.off("message:new");
      s.off("message:ack");
      s.off("message:reaction");
      s.off("typing:update");
      s.off("user:status");
      s.off("room:new");
      s.off("message:deleted");
      s.off("room:deleted");
      s.off("room:member_left");
      s.off("contact:request");
      s.off("contact:accepted");
      s.off("user:avatar");
      s.off("message:error");
      s.off("channel:member_kicked");
      s.off("channel:role_changed");
      s.off("channel:member_joined");
      s.off("channel:member_left");
      s.off("channel:member_muted");
      s.off("channel:message_pinned");
      s.off("channel:message_unpinned");
      s.off("channel:updated");
      s.off("channel:added");
      disconnectSocket();
    };
  }, [token, currentUser.id, currentUser.username]);

  // ── Load rooms + users ────────────────────────────────────────────────────────
  useEffect(() => {
    api
      .getRooms()
      .then((loadedRooms) => {
        setRooms(loadedRooms);
        const savedId = Number(localStorage.getItem("chatloop_active_room"));
        if (savedId && loadedRooms.some((r) => r.id === savedId)) {
          setActiveRoomId(savedId);
          setDisplayRoomId(savedId);
        }
      })
      .catch(console.error);
    api
      .getUsers()
      .then((users) => {
        setAllUsers(users);
        setOnlineIds(new Set(users.filter((u) => u.online).map((u) => u.id)));
      })
      .catch(console.error);
  }, []);

  // ── Load messages on room change ──────────────────────────────────────────────
  useEffect(() => {
    if (!activeRoomId || loadedRoomsRef.current.has(activeRoomId)) return;
    loadedRoomsRef.current.add(activeRoomId);
    api
      .getMessages(activeRoomId)
      .then(({ messages: msgs, hasMore }) => {
        setMessages((prev) => ({ ...prev, [activeRoomId]: msgs }));
        setHasMoreMessages((prev) => ({ ...prev, [activeRoomId]: hasMore }));
      })
      .catch((err) => {
        loadedRoomsRef.current.delete(activeRoomId);
        console.error(err);
      });
  }, [activeRoomId]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeRoomId)
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [activeRoomId]);
  useEffect(() => {
    if (activeRoomId)
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeRoomId, messages]);

  // ── Tab title ─────────────────────────────────────────────────────────────────
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Chatloop` : "Chatloop";
  }, [totalUnread]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const stopTyping = useCallback(() => {
    clearTimeout(typingTimerRef.current);
    if (isTypingRef.current && activeRoomId && socketRef.current) {
      isTypingRef.current = false;
      socketRef.current.emit("typing:stop", { roomId: activeRoomId });
    }
  }, [activeRoomId]);

  async function loadEarlierMessages() {
    if (!displayRoomId || loadingMore[displayRoomId]) return;
    const earliest = messages[displayRoomId]?.[0];
    if (!earliest) return;
    setLoadingMore((prev) => ({ ...prev, [displayRoomId]: true }));
    try {
      const { messages: older, hasMore } = await api.getMessages(
        displayRoomId,
        earliest.created_at,
      );
      setMessages((prev) => ({
        ...prev,
        [displayRoomId]: [...older, ...(prev[displayRoomId] || [])],
      }));
      setHasMoreMessages((prev) => ({ ...prev, [displayRoomId]: hasMore }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore((prev) => ({ ...prev, [displayRoomId]: false }));
    }
  }

  const sendMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text || !activeRoomId || !socketRef.current) return;
    if (text.length > 4000) return;
    const tempId = `temp_${Date.now()}`;
    const tempMsg = {
      id: tempId,
      text,
      user_id: currentUser.id,
      username: currentUser.username,
      created_at: Math.floor(Date.now() / 1000),
      reaction: null,
      temp: true,
    };
    setMessages((prev) => ({
      ...prev,
      [activeRoomId]: [...(prev[activeRoomId] || []), tempMsg],
    }));
    socketRef.current.emit("message:send", {
      roomId: activeRoomId,
      text,
      tempId,
    });
    setInputText("");
    stopTyping();
    inputRef.current?.focus();
  }, [inputText, activeRoomId, currentUser, stopTyping]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  function startTyping() {
    if (!activeRoomId || !socketRef.current) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socketRef.current.emit("typing:start", { roomId: activeRoomId });
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(stopTyping, 2500);
  }

  function handleInputChange(e) {
    setInputText(e.target.value);
    if (e.target.value) startTyping();
    else stopTyping();
  }

  // Reset height after send (inputText cleared to "")
  useEffect(() => {
    const el = inputRef.current;
    if (!el || inputText !== "") return;
    el.style.height = "auto";
  }, [inputText]);

  const handleContextMenu = useCallback((e, msg) => {
    e.preventDefault();
    setContextMenu({ msg, x: e.clientX, y: e.clientY });
  }, []);

  function handleReact(messageId, emoji) {
    socketRef.current?.emit("message:react", { messageId, emoji });
  }

  function handleCopy(text) {
    navigator.clipboard.writeText(text).catch(console.error);
  }

  function resizeImage(file, maxPx) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas
          .getContext("2d")
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };
      img.src = url;
    });
  }

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const dataUrl = await resizeImage(file, 256);
    setMyAvatar(dataUrl);
    const updated = { ...currentUser, avatar: dataUrl };
    localStorage.setItem("chatloop_user", JSON.stringify(updated));
    api.uploadAvatar(dataUrl).catch(console.error);
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

  function handleDeleteRoom(roomId) {
    const room = rooms.find((r) => r.id === roomId);
    const isGroup = !!room?.is_group;
    const isChannel =
      room?.type === "channel" || room?.type === "private_channel";
    const amOwner = isChannel && room?.role === "owner";
    setConfirmModal({
      title: isChannel
        ? amOwner
          ? "Delete channel?"
          : "Leave channel?"
        : isGroup
          ? "Leave group?"
          : "Delete conversation?",
      body: isChannel
        ? amOwner
          ? "This will permanently delete the channel and all its messages for everyone."
          : "You'll be removed from the channel."
        : isGroup
          ? "You'll be removed from the group. If only one member remains after you leave, the group will be deleted for everyone."
          : "This conversation will be permanently deleted. Neither of you will be able to see the messages again.",
      confirmLabel: amOwner ? "Delete" : isGroup ? "Leave" : "Delete",
      onConfirm: async () => {
        closeRoom();
        setRooms((prev) => prev.filter((r) => r.id !== roomId));
        try {
          await api.deleteRoom(roomId);
        } catch (err) {
          console.error(err);
          api.getRooms().then(setRooms).catch(console.error);
        }
      },
    });
  }

  async function handleSelectUser(user) {
    setShowNewChat(false);
    const existing = rooms.find(
      (r) => !r.is_group && r.other_user_id === user.id,
    );
    if (existing) {
      selectRoom(existing.id);
      return;
    }
    try {
      const { roomId } = await api.createDM(user.id);
      selectRoom(roomId);
      api.getRooms().then(setRooms).catch(console.error);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSendRequest(contactId) {
    setAllUsers((prev) =>
      prev.map((u) =>
        u.id === contactId ? { ...u, contact_status: "pending_sent" } : u,
      ),
    );
    try {
      await api.sendContactRequest(contactId);
      api.getUsers().then(setAllUsers).catch(console.error);
    } catch (err) {
      setAllUsers((prev) =>
        prev.map((u) =>
          u.id === contactId ? { ...u, contact_status: null } : u,
        ),
      );
      throw err;
    }
  }

  async function handleAcceptContact(requesterId) {
    try {
      await api.acceptContact(requesterId);
      const users = await api.getUsers();
      setAllUsers(users);
      setOnlineIds(new Set(users.filter((u) => u.online).map((u) => u.id)));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRemoveContact(contactId) {
    try {
      await api.removeContact(contactId);
      api.getUsers().then(setAllUsers).catch(console.error);
    } catch (err) {
      console.error(err);
    }
  }

  async function openGroupMembers() {
    if (!displayRoomId) return;
    try {
      const members = await api.getRoomMembers(displayRoomId);
      setGroupMembersPanel({ roomId: displayRoomId, members });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateChannel(name, slug, description, isPrivate) {
    setShowNewChat(false);
    const { roomId } = await api.createChannel(name, slug, description, isPrivate);
    selectRoom(roomId);
    api.getRooms().then(setRooms).catch(console.error);
  }

  async function handleJoinChannel(slug) {
    const { roomId } = await api.joinChannel(slug);
    setShowNewChat(false);
    selectRoom(roomId);
    api.getRooms().then(setRooms).catch(console.error);
  }

  async function handleKickMember(userId) {
    if (!displayRoomId) return;
    try {
      await api.kickChannelMember(displayRoomId, userId);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRoleChange(userId, role) {
    if (!displayRoomId) return;
    try {
      await api.setMemberRole(displayRoomId, userId, role);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleMuteUser(userId, duration) {
    if (!displayRoomId) return;
    try {
      await api.muteChannelMember(displayRoomId, userId, duration);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddMember(userId) {
    if (!displayRoomId) return;
    try {
      await api.addChannelMember(displayRoomId, userId);
      const members = await api.getRoomMembers(displayRoomId);
      setGroupMembersPanel((prev) => prev ? { ...prev, members } : prev);
    } catch (err) {
      console.error(err);
    }
  }

  function handleTransferOwnership(userId, username) {
    setConfirmModal({
      title: "Transfer Ownership",
      body: `Transfer channel ownership to ${username}? You will become an Admin. This cannot be undone without their cooperation.`,
      confirmLabel: "Transfer",
      onConfirm: async () => {
        try {
          await api.setMemberRole(displayRoomId, userId, "owner");
          // Immediately revoke owner-level UI access; socket confirms the rest
          setRooms((prev) =>
            prev.map((r) => r.id === displayRoomId ? { ...r, role: "admin" } : r),
          );
          setGroupMembersPanel((prev) =>
            prev?.roomId === displayRoomId
              ? {
                  ...prev,
                  members: prev.members.map((m) =>
                    m.id === currentUser.id ? { ...m, role: "admin" } : m,
                  ),
                }
              : prev,
          );
        } catch (err) {
          console.error(err);
        }
        setConfirmModal(null);
      },
    });
  }

  async function handleEditChannel(name, description, slug) {
    if (!displayRoomId) return;
    try {
      await api.editChannel(displayRoomId, name, description, slug);
      setEditChannelModal(null);
    } catch (err) {
      throw err;
    }
  }

  async function handlePinMessage(messageId) {
    if (!displayRoomId) return;
    try {
      await api.pinMessage(displayRoomId, messageId);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleUnpinMessage(messageId) {
    if (!displayRoomId) return;
    try {
      await api.unpinMessage(displayRoomId, messageId);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateGroup(userIds, name) {
    setShowNewChat(false);
    try {
      const { roomId } = await api.createGroup(userIds, name);
      selectRoom(roomId);
      api.getRooms().then(setRooms).catch(console.error);
    } catch (err) {
      console.error(err);
    }
  }

  function selectRoom(roomId) {
    clearTimeout(closeTimerRef.current);
    setDisplayRoomId(roomId);
    setActiveRoomId(roomId);
    setUnreadCounts((prev) => ({ ...prev, [roomId]: 0 }));
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId ? { ...r, is_new: 0, role_notification: null } : r,
      ),
    );
    setShowMsgSearch(false);
    setMsgSearch("");
    stopTyping();
    localStorage.setItem("chatloop_active_room", String(roomId));
    const room = rooms.find((r) => r.id === roomId);
    if (room?.type === "channel" || room?.type === "private_channel") {
      api.getPinnedMessages(roomId)
        .then((pins) => setPinnedMessages((prev) => ({ ...prev, [roomId]: pins })))
        .catch(console.error);
    }
  }

  function closeRoom() {
    stopTyping();
    setActiveRoomId(null);
    closeTimerRef.current = setTimeout(() => setDisplayRoomId(null), 200);
    setShowMsgSearch(false);
    setMsgSearch("");
    localStorage.removeItem("chatloop_active_room");
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const contacts = allUsers.filter((u) => u.contact_status === "accepted");
  const pendingUsers = allUsers.filter(
    (u) => u.contact_status === "pending_received",
  );
  const pendingRequestCount = pendingUsers.length;
  const avatarMap = useMemo(() => {
    const map = {};
    allUsers.forEach((u) => {
      if (u.avatar) map[u.id] = u.avatar;
    });
    if (myAvatar) map[currentUser.id] = myAvatar;
    return map;
  }, [allUsers, myAvatar, currentUser.id]);

  const activeRoom = rooms.find((r) => r.id === displayRoomId) || null;
  const activeMessages = displayRoomId ? messages[displayRoomId] || [] : [];
  const displayedMessages =
    showMsgSearch && msgSearch.trim()
      ? activeMessages.filter(
          (m) =>
            !m.system && m.text.toLowerCase().includes(msgSearch.toLowerCase()),
        )
      : activeMessages;

  const typingNames = displayRoomId
    ? (typingMap[displayRoomId] || [])
        .filter((u) => u.userId !== currentUser.id)
        .map((u) => u.username)
    : [];

  const isActiveChannel =
    activeRoom?.type === "channel" || activeRoom?.type === "private_channel";
  const myActiveRole = activeRoom?.role || null;

  const activeRoomName = activeRoom
    ? isActiveChannel
      ? activeRoom.name || activeRoom.slug
      : activeRoom.is_group
        ? activeRoom.name || "Group Chat"
        : activeRoom.other_username || "Unknown"
    : "";

  const activeRoomOnline =
    activeRoom && !activeRoom.is_group
      ? onlineIds.has(activeRoom.other_user_id)
      : false;

  const activeAvatarId = activeRoom
    ? activeRoom.is_group
      ? activeRoom.id
      : activeRoom.other_user_id
    : null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      data-theme={isDark ? "dark" : "light"}
      className="relative w-full h-dvh overflow-hidden"
      style={{ background: isDark ? darkBg0 : lightBg0 }}
    >
      {/* Orbital Hub — always in background */}
      <OrbitalHub
        rooms={rooms}
        onSelectRoom={selectRoom}
        onNewChat={() => setShowNewChat(true)}
        onLogout={onLogout}
        currentUser={currentUser}
        onlineIds={onlineIds}
        unreadCounts={unreadCounts}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        pendingCount={pendingRequestCount}
        pendingUsers={pendingUsers}
        onAcceptContact={handleAcceptContact}
        onRemoveContact={handleRemoveContact}
        avatarMap={avatarMap}
        myAvatar={myAvatar}
        onAvatarClick={() => avatarFileRef.current?.click()}
      />
      <input
        ref={avatarFileRef}
        type="file"
        accept="image/*"
        aria-label="Upload profile picture"
        className="hidden"
        onChange={handleAvatarFile}
      />

      {/* Solid backdrop — covers the orbital hub completely whenever a chat is
          open, including during the fade-in transition and the iOS keyboard
          accessory-bar gap that sits below --vvh */}
      {displayRoomId && (
        <div
          className="fixed inset-0 z-199 pointer-events-none"
          style={{ background: isDark ? darkBg0 : lightBg0 }}
        />
      )}

      {/* Chat Panel
          Outer: top=--vvt so the panel tracks iOS visual viewport pan.
          Inner: height=--vvh (actual visible height above keyboard) so the
          flex column is sized to exactly what the user can see. Without this,
          justify-end pushes messages below the keyboard fold. */}
      <div
        className="fixed left-0 right-0 z-200 pointer-events-none"
        style={{
          top: "var(--vvt, 0px)",
          height: "100dvh",
          // Cover the gap between --vvh bottom and the keyboard (iOS accessory bar
          // area) so the orbital hub never bleeds through when keyboard is open
          background: displayRoomId
            ? isDark
              ? darkBg0
              : lightBg0
            : "transparent",
        }}
      >
        <div
          className={`absolute top-0 left-0 right-0 flex flex-col transition-opacity duration-200 ${activeRoomId ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          style={{
            height: "var(--vvh, 100dvh)",
            background: isDark ? darkBg0 : lightBg0,
          }}
        >
          {displayRoomId && activeRoom && (
            <>
              {/* Chat header */}
              <div
                className="flex items-center gap-1.5 sm:gap-3 px-3 sm:px-4 py-3.5 border-b shrink-0"
                style={{
                  borderColor: isDark ? darkBorder : lightBorderMid,
                  background: isDark ? darkBg0 : lightBg1,
                }}
              >
                <button
                  onClick={closeRoom}
                  aria-label="Back to conversations"
                  className="w-11 h-11 rounded-full flex items-center justify-center transition-all shrink-0"
                  style={{
                    color: isDark ? "rgba(238,242,255,0.5)" : "#64748b",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark
                      ? "rgba(99,102,241,0.1)"
                      : "rgba(99,102,241,0.07)";
                    e.currentTarget.style.color = isDark
                      ? "#eef2ff"
                      : "#0f172a";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "";
                    e.currentTarget.style.color = isDark
                      ? "rgba(238,242,255,0.5)"
                      : "#64748b";
                  }}
                >
                  <ArrowLeft size={18} />
                </button>
                <Avatar
                  userId={activeAvatarId}
                  username={activeRoomName}
                  size={40}
                  online={activeRoomOnline}
                  avatar={avatarMap[activeAvatarId]}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="font-semibold text-sm truncate"
                      style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
                    >
                      {activeRoomName}
                    </span>
                    {isActiveChannel &&
                      activeRoom.type === "private_channel" && (
                        <Lock
                          size={11}
                          style={{
                            color: isDark
                              ? "rgba(165,180,252,0.35)"
                              : "#94a3b8",
                            flexShrink: 0,
                          }}
                        />
                      )}
                  </div>
                  <div className="text-xs mt-0.5">
                    {typingNames.length > 0 ? (
                      <TypingIndicator names={typingNames} isDark={isDark} />
                    ) : (
                      <span
                        className="truncate block"
                        style={{
                          color: activeRoomOnline
                            ? "#34d399"
                            : isDark
                              ? "rgba(165,180,252,0.4)"
                              : "#94a3b8",
                        }}
                      >
                        {isActiveChannel
                          ? activeRoom.description || activeRoom.name || "Channel"
                          : activeRoom.is_group
                            ? "Group chat"
                            : activeRoomOnline
                              ? "Active now"
                              : "Offline"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Header action buttons */}
                {[
                  {
                    icon: <Search size={16} />,
                    active: showMsgSearch,
                    onClick: () => {
                      setShowMsgSearch((v) => !v);
                      setMsgSearch("");
                    },
                    title: "Search messages",
                    show: true,
                  },
                  {
                    icon: <Pencil size={16} />,
                    active: false,
                    onClick: () => setEditChannelModal({ name: activeRoom.name || "", description: activeRoom.description || "", slug: activeRoom.slug || "" }),
                    title: "Edit channel",
                    show: !!isActiveChannel && ROLE_LEVEL[myActiveRole] >= ROLE_LEVEL.admin,
                  },
                  {
                    icon: copiedSlug ? <Check size={16} /> : <Copy size={16} />,
                    active: copiedSlug,
                    onClick: () => {
                      navigator.clipboard
                        .writeText(`#${activeRoom.slug}`)
                        .catch(console.error);
                      setCopiedSlug(true);
                      setTimeout(() => setCopiedSlug(false), 2000);
                    },
                    title: copiedSlug ? "Copied!" : `Copy channel address (#${activeRoom.slug})`,
                    show: !!isActiveChannel,
                  },
                  {
                    icon: <Users size={16} />,
                    active: false,
                    onClick: openGroupMembers,
                    title: "View members",
                    show: !!activeRoom.is_group,
                  },
                  {
                    icon: <Trash2 size={16} />,
                    active: false,
                    onClick: () => handleDeleteRoom(activeRoomId),
                    title: isActiveChannel
                      ? myActiveRole === "owner"
                        ? "Delete channel"
                        : "Leave channel"
                      : "Delete chat",
                    danger: true,
                    show: true,
                  },
                ]
                  .filter((b) => b.show)
                  .map((btn, i) => (
                    <button
                      key={i}
                      onClick={btn.onClick}
                      title={btn.title}
                      aria-label={btn.title}
                      className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all shrink-0"
                      style={{
                        background: btn.active
                          ? isDark
                            ? "rgba(99,102,241,0.15)"
                            : "rgba(99,102,241,0.1)"
                          : "transparent",
                        color: btn.active
                          ? isDark
                            ? "#a5b4fc"
                            : "#6366f1"
                          : isDark
                            ? "rgba(238,242,255,0.4)"
                            : "#94a3b8",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = btn.danger
                          ? "rgba(239,68,68,0.1)"
                          : isDark
                            ? "rgba(99,102,241,0.1)"
                            : "rgba(99,102,241,0.07)";
                        e.currentTarget.style.color = btn.danger
                          ? "#f87171"
                          : isDark
                            ? "#a5b4fc"
                            : "#6366f1";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = btn.active
                          ? isDark
                            ? "rgba(99,102,241,0.15)"
                            : "rgba(99,102,241,0.1)"
                          : "transparent";
                        e.currentTarget.style.color = btn.active
                          ? isDark
                            ? "#a5b4fc"
                            : "#6366f1"
                          : isDark
                            ? "rgba(238,242,255,0.4)"
                            : "#94a3b8";
                      }}
                    >
                      {btn.icon}
                    </button>
                  ))}
              </div>

              {/* Message search bar */}
              {showMsgSearch && (
                <div
                  className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0"
                  style={{
                    borderColor: isDark ? darkBorder : lightBorderMid,
                    background: isDark ? darkBg2 : "#f8fafc",
                  }}
                >
                  <Search
                    size={13}
                    className="shrink-0"
                    style={{
                      color: isDark ? "rgba(165,180,252,0.4)" : "#94a3b8",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search messages…"
                    value={msgSearch}
                    onChange={(e) => setMsgSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
                  />
                  <button
                    onClick={() => {
                      setShowMsgSearch(false);
                      setMsgSearch("");
                    }}
                    aria-label="Close search"
                    className="w-11 h-11 flex items-center justify-center shrink-0"
                    style={{
                      color: isDark ? "rgba(165,180,252,0.4)" : "#94a3b8",
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Pinned message banner (channels only) */}
              {isActiveChannel && (pinnedMessages[displayRoomId] || []).length > 0 && (() => {
                const latest = pinnedMessages[displayRoomId][0];
                return (
                  <div
                    className="flex items-center gap-2.5 px-4 py-2 border-b shrink-0"
                    style={{ borderColor: isDark ? darkBorder : lightBorderMid, background: isDark ? "rgba(251,191,36,0.05)" : "rgba(251,191,36,0.06)" }}
                  >
                    <Pin size={12} style={{ color: "#fbbf24", flexShrink: 0 }} />
                    <p className="flex-1 text-xs truncate" style={{ color: isDark ? "rgba(238,242,255,0.7)" : "#475569" }}>
                      <span className="font-semibold" style={{ color: isDark ? "#fbbf24" : "#b45309" }}>Pinned: </span>
                      {latest.text}
                    </p>
                    {ROLE_LEVEL[myActiveRole] >= ROLE_LEVEL.moderator && (
                      <button
                        onClick={() => handleUnpinMessage(latest.message_id)}
                        className="shrink-0 transition-all"
                        style={{ color: isDark ? "rgba(238,242,255,0.3)" : "#94a3b8" }}
                        title="Unpin"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Messages — layered: dot-grid texture + fade edges + scroll area */}
              <div
                className="flex-1 relative overflow-hidden"
                style={{ background: isDark ? darkBg0 : lightBg0 }}
              >
                {/* Dot grid texture */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `radial-gradient(circle, ${isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.055)"} 1px, transparent 1px)`,
                    backgroundSize: "28px 28px",
                  }}
                />
                {/* Top fade */}
                <div
                  className="absolute top-0 left-0 right-0 h-10 z-10 pointer-events-none"
                  style={{
                    background: `linear-gradient(to bottom, ${isDark ? darkBg0 : lightBg0}, transparent)`,
                  }}
                />
                {/* Scroll container */}
                <div className="absolute inset-0 overflow-y-auto px-4 py-4 no-scrollbar">
                  <div className="relative flex flex-col justify-end min-h-full gap-2.5">
                    {hasMoreMessages[displayRoomId] && (
                      <div className="flex justify-center py-2 shrink-0">
                        <button
                          onClick={loadEarlierMessages}
                          disabled={loadingMore[displayRoomId]}
                          className="text-xs px-4 py-1.5 rounded-full transition-all disabled:opacity-40"
                          style={{
                            color: isDark ? "rgba(165,180,252,0.7)" : "#6366f1",
                            background: isDark
                              ? "rgba(99,102,241,0.08)"
                              : "rgba(99,102,241,0.06)",
                            border: `1px solid ${isDark ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.2)"}`,
                          }}
                        >
                          {loadingMore[displayRoomId]
                            ? "Loading…"
                            : "↑ Load earlier messages"}
                        </button>
                      </div>
                    )}
                    {displayedMessages.length === 0 &&
                      messages[activeRoomId] !== undefined && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                          <div
                            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                            style={{
                              background: userBg(activeAvatarId),
                              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                            }}
                          >
                            <span className="text-white text-xl font-bold">
                              {initials(activeRoomName)}
                            </span>
                          </div>
                          <p
                            className="text-sm font-medium"
                            style={{
                              color: isDark
                                ? "rgba(238,242,255,0.55)"
                                : "#475569",
                            }}
                          >
                            {activeRoomName}
                          </p>
                          <p
                            className="text-xs mt-1"
                            style={{
                              color: isDark
                                ? "rgba(165,180,252,0.3)"
                                : "#94a3b8",
                            }}
                          >
                            {msgSearch
                              ? "No matching messages"
                              : "No messages yet — say hello! 👋"}
                          </p>
                        </div>
                      )}

                    {displayedMessages.map((msg, index) => {
                      const prev = displayedMessages[index - 1];
                      const showSeparator =
                        !!msg.created_at &&
                        (!prev ||
                          dayKey(msg.created_at) !== dayKey(prev.created_at));
                      const dateSeparator = showSeparator && (
                        <div className="flex justify-center py-3">
                          <span
                            className="text-[11px] px-3 py-1 rounded-full select-none"
                            style={{
                              background: isDark
                                ? "rgba(99,102,241,0.08)"
                                : "rgba(0,0,0,0.06)",
                              color: isDark
                                ? "rgba(165,180,252,0.55)"
                                : "#64748b",
                            }}
                          >
                            {formatDateSeparator(msg.created_at)}
                          </span>
                        </div>
                      );
                      if (msg.system) {
                        return (
                          <Fragment key={msg.id}>
                            {dateSeparator}
                            <div className="flex justify-center py-1">
                              <span
                                className="text-xs px-3 py-1 rounded-full"
                                style={{
                                  background: isDark
                                    ? "rgba(99,102,241,0.08)"
                                    : "rgba(99,102,241,0.06)",
                                  color: isDark
                                    ? "rgba(165,180,252,0.5)"
                                    : "#6366f1",
                                  border: `1px solid ${isDark ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.12)"}`,
                                }}
                              >
                                {msg.text}
                              </span>
                            </div>
                          </Fragment>
                        );
                      }
                      const isMine = msg.user_id === currentUser.id;
                      const isTemp = !!msg.temp;
                      return (
                        <Fragment key={msg.id}>
                          {dateSeparator}
                          <div
                            className={`relative flex w-full items-end gap-2 animate-fade-in-up ${isMine ? "flex-row-reverse" : "flex-row"} ${msg.reaction ? "mb-3 z-1" : ""}`}
                            onContextMenu={(e) =>
                              !isTemp && handleContextMenu(e, msg)
                            }
                            onTouchStart={(e) => {
                              if (isTemp) return;
                              const touch = e.touches[0];
                              const x = touch.clientX;
                              const y = touch.clientY;
                              longPressTimerRef.current = setTimeout(() => {
                                setContextMenu({ msg, x, y });
                              }, 500);
                            }}
                            onTouchEnd={() =>
                              clearTimeout(longPressTimerRef.current)
                            }
                            onTouchMove={() =>
                              clearTimeout(longPressTimerRef.current)
                            }
                            onTouchCancel={() =>
                              clearTimeout(longPressTimerRef.current)
                            }
                          >
                            <div
                              className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[78%]`}
                            >
                              {!isMine && !!activeRoom.is_group && (
                                <span
                                  className="text-[11px] mb-1 ml-1 font-medium"
                                  style={{
                                    color: isDark
                                      ? "rgba(165,180,252,0.5)"
                                      : "#94a3b8",
                                  }}
                                >
                                  {msg.username}
                                </span>
                              )}
                              <div className="relative">
                                <div
                                  className={`px-4 py-2.5 text-sm leading-relaxed wrap-break-word ${
                                    isMine
                                      ? "rounded-2xl rounded-br-sm"
                                      : "rounded-2xl rounded-bl-sm"
                                  } ${isTemp ? "opacity-50" : ""}`}
                                  style={
                                    isMine
                                      ? {
                                          background:
                                            "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)",
                                          color: "#ffffff",
                                          boxShadow:
                                            "0 2px 16px rgba(99,102,241,0.4)",
                                          userSelect: "none",
                                          WebkitUserSelect: "none",
                                          WebkitTouchCallout: "none",
                                        }
                                      : isDark
                                        ? {
                                            background: darkBg2,
                                            color: "#eef2ff",
                                            border: `1px solid ${darkBorder}`,
                                            userSelect: "none",
                                            WebkitUserSelect: "none",
                                            WebkitTouchCallout: "none",
                                          }
                                        : {
                                            background: "#ffffff",
                                            color: "#1e293b",
                                            border:
                                              "1px solid rgba(226,232,240,1)",
                                            boxShadow:
                                              "0 1px 4px rgba(0,0,0,0.05)",
                                            userSelect: "none",
                                            WebkitUserSelect: "none",
                                            WebkitTouchCallout: "none",
                                          }
                                  }
                                >
                                  {msg.text}
                                  <span
                                    className="ml-2 text-[10px] whitespace-nowrap"
                                    style={{ opacity: 0.4 }}
                                  >
                                    {formatFullTime(msg.created_at)}
                                  </span>
                                </div>
                                {msg.reaction && (
                                  <span
                                    className="absolute -bottom-3.5 right-1 text-base rounded-full px-1.5 py-0.5 leading-none"
                                    style={{
                                      background: isDark ? darkBg1 : "#ffffff",
                                      border: `1px solid ${isDark ? darkBorder : lightBorderMid}`,
                                      boxShadow: isDark
                                        ? "0 2px 8px rgba(0,0,0,0.4)"
                                        : "0 2px 8px rgba(0,0,0,0.08)",
                                    }}
                                  >
                                    {msg.reaction}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </Fragment>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                {/* end scroll container */}
                {/* Bottom fade */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-10 z-10 pointer-events-none"
                  style={{
                    background: `linear-gradient(to top, ${isDark ? darkBg0 : lightBg0}, transparent)`,
                  }}
                />
              </div>

              {/* Mute / input error */}
              {inputError && (
                <div className="px-4 py-1.5 shrink-0 flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)" }}>
                  <VolumeX size={12} style={{ color: "#f87171", flexShrink: 0 }} />
                  <span className="text-xs" style={{ color: "#f87171" }}>{inputError}</span>
                </div>
              )}

              {/* Message input */}
              <div
                className="px-4 py-3 flex items-end gap-2.5 shrink-0"
                style={{
                  borderTop: `1px solid ${isDark ? darkBorder : lightBorderMid}`,
                  background: isDark ? darkBg0 : lightBg1,
                }}
              >
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={inputText}
                  onChange={(e) => {
                    handleInputChange(e);
                    // Synchronous resize — must happen before paint so mobile
                    // browsers don't flash a scrollbar inside the textarea
                    e.target.style.height = "auto";
                    e.target.style.height =
                      Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  onBlur={stopTyping}
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
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(99,102,241,0.10)";
                  }}
                  onBlurCapture={(e) => {
                    e.target.style.border = isDark
                      ? "1px solid rgba(99,102,241,0.15)"
                      : "1px solid rgba(226,232,240,1)";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim()}
                  aria-label="Send message"
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  style={{
                    background: inputText.trim()
                      ? "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)"
                      : isDark
                        ? "rgba(99,102,241,0.08)"
                        : "#f1f5f9",
                    boxShadow: inputText.trim()
                      ? "0 4px 16px rgba(99,102,241,0.45)"
                      : "none",
                  }}
                >
                  <Send
                    size={16}
                    style={{
                      color: inputText.trim()
                        ? "#ffffff"
                        : isDark
                          ? "rgba(165,180,252,0.4)"
                          : "#94a3b8",
                    }}
                  />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <NewChatModal
          contacts={contacts}
          allUsers={allUsers}
          onlineIds={onlineIds}
          onSelectUser={handleSelectUser}
          onCreateGroup={handleCreateGroup}
          onCreateChannel={handleCreateChannel}
          onJoinChannel={handleJoinChannel}
          onSendRequest={handleSendRequest}
          onAcceptContact={handleAcceptContact}
          onRemoveContact={handleRemoveContact}
          onClose={() => setShowNewChat(false)}
          isDark={isDark}
          avatarMap={avatarMap}
        />
      )}

      {/* Group Members Panel */}
      {groupMembersPanel && (
        <GroupMembersPanel
          members={groupMembersPanel.members}
          onClose={() => setGroupMembersPanel(null)}
          onlineIds={onlineIds}
          avatarMap={avatarMap}
          isDark={isDark}
          isChannel={!!isActiveChannel}
          myRole={myActiveRole}
          currentUserId={currentUser.id}
          onKick={handleKickMember}
          onRoleChange={handleRoleChange}
          onMute={handleMuteUser}
          onTransferOwnership={handleTransferOwnership}
          onAddMember={handleAddMember}
          allUsers={allUsers}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          msg={contextMenu.msg}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onReact={handleReact}
          onCopy={handleCopy}
          onDelete={handleDeleteMessage}
          onPin={handlePinMessage}
          onUnpin={handleUnpinMessage}
          isPinned={(pinnedMessages[displayRoomId] || []).some((p) => p.message_id === contextMenu.msg.id)}
          currentUserId={currentUser.id}
          isDark={isDark}
          isChannel={!!isActiveChannel}
          myRole={myActiveRole}
        />
      )}

      {/* Edit Channel Modal */}
      {editChannelModal && (
        <EditChannelModal
          initialName={editChannelModal.name}
          initialDescription={editChannelModal.description}
          initialSlug={editChannelModal.slug}
          myRole={myActiveRole}
          onSave={handleEditChannel}
          onClose={() => setEditChannelModal(null)}
          isDark={isDark}
        />
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          body={confirmModal.body}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(null)}
          isDark={isDark}
        />
      )}

      {/* In-app toast notifications */}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-6 right-4 z-[600] flex flex-col gap-2"
          style={{ maxWidth: "320px", pointerEvents: "none" }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="animate-slide-in-right flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl"
              style={{
                pointerEvents: "auto",
                background: isDark ? "rgba(22,20,44,0.97)" : "rgba(255,255,255,0.98)",
                border: `1px solid ${isDark ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.2)"}`,
                borderLeft: "3px solid #6366f1",
                color: isDark ? "#e0e7ff" : "#1e1b4b",
              }}
            >
              <span className="flex-1 leading-snug">{t.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="shrink-0 mt-0.5 opacity-40 hover:opacity-80 transition-opacity"
                style={{ color: isDark ? "#a5b4fc" : "#6366f1" }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
