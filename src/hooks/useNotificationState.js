import { useState, useEffect, useRef } from "react";

// Owns the two persisted notification stacks — channel-activity notifs and
// friend-request/accept banners — plus the helpers that mutate them and the
// stable refs the once-registered socket handlers call through. Lifted out of
// ChatApp verbatim. `setUnreadCounts` is passed in because clearRoomNotifs
// drops a room's unread badge alongside its channel notifs.
export function useNotificationState({ setUnreadCounts }) {
  const [channelNotifs, setChannelNotifs] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("linkloop_channel_notifs") || "[]",
      );
    } catch {
      return [];
    }
  });
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

  const addChannelNotifRef = useRef(addChannelNotif);
  const clearRoomNotifsRef = useRef(clearRoomNotifs);
  useEffect(() => {
    addChannelNotifRef.current = addChannelNotif;
    clearRoomNotifsRef.current = clearRoomNotifs;
  });

  return {
    channelNotifs,
    setChannelNotifs,
    friendNotifs,
    clearFriendNotif,
    clearFriendNotifs,
    clearRoomNotifs,
    addFriendNotifRef,
    addChannelNotifRef,
    clearRoomNotifsRef,
  };
}
