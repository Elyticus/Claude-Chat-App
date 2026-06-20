import { useMemo } from "react";
import { ROLE_LEVEL } from "../lib/constants.js";

// Must match the server's message:send limit (server/index.js).
export const MAX_MESSAGE_LENGTH = 4000;
// Show the live character counter once the user is within this many
// characters of the limit.
const LIMIT_WARN_THRESHOLD = 500;

// Pure values derived from chat state — contact lists, the avatar map, the
// active room and its display metadata, the "New Messages" divider index,
// typing names, message-length awareness, and the profile-sheet context.
// Lifted out of ChatApp verbatim; everything here is a function of the state
// passed in, so it lives in one place instead of inline in the component body.
export function useChatDerivedState({
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
}) {
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

  return {
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
  };
}
