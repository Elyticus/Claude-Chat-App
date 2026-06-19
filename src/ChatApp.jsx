import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Fragment,
} from "react";
import { flushSync } from "react-dom";
import {
  ArrowLeft,
  Send,
  Search,
  X,
  Trash2,
  Users,
  Copy,
  Check,
  Lock,
  Pencil,
  Pin,
  VolumeX,
} from "lucide-react";
import { api } from "./lib/api.js";
import { connectSocket, disconnectSocket } from "./lib/socket.js";
import { OrbitalHub } from "./components/OrbitalHub.jsx";
import { ContextMenu } from "./components/ContextMenu.jsx";
import { NewChatModal } from "./components/NewChatModal.jsx";
import { FriendsModal } from "./components/FriendsModal.jsx";
import { AccountModal } from "./components/AccountModal.jsx";
import { ConfirmModal } from "./components/ConfirmModal.jsx";
import { EditChannelModal } from "./components/EditChannelModal.jsx";
import { GroupMembersPanel } from "./components/GroupMembersPanel.jsx";
import { UserProfileModal } from "./components/UserProfileModal.jsx";
import { Avatar } from "./components/ui/Avatar.jsx";
import { TypingIndicator } from "./components/ui/TypingIndicator.jsx";
import {
  ROLE_LEVEL,
  darkBg0,
  darkBg1,
  darkBg2,
  darkBorder,
  lightBg0,
  lightBg1,
  lightBorderMid,
  specialBg0,
  specialBg1,
} from "./lib/constants.js";
import {
  userBg,
  initials,
  formatFullTime,
  dayKey,
  formatDateSeparator,
} from "./lib/helpers.js";

// Must match the server's message:send limit (server/index.js).
const MAX_MESSAGE_LENGTH = 4000;
// Show the live character counter once the user is within this many
// characters of the limit.
const LIMIT_WARN_THRESHOLD = 500;

