import { api } from "../lib/api.js";

// Room + sheet navigation: open/close a room (with the read-state snapshot the
// "New Messages" divider depends on), delete/leave a room, open a DM with a
// user, open the members panel, the New Chat sheet, and the user-profile sheet,
// plus the "add user to group/channel" actions launched from a profile. Lifted
// out of ChatApp verbatim; all state, setters, refs, and the two cross-cutting
// helpers (clearRoomNotifs, stopTyping) are passed in.
export function useRoomNavigation({
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
}) {
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
    // Seed from this user's cached shared-room set (which includes any rooms we
    // just added them to) so the "Add to" pickers hide already-joined rooms
    // instantly on (re)open, instead of flashing them until the refetch lands.
    // A different user's entry is keyed separately, so no stale cross-user data.
    setProfileShared(new Set(sharedRoomsCacheRef.current[userId] || []));
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
  // Record that a user now shares this room with us, so the profile's "Add to"
  // option for it stays hidden even after the modal closes and reopens (the
  // local addedRooms state is lost on unmount; this cache persists).
  function rememberSharedRoom(userId, roomId) {
    const prev = sharedRoomsCacheRef.current[userId] || [];
    if (!prev.includes(roomId))
      sharedRoomsCacheRef.current[userId] = [...prev, roomId];
    setProfileShared((s) => new Set(s).add(roomId));
  }
  function addUserToGroup(roomId, userId) {
    return api.addGroupMember(roomId, userId).then((res) => {
      const u = allUsers.find((x) => x.id === userId);
      const room = rooms.find((r) => r.id === roomId);
      setToast(`Added ${u?.username || "user"} to ${room?.name || "the group"}`);
      rememberSharedRoom(userId, roomId);
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
      rememberSharedRoom(userId, roomId);
      return res;
    });
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

  return {
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
  };
}
