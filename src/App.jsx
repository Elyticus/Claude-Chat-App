import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
} from "lucide-react";
import AuthScreen from "./components/AuthScreen.jsx";
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

const REACTIONS = ["🔥", "🙌", "❤️", "😀", "😝", "👍"];

function ContactStatusButton({ status, onAdd, onRemove, isDark }) {
  if (status === "accepted") {
    return (
      <button
        onClick={onRemove}
        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${isDark ? "bg-white/8 text-white/50 hover:bg-red-500/15 hover:text-red-400" : "bg-black/6 text-slate-400 hover:bg-red-500/10 hover:text-red-400"}`}
      >
        Remove
      </button>
    );
  }
  if (status === "pending_sent") {
    return (
      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold opacity-50 ${isDark ? "bg-white/8 text-white/40" : "bg-black/6 text-slate-400"}`}>
        Pending
      </span>
    );
  }
  if (status === "pending_received") {
    return (
      <button
        onClick={onRemove}
        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"
      >
        Decline
      </button>
    );
  }
  return (
    <button
      onClick={onAdd}
      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-all"
    >
      Add
    </button>
  );
}


// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ userId, username, size = 48, online = false, avatar = null }) {
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
          className="rounded-full flex items-center justify-center text-white font-bold"
          style={{
            background: userBg(userId),
            width: size,
            height: size,
            fontSize: Math.round(size * 0.34),
          }}
        >
          {initials(username)}
        </div>
      )}
      {online && (
        <span
          className="absolute rounded-full bg-green-400 border-2 border-black"
          style={{ width: dotSize, height: dotSize, bottom: 1, right: 1 }}
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
    <span className={`flex items-center gap-1 text-xs ${isDark ? "text-white/50" : "text-slate-500"}`}>
      {label}
      <span className="flex gap-0.5 items-end ml-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`w-1 h-1 rounded-full animate-bounce ${isDark ? "bg-white/40" : "bg-slate-400"}`}
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
  myAvatar,
  onAvatarClick,
}) {
  const [rotationAngle, setRotationAngle] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);
  const [containerSize, setContainerSize] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  const containerRef = useRef(null);
  const angleRef = useRef(0);

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
      className={`relative w-full h-dvh flex items-center justify-center overflow-hidden transition-colors duration-300 ${isDark ? "bg-black" : "bg-indigo-50"}`}
    >
      {/* Futuristic background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute inset-0 futuristic-grid ${isDark ? "opacity-100" : "opacity-50"}`} />
        <div className={`absolute inset-0 futuristic-aurora ${isDark ? "opacity-100" : "opacity-40"}`} />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 z-30">
        <div className="flex items-center gap-2">
          <span className={`font-semibold tracking-wide text-xl ${isDark ? "text-white" : "text-slate-900"}`}>
            Chatloop<span className="text-purple-400">.</span>
          </span>
          {totalUnread > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAvatarClick}
            title="Change profile picture"
            className="flex items-center gap-2 rounded-full focus:outline-none group cursor-pointer"
          >
            <div className="relative">
              <Avatar userId={currentUser.id} username={currentUser.username} size={56} avatar={myAvatar} />
              <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                <span className="text-white text-[10px] opacity-0 group-hover:opacity-100 font-semibold leading-none">Edit</span>
              </span>
            </div>
            <span className={`text-sm hidden sm:block ${isDark ? "text-white/40" : "text-slate-400"}`}>
              {currentUser.username}
            </span>
          </button>
          <button
            onClick={onToggleTheme}
            title={isDark ? "Light mode" : "Dark mode"}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${isDark ? "border-white/15 text-white/50 hover:text-white hover:border-white/30" : "border-slate-300 text-slate-400 hover:text-slate-700 hover:border-slate-400"}`}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            onClick={onLogout}
            title="Sign out"
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${isDark ? "border-white/15 text-white/50 hover:text-white hover:border-white/30" : "border-slate-300 text-slate-400 hover:text-slate-700 hover:border-slate-400"}`}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Orbit rings */}
      <div
        className={`absolute rounded-full border pointer-events-none ${isDark ? "border-white/[0.07]" : "border-indigo-300/50"}`}
        style={{ width: "min(64vmin, 500px)", height: "min(64vmin, 500px)" }}
      />
      <div
        className={`absolute rounded-full border pointer-events-none ${isDark ? "border-white/4" : "border-indigo-300/30"}`}
        style={{ width: "min(44vmin, 340px)", height: "min(44vmin, 340px)" }}
      />

      {/* Center hub */}
      <div
        className="absolute w-20 h-20 rounded-full flex items-center justify-center cursor-pointer z-20 select-none"
        style={{
          background: "linear-gradient(135deg, #6366f1, #3b82f6, #14b8a6)",
          boxShadow: "0 0 50px rgba(99, 102, 241, 0.35), 0 0 100px rgba(99, 102, 241, 0.15)",
          animation: "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        }}
        onClick={onNewChat}
        title="Start a new chat"
      >
        <div
          className="absolute rounded-full border border-white/15"
          style={{ width: 96, height: 96, animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite" }}
        />
        <div
          className="absolute rounded-full border border-white/[0.07]"
          style={{ width: 116, height: 116, animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite", animationDelay: "0.6s" }}
        />
        <MessageCircle size={28} className="text-white relative z-10" />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-md z-20">
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        )}
      </div>

      {/* Empty state */}
      {rooms.length === 0 && (
        <p
          className={`absolute text-sm tracking-wide pointer-events-none ${isDark ? "text-white/20" : "text-slate-400"}`}
          style={{ marginTop: "220px" }}
        >
          Tap the orb to start a conversation
        </p>
      )}

      {/* Room nodes */}
      {rooms.map((room, index) => {
        const pos = getNodePosition(index, rooms.length);
        const displayName = room.is_group ? room.name || "Group" : room.other_username || "User";
        const avatarId = room.is_group ? room.id : room.other_user_id;
        const isOnline = !room.is_group && onlineIds.has(room.other_user_id);
        const unread = unreadCounts[room.id] || 0;

        return (
          <div
            key={room.id}
            className={`absolute cursor-pointer flex flex-col items-center select-none active:scale-95 ${hoveredId === null ? "transition-transform duration-50" : "transition-none"}`}
            style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, zIndex: pos.zIndex, opacity: pos.opacity }}
            onMouseEnter={() => setHoveredId(room.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelectRoom(room.id)}
          >
            {/* Glow aura */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 72, height: 72, left: "50%", top: "50%",
                transform: "translate(-50%, -50%)",
                background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)",
              }}
            />
            {/* Node circle */}
            <div
              className={`relative w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold border-2 shadow-lg hover:scale-110 transition-all duration-200 ${isDark ? "border-white/25 hover:border-white/50" : "border-white/50 hover:border-white/80"}`}
              style={{ background: userBg(avatarId) }}
            >
              {initials(displayName)}
              {isOnline && (
                <span className={`absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 ${isDark ? "border-black" : "border-indigo-50"}`} />
              )}
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-md">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </div>
            {/* Name label */}
            <span className={`mt-2 text-[11px] font-medium max-w-19 truncate text-center leading-tight ${isDark ? "text-white/55" : "text-slate-500"}`}>
              {displayName}
            </span>
            {room.last_message_at && (
              <span className={`text-[10px] mt-0.5 ${isDark ? "text-white/25" : "text-slate-400"}`}>
                {formatTime(room.last_message_at)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

function ContextMenu({ msg, position, onClose, onReact, onCopy, onDelete, currentUserId, isDark }) {
  const menuW = 240;
  const menuH = 420;
  const style = {
    top: Math.max(8, Math.min(position.y, window.innerHeight - menuH - 8)),
    left: Math.max(8, Math.min(position.x, window.innerWidth - menuW - 8)),
  };

  return (
    <>
      <div className="fixed inset-0 z-300" onClick={onClose} />
      <div
        className={`fixed z-300 border rounded-2xl shadow-2xl overflow-hidden w-60 transition-colors duration-300 ${isDark ? "bg-[#111] border-white/12 shadow-black/70" : "bg-white border-black/8 shadow-black/10"}`}
        style={style}
      >
        {/* Preview */}
        <div className={`px-4 py-3 border-b ${isDark ? "border-white/8" : "border-black/6"}`}>
          {msg.reaction && <span className="text-lg mr-1">{msg.reaction}</span>}
          <p className={`text-sm leading-relaxed line-clamp-2 ${isDark ? "text-white/65" : "text-slate-500"}`}>
            {msg.text}
          </p>
          <span className={`text-[10px] mt-1 block ${isDark ? "text-white/25" : "text-slate-400"}`}>
            {formatFullTime(msg.created_at)}
          </span>
        </div>

        {/* Reactions */}
        <div className={`px-3 py-2.5 border-b ${isDark ? "border-white/8" : "border-black/6"}`}>
          <p className={`text-[10px] uppercase tracking-widest mb-2 ${isDark ? "text-white/35" : "text-slate-400"}`}>
            React
          </p>
          <div className="flex gap-1">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => { onReact(msg.id, emoji); onClose(); }}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-base transition-all ${
                  msg.reaction === emoji
                    ? isDark ? "bg-white/20 ring-1 ring-white/30" : "bg-black/10 ring-1 ring-black/20"
                    : isDark ? "hover:bg-white/10" : "hover:bg-black/6"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-1.5">
          <button
            onClick={() => { onCopy(msg.text); onClose(); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${isDark ? "text-white/65 hover:text-white hover:bg-white/[0.07]" : "text-slate-500 hover:text-slate-900 hover:bg-black/5"}`}
          >
            Copy text
            <kbd className={`text-[10px] ${isDark ? "text-white/25" : "text-slate-400"}`}>⌘C</kbd>
          </button>
          {Number(msg.user_id) === Number(currentUserId) && (
            <button
              onClick={() => { onDelete(msg.id); onClose(); }}
              className="w-full flex items-center px-3 py-2 rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 text-sm transition-all"
            >
              Delete
            </button>
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

  const incoming = allUsers.filter((u) => u.contact_status === "pending_received");

  const filtered = (mode === "find" ? allUsers.filter((u) => u.contact_status !== "pending_received") : contacts).filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()),
  );

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

  const tabs = [
    { id: "dm", label: "Direct" },
    { id: "group", label: "Group" },
    { id: "find", label: "Find People", badge: incoming.length },
  ];

  const headerTitle = mode === "dm" ? "New Message" : mode === "group" ? "New Group" : "Find People";

  return (
    <div className="fixed inset-0 z-500 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 backdrop-blur-sm ${isDark ? "bg-black/90" : "bg-slate-900/30"}`}
        onClick={onClose}
      />
      <div className={`relative border rounded-2xl w-full sm:w-100 max-h-[85dvh] flex flex-col shadow-2xl overflow-hidden transition-colors duration-300 ${isDark ? "bg-[#0d0d0d] border-white/10" : "bg-white border-black/10"}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${isDark ? "border-white/8" : "border-black/6"}`}>
          <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
            {headerTitle}
          </span>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isDark ? "text-white/40 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-slate-900 hover:bg-black/6"}`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 p-3 pb-0 shrink-0">
          {tabs.map((m) => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setSelectedIds([]); setSearch(""); setFindError(""); }}
              className={`flex-1 relative py-2 rounded-xl text-xs font-medium transition-all ${
                mode === m.id
                  ? isDark ? "bg-white text-black" : "bg-slate-900 text-white"
                  : isDark ? "text-white/45 hover:text-white hover:bg-white/8" : "text-slate-400 hover:text-slate-900 hover:bg-black/5"
              }`}
            >
              {m.label}
              {m.badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
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
              className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-colors ${isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-white/25" : "bg-black/4 border-black/10 text-slate-900 placeholder:text-slate-400 focus:border-black/20"}`}
              placeholder="Group name…"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
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
                  className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors ${isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-black/8 text-slate-700 hover:bg-black/12"}`}
                >
                  {u.username} <X size={10} />
                </button>
              ) : null;
            })}
          </div>
        )}

        {/* Search */}
        <div className="px-4 pt-3 shrink-0">
          <div className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 ${isDark ? "bg-white/5 border-white/8" : "bg-black/4 border-black/8"}`}>
            <Search size={14} className={`shrink-0 ${isDark ? "text-white/35" : "text-slate-400"}`} />
            <input
              type="text"
              placeholder={mode === "dm" ? "Search contacts…" : mode === "group" ? "Add members…" : "Search people…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`flex-1 bg-transparent text-sm outline-none ${isDark ? "text-white placeholder:text-white/25" : "text-slate-900 placeholder:text-slate-400"}`}
            />
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 mt-1">
          {mode === "find" ? (
            <div className="space-y-0.5">
              {/* Incoming requests */}
              {incoming.length > 0 && !search && (
                <div className="mb-2">
                  <p className={`text-[10px] uppercase tracking-widest px-3 py-1 ${isDark ? "text-white/30" : "text-slate-400"}`}>
                    Requests
                  </p>
                  {incoming.map((u) => (
                    <div
                      key={u.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isDark ? "bg-indigo-500/8" : "bg-indigo-50"}`}
                    >
                      <Avatar userId={u.id} username={u.username} size={40} online={onlineIds.has(u.id)} avatar={avatarMap[u.id]} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-slate-900"}`}>{u.username}</div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => onAcceptContact(u.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-all"
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
                  <div className={`mx-3 my-2 border-t ${isDark ? "border-white/8" : "border-black/6"}`} />
                </div>
              )}

              {/* All other users */}
              {filtered.length === 0 && (
                <p className={`text-center text-sm py-8 ${isDark ? "text-white/25" : "text-slate-400"}`}>
                  No users found
                </p>
              )}
              {findError && (
                <div className="mx-1 mb-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {findError}
                </div>
              )}
              {filtered.map((u) => (
                <div key={u.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isDark ? "hover:bg-white/4" : "hover:bg-black/3"}`}>
                  <Avatar userId={u.id} username={u.username} size={40} online={onlineIds.has(u.id)} avatar={avatarMap[u.id]} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-slate-900"}`}>{u.username}</div>
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
                <p className={`text-center text-sm py-10 ${isDark ? "text-white/25" : "text-slate-400"}`}>
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                      selected
                        ? isDark ? "bg-white/12" : "bg-black/8"
                        : isDark ? "hover:bg-white/6" : "hover:bg-black/4"
                    }`}
                    onClick={() => mode === "dm" ? onSelectUser(u) : toggleSelect(u.id)}
                  >
                    <Avatar userId={u.id} username={u.username} size={40} online={onlineIds.has(u.id)} avatar={avatarMap[u.id]} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                        {u.username}
                      </div>
                    </div>
                    {mode === "dm" && onlineIds.has(u.id) && (
                      <span className="text-[10px] text-green-400 font-semibold shrink-0">Online</span>
                    )}
                    {mode === "group" && selected && (
                      <span className="text-purple-400 font-bold shrink-0">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Create group CTA */}
        {mode === "group" && (
          <div className={`px-4 pb-5 pt-2 border-t shrink-0 ${isDark ? "border-white/8" : "border-black/6"}`}>
            <button
              onClick={submitGroup}
              disabled={selectedIds.length < 1 || !groupName.trim() || creating}
              className="w-full py-3 rounded-xl bg-linear-to-r from-purple-600 to-blue-600 text-white text-sm font-semibold disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90 transition-all"
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

// ─── App (auth gate) ──────────────────────────────────────────────────────────

export default function App() {
  const [authData, setAuthData] = useState(() => {
    try {
      const token = localStorage.getItem("chatloop_token");
      const user = JSON.parse(localStorage.getItem("chatloop_user") || "null");
      return token && user ? { token, user } : { token: null, user: null };
    } catch {
      return { token: null, user: null };
    }
  });

  function handleAuth({ token, user }) {
    localStorage.setItem("chatloop_token", token);
    localStorage.setItem("chatloop_user", JSON.stringify(user));
    setAuthData({ token, user });
  }

  function handleLogout() {
    localStorage.removeItem("chatloop_token");
    localStorage.removeItem("chatloop_user");
    disconnectSocket();
    setAuthData({ token: null, user: null });
  }

  if (!authData.token || !authData.user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return (
    <ChatApp
      token={authData.token}
      currentUser={authData.user}
      onLogout={handleLogout}
    />
  );
}

// ─── Chat App ─────────────────────────────────────────────────────────────────

function ChatApp({ token, currentUser, onLogout }) {
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

  // ── Socket setup ────────────────────────────────────────────────────────────
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

    s.on("room:new", () => {
      api.getRooms().then(setRooms).catch(console.error);
    });

    s.on("message:deleted", ({ roomId, messageId }) => {
      setMessages((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || []).filter((m) => m.id !== messageId),
      }));
    });

    s.on("contact:request", () => {
      api.getUsers().then(setAllUsers).catch(console.error);
    });

    s.on("contact:accepted", () => {
      api.getUsers().then((users) => {
        setAllUsers(users);
        setOnlineIds(new Set(users.filter((u) => u.online).map((u) => u.id)));
      }).catch(console.error);
    });

    s.on("user:avatar", ({ userId, avatar }) => {
      setAllUsers((prev) => prev.map((u) => u.id === userId ? { ...u, avatar } : u));
      if (userId === currentUser.id) setMyAvatar(avatar);
    });

    return () => {
      s.off("message:new");
      s.off("message:ack");
      s.off("message:reaction");
      s.off("typing:update");
      s.off("user:status");
      s.off("room:new");
      s.off("message:deleted");
      s.off("contact:request");
      s.off("contact:accepted");
      s.off("user:avatar");
    };
  }, [token, currentUser.id]);

  // ── Load rooms + users ──────────────────────────────────────────────────────
  useEffect(() => {
    api.getRooms().then((loadedRooms) => {
      setRooms(loadedRooms);
      const savedId = Number(localStorage.getItem("chatloop_active_room"));
      if (savedId && loadedRooms.some((r) => r.id === savedId)) {
        setActiveRoomId(savedId);
        setDisplayRoomId(savedId);
      }
    }).catch(console.error);
    api
      .getUsers()
      .then((users) => {
        setAllUsers(users);
        setOnlineIds(new Set(users.filter((u) => u.online).map((u) => u.id)));
      })
      .catch(console.error);
  }, []);

  // ── Load messages on room change ─────────────────────────────────────────────
  useEffect(() => {
    if (!activeRoomId || loadedRoomsRef.current.has(activeRoomId)) return;
    loadedRoomsRef.current.add(activeRoomId);
    api
      .getMessages(activeRoomId)
      .then((msgs) =>
        setMessages((prev) => ({ ...prev, [activeRoomId]: msgs })),
      )
      .catch((err) => {
        loadedRoomsRef.current.delete(activeRoomId);
        console.error(err);
      });
  }, [activeRoomId]);

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  // Instant when switching rooms — avoids competing with the panel slide-in animation
  useEffect(() => {
    if (activeRoomId)
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [activeRoomId]);
  // Smooth when a new message arrives in the current room
  useEffect(() => {
    if (activeRoomId)
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeRoomId, messages]);

  // ── Tab title ────────────────────────────────────────────────────────────────
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Chatloop` : "Chatloop";
  }, [totalUnread]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const stopTyping = useCallback(() => {
    clearTimeout(typingTimerRef.current);
    if (isTypingRef.current && activeRoomId && socketRef.current) {
      isTypingRef.current = false;
      socketRef.current.emit("typing:stop", { roomId: activeRoomId });
    }
  }, [activeRoomId]);

  const sendMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text || !activeRoomId || !socketRef.current) return;
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
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
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

  async function handleDeleteRoom(roomId) {
    if (!window.confirm("Delete this chat? This cannot be undone.")) return;
    closeRoom();
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    try {
      await api.deleteRoom(roomId);
    } catch (err) {
      console.error(err);
    }
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
      prev.map((u) => (u.id === contactId ? { ...u, contact_status: "pending_sent" } : u)),
    );
    try {
      await api.sendContactRequest(contactId);
      api.getUsers().then(setAllUsers).catch(console.error);
    } catch (err) {
      setAllUsers((prev) =>
        prev.map((u) => (u.id === contactId ? { ...u, contact_status: null } : u)),
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
    setShowMsgSearch(false);
    setMsgSearch("");
    stopTyping();
    localStorage.setItem("chatloop_active_room", String(roomId));
  }

  function closeRoom() {
    stopTyping();
    setActiveRoomId(null);
    closeTimerRef.current = setTimeout(() => setDisplayRoomId(null), 200);
    setShowMsgSearch(false);
    setMsgSearch("");
    localStorage.removeItem("chatloop_active_room");
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const contacts = allUsers.filter((u) => u.contact_status === "accepted");
  const pendingRequestCount = allUsers.filter((u) => u.contact_status === "pending_received").length;
  const avatarMap = useMemo(() => {
    const map = {};
    allUsers.forEach((u) => { if (u.avatar) map[u.id] = u.avatar; });
    if (myAvatar) map[currentUser.id] = myAvatar;
    return map;
  }, [allUsers, myAvatar, currentUser.id]);

  const activeRoom = rooms.find((r) => r.id === displayRoomId) || null;
  const activeMessages = displayRoomId ? messages[displayRoomId] || [] : [];
  const displayedMessages =
    showMsgSearch && msgSearch.trim()
      ? activeMessages.filter((m) =>
          m.text.toLowerCase().includes(msgSearch.toLowerCase()),
        )
      : activeMessages;

  const typingNames = displayRoomId
    ? (typingMap[displayRoomId] || [])
        .filter((u) => u.userId !== currentUser.id)
        .map((u) => u.username)
    : [];

  const activeRoomName = activeRoom
    ? activeRoom.is_group
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
      className={`relative w-full h-dvh overflow-hidden transition-colors duration-300 ${isDark ? "bg-black" : "bg-indigo-50"}`}
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
        myAvatar={myAvatar}
        onAvatarClick={() => avatarFileRef.current?.click()}
      />
      <input
        ref={avatarFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFile}
      />

      {/* Chat Panel */}
      <div className="fixed inset-0 z-200 pointer-events-none">
        <div
          className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${isDark ? "bg-black" : "bg-white"} ${activeRoomId ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        >
          {displayRoomId && activeRoom && (
            <>
              {/* Chat header */}
              <div className={`flex items-center gap-3 px-4 py-3 border-b shrink-0 ${isDark ? "border-white/8" : "border-black/8"}`}>
                <button
                  onClick={closeRoom}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isDark ? "text-white/50 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-slate-900 hover:bg-black/6"}`}
                >
                  <ArrowLeft size={18} />
                </button>
                <Avatar userId={activeAvatarId} username={activeRoomName} size={40} online={activeRoomOnline} avatar={avatarMap[activeAvatarId]} />
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                    {activeRoomName}
                  </div>
                  <div className="text-xs mt-0.5">
                    {typingNames.length > 0 ? (
                      <TypingIndicator names={typingNames} isDark={isDark} />
                    ) : (
                      <span className={activeRoomOnline ? "text-green-400" : isDark ? "text-white/35" : "text-slate-400"}>
                        {activeRoom.is_group ? "Group chat" : activeRoomOnline ? "Online" : "Offline"}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setShowMsgSearch((v) => !v); setMsgSearch(""); }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    showMsgSearch
                      ? isDark ? "text-white bg-white/10" : "text-slate-900 bg-black/8"
                      : isDark ? "text-white/40 hover:text-white hover:bg-white/8" : "text-slate-400 hover:text-slate-900 hover:bg-black/5"
                  }`}
                  title="Search messages"
                >
                  <Search size={16} />
                </button>
                <button
                  onClick={() => handleDeleteRoom(activeRoomId)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isDark ? "text-white/40 hover:text-red-400 hover:bg-red-500/10" : "text-slate-400 hover:text-red-400 hover:bg-red-500/10"}`}
                  title="Delete chat"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Message search bar */}
              {showMsgSearch && (
                <div className={`flex items-center gap-2 px-4 py-2.5 border-b shrink-0 ${isDark ? "border-white/8 bg-white/3" : "border-black/6 bg-black/3"}`}>
                  <Search size={13} className={`shrink-0 ${isDark ? "text-white/35" : "text-slate-400"}`} />
                  <input
                    type="text"
                    placeholder="Search messages…"
                    value={msgSearch}
                    onChange={(e) => setMsgSearch(e.target.value)}
                    className={`flex-1 bg-transparent text-sm outline-none ${isDark ? "text-white placeholder:text-white/25" : "text-slate-900 placeholder:text-slate-400"}`}
                  />
                  <button
                    onClick={() => { setShowMsgSearch(false); setMsgSearch(""); }}
                    className={`transition-colors ${isDark ? "text-white/35 hover:text-white" : "text-slate-400 hover:text-slate-700"}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="flex flex-col justify-end min-h-full gap-3">
                  {displayedMessages.length === 0 && messages[activeRoomId] !== undefined && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: userBg(activeAvatarId) }}>
                        <span className="text-white text-xl font-bold">{initials(activeRoomName)}</span>
                      </div>
                      <p className={`text-sm font-medium ${isDark ? "text-white/50" : "text-slate-500"}`}>{activeRoomName}</p>
                      <p className={`text-xs mt-1 ${isDark ? "text-white/25" : "text-slate-400"}`}>
                        {msgSearch ? "No matching messages" : "No messages yet — say hello! 👋"}
                      </p>
                    </div>
                  )}

                  {displayedMessages.map((msg) => {
                    const isMine = msg.user_id === currentUser.id;
                    const isTemp = !!msg.temp;
                    return (
                      <div
                        key={msg.id}
                        className={`flex w-full items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}
                        onContextMenu={(e) => !isTemp && handleContextMenu(e, msg)}
                      >
                        {!isMine && <Avatar userId={msg.user_id} username={msg.username} size={28} avatar={avatarMap[msg.user_id]} />}
                        {isMine && <Avatar userId={currentUser.id} username={currentUser.username} size={28} avatar={myAvatar} />}
                        <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[72%]`}>
                          {!isMine && !!activeRoom.is_group && (
                            <span className={`text-[11px] mb-1 ml-1 ${isDark ? "text-white/35" : "text-slate-400"}`}>
                              {msg.username}
                            </span>
                          )}
                          <div className="relative">
                            <div
                              className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed wrap-break-word ${
                                isMine
                                  ? "bg-linear-to-br from-purple-600 to-blue-600 text-white rounded-br-sm"
                                  : isDark
                                    ? "bg-white/10 text-white rounded-bl-sm"
                                    : "bg-slate-100 text-slate-900 rounded-bl-sm"
                              } ${isTemp ? "opacity-50" : ""}`}
                            >
                              {msg.text}
                              <span className="ml-2 text-[10px] opacity-40 whitespace-nowrap">
                                {formatFullTime(msg.created_at)}
                              </span>
                            </div>
                            {msg.reaction && (
                              <span className={`absolute -bottom-3.5 right-1 text-base rounded-full px-1.5 py-0.5 border leading-none ${isDark ? "bg-black/80 border-white/10" : "bg-white border-black/10 shadow-sm"}`}>
                                {msg.reaction}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Message input */}
              <div className={`px-4 py-3 border-t flex items-center gap-2.5 shrink-0 ${isDark ? "border-white/8" : "border-black/8"}`}>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onBlur={stopTyping}
                  placeholder="Type a message…"
                  className={`flex-1 border rounded-full px-4 py-2.5 text-sm outline-none transition-colors ${isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-white/20" : "bg-black/4 border-black/10 text-slate-900 placeholder:text-slate-400 focus:border-black/20"}`}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim()}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed shrink-0"
                  style={{
                    background: inputText.trim()
                      ? "linear-gradient(135deg, #7c3aed, #2563eb)"
                      : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
                  }}
                >
                  <Send size={16} className="text-white" />
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
          onSendRequest={handleSendRequest}
          onAcceptContact={handleAcceptContact}
          onRemoveContact={handleRemoveContact}
          onClose={() => setShowNewChat(false)}
          isDark={isDark}
          avatarMap={avatarMap}
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
          currentUserId={currentUser.id}
          isDark={isDark}
        />
      )}
    </div>
  );
}
