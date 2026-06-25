import { Check } from "lucide-react";
import { FriendsModal } from "../FriendsModal.jsx";
import { AccountModal } from "../AccountModal.jsx";
import { NewChatModal } from "../NewChatModal.jsx";
import { GroupMembersPanel } from "../GroupMembersPanel.jsx";
import { UserProfileModal } from "../UserProfileModal.jsx";
import { ContextMenu } from "../ContextMenu.jsx";
import { EditChannelModal } from "../EditChannelModal.jsx";
import { ConfirmModal } from "../ConfirmModal.jsx";
import { darkBorder } from "../../lib/constants.js";

// Every top-level overlay that floats above the hub + chat panel: friends,
// account, new chat, group members, user profile, context menu, channel edit,
// confirm dialog, and the confirmation toast. Lifted out of ChatApp's render
// verbatim — purely presentational; all state and handlers are passed in.
export function ChatModals({
  isDark,
  onlineIds,
  avatarMap,
  contacts,
  allUsers,
  currentUser,
  plan,
  onUpgrade,
  onCancelPlan,
  pendingUsers,
  friendNotifs,
  showFriends,
  setShowFriends,
  showAccount,
  setShowAccount,
  showNewChat,
  setShowNewChat,
  newChatTab,
  myAvatar,
  avatarFileRef,
  groupMembersPanel,
  setGroupMembersPanel,
  profile,
  profileUser,
  profileManage,
  profileGroups,
  profileChannels,
  profileShared,
  setProfile,
  contextMenu,
  setContextMenu,
  editChannelModal,
  setEditChannelModal,
  confirmModal,
  setConfirmModal,
  toast,
  pinnedMessages,
  displayRoomId,
  isActiveChannel,
  myActiveRole,
  onLogout,
  openProfile,
  openNewChat,
  handleAcceptContact,
  handleRemoveContact,
  handleSendRequest,
  clearFriendNotif,
  clearFriendNotifs,
  handleCreateGroup,
  handleCreateChannel,
  handleJoinChannel,
  handleAddMember,
  handleProfileMessage,
  addUserToGroup,
  addUserToChannel,
  handleRoleChange,
  handleMuteUser,
  handleKickMember,
  handleTransferOwnership,
  handleReact,
  handleCopy,
  handleDeleteMessage,
  handlePinMessage,
  handleUnpinMessage,
  handleEditChannel,
  aiEnabled,
  onTranslate,
}) {
  return (
    <>
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
          plan={plan}
          onUpgrade={() => {
            setShowAccount(false);
            onUpgrade?.();
          }}
          onCancelPlan={onCancelPlan}
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
          aiEnabled={aiEnabled}
          onTranslate={onTranslate}
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
    </>
  );
}
