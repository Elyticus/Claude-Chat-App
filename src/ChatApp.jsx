import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { flushSync } from "react-dom";
import { Search, X, Check, Pin } from "lucide-react";
import { api } from "./lib/api.js";
import { useChatSocket } from "./hooks/useChatSocket.js";
import { useContactActions } from "./hooks/useContactActions.js";
import { useChannelActions } from "./hooks/useChannelActions.js";
import { OrbitalHub } from "./components/OrbitalHub.jsx";
import { ContextMenu } from "./components/ContextMenu.jsx";
import { NewChatModal } from "./components/NewChatModal.jsx";
import { FriendsModal } from "./components/FriendsModal.jsx";
import { AccountModal } from "./components/AccountModal.jsx";
import { MessageComposer } from "./components/chat/MessageComposer.jsx";
import { ChatHeader } from "./components/chat/ChatHeader.jsx";
import { MessageList } from "./components/chat/MessageList.jsx";
import { ConfirmModal } from "./components/ConfirmModal.jsx";
import { EditChannelModal } from "./components/EditChannelModal.jsx";
import { GroupMembersPanel } from "./components/GroupMembersPanel.jsx";
import { UserProfileModal } from "./components/UserProfileModal.jsx";
import {
  ROLE_LEVEL,
  darkBg0,
  darkBg2,
  darkBorder,
  lightBg0,
  lightBg1,
  lightBorderMid,
  specialBg0,
  specialBg1,
} from "./lib/constants.js";

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
  useChatSocket({
    token,
    currentUser,
    playPing,
    syncRooms,
    syncPresence,
    refreshActiveRoomMessages,
    socketRef,
    activeRoomIdRef,
    roomsRef,
    loadedRoomsRef,
    addFriendNotifRef,
    addChannelNotifRef,
    clearRoomNotifsRef,
    selectRoomRef,
    setActiveRoomId,
    setAllUsers,
    setDisplayRoomId,
    setGroupMembersPanel,
    setInputError,
    setMessages,
    setMyAvatar,
    setOnlineIds,
    setPendingRoomIds,
    setPinnedMessages,
    setRooms,
    setTypingMap,
    setUnreadCounts,
  });

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
      // Clear any stale "typing…" indicators that may have lingered while away.
      setTypingMap({});
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

  const { handleSendRequest, handleAcceptContact, handleRemoveContact } =
    useContactActions({ setAllUsers, setOnlineIds });

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

  const {
    handleCreateChannel,
    handleJoinChannel,
    handleKickMember,
    handleRoleChange,
    handleMuteUser,
    handleAddMember,
    handleTransferOwnership,
    handleEditChannel,
    handlePinMessage,
    handleUnpinMessage,
  } = useChannelActions({
    displayRoomId,
    currentUser,
    selectRoom,
    setShowNewChat,
    setRooms,
    setGroupMembersPanel,
    setConfirmModal,
    setEditChannelModal,
  });

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
  // These lists are NOT filtered by profileShared so the "Add to" buttons don't
  // flicker (appear, then vanish) while the shared-rooms fetch resolves — the
  // profile filters already-joined rooms out of the picker list via
  // sharedRoomIds instead.
  const profileGroups = rooms.filter(
    (r) =>
      !!r.is_group &&
      r.type !== "channel" &&
      r.type !== "private_channel",
  );
  const profileChannels = rooms.filter(
    (r) =>
      (r.type === "channel" || r.type === "private_channel") &&
      ROLE_LEVEL[r.role] >= ROLE_LEVEL.admin,
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
              <ChatHeader
                activeRoom={activeRoom}
                activeRoomName={activeRoomName}
                activeAvatarId={activeAvatarId}
                activeRoomOnline={activeRoomOnline}
                avatarMap={avatarMap}
                isActiveChannel={isActiveChannel}
                isDmHeader={isDmHeader}
                typingNames={typingNames}
                myActiveRole={myActiveRole}
                isDark={isDark}
                bgRaised={bgRaised}
                onClose={closeRoom}
                onOpenProfile={() => openProfile(activeRoom.other_user_id)}
                searchActive={showMsgSearch}
                onToggleSearch={() => {
                  setShowMsgSearch((v) => !v);
                  setMsgSearch("");
                }}
                onEditChannel={() =>
                  setEditChannelModal({
                    name: activeRoom.name || "",
                    description: activeRoom.description || "",
                    slug: activeRoom.slug || "",
                  })
                }
                copiedSlug={copiedSlug}
                onCopySlug={() => {
                  navigator.clipboard
                    .writeText(`#${activeRoom.slug}`)
                    .catch(console.error);
                  setCopiedSlug(true);
                  setTimeout(() => setCopiedSlug(false), 2000);
                }}
                onOpenMembers={openGroupMembers}
                onDeleteRoom={() => handleDeleteRoom(activeRoomId)}
              />

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

              <MessageList
                bg0={bg0}
                isDark={isDark}
                displayedMessages={displayedMessages}
                roomLoaded={messages[activeRoomId] !== undefined}
                hasMore={!!hasMoreMessages[displayRoomId]}
                loadingMore={!!loadingMore[displayRoomId]}
                onLoadEarlier={loadEarlierMessages}
                activeAvatarId={activeAvatarId}
                activeRoomName={activeRoomName}
                isGroup={!!activeRoom.is_group}
                msgSearch={msgSearch}
                newMarkerIndex={newMarkerIndex}
                currentUserId={currentUser.id}
                onContextMenu={handleContextMenu}
                setContextMenu={setContextMenu}
                longPressTimerRef={longPressTimerRef}
                messagesEndRef={messagesEndRef}
              />

              <MessageComposer
                inputRef={inputRef}
                inputText={inputText}
                onInputChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onBlur={stopTyping}
                onSend={sendMessage}
                canSend={canSend}
                inputError={inputError}
                nearLimit={nearLimit}
                overLimit={overLimit}
                inputLength={inputLength}
                maxLength={MAX_MESSAGE_LENGTH}
                isDark={isDark}
                bgRaised={bgRaised}
              />
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
          inMemberList={!!profile.roomId}
          groups={profileGroups}
          channels={profileChannels}
          sharedRoomIds={profileShared}
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
