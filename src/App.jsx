import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageCircle,
  LogOut,
  ArrowLeft,
  Send,
  Smile,
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

const EMOJI_PICKER_ITEMS = [
  "😀",
  "😂",
  "😍",
  "🥰",
  "😎",
  "🤔",
  "😅",
  "😢",
  "😭",
  "😡",
  "🤯",
  "🙏",
  "👍",
  "👎",
  "❤️",
  "🔥",
  "🎉",
  "💯",
  "🤣",
  "🥺",
  "🚀",
  "⭐",
  "💪",
  "🤝",
  "🙌",
  "👋",
  "😝",
  "🎊",
  "✨",
  "💀",
  "🥶",
];

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ userId, username, size = 48, online = false }) {
  const dotSize = Math.round(size * 0.28);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
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

function TypingIndicator({ names }) {
  if (!names.length) return null;
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : `${names.join(", ")} are typing`;
  return (
    <span className="flex items-center gap-1 text-white/50 text-xs">
      {label}
      <span className="flex gap-0.5 items-end ml-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1 h-1 bg-white/40 rounded-full animate-bounce"
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
}) {
  const [rotationAngle, setRotationAngle] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);
  // Initialize with real window size so first frame never overflows on mobile
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
      className="relative w-full h-dvh bg-black flex items-center justify-center overflow-hidden"
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 z-30">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold tracking-wide text-xl">
            Chatloop<span className="text-purple-400">.</span>
          </span>
          {totalUnread > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Avatar
              userId={currentUser.id}
              username={currentUser.username}
              size={28}
            />
            <span className="text-white/40 text-sm hidden sm:block">
              {currentUser.username}
            </span>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            className="w-8 h-8 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 transition-all"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Orbit rings */}
      <div
        className="absolute rounded-full border border-white/[0.07] pointer-events-none"
        style={{ width: "min(64vmin, 500px)", height: "min(64vmin, 500px)" }}
      />
      <div
        className="absolute rounded-full border border-white/4 pointer-events-none"
        style={{ width: "min(44vmin, 340px)", height: "min(44vmin, 340px)" }}
      />

      {/* Center hub */}
      <div
        className="absolute w-20 h-20 rounded-full flex items-center justify-center cursor-pointer z-20 select-none"
        style={{
          background: "linear-gradient(135deg, #6366f1, #3b82f6, #14b8a6)",
          boxShadow:
            "0 0 50px rgba(99, 102, 241, 0.35), 0 0 100px rgba(99, 102, 241, 0.15)",
          animation: "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        }}
        onClick={onNewChat}
        title="Start a new chat"
      >
        <div
          className="absolute rounded-full border border-white/15"
          style={{
            width: 96,
            height: 96,
            animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
          }}
        />
        <div
          className="absolute rounded-full border border-white/[0.07]"
          style={{
            width: 116,
            height: 116,
            animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
            animationDelay: "0.6s",
          }}
        />
        <MessageCircle size={28} className="text-white relative z-10" />
      </div>

      {/* Empty state */}
      {rooms.length === 0 && (
        <p
          className="absolute text-white/20 text-sm tracking-wide pointer-events-none"
          style={{ marginTop: "220px" }}
        >
          Tap the orb to start a conversation
        </p>
      )}

      {/* Room nodes */}
      {rooms.map((room, index) => {
        const pos = getNodePosition(index, rooms.length);
        const displayName = room.is_group
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
            {/* Glow aura */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 72,
                height: 72,
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)",
              }}
            />

            {/* Node circle */}
            <div
              className="relative w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold border-2 border-white/25 shadow-lg hover:border-white/50 hover:scale-110 transition-all duration-200"
              style={{ background: userBg(avatarId) }}
            >
              {initials(displayName)}
              {isOnline && (
                <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-black" />
              )}
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-md">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </div>

            {/* Name label */}
            <span className="mt-2 text-[11px] text-white/55 font-medium max-w-19 truncate text-center leading-tight">
              {displayName}
            </span>
            {room.last_message_at && (
              <span className="text-[10px] text-white/25 mt-0.5">
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

function ContextMenu({ msg, position, onClose, onReact, onCopy, onDelete }) {
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
        className="fixed z-300 bg-[#111] border border-white/12 rounded-2xl shadow-2xl shadow-black/70 overflow-hidden w-60"
        style={style}
      >
        {/* Preview */}
        <div className="px-4 py-3 border-b border-white/8">
          {msg.reaction && <span className="text-lg mr-1">{msg.reaction}</span>}
          <p className="text-white/65 text-sm leading-relaxed line-clamp-2">
            {msg.text}
          </p>
          <span className="text-white/25 text-[10px] mt-1 block">
            {formatFullTime(msg.created_at)}
          </span>
        </div>

        {/* Reactions */}
        <div className="px-3 py-2.5 border-b border-white/8">
          <p className="text-white/35 text-[10px] uppercase tracking-widest mb-2">
            React
          </p>
          <div className="flex gap-1">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onReact(msg.id, emoji);
                  onClose();
                }}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-base transition-all hover:bg-white/10 ${msg.reaction === emoji ? "bg-white/20 ring-1 ring-white/30" : ""}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-1.5">
          <button
            onClick={() => {
              onCopy(msg.text);
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-white/65 hover:text-white hover:bg-white/[0.07] text-sm transition-all"
          >
            Copy text
            <kbd className="text-white/25 text-[10px]">⌘C</kbd>
          </button>
          <button
            onClick={() => {
              onDelete(msg.id);
              onClose();
            }}
            className="w-full flex items-center px-3 py-2 rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 text-sm transition-all"
          >
            Delete
          </button>
        </div>
      </div>
    </>
  );
}

// ─── New Chat Modal ───────────────────────────────────────────────────────────

function NewChatModal({
  users,
  onlineIds,
  onSelectUser,
  onCreateGroup,
  onClose,
}) {
  const [mode, setMode] = useState("dm");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
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

  return (
    <div className="fixed inset-0 z-500 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-[#0d0d0d] border border-white/10 rounded-2xl w-full sm:w-100 max-h-[85dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <span className="text-white font-semibold">
            {mode === "dm" ? "New Message" : "New Group"}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 p-3 pb-0 shrink-0">
          {[
            { id: "dm", label: "Direct Message" },
            { id: "group", label: "Group Chat" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMode(m.id);
                setSelectedIds([]);
              }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${mode === m.id ? "bg-white text-black" : "text-white/45 hover:text-white hover:bg-white/8"}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Group name input */}
        {mode === "group" && (
          <div className="px-4 pt-3 shrink-0">
            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none placeholder:text-white/25 focus:border-white/25 transition-colors"
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
              const u = users.find((x) => x.id === id);
              return u ? (
                <button
                  key={id}
                  onClick={() => toggleSelect(id)}
                  className="flex items-center gap-1 bg-white/10 text-white text-xs px-2.5 py-1 rounded-full hover:bg-white/20 transition-colors"
                >
                  {u.username} <X size={10} />
                </button>
              ) : null;
            })}
          </div>
        )}

        {/* Search */}
        <div className="px-4 pt-3 shrink-0">
          <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5">
            <Search size={14} className="text-white/35 shrink-0" />
            <input
              type="text"
              placeholder={mode === "dm" ? "Search users…" : "Add members…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/25"
            />
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 mt-1 space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-center text-white/25 text-sm py-10">
              No users found
            </p>
          )}
          {filtered.map((u) => {
            const selected = selectedIds.includes(u.id);
            return (
              <button
                key={u.id}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${selected ? "bg-white/12" : "hover:bg-white/6"}`}
                onClick={() =>
                  mode === "dm" ? onSelectUser(u) : toggleSelect(u.id)
                }
              >
                <Avatar
                  userId={u.id}
                  username={u.username}
                  size={40}
                  online={onlineIds.has(u.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">
                    {u.username}
                  </div>
                  <div className="text-white/35 text-xs truncate">
                    {u.email}
                  </div>
                </div>
                {mode === "dm" && onlineIds.has(u.id) && (
                  <span className="text-[10px] text-green-400 font-semibold shrink-0">
                    Online
                  </span>
                )}
                {mode === "group" && selected && (
                  <span className="text-purple-400 font-bold shrink-0">✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Create group CTA */}
        {mode === "group" && (
          <div className="px-4 pb-5 pt-2 border-t border-white/8 shrink-0">
            <button
              onClick={submitGroup}
              disabled={selectedIds.length < 1 || !groupName.trim() || creating}
              className="w-full py-3 rounded-xl bg-linear-to-r from-purple-600 to-blue-600 text-white text-sm font-semibold disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90 transition-all"
            >
              {creating
                ? "Creating…"
                : `Create Group${selectedIds.length > 0 ? ` (${selectedIds.length + 1} members)` : ""}`}
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearch, setMsgSearch] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});

  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
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

    return () => {
      s.off("message:new");
      s.off("message:ack");
      s.off("message:reaction");
      s.off("typing:update");
      s.off("user:status");
      s.off("room:new");
      s.off("message:deleted");
    };
  }, [token]);

  // ── Load rooms + users ──────────────────────────────────────────────────────
  useEffect(() => {
    api.getRooms().then(setRooms).catch(console.error);
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

  function handleEmojiPick(emoji) {
    setInputText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
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
    setShowEmojiPicker(false);
    setShowMsgSearch(false);
    setMsgSearch("");
    stopTyping();
  }

  function closeRoom() {
    stopTyping();
    setActiveRoomId(null);
    closeTimerRef.current = setTimeout(() => setDisplayRoomId(null), 200);
    setShowEmojiPicker(false);
    setShowMsgSearch(false);
    setMsgSearch("");
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

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
    <div className="relative w-full h-dvh bg-black overflow-hidden">
      {/* Orbital Hub — always in background */}
      <OrbitalHub
        rooms={rooms}
        onSelectRoom={selectRoom}
        onNewChat={() => setShowNewChat(true)}
        onLogout={onLogout}
        currentUser={currentUser}
        onlineIds={onlineIds}
        unreadCounts={unreadCounts}
      />

      {/* Chat Panel */}
      <div className="fixed inset-0 z-200 pointer-events-none">
        <div
          className={`absolute inset-0 bg-black flex flex-col transition-opacity duration-200 ${activeRoomId ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        >
          {displayRoomId && activeRoom && (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 shrink-0">
                <button
                  onClick={closeRoom}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
                >
                  <ArrowLeft size={18} />
                </button>
                <Avatar
                  userId={activeAvatarId}
                  username={activeRoomName}
                  size={40}
                  online={activeRoomOnline}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-sm truncate">
                    {activeRoomName}
                  </div>
                  <div className="text-xs mt-0.5">
                    {typingNames.length > 0 ? (
                      <TypingIndicator names={typingNames} />
                    ) : (
                      <span
                        className={
                          activeRoomOnline ? "text-green-400" : "text-white/35"
                        }
                      >
                        {activeRoom.is_group
                          ? "Group chat"
                          : activeRoomOnline
                            ? "Online"
                            : "Offline"}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowMsgSearch((v) => !v);
                    setMsgSearch("");
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${showMsgSearch ? "text-white bg-white/10" : "text-white/40 hover:text-white hover:bg-white/8"}`}
                  title="Search messages"
                >
                  <Search size={16} />
                </button>
                <button
                  onClick={() => handleDeleteRoom(activeRoomId)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Delete chat"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Message search bar */}
              {showMsgSearch && (
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 bg-white/3 shrink-0">
                  <Search size={13} className="text-white/35 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search messages…"
                    value={msgSearch}
                    onChange={(e) => setMsgSearch(e.target.value)}
                    className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/25"
                  />
                  <button
                    onClick={() => {
                      setShowMsgSearch(false);
                      setMsgSearch("");
                    }}
                    className="text-white/35 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="flex flex-col justify-end min-h-full gap-3">
                  {displayedMessages.length === 0 &&
                    messages[activeRoomId] !== undefined && (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                        <div
                          className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                          style={{ background: userBg(activeAvatarId) }}
                        >
                          <span className="text-white text-xl font-bold">
                            {initials(activeRoomName)}
                          </span>
                        </div>
                        <p className="text-white/50 text-sm font-medium">
                          {activeRoomName}
                        </p>
                        <p className="text-white/25 text-xs mt-1">
                          {msgSearch
                            ? "No matching messages"
                            : "No messages yet — say hello! 👋"}
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
                        onContextMenu={(e) =>
                          !isTemp && handleContextMenu(e, msg)
                        }
                      >
                        {!isMine && (
                          <Avatar
                            userId={msg.user_id}
                            username={msg.username}
                            size={28}
                          />
                        )}
                        <div
                          className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[72%]`}
                        >
                          {!isMine && !!activeRoom.is_group && (
                            <span className="text-[11px] text-white/35 mb-1 ml-1">
                              {msg.username}
                            </span>
                          )}
                          <div className="relative">
                            <div
                              className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed wrap-break-word ${
                                isMine
                                  ? "bg-linear-to-br from-purple-600 to-blue-600 text-white rounded-br-sm"
                                  : "bg-white/10 text-white rounded-bl-sm"
                              } ${isTemp ? "opacity-50" : ""}`}
                            >
                              {msg.text}
                              <span className="ml-2 text-[10px] opacity-40 whitespace-nowrap">
                                {formatFullTime(msg.created_at)}
                              </span>
                            </div>
                            {msg.reaction && (
                              <span className="absolute -bottom-3.5 right-1 text-base bg-black/80 rounded-full px-1.5 py-0.5 border border-white/10 leading-none">
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

              {/* Emoji picker */}
              {showEmojiPicker && (
                <div className="px-4 pb-2 shrink-0">
                  <div className="bg-white/5 border border-white/8 rounded-2xl p-3 flex flex-wrap gap-1">
                    {EMOJI_PICKER_ITEMS.map((em) => (
                      <button
                        key={em}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-base transition-colors"
                        onClick={() => handleEmojiPick(em)}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message input */}
              <div className="px-4 py-3 border-t border-white/8 flex items-center gap-2.5 shrink-0">
                <button
                  onClick={() => setShowEmojiPicker((v) => !v)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${showEmojiPicker ? "text-white bg-white/10" : "text-white/35 hover:text-white hover:bg-white/8"}`}
                  title="Emoji"
                >
                  <Smile size={18} />
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onBlur={stopTyping}
                  placeholder="Type a message…"
                  className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-white text-sm outline-none placeholder:text-white/25 focus:border-white/20 transition-colors"
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim()}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed shrink-0"
                  style={{
                    background: inputText.trim()
                      ? "linear-gradient(135deg, #7c3aed, #2563eb)"
                      : "rgba(255,255,255,0.05)",
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
          users={allUsers}
          onlineIds={onlineIds}
          onSelectUser={handleSelectUser}
          onCreateGroup={handleCreateGroup}
          onClose={() => setShowNewChat(false)}
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
        />
      )}
    </div>
  );
}
