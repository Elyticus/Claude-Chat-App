import { useState, useEffect, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { api } from "./lib/api.js";
import { useChatSocket } from "./hooks/useChatSocket.js";
import { useContactActions } from "./hooks/useContactActions.js";
import { useRoomNavigation } from "./hooks/useRoomNavigation.js";
import { useChannelActions } from "./hooks/useChannelActions.js";
import { useMessageActions } from "./hooks/useMessageActions.js";
import { useAvatarUpload } from "./hooks/useAvatarUpload.js";
import { useNotificationState } from "./hooks/useNotificationState.js";
import {
  useChatDerivedState,
  MAX_MESSAGE_LENGTH,
} from "./hooks/useChatDerivedState.js";
import { OrbitalHub } from "./components/OrbitalHub.jsx";
import { ChatPanel } from "./components/chat/ChatPanel.jsx";
import { ChatModals } from "./components/chat/ChatModals.jsx";
import {
  darkBg0,
  lightBg0,
  lightBg1,
  specialBg0,
  specialBg1,
} from "./lib/constants.js";

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
  const {
    channelNotifs,
    setChannelNotifs,
    friendNotifs,
    clearFriendNotif,
    clearFriendNotifs,
    clearRoomNotifs,
    addFriendNotifRef,
    addChannelNotifRef,
    clearRoomNotifsRef,
  } = useNotificationState({ setUnreadCounts });
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
  // Per-user cache of the rooms they share with us (userId -> roomId[]). Seeds
  // profileShared the instant a profile (re)opens so just-added rooms stay out
  // of the "Add to" pickers without flickering while the fresh fetch resolves.
  const sharedRoomsCacheRef = useRef({});
  const activeRoomIdRef = useRef(null);
  const closeTimerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const audioCtxRef = useRef(null);

  const selectRoomRef = useRef(null);

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
  // "Add to" pickers can hide them. openProfile() seeds the set from the cache
  // up front, so this effect refreshes it from the server (and updates the
  // cache) without a flicker.
  useEffect(() => {
    if (!profile?.userId) return;
    const userId = profile.userId;
    let cancelled = false;
    api
      .getSharedRooms(userId)
      .then((ids) => {
        sharedRoomsCacheRef.current[userId] = ids;
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
  }, [setChannelNotifs]);

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

  const { handleContextMenu, handleReact, handleCopy, handleDeleteMessage } =
    useMessageActions({ socketRef, activeRoomId, setMessages, setContextMenu });

  const { handleAvatarFile } = useAvatarUpload({ setMyAvatar, currentUser });

  const {
    selectRoom,
    closeRoom,
    handleDeleteRoom,
    openGroupMembers,
    openNewChat,
    openProfile,
    handleProfileMessage,
    addUserToGroup,
    addUserToChannel,
    handleCreateGroup,
  } = useRoomNavigation({
    rooms,
    allUsers,
    displayRoomId,
    unreadCounts,
    currentUser,
    closeTimerRef,
    socketRef,
    clearRoomNotifs,
    stopTyping,
    setConfirmModal,
    setRooms,
    setShowNewChat,
    setPendingRoomIds,
    setGroupMembersPanel,
    setNewMsgMarkers,
    setDisplayRoomId,
    setActiveRoomId,
    setShowMsgSearch,
    setMsgSearch,
    setPinnedMessages,
    setNewChatTab,
    setProfileShared,
    sharedRoomsCacheRef,
    setProfile,
    setShowFriends,
    setToast,
  });

  // Mirror selectRoom into the ref the once-registered socket handlers call
  // through, so they always reach the latest closure.
  useEffect(() => {
    selectRoomRef.current = selectRoom;
  });

  const { handleSendRequest, handleAcceptContact, handleRemoveContact } =
    useContactActions({ setAllUsers, setOnlineIds });

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

  // ── Derived ──────────────────────────────────────────────────────────────────

  const {
    contacts,
    pendingUsers,
    pendingRequestCount,
    avatarMap,
    hasGroupNewNotif,
    activeRoom,
    displayedMessages,
    newMarkerIndex,
    typingNames,
    inputLength,
    overLimit,
    nearLimit,
    canSend,
    isActiveChannel,
    myActiveRole,
    activeRoomName,
    activeRoomOnline,
    activeAvatarId,
    isDmHeader,
    profileUser,
    profileGroups,
    profileChannels,
    profileManage,
  } = useChatDerivedState({
    allUsers,
    myAvatar,
    currentUser,
    rooms,
    displayRoomId,
    messages,
    showMsgSearch,
    msgSearch,
    newMsgMarkers,
    typingMap,
    inputText,
    onlineIds,
    profile,
    groupMembersPanel,
  });

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

      <ChatPanel
        bg0={bg0}
        bgRaised={bgRaised}
        isDark={isDark}
        displayRoomId={displayRoomId}
        activeRoomId={activeRoomId}
        activeRoom={activeRoom}
        activeRoomName={activeRoomName}
        activeAvatarId={activeAvatarId}
        activeRoomOnline={activeRoomOnline}
        avatarMap={avatarMap}
        isActiveChannel={isActiveChannel}
        isDmHeader={isDmHeader}
        typingNames={typingNames}
        myActiveRole={myActiveRole}
        showMsgSearch={showMsgSearch}
        setShowMsgSearch={setShowMsgSearch}
        msgSearch={msgSearch}
        setMsgSearch={setMsgSearch}
        copiedSlug={copiedSlug}
        setCopiedSlug={setCopiedSlug}
        setEditChannelModal={setEditChannelModal}
        setContextMenu={setContextMenu}
        pinnedMessages={pinnedMessages}
        displayedMessages={displayedMessages}
        messages={messages}
        hasMoreMessages={hasMoreMessages}
        loadingMore={loadingMore}
        newMarkerIndex={newMarkerIndex}
        currentUser={currentUser}
        inputText={inputText}
        canSend={canSend}
        inputError={inputError}
        nearLimit={nearLimit}
        overLimit={overLimit}
        inputLength={inputLength}
        inputRef={inputRef}
        longPressTimerRef={longPressTimerRef}
        messagesEndRef={messagesEndRef}
        closeRoom={closeRoom}
        openProfile={openProfile}
        openGroupMembers={openGroupMembers}
        handleDeleteRoom={handleDeleteRoom}
        handleUnpinMessage={handleUnpinMessage}
        loadEarlierMessages={loadEarlierMessages}
        handleContextMenu={handleContextMenu}
        handleInputChange={handleInputChange}
        handleKeyDown={handleKeyDown}
        stopTyping={stopTyping}
        sendMessage={sendMessage}
      />

      <ChatModals
        isDark={isDark}
        onlineIds={onlineIds}
        avatarMap={avatarMap}
        contacts={contacts}
        allUsers={allUsers}
        currentUser={currentUser}
        pendingUsers={pendingUsers}
        friendNotifs={friendNotifs}
        showFriends={showFriends}
        setShowFriends={setShowFriends}
        showAccount={showAccount}
        setShowAccount={setShowAccount}
        showNewChat={showNewChat}
        setShowNewChat={setShowNewChat}
        newChatTab={newChatTab}
        myAvatar={myAvatar}
        avatarFileRef={avatarFileRef}
        groupMembersPanel={groupMembersPanel}
        setGroupMembersPanel={setGroupMembersPanel}
        profile={profile}
        profileUser={profileUser}
        profileManage={profileManage}
        profileGroups={profileGroups}
        profileChannels={profileChannels}
        profileShared={profileShared}
        setProfile={setProfile}
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        editChannelModal={editChannelModal}
        setEditChannelModal={setEditChannelModal}
        confirmModal={confirmModal}
        setConfirmModal={setConfirmModal}
        toast={toast}
        pinnedMessages={pinnedMessages}
        displayRoomId={displayRoomId}
        isActiveChannel={isActiveChannel}
        myActiveRole={myActiveRole}
        onLogout={onLogout}
        openProfile={openProfile}
        openNewChat={openNewChat}
        handleAcceptContact={handleAcceptContact}
        handleRemoveContact={handleRemoveContact}
        handleSendRequest={handleSendRequest}
        clearFriendNotif={clearFriendNotif}
        clearFriendNotifs={clearFriendNotifs}
        handleCreateGroup={handleCreateGroup}
        handleCreateChannel={handleCreateChannel}
        handleJoinChannel={handleJoinChannel}
        handleAddMember={handleAddMember}
        handleProfileMessage={handleProfileMessage}
        addUserToGroup={addUserToGroup}
        addUserToChannel={addUserToChannel}
        handleRoleChange={handleRoleChange}
        handleMuteUser={handleMuteUser}
        handleKickMember={handleKickMember}
        handleTransferOwnership={handleTransferOwnership}
        handleReact={handleReact}
        handleCopy={handleCopy}
        handleDeleteMessage={handleDeleteMessage}
        handlePinMessage={handlePinMessage}
        handleUnpinMessage={handleUnpinMessage}
        handleEditChannel={handleEditChannel}
      />
    </div>
  );
}
