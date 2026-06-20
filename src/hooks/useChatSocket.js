import { useEffect } from "react";
import { api } from "../lib/api.js";
import { connectSocket, disconnectSocket } from "../lib/socket.js";

// All Socket.io event wiring for the chat app, lifted out of ChatApp verbatim.
// Every piece of React state it touches is passed in (setters + refs + the
// sync callbacks are stable identities), so behavior is identical.
export function useChatSocket({
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
}) {
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
      // A user who just went offline can't be typing — drop any stale indicator
      // (covers a typing:stop that never arrived because they dropped abruptly).
      if (!online) {
        setTypingMap((prev) => {
          let changed = false;
          const next = {};
          for (const [roomId, users] of Object.entries(prev)) {
            const filtered = users.filter((u) => u.userId !== userId);
            if (filtered.length !== users.length) changed = true;
            next[roomId] = filtered;
          }
          return changed ? next : prev;
        });
      }
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

    s.on("contact:request", ({ from }) => {
      // Refresh users so the Friends badge / requests list update live.
      api.getUsers().then(setAllUsers).catch(console.error);
      playPing();
      if (
        from?.username &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification("New friend request", {
          body: `${from.username} sent you a friend request`,
        });
      }
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

    // Re-pull everything whenever the socket (re)connects — this covers BOTH
    // automatic reconnects and manual ones (the foreground handler), and unlike
    // the manager's "reconnect" event it also fires for a socket-level connect.
    // So any notification (DM, group, channel, friend request/accept/decline)
    // that arrived while the socket was suspended/dropped surfaces without a
    // page refresh. The very first connect is skipped — the load effect already
    // fetched the initial state.
    let firstConnect = true;
    const onConnect = () => {
      if (firstConnect) {
        firstConnect = false;
        return;
      }
      // syncRooms() reads each room's unread_count (and snapshots the open
      // room's "New Messages" divider) before refreshActiveRoomMessages
      // re-fetches messages, which advances the server read marker. syncPresence
      // refreshes users — which also recovers pending friend requests.
      syncRooms().then(() => refreshActiveRoomMessages());
      syncPresence();
      // Typing is ephemeral — drop anything that may have gone stale.
      setTypingMap({});
    };
    s.on("connect", onConnect);

    return () => {
      s.off("connect", onConnect);
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
    // The setters and refs passed in are stable identities (useState setters /
    // useRef), so they're intentionally omitted from the dependency list —
    // matching how this effect lived inside ChatApp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    token,
    currentUser.id,
    currentUser.username,
    playPing,
    syncRooms,
    syncPresence,
    refreshActiveRoomMessages,
  ]);
}