export default function ChatApp({ token, currentUser, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [displayRoomId, setDisplayRoomId] = useState(null);
  const [messages, setMessages] = useState({});
  const [typingMap, setTypingMap] = useState({});
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [allUsers, setAllUsers] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  // Which tab New Chat opens on (e.g. "find" when launched from Friends → Add).
  const [newChatTab, setNewChatTab] = useState("group");
  // The Friends list now lives in its own modal, not inside New Chat.
  const [showFriends, setShowFriends] = useState(false);
  // The current user's own profile (change picture / sign out).
  const [showAccount, setShowAccount] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [inputText, setInputText] = useState("");
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearch, setMsgSearch] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});
  // Theme: "dark" | "light" | "special". Special is the aurora mode — it
  // inherits the dark UI palette (isDark stays true) on teal-black backgrounds.
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("linkloop_theme");
    return saved === "light" || saved === "special" ? saved : "dark";
  });
  const isDark = theme !== "light";
  const isSpecial = theme === "special";
  // App-level backgrounds: special mode swaps the deep indigo for teal-black
  // so the whole app (hub + chat panel) shifts with the time-of-day scene.
  const bg0 = isSpecial ? specialBg0 : isDark ? darkBg0 : lightBg0;
  const bgRaised = isSpecial ? specialBg1 : isDark ? darkBg0 : lightBg1;
  const [myAvatar, setMyAvatar] = useState(() => currentUser.avatar || null);
  const [groupMembersPanel, setGroupMembersPanel] = useState(null);
  // User profile modal: { userId, roomId } — roomId is set when opened from a
  // channel's member list so the profile can also surface moderation actions.
  const [profile, setProfile] = useState(null);
  // Rooms the profiled user already shares with us — hidden from the profile's
  // "Add to group / channel" pickers so you can't try to add a current member.
  const [profileShared, setProfileShared] = useState(() => new Set());
  // Transient confirmation pill (e.g. "Added X to Y").
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState({});
  const [editChannelModal, setEditChannelModal] = useState(null);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [inputError, setInputError] = useState("");
  const [hasMoreMessages, setHasMoreMessages] = useState({});
  const [loadingMore, setLoadingMore] = useState({});
  const [channelNotifs, setChannelNotifs] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("linkloop_channel_notifs") || "[]",
      );
    } catch {
      return [];
    }
  });
  // Empty DMs opened this session — hidden from the chat list until the first
  // message is sent/received, so clicking a user to start a DM doesn't leave a
  // stray empty conversation. Groups and channels are NEVER pending: being
  // added to one is a deliberate assignment that must show immediately.
  const [pendingRoomIds, setPendingRoomIds] = useState(new Set());
  // Per-room "New Messages" divider: unread count + open timestamp captured at
  // the moment the room is opened (before the unread badge is cleared), so the
  // divider marks where unseen messages start and doesn't drift when more
  // messages arrive while the room is open.
  const [newMsgMarkers, setNewMsgMarkers] = useState({});
  // App-level confirmation banners (e.g. "You're now friends with X" shown to
  // the request sender when someone accepts). Persisted to localStorage and
  // kept until the sender explicitly clears each one — they never auto-dismiss.
  const [friendNotifs, setFriendNotifs] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("linkloop_friend_notifs") || "[]",
      );
    } catch {
      return [];
    }
  });

  function addFriendNotif(message, type = "accepted") {
    const notif = { id: `${Date.now()}-${Math.random()}`, message, type };
    setFriendNotifs((prev) => {
      const next = [notif, ...prev].slice(0, 30);
      localStorage.setItem("linkloop_friend_notifs", JSON.stringify(next));
      return next;
    });
  }

  function clearFriendNotif(id) {
    setFriendNotifs((prev) => {
      const next = prev.filter((n) => n.id !== id);
      localStorage.setItem("linkloop_friend_notifs", JSON.stringify(next));
      return next;
    });
  }

  function clearFriendNotifs() {
    setFriendNotifs([]);
    localStorage.removeItem("linkloop_friend_notifs");
  }

  // Stable ref so the once-registered socket handler always calls the latest.
  const addFriendNotifRef = useRef(addFriendNotif);
  useEffect(() => {
    addFriendNotifRef.current = addFriendNotif;
  });

  function addChannelNotif(message, type = "info", roomId = null) {
    const id = Date.now() + Math.random();
    const notif = { id, message, type, roomId, ts: Date.now() };
    setChannelNotifs((prev) => {
      const next = [notif, ...prev].slice(0, 50);
      localStorage.setItem("linkloop_channel_notifs", JSON.stringify(next));
      return next;
    });
  }

  // Drop every notification and unread badge tied to a room. Called when the
  // room goes away (deleted, or this user was kicked) so stale notifications
  // don't point at a chat that no longer exists, and when a room is opened
  // (its activity has been seen).
  function clearRoomNotifs(roomId) {
    setUnreadCounts((prev) => {
      if (!(roomId in prev)) return prev;
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
    setChannelNotifs((prev) => {
      const next = prev.filter((n) => n.roomId !== roomId);
      if (next.length === prev.length) return prev;
      localStorage.setItem("linkloop_channel_notifs", JSON.stringify(next));
      return next;
    });
  }

  // Apply a theme with a soft crossfade. The View Transitions API snapshots
  // the whole document (backgrounds, text, AND the StarField/SpecialField canvas
  // swap) and fades between them — one place handles every mode change without
  // touching the dozens of inline-styled backgrounds. flushSync makes React
  // commit synchronously inside the transition callback so the snapshot is
  // taken at the right moment. Falls back to an instant switch where the API
  // (or reduced-motion) isn't available; the fade timing lives in globals.css.
  function applyTheme(next) {
    localStorage.setItem("linkloop_theme", next);
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (document.startViewTransition && !prefersReduced) {
      document.startViewTransition(() => flushSync(() => setTheme(next)));
    } else {
      setTheme(next);
    }
  }

  // Light/dark toggle. From special mode (isDark, shows Sun) it lands on light.
  function toggleTheme() {
    applyTheme(theme === "light" ? "dark" : "light");
  }

  // Special mode (the time-of-day scenes) has its own button; toggling it off
  // returns to the mode the user was in before entering.
  const prevThemeRef = useRef("dark");
  function toggleSpecial() {
    const next = theme === "special" ? prevThemeRef.current : "special";
    if (theme !== "special") prevThemeRef.current = theme;
    applyTheme(next);
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
  const audioCtxRef = useRef(null);
  const addChannelNotifRef = useRef(addChannelNotif);
  const clearRoomNotifsRef = useRef(clearRoomNotifs);
  useEffect(() => {
    addChannelNotifRef.current = addChannelNotif;
    clearRoomNotifsRef.current = clearRoomNotifs;
  });

  const selectRoomRef = useRef(null);
  useEffect(() => {
    selectRoomRef.current = selectRoom;
  });

  // Mirror `rooms` into a ref so socket listeners (registered once) can read the
  // latest room metadata — e.g. to title a new-message notification with the
  // group/channel name — without going stale or re-subscribing on every change.
  const roomsRef = useRef(rooms);
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  // Short two-tone "ping" for incoming messages in a room you're not viewing.
  // Synthesized with the Web Audio API so there's no audio asset to ship; the
  // context is created lazily and resumed on use (the user has already
  // interacted with the app by this point, satisfying autoplay policies).
  const playPing = useCallback(() => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = audioCtxRef.current || (audioCtxRef.current = new AC());
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1320, now + 0.1);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch {
      /* audio unavailable — ignore */
    }
  }, []);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  // Auto-dismiss the confirmation toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // When a profile opens, fetch which of our rooms the user is already in so the
  // "Add to" pickers can hide them. openProfile() resets the set up front, so
  // this effect only needs to populate it.
  useEffect(() => {
    if (!profile?.userId) return;
    let cancelled = false;
    api
      .getSharedRooms(profile.userId)
      .then((ids) => {
        if (!cancelled) setProfileShared(new Set(ids));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profile?.userId]);

  // Mirror unreadCounts for handlers registered once (foreground handler).
  const unreadCountsRef = useRef(unreadCounts);
  useEffect(() => {
    unreadCountsRef.current = unreadCounts;
  }, [unreadCounts]);

  // Fetch rooms and rebuild unread counts from the server's per-room
  // `unread_count` (the room currently open is treated as read). This is the
  // source of truth that makes unread badges survive a reload / app close and
  // lets us recover anything missed while the socket was suspended in the
  // background. Returns the loaded rooms for callers that need them.
  const syncRooms = useCallback(() => {
    return api
      .getRooms()
      .then((loadedRooms) => {
        setRooms(loadedRooms);
        // The OPEN room can carry server-side unread (socket suspended while
        // mobile was backgrounded, or messages missed while disconnected).
        // Its badge is skipped below, so surface the "New Messages" divider
        // and advance the read marker instead of dropping it silently.
        const activeRoom = loadedRooms.find(
          (r) => r.id === activeRoomIdRef.current,
        );
        if (activeRoom?.unread_count > 0) {
          setNewMsgMarkers((prev) => ({
            ...prev,
            [activeRoom.id]: {
              count: activeRoom.unread_count,
              openedAt: Math.floor(Date.now() / 1000),
            },
          }));
          socketRef.current?.emit("room:read", { roomId: activeRoom.id });
        }
        setUnreadCounts(() => {
          const next = {};
          for (const r of loadedRooms) {
            if (r.id === activeRoomIdRef.current) continue;
            if (r.unread_count > 0) next[r.id] = r.unread_count;
          }
          return next;
        });
        // Prune persisted notifications whose room no longer exists — covers
        // rooms deleted while this user was offline (no room:deleted event).
        const roomIds = new Set(loadedRooms.map((r) => r.id));
        setChannelNotifs((prev) => {
          const next = prev.filter(
            (n) => n.roomId == null || roomIds.has(n.roomId),
          );
          if (next.length === prev.length) return prev;
          localStorage.setItem("linkloop_channel_notifs", JSON.stringify(next));
          return next;
        });
        return loadedRooms;
      })
      .catch((err) => {
        console.error(err);
        return null;
      });
  }, []);

  const syncPresence = useCallback(() => {
    return api
      .getUsers()
      .then((users) => {
        setAllUsers(users);
        setOnlineIds(new Set(users.filter((u) => u.online).map((u) => u.id)));
        return users;
      })
      .catch((err) => {
        console.error(err);
        return null;
      });
  }, []);

  // Re-fetch the messages of the currently-open room and merge in anything we
  // don't already have. This is the piece that makes a conversation catch up
  // WITHOUT a page refresh: mobile browsers suspend the socket when the app is
  // backgrounded/locked, so live `message:new` events for the open thread are
  // missed while suspended. syncRooms only refreshes the room list + unread
  // badges; the messages effect is guarded by loadedRoomsRef and won't reload
  // an already-loaded room. Without this, missed DMs/group/channel messages
  // only appeared after a full reload. Merge (instead of replace) so optimistic
  // temp messages and any earlier pages loaded via pagination are preserved.
  const refreshActiveRoomMessages = useCallback(() => {
    const roomId = activeRoomIdRef.current;
    if (!roomId) return Promise.resolve();
    return api
      .getMessages(roomId)
      .then(({ messages: msgs }) => {
        setMessages((prev) => {
          const existing = prev[roomId] || [];
          const existingIds = new Set(existing.map((m) => m.id));
          const toAppend = msgs.filter((m) => !existingIds.has(m.id));
          if (toAppend.length === 0) return prev;
          const merged = [...existing, ...toAppend].sort(
            (a, b) => (a.created_at || 0) - (b.created_at || 0),
          );
          return { ...prev, [roomId]: merged };
        });
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  useEffect(() => {
    function urlBase64ToUint8Array(base64String) {
      const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const raw = atob(base64);
      return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
    }

    async function initPush() {
      if (typeof Notification === "undefined") return;

      let perm = Notification.permission;
      if (perm === "default") {
        perm = await Notification.requestPermission();
      }

      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey || perm !== "granted") return;

      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        }
        api.pushSubscribe(sub).catch(console.error);
      } catch (err) {
        console.error("[push] Setup failed:", err);
      }
    }

    initPush();

    function handleSwMessage(event) {
      if (event.data?.type === "OPEN_ROOM") {
        const roomId = event.data.roomId;
        if (roomId) selectRoomRef.current?.(roomId);
      }
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSwMessage);
    }
    return () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSwMessage);
      }
    };
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
      setPendingRoomIds((prev) => {
        if (!prev.has(roomId)) return prev;
        const next = new Set(prev);
        next.delete(roomId);
        return next;
      });
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
      const seen =
        roomId === activeRoomIdRef.current && document.hasFocus();
      if (!seen) {
        // Not seen: a different room, or this room while the window is
        // unfocused/minimized (desktop). Count it as unread — for the open
        // room the foreground handler turns this into the "New Messages"
        // divider when the user comes back. Own echoes from another tab are
        // skipped to match the server's unread definition (other users only).
        if (message.user_id !== currentUser.id) {
          setUnreadCounts((prev) => ({
            ...prev,
            [roomId]: (prev[roomId] || 0) + 1,
          }));
          playPing();

          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            // Title with the group/channel name (and prefix the body with the
            // sender) so group and channel notifications are distinguishable;
            // DMs keep showing just the sender's name.
            const room = roomsRef.current.find((r) => r.id === roomId);
            const isChannel =
              room?.type === "channel" || room?.type === "private_channel";
            const isGroup = !!room?.is_group;
            const title = isChannel
              ? `#${room.name || room.slug}`
              : isGroup
                ? room.name || "Group Chat"
                : message.username;
            const body =
              isGroup || isChannel
                ? `${message.username}: ${message.text}`
                : message.text;
            // tag collapses repeat alerts from the same room into one popup.
            const notification = new Notification(title, {
              body,
              tag: `room-${roomId}`,
            });
            notification.onclick = () => {
              window.focus();
              // Already-active room: the focus handler converts its unread
              // into the divider; re-selecting would wipe that marker.
              if (activeRoomIdRef.current !== roomId)
                selectRoomRef.current?.(roomId);
              notification.close();
            };
          }
        }
      } else {
        // Message landed in the room you're viewing while the window has
        // focus — actually seen. Keep the server's read marker current so it
        // doesn't resurface as unread after a reload.
        s.emit("room:read", { roomId });
      }
    });

    s.on("message:ack", ({ tempId, message, roomId }) => {
      setMessages((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || []).map((m) =>
          m.id === tempId ? message : m,
        ),
      }));
      setPendingRoomIds((prev) => {
        if (!prev.has(roomId)) return prev;
        const next = new Set(prev);
        next.delete(roomId);
        return next;
      });
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
      api
        .getRooms()
        .then((loadedRooms) => {
          const prevIds = new Set(roomsRef.current.map((r) => r.id));
          // Only empty DMs are hidden until a first message — a group or
          // channel is a deliberate assignment and must appear in the chat
          // list the instant you're added, without a refresh.
          const newPending = loadedRooms
            .filter((r) => !prevIds.has(r.id) && !r.last_message && !r.is_group)
            .map((r) => r.id);
          setRooms(loadedRooms);
          if (newPending.length > 0) {
            setPendingRoomIds((prev) => new Set([...prev, ...newPending]));
          }
        })
        .catch(console.error);
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
      clearRoomNotifsRef.current(roomId);
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

    // Someone was added to a group this user is already in — append the system
    // message (the added user themselves gets room:new instead). If the members
    // panel is open for this room, refresh it so the new person shows up.
    s.on("room:member_joined", ({ roomId, username, addedBy, systemMessage }) => {
      const msg = systemMessage ?? {
        id: `sys_${Date.now()}`,
        text: addedBy
          ? `${username} was added by ${addedBy}`
          : `${username} joined the group`,
        system: true,
        created_at: Math.floor(Date.now() / 1000),
      };
      setMessages((prev) => ({
        ...prev,
        [roomId]: [...(prev[roomId] || []), msg],
      }));
      setGroupMembersPanel((prev) => {
        if (prev?.roomId !== roomId) return prev;
        api
          .getRoomMembers(roomId)
          .then((members) =>
            setGroupMembersPanel((cur) =>
              cur?.roomId === roomId ? { ...cur, members } : cur,
            ),
          )
          .catch(console.error);
        return prev;
      });
    });

    s.on("contact:request", () => {
      api.getUsers().then(setAllUsers).catch(console.error);
    });

    s.on("contact:accepted", ({ by }) => {
      api
        .getUsers()
        .then((users) => {
          setAllUsers(users);
          setOnlineIds(new Set(users.filter((u) => u.online).map((u) => u.id)));
        })
        .catch(console.error);
      // Confirm to the sender that the person they requested accepted. The
      // banner persists until they clear it.
      if (by?.username) {
        addFriendNotifRef.current(
          `You're now friends with ${by.username}`,
          "accepted",
        );
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification("Friend request accepted", {
            body: `${by.username} accepted your friend request`,
          });
        }
      }
    });

    s.on("contact:declined", ({ by }) => {
      // The recipient declined; clear the now-gone pending_sent state.
      api.getUsers().then(setAllUsers).catch(console.error);
      // Confirm to the sender that their request was denied.
      if (by?.username) {
        addFriendNotifRef.current(
          `${by.username} declined your friend request`,
          "declined",
        );
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification("Friend request declined", {
            body: `${by.username} declined your friend request`,
          });
        }
      }
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

    s.on(
      "channel:member_kicked",
      ({
        roomId,
        kickedUserId,
        kickedUsername,
        kickedBy,
        channelName,
        systemMsg,
      }) => {
        if (kickedUserId === currentUser.id) {
          loadedRoomsRef.current.delete(roomId);
          setRooms((prev) => prev.filter((r) => r.id !== roomId));
          clearRoomNotifsRef.current(roomId);
          if (activeRoomIdRef.current === roomId) {
            setActiveRoomId(null);
            setTimeout(() => setDisplayRoomId(null), 200);
          }
          // roomId null: the room is gone for this user, so the notif must not
          // be tied to it — room-scoped notifs are pruned when the room
          // disappears, and this one should persist until dismissed.
          addChannelNotifRef.current(
            `You were removed from #${channelName} by ${kickedBy}`,
            "kick",
            null,
          );
        } else {
          const msg = systemMsg ?? {
            id: `sys_${Date.now()}`,
            text: `${kickedUsername || "A member"} was removed from the channel`,
            system: true,
            created_at: Math.floor(Date.now() / 1000),
          };
          setMessages((prev) => ({
            ...prev,
            [roomId]: [...(prev[roomId] || []), msg],
          }));
          setGroupMembersPanel((prev) =>
            prev?.roomId === roomId
              ? {
                  ...prev,
                  members: prev.members.filter((m) => m.id !== kickedUserId),
                }
              : prev,
          );
          // Notify remaining members — not the actor who performed the kick
          if (kickedBy !== currentUser.username) {
            const name = channelName ? `#${channelName}` : "the channel";
            addChannelNotifRef.current(
              `${kickedUsername} was removed from ${name}`,
              "kick",
              roomId,
            );
          }
        }
      },
    );

    s.on(
      "channel:role_changed",
      ({
        roomId,
        userId,
        role,
        changedBy,
        channelName,
        transferredTo,
        systemMsg,
      }) => {
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

        // System message is visible to all members and persisted (only present on
        // the first emit; the second emit for ownership transfer has no systemMsg).
        if (systemMsg) {
          setMessages((prev) => ({
            ...prev,
            [roomId]: [...(prev[roomId] || []), systemMsg],
          }));
        }

        const isMe = userId === currentUser.id;

        // Neutral notification for uninvolved members — not the actor who made the change
        if (!isMe && systemMsg && changedBy !== currentUser.username) {
          addChannelNotifRef.current(systemMsg.text, "role", roomId);
        }

        // Personalized notification + role-state update for the affected user
        if (isMe) {
          const roleName = role.charAt(0).toUpperCase() + role.slice(1);
          const article = /^[aeiou]/i.test(role) ? "an" : "a";
          const isOwnTransfer = !!(
            transferredTo && changedBy === currentUser.username
          );

          const notifText = isOwnTransfer
            ? `You transferred ownership to ${transferredTo}`
            : role === "owner"
              ? `${changedBy} made you the Owner`
              : `${changedBy} made you ${article} ${roleName}`;

          setRooms((prev) =>
            prev.map((r) =>
              r.id === roomId
                ? { ...r, role, role_notification: notifText }
                : r,
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

          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            new Notification(desktopTitle, { body: desktopBody });
          }
          addChannelNotifRef.current(toastMsg, "role", roomId);
        }
      },
    );

    s.on(
      "channel:member_joined",
      ({ roomId, userId, username, addedBy, channelName, systemMsg }) => {
        const msg = systemMsg ?? {
          id: `sys_${Date.now()}`,
          text: addedBy
            ? `${username} was added by ${addedBy}`
            : `${username} joined the channel`,
          system: true,
          created_at: Math.floor(Date.now() / 1000),
        };
        setMessages((prev) => ({
          ...prev,
          [roomId]: [...(prev[roomId] || []), msg],
        }));
        // Notify existing members — skip the actor and the newly added user
        if (userId !== currentUser.id && addedBy !== currentUser.username) {
          const name = channelName ? `#${channelName}` : "the channel";
          addChannelNotifRef.current(
            `${username} was added to ${name}`,
            "added",
            roomId,
          );
        }
      },
    );

    s.on("channel:member_left", ({ roomId, systemMessage, username }) => {
      // A member leaving is channel history (system message), not a targeted
      // activity notification — nobody gets an activity badge for it.
      const msgEntry = systemMessage ?? {
        id: `sys_${Date.now()}`,
        text: `${username} left the channel`,
        system: true,
        created_at: Math.floor(Date.now() / 1000),
      };
      setMessages((prev) => ({
        ...prev,
        [roomId]: [...(prev[roomId] || []), msgEntry],
      }));
    });

    s.on(
      "channel:member_muted",
      ({
        roomId,
        userId,
        mutedUntil,
        mutedBy,
        targetUsername,
        channelName,
        systemMsg,
      }) => {
        setGroupMembersPanel((prev) =>
          prev?.roomId === roomId
            ? {
                ...prev,
                members: prev.members.map((m) =>
                  m.id === userId ? { ...m, muted_until: mutedUntil } : m,
                ),
              }
            : prev,
        );
        const isUnmute = !mutedUntil;
        const isMe = userId === currentUser.id;
        const name = channelName ? `#${channelName}` : "the channel";

        // System message (neutral, third-person) visible to all members and persisted.
        const msg = systemMsg ?? {
          id: `sys_${Date.now()}`,
          text: isUnmute
            ? `${targetUsername} was unmuted by ${mutedBy}`
            : `${targetUsername} was muted by ${mutedBy}`,
          system: true,
          created_at: Math.floor(Date.now() / 1000),
        };
        setMessages((prev) => ({
          ...prev,
          [roomId]: [...(prev[roomId] || []), msg],
        }));

        // Notify the muted user (personalized) and uninvolved members — not the actor
        if (isMe || mutedBy !== currentUser.username) {
          const notifText = isMe
            ? isUnmute
              ? `You were unmuted in ${name}`
              : `You were muted in ${name} by ${mutedBy}`
            : msg.text;
          addChannelNotifRef.current(
            notifText,
            isUnmute ? "unmute" : "mute",
            roomId,
          );
        }
      },
    );

    s.on("channel:message_pinned", ({ roomId, pinned }) => {
      setPinnedMessages((prev) => ({
        ...prev,
        [roomId]: [pinned, ...(prev[roomId] || [])],
      }));
    });

    s.on("channel:message_unpinned", ({ roomId, messageId }) => {
      setPinnedMessages((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || []).filter(
          (p) => p.message_id !== messageId,
        ),
      }));
    });

    s.on("channel:updated", ({ roomId, name, description, slug }) => {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? { ...r, name, description, ...(slug !== undefined && { slug }) }
            : r,
        ),
      );
    });

    s.on("channel:added", ({ room, addedBy }) => {
      if (room) {
        // Being added to a channel is a deliberate assignment — refresh the
        // room list so it shows up immediately. Never mark it pending (that
        // would hide it until a first message, forcing a manual refresh).
        api.getRooms().then(setRooms).catch(console.error);
      }
      if (addedBy && addedBy !== currentUser.username) {
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification(`Added to "#${room?.name}"`, {
            body: `${addedBy} added you to this channel`,
          });
        }
        const msg = `${addedBy} added you to #${room?.name}`;
        addChannelNotifRef.current(msg, "added", room?.id);
      }
    });

    // After the socket reconnects (e.g. the app was backgrounded/locked on
    // mobile and the connection was suspended), pull fresh rooms/unread and
    // presence so anything missed while disconnected shows up right away.
    const onReconnect = () => {
      // Order matters: syncRooms() reads each room's unread_count (and snapshots
      // the open room's "New Messages" divider) before refreshActiveRoomMessages
      // re-fetches messages, which advances the server read marker.
      syncRooms().then(() => refreshActiveRoomMessages());
      syncPresence();
    };
    s.io.on("reconnect", onReconnect);

    return () => {
      s.io.off("reconnect", onReconnect);
      s.off("message:new");
      s.off("message:ack");
      s.off("message:reaction");
      s.off("typing:update");
      s.off("user:status");
      s.off("room:new");
      s.off("message:deleted");
      s.off("room:deleted");
      s.off("room:member_left");
      s.off("room:member_joined");
      s.off("contact:request");
      s.off("contact:accepted");
      s.off("contact:declined");
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
  }, [
    token,
    currentUser.id,
    currentUser.username,
    playPing,
    syncRooms,
    syncPresence,
    refreshActiveRoomMessages,
  ]);

  // ── Load rooms + users ────────────────────────────────────────────────────────
  useEffect(() => {
    syncRooms().then((loadedRooms) => {
      if (!loadedRooms) return;
      // Ids are UUID strings — compare as-is. (Old saved integer ids simply
      // won't match any room and are ignored.)
      const savedId = localStorage.getItem("linkloop_active_room");
      const savedRoom = loadedRooms.find((r) => r.id === savedId);
      if (savedRoom) {
        setActiveRoomId(savedId);
        setDisplayRoomId(savedId);
        setNewMsgMarkers((prev) => ({
          ...prev,
          [savedId]: {
            count: savedRoom.unread_count || 0,
            openedAt: Math.floor(Date.now() / 1000),
          },
        }));
        setUnreadCounts((prev) => ({ ...prev, [savedId]: 0 }));
      }
    });
    syncPresence();
  }, [syncRooms, syncPresence]);

  // ── Re-sync when the app returns to the foreground ────────────────────────────
  // Mobile browsers suspend the socket when the app is backgrounded or the
  // screen locks, so messages can arrive while we're not listening. On return,
  // reconnect the socket and pull fresh rooms/unread counts from the server.
  useEffect(() => {
    function handleForeground() {
      if (document.visibilityState !== "visible") return;
      // Unread accumulated for the OPEN room while the window was unfocused
      // (desktop) — now that the user is back and looking at it, surface the
      // "New Messages" divider, clear the badge and advance the read marker.
      if (document.hasFocus()) {
        const roomId = activeRoomIdRef.current;
        const unseen = roomId ? unreadCountsRef.current[roomId] || 0 : 0;
        if (unseen > 0) {
          setNewMsgMarkers((prev) => ({
            ...prev,
            [roomId]: {
              count: unseen,
              openedAt: Math.floor(Date.now() / 1000),
            },
          }));
          setUnreadCounts((prev) => {
            const next = { ...prev };
            delete next[roomId];
            return next;
          });
          socketRef.current?.emit("room:read", { roomId });
        }
      }
      const s = socketRef.current;
      if (s && !s.connected) s.connect();
      // Re-pull rooms/unread first, then catch the open conversation up with any
      // messages that arrived while the socket was suspended in the background —
      // so the user doesn't have to refresh the page to see them.
      syncRooms().then(() => refreshActiveRoomMessages());
      syncPresence();
    }
    document.addEventListener("visibilitychange", handleForeground);
    window.addEventListener("focus", handleForeground);
    return () => {
      document.removeEventListener("visibilitychange", handleForeground);
      window.removeEventListener("focus", handleForeground);
    };
  }, [syncRooms, syncPresence, refreshActiveRoomMessages]);

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
    document.title = totalUnread > 0 ? `(${totalUnread}) Linkloop` : "Linkloop";
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
    // Over-limit feedback is shown live by the counter bar above the input;
    // this guard just makes sure nothing slips through to the server.
    if (text.length > MAX_MESSAGE_LENGTH) return;
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
    localStorage.setItem("linkloop_user", JSON.stringify(updated));
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
        clearRoomNotifs(roomId);
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
      setPendingRoomIds((prev) => new Set([...prev, roomId]));
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

  // Open the profile sheet for another user. `roomId` is passed when opening
  // from a channel's member list so the profile can also show moderation
  // actions; it's null everywhere else (friends list, DM header).
  // Open the New Chat modal on a specific tab ("group" default, "find" when
  // launched from the Friends modal's Add button).
  function openNewChat(tab = "group") {
    setNewChatTab(tab);
    setShowNewChat(true);
  }

  function openProfile(userId, roomId = null) {
    if (!userId || userId === currentUser.id) return;
    // Clear any previous user's shared-room set so stale entries don't briefly
    // hide the wrong rooms before the fresh fetch resolves.
    setProfileShared(new Set());
    setProfile({ userId, roomId });
  }

  // "Message" from the profile: open (or create) the DM and dismiss the
  // overlays the profile may have been launched from.
  function handleProfileMessage(userId) {
    const user = allUsers.find((u) => u.id === userId);
    setProfile(null);
    setGroupMembersPanel(null);
    setShowFriends(false);
    if (user) handleSelectUser(user);
  }

  // Add a user to an existing group / channel from their profile. Both return
  // the promise so the profile can show per-room success / error, and pop a
  // confirmation toast. The server's room:member_joined / channel:member_joined
  // events keep everyone in sync.
  function addUserToGroup(roomId, userId) {
    return api.addGroupMember(roomId, userId).then((res) => {
      const u = allUsers.find((x) => x.id === userId);
      const room = rooms.find((r) => r.id === roomId);
      setToast(`Added ${u?.username || "user"} to ${room?.name || "the group"}`);
      return res;
    });
  }
  function addUserToChannel(roomId, userId) {
    return api.addChannelMember(roomId, userId).then((res) => {
      const u = allUsers.find((x) => x.id === userId);
      const room = rooms.find((r) => r.id === roomId);
      setToast(
        `Added ${u?.username || "user"} to #${room?.name || room?.slug || "channel"}`,
      );
      return res;
    });
  }

  async function handleCreateChannel(name, slug, description, isPrivate) {
    setShowNewChat(false);
    const { roomId } = await api.createChannel(
      name,
      slug,
      description,
      isPrivate,
    );
    // Channels show in the list immediately (not pending) — they're a
    // deliberate, named space, unlike a freshly-opened empty DM.
    selectRoom(roomId);
    api.getRooms().then(setRooms).catch(console.error);
  }

  async function handleJoinChannel(slug) {
    const { roomId } = await api.joinChannel(slug);
    setShowNewChat(false);
    // A joined channel is a real membership — show it right away, never pending.
    selectRoom(roomId);
    api.getRooms().then(setRooms).catch(console.error);
  }

  async function handleKickMember(userId) {
    if (!displayRoomId) return;
    try {
      await api.kickChannelMember(displayRoomId, userId);
      setGroupMembersPanel((prev) =>
        prev?.roomId === displayRoomId
          ? { ...prev, members: prev.members.filter((m) => m.id !== userId) }
          : prev,
      );
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRoleChange(userId, role) {
    if (!displayRoomId) return;
    try {
      await api.setMemberRole(displayRoomId, userId, role);
      setGroupMembersPanel((prev) =>
        prev?.roomId === displayRoomId
          ? {
              ...prev,
              members: prev.members.map((m) =>
                m.id === userId ? { ...m, role } : m,
              ),
            }
          : prev,
      );
    } catch (err) {
      console.error(err);
    }
  }

  async function handleMuteUser(userId, duration) {
    if (!displayRoomId) return;
    try {
      await api.muteChannelMember(displayRoomId, userId, duration);
      const mutedUntil = duration
        ? Math.floor(Date.now() / 1000) + duration
        : null;
      setGroupMembersPanel((prev) =>
        prev?.roomId === displayRoomId
          ? {
              ...prev,
              members: prev.members.map((m) =>
                m.id === userId ? { ...m, muted_until: mutedUntil } : m,
              ),
            }
          : prev,
      );
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddMember(userId) {
    if (!displayRoomId) return;
    try {
      await api.addChannelMember(displayRoomId, userId);
      const members = await api.getRoomMembers(displayRoomId);
      setGroupMembersPanel((prev) => (prev ? { ...prev, members } : prev));
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
          setRooms((prev) =>
            prev.map((r) =>
              r.id === displayRoomId ? { ...r, role: "admin" } : r,
            ),
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
    await api.editChannel(displayRoomId, name, description, slug);
    setEditChannelModal(null);
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
      // Groups show in the list immediately (not pending) — a named group with
      // members is a deliberate assignment, unlike an empty one-on-one DM.
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
    // Snapshot the unread count before clearRoomNotifs wipes it — this is
    // where the "New Messages" divider goes. A count of 0 clears the divider
    // from the previous visit.
    setNewMsgMarkers((prev) => ({
      ...prev,
      [roomId]: {
        count: unreadCounts[roomId] || 0,
        openedAt: Math.floor(Date.now() / 1000),
      },
    }));
    clearRoomNotifs(roomId);
    // Persist the read state server-side so the count stays cleared after a
    // reload, even if this room's messages were already loaded this session.
    socketRef.current?.emit("room:read", { roomId });
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId ? { ...r, is_new: 0, role_notification: null } : r,
      ),
    );
    setShowMsgSearch(false);
    setMsgSearch("");
    stopTyping();
    localStorage.setItem("linkloop_active_room", String(roomId));
    const room = rooms.find((r) => r.id === roomId);
    if (room?.type === "channel" || room?.type === "private_channel") {
      api
        .getPinnedMessages(roomId)
        .then((pins) =>
          setPinnedMessages((prev) => ({ ...prev, [roomId]: pins })),
        )
        .catch(console.error);
    }
  }

  function closeRoom() {
    stopTyping();
    setActiveRoomId(null);
    closeTimerRef.current = setTimeout(() => setDisplayRoomId(null), 200);
    setShowMsgSearch(false);
    setMsgSearch("");
    localStorage.removeItem("linkloop_active_room");
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

  // Computed over the full rooms list (not filtered by pendingRoomIds) so the
  // yellow hub dot appears immediately when room:new fires, even before a message
  // is sent (pending rooms are hidden from the orbital canvas but still carry
  // their is_new flag).
  const hasGroupNewNotif = rooms.some(
    (r) =>
      !!r.is_group &&
      !!r.is_new &&
      r.type !== "channel" &&
      r.type !== "private_channel",
  );

  const activeRoom = rooms.find((r) => r.id === displayRoomId) || null;
  const activeMessages = displayRoomId ? messages[displayRoomId] || [] : [];
  const displayedMessages =
    showMsgSearch && msgSearch.trim()
      ? activeMessages.filter(
          (m) =>
            !m.system && m.text.toLowerCase().includes(msgSearch.toLowerCase()),
        )
      : activeMessages;

  // Index of the first unread message — the "New Messages" divider renders
  // just above it. Walks backwards counting the same messages the server
  // counts as unread (non-system, from other users), skipping anything that
  // arrived after the room was opened so the divider doesn't drift. Hidden
  // while searching (filtered indexes would be misleading).
  const activeMarker = displayRoomId ? newMsgMarkers[displayRoomId] : null;
  let newMarkerIndex = -1;
  if (activeMarker?.count > 0 && !(showMsgSearch && msgSearch.trim())) {
    let remaining = activeMarker.count;
    for (let i = displayedMessages.length - 1; i >= 0 && remaining > 0; i--) {
      const m = displayedMessages[i];
      if (m.system || m.user_id === currentUser.id) continue;
      if (m.created_at > activeMarker.openedAt) continue;
      newMarkerIndex = i;
      remaining--;
    }
  }

  const typingNames = displayRoomId
    ? (typingMap[displayRoomId] || [])
        .filter((u) => u.userId !== currentUser.id)
        .map((u) => u.username)
    : [];

  // Message-length awareness: counts what would actually be sent (trimmed,
  // same as the server's check). Near the limit a live counter appears; over
  // it the counter turns into an error and send is blocked.
  const inputLength = inputText.trim().length;
  const overLimit = inputLength > MAX_MESSAGE_LENGTH;
  const nearLimit = inputLength > MAX_MESSAGE_LENGTH - LIMIT_WARN_THRESHOLD;
  const canSend = inputLength > 0 && !overLimit;

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

  // Clicking the DM header (a one-on-one chat) opens the other user's profile.
  const isDmHeader = !!activeRoom && !activeRoom.is_group && !isActiveChannel;

  // Resolve the clicked user + (optional) channel-management context from the
  // live lists so the profile's badges and actions stay in sync. Merge the
  // member record (role / muted_until) under the directory record (contact
  // status / online / avatar).
  const profileUser = (() => {
    if (!profile) return null;
    const fromUsers = allUsers.find((u) => u.id === profile.userId);
    const fromMembers = groupMembersPanel?.members.find(
      (m) => m.id === profile.userId,
    );
    if (!fromUsers && !fromMembers) return null;
    const merged = { ...(fromMembers || {}), ...(fromUsers || {}) };
    return { ...merged, avatar: avatarMap[profile.userId] || merged.avatar };
  })();
  // Groups the user can be added to (groups require the target be a contact);
  // channels where this user is an admin/owner (only they can add members).
  // Rooms the target is already in are filtered out via profileShared.
  const profileGroups = rooms.filter(
    (r) =>
      !!r.is_group &&
      r.type !== "channel" &&
      r.type !== "private_channel" &&
      !profileShared.has(r.id),
  );
  const profileChannels = rooms.filter(
    (r) =>
      (r.type === "channel" || r.type === "private_channel") &&
      ROLE_LEVEL[r.role] >= ROLE_LEVEL.admin &&
      !profileShared.has(r.id),
  );
  let profileManage = null;
  if (profile?.roomId && groupMembersPanel?.roomId === profile.roomId) {
    const room = rooms.find((r) => r.id === profile.roomId);
    const isCh =
      room?.type === "channel" || room?.type === "private_channel";
    const member = groupMembersPanel.members.find(
      (m) => m.id === profile.userId,
    );
    if (isCh && member) {
      profileManage = {
        myRole: room?.role || null,
        targetRole: member.role || "member",
        mutedUntil: member.muted_until || null,
      };
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      data-theme={isDark ? "dark" : "light"}
      className="relative w-full h-dvh overflow-hidden"
      style={{ background: bg0 }}
    >
      {/* Orbital Hub — always in background */}
      <OrbitalHub
        rooms={rooms.filter((r) => !pendingRoomIds.has(r.id))}
        hasGroupNewNotif={hasGroupNewNotif}
        onSelectRoom={selectRoom}
        onNewChat={() => openNewChat()}
        onOpenFriends={() => setShowFriends(true)}
        onOpenAccount={() => setShowAccount(true)}
        currentUser={currentUser}
        onlineIds={onlineIds}
        unreadCounts={unreadCounts}
        isDark={isDark}
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleSpecial={toggleSpecial}
        pendingCount={pendingRequestCount}
        pendingUsers={pendingUsers}
        onAcceptContact={handleAcceptContact}
        onRemoveContact={handleRemoveContact}
        avatarMap={avatarMap}
        myAvatar={myAvatar}
        channelNotifs={channelNotifs}
        onClearChannelNotifs={() => {
          setChannelNotifs([]);
          localStorage.removeItem("linkloop_channel_notifs");
        }}
        friendNotifs={friendNotifs}
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
          style={{ background: bg0 }}
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
          background: displayRoomId ? bg0 : "transparent",
        }}
      >
        <div
          className={`absolute top-0 left-0 right-0 flex flex-col transition-opacity duration-200 ${activeRoomId ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          style={{
            height: "var(--vvh, 100dvh)",
            background: bg0,
          }}
        >
          {displayRoomId && activeRoom && (
            <>
              {/* Chat header */}
              <div
                className="flex items-center gap-1.5 sm:gap-3 px-3 sm:px-4 py-3.5 border-b shrink-0"
                style={{
                  borderColor: isDark ? darkBorder : lightBorderMid,
                  background: bgRaised,
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
                <div
                  className={`flex items-center gap-1.5 sm:gap-3 flex-1 min-w-0 ${isDmHeader ? "cursor-pointer" : ""}`}
                  onClick={
                    isDmHeader
                      ? () => openProfile(activeRoom.other_user_id)
                      : undefined
                  }
                  role={isDmHeader ? "button" : undefined}
                  title={
                    isDmHeader ? `View ${activeRoomName}'s profile` : undefined
                  }
                >
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
                          ? activeRoom.description ||
                            activeRoom.name ||
                            "Channel"
                          : activeRoom.is_group
                            ? "Group chat"
                            : activeRoomOnline
                              ? "Active now"
                              : "Offline"}
                      </span>
                    )}
                  </div>
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
                    onClick: () =>
                      setEditChannelModal({
                        name: activeRoom.name || "",
                        description: activeRoom.description || "",
                        slug: activeRoom.slug || "",
                      }),
                    title: "Edit channel",
                    show:
                      !!isActiveChannel &&
                      ROLE_LEVEL[myActiveRole] >= ROLE_LEVEL.admin,
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
                    title: copiedSlug
                      ? "Copied!"
                      : `Copy channel address (#${activeRoom.slug})`,
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
              {isActiveChannel &&
                (pinnedMessages[displayRoomId] || []).length > 0 &&
                (() => {
                  const latest = pinnedMessages[displayRoomId][0];
                  return (
                    <div
                      className="flex items-center gap-2.5 px-4 py-2 border-b shrink-0"
                      style={{
                        borderColor: isDark ? darkBorder : lightBorderMid,
                        background: isDark
                          ? "rgba(251,191,36,0.05)"
                          : "rgba(251,191,36,0.06)",
                      }}
                    >
                      <Pin
                        size={12}
                        style={{ color: "#fbbf24", flexShrink: 0 }}
                      />
                      <p
                        className="flex-1 text-xs truncate"
                        style={{
                          color: isDark ? "rgba(238,242,255,0.7)" : "#475569",
                        }}
                      >
                        <span
                          className="font-semibold"
                          style={{ color: isDark ? "#fbbf24" : "#b45309" }}
                        >
                          Pinned:{" "}
                        </span>
                        {latest.text}
                      </p>
                      {ROLE_LEVEL[myActiveRole] >= ROLE_LEVEL.moderator && (
                        <button
                          onClick={() => handleUnpinMessage(latest.message_id)}
                          className="shrink-0 transition-all"
                          style={{
                            color: isDark ? "rgba(238,242,255,0.3)" : "#94a3b8",
                          }}
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
                style={{ background: bg0 }}
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
                    background: `linear-gradient(to bottom, ${bg0}, transparent)`,
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
                          {index === newMarkerIndex && (
                            <div
                              className="flex items-center gap-3 py-2 select-none"
                              aria-label="New messages below"
                            >
                              <span
                                className="flex-1 h-px"
                                style={{
                                  background: isDark
                                    ? "rgba(248,113,113,0.35)"
                                    : "rgba(220,38,38,0.3)",
                                }}
                              />
                              <span
                                className="text-[10px] font-bold uppercase tracking-widest"
                                style={{
                                  color: isDark ? "#f87171" : "#dc2626",
                                }}
                              >
                                New Messages
                              </span>
                              <span
                                className="flex-1 h-px"
                                style={{
                                  background: isDark
                                    ? "rgba(248,113,113,0.35)"
                                    : "rgba(220,38,38,0.3)",
                                }}
                              />
                            </div>
                          )}
                          <div
                            className={`relative flex items-end gap-2 animate-fade-in-up max-w-[78%] ${isMine ? "self-end" : "self-start"} ${msg.reaction ? "mb-3 z-1" : ""}`}
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
                              className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
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
                    background: `linear-gradient(to top, ${bg0}, transparent)`,
                  }}
                />
              </div>

              {/* Mute / input error */}
              {inputError && (
                <div
                  className="px-4 py-1.5 shrink-0 flex items-center gap-2"
                  style={{ background: "rgba(239,68,68,0.08)" }}
                >
                  <VolumeX
                    size={12}
                    style={{ color: "#f87171", flexShrink: 0 }}
                  />
                  <span className="text-xs" style={{ color: "#f87171" }}>
                    {inputError}
                  </span>
                </div>
              )}

              {/* Message length counter — appears near the 4,000-char limit,
                  turns into an error when over it (send is blocked then). */}
              {nearLimit && (
                <div
                  className="px-4 py-1.5 shrink-0 flex items-center justify-between gap-2"
                  style={{
                    background: overLimit
                      ? "rgba(239,68,68,0.08)"
                      : "rgba(245,158,11,0.08)",
                  }}
                >
                  <span
                    className="text-xs"
                    style={{ color: overLimit ? "#f87171" : "#f59e0b" }}
                  >
                    {overLimit
                      ? "Message is too long — shorten it to send"
                      : "Approaching the message length limit"}
                  </span>
                  <span
                    className="text-xs font-semibold shrink-0"
                    style={{
                      color: overLimit ? "#f87171" : "#f59e0b",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {inputLength.toLocaleString()} /{" "}
                    {MAX_MESSAGE_LENGTH.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Message input */}
              <div
                className="px-4 py-3 flex items-end gap-2.5 shrink-0"
                style={{
                  borderTop: `1px solid ${isDark ? darkBorder : lightBorderMid}`,
                  background: bgRaised,
                }}
              >
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={inputText}
                  onChange={(e) => {
                    handleInputChange(e);
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
                  disabled={!canSend}
                  aria-label="Send message"
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-[background,opacity] disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  style={{
                    background: canSend
                      ? "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)"
                      : isDark
                        ? "rgba(99,102,241,0.08)"
                        : "#f1f5f9",
                    // No box-shadow at all — a glow that transitioned to/from
                    // here left a ghost on iOS (incl. the home-screen shortcut),
                    // so the send button stays flat on every platform.
                    boxShadow: "none",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <Send
                    size={16}
                    style={{
                      color: canSend
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

      {/* Friends Modal — the friends list, lifted out of New Chat */}
      {showFriends && (
        <FriendsModal
          contacts={contacts}
          pendingUsers={pendingUsers}
          friendNotifs={friendNotifs}
          onlineIds={onlineIds}
          avatarMap={avatarMap}
          isDark={isDark}
          onOpenProfile={(u) => openProfile(u.id)}
          onAcceptContact={handleAcceptContact}
          onRemoveContact={handleRemoveContact}
          onClearFriendNotif={clearFriendNotif}
          onClearFriendNotifs={clearFriendNotifs}
          onAddFriend={() => {
            setShowFriends(false);
            openNewChat("find");
          }}
          onClose={() => setShowFriends(false)}
        />
      )}

      {/* Account / self profile — change picture, sign out */}
      {showAccount && (
        <AccountModal
          currentUser={currentUser}
          myAvatar={myAvatar}
          isDark={isDark}
          onChangeAvatar={() => avatarFileRef.current?.click()}
          onLogout={() => {
            setShowAccount(false);
            setConfirmModal({
              title: "Sign out",
              body: "Are you sure you want to sign out?",
              confirmLabel: "Sign out",
              onConfirm: () => {
                setConfirmModal(null);
                onLogout();
              },
            });
          }}
          onClose={() => setShowAccount(false)}
        />
      )}

      {/* New Chat Modal */}
      {showNewChat && (
        <NewChatModal
          contacts={contacts}
          allUsers={allUsers}
          onlineIds={onlineIds}
          initialMode={newChatTab}
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
          onOpenProfile={(memberId) =>
            openProfile(memberId, groupMembersPanel.roomId)
          }
          onAddMember={handleAddMember}
          allUsers={allUsers}
        />
      )}

      {/* User Profile — every action available on a user lives here */}
      {profile && profileUser && (
        <UserProfileModal
          user={profileUser}
          online={onlineIds.has(profile.userId)}
          contactStatus={profileUser.contact_status}
          manage={profileManage}
          groups={profileGroups}
          channels={profileChannels}
          isDark={isDark}
          onClose={() => setProfile(null)}
          onMessage={() => handleProfileMessage(profile.userId)}
          onAddToGroup={(roomId) => addUserToGroup(roomId, profile.userId)}
          onAddToChannel={(roomId) => addUserToChannel(roomId, profile.userId)}
          onAddContact={() =>
            handleSendRequest(profile.userId).catch(console.error)
          }
          onAcceptContact={() => handleAcceptContact(profile.userId)}
          onCancelRequest={() => handleRemoveContact(profile.userId)}
          onRemoveContact={() => handleRemoveContact(profile.userId)}
          onRoleChange={(role) => handleRoleChange(profile.userId, role)}
          onMute={(duration) => handleMuteUser(profile.userId, duration)}
          onKick={() => handleKickMember(profile.userId)}
          onTransferOwnership={() =>
            handleTransferOwnership(profile.userId, profileUser.username)
          }
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
          isPinned={(pinnedMessages[displayRoomId] || []).some(
            (p) => p.message_id === contextMenu.msg.id,
          )}
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

      {/* Confirmation toast (e.g. "Added X to Y") — above every overlay */}
      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-700 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium animate-scale-in pointer-events-none"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
            maxWidth: "calc(100vw - 32px)",
            background: isDark ? "#10192e" : "#0f172a",
            color: "#ffffff",
            boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
            border: `1px solid ${isDark ? darkBorder : "rgba(255,255,255,0.08)"}`,
          }}
        >
          <Check size={15} style={{ color: "#4ade80", flexShrink: 0 }} />
          <span className="truncate">{toast}</span>
        </div>
      )}

    </div>
  );
}
