import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Fragment,
} from "react";
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
import { ConfirmModal } from "./components/ConfirmModal.jsx";
import { EditChannelModal } from "./components/EditChannelModal.jsx";
import { GroupMembersPanel } from "./components/GroupMembersPanel.jsx";
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
} from "./lib/constants.js";
import {
  userBg,
  initials,
  formatFullTime,
  dayKey,
  formatDateSeparator,
} from "./lib/helpers.js";

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
  const [channelNotifs, setChannelNotifs] = useState([]);

  function addChannelNotif(message, type = "info", roomId = null) {
    const id = Date.now() + Math.random();
    setChannelNotifs((prev) =>
      [{ id, message, type, roomId, ts: Date.now() }, ...prev].slice(0, 50),
    );
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
  const addChannelNotifRef = useRef(addChannelNotif);
  useEffect(() => {
    addChannelNotifRef.current = addChannelNotif;
  });

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

    s.on(
      "channel:member_kicked",
      ({ roomId, kickedUserId, kickedUsername, kickedBy, channelName }) => {
        if (kickedUserId === currentUser.id) {
          loadedRoomsRef.current.delete(roomId);
          setRooms((prev) => prev.filter((r) => r.id !== roomId));
          if (activeRoomIdRef.current === roomId) {
            setActiveRoomId(null);
            setTimeout(() => setDisplayRoomId(null), 200);
          }
          addChannelNotifRef.current(
            `You were removed from #${channelName} by ${kickedBy}`,
            "kick",
            roomId,
          );
        } else {
          setMessages((prev) => ({
            ...prev,
            [roomId]: [
              ...(prev[roomId] || []),
              {
                id: `sys_${Date.now()}`,
                text: `${kickedUsername || "A member"} was removed from the channel`,
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
          addChannelNotifRef.current(
            `${kickedUsername} was removed from #${channelName} by ${kickedBy}`,
            "kick",
            roomId,
          );
        }
      },
    );

    s.on(
      "channel:role_changed",
      ({ roomId, userId, role, changedBy, channelName, transferredTo }) => {
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
          setMessages((prev) => ({
            ...prev,
            [roomId]: [
              ...(prev[roomId] || []),
              {
                id: `sys_${Date.now()}`,
                text: notifText,
                system: true,
                created_at: Math.floor(Date.now() / 1000),
              },
            ],
          }));
          addChannelNotifRef.current(toastMsg, "role", roomId);
        }
      },
    );

    s.on(
      "channel:member_joined",
      ({ roomId, username, channelName, addedBy }) => {
        setMessages((prev) => ({
          ...prev,
          [roomId]: [
            ...(prev[roomId] || []),
            {
              id: `sys_${Date.now()}`,
              text: addedBy
                ? `${username} was added by ${addedBy}`
                : `${username} joined the channel`,
              system: true,
              created_at: Math.floor(Date.now() / 1000),
            },
          ],
        }));
        const name = channelName ? `#${channelName}` : "the channel";
        const msg = addedBy
          ? `${username} was added to ${name} by ${addedBy}`
          : `${username} joined ${name}`;
        addChannelNotifRef.current(msg, "join", roomId);
      },
    );

    s.on("channel:member_left", ({ roomId, userId, username, channelName, systemMessage }) => {
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
      if (userId !== currentUser.id) {
        const msg = `${username} left #${channelName}`;
        addChannelNotifRef.current(msg, "leave", roomId);
      }
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
        const name = channelName ? `#${channelName}` : "the channel";
        let msg;
        if (userId === currentUser.id) {
          msg = isUnmute
            ? `You were unmuted in ${name}`
            : `You were muted in ${name} by ${mutedBy}`;
        } else {
          msg = isUnmute
            ? `${targetUsername} was unmuted in ${name}`
            : `${targetUsername} was muted in ${name} by ${mutedBy}`;
        }
        const sysText = isUnmute
          ? `${userId === currentUser.id ? "You were" : `${targetUsername} was`} unmuted`
          : `${userId === currentUser.id ? "You were" : `${targetUsername} was`} muted by ${mutedBy}`;
        setMessages((prev) => ({
          ...prev,
          [roomId]: [
            ...(prev[roomId] || []),
            {
              id: `sys_${Date.now()}`,
              text: sysText,
              system: true,
              created_at: Math.floor(Date.now() / 1000),
            },
          ],
        }));
        addChannelNotifRef.current(msg, isUnmute ? "unmute" : "mute", roomId);
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
      if (room) api.getRooms().then(setRooms).catch(console.error);
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
    const { roomId } = await api.createChannel(
      name,
      slug,
      description,
      isPrivate,
    );
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
    setChannelNotifs((prev) => prev.filter((n) => n.roomId !== roomId));
    setShowMsgSearch(false);
    setMsgSearch("");
    stopTyping();
    localStorage.setItem("chatloop_active_room", String(roomId));
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
        channelNotifs={channelNotifs}
        onClearChannelNotifs={() => setChannelNotifs([])}
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

    </div>
  );
}
