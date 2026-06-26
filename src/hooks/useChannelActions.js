import { api } from "../lib/api.js";

// Channel create/join + member moderation (kick, role, mute, add, transfer) and
// channel edit/pin/unpin, lifted out of ChatApp verbatim. All of these act on
// the currently displayed room. Returns plain handlers rebuilt each render so
// they always see the latest displayRoomId and (stable) setters.
export function useChannelActions({
  displayRoomId,
  currentUser,
  selectRoom,
  setShowNewChat,
  setRooms,
  setGroupMembersPanel,
  setConfirmModal,
  setEditChannelModal,
  onGateError,
}) {
  async function handleCreateChannel(name, slug, description, isPrivate) {
    // Create first, then close — so a failure (e.g. the per-plan channel cap)
    // keeps the create sheet open to show the error instead of closing silently.
    let roomId;
    try {
      ({ roomId } = await api.createChannel(name, slug, description, isPrivate));
    } catch (err) {
      // A plan-gate error (402 UPGRADE_REQUIRED) opens the upgrade modal; close
      // the create sheet so the paywall is unobstructed.
      if (onGateError?.(err)) {
        setShowNewChat(false);
        return;
      }
      throw err; // let NewChatModal surface the inline error
    }
    setShowNewChat(false);
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

  return {
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
  };
}
