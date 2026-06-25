import { Search, X, Pin } from "lucide-react";
import { ChatHeader } from "./ChatHeader.jsx";
import { MessageList } from "./MessageList.jsx";
import { MessageComposer } from "./MessageComposer.jsx";
import { SmartReplies } from "./SmartReplies.jsx";
import { ChatBackdrop } from "./ChatBackdrop.jsx";
import { MAX_MESSAGE_LENGTH } from "../../hooks/useChatDerivedState.js";
import {
  ROLE_LEVEL,
  darkBg2,
  darkBorder,
  lightBorderMid,
} from "../../lib/constants.js";

// Translucent version of a #rrggbb token, so the top/bottom bars let the doodle
// backdrop show through and the whole chat box reads as one filled surface.
function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// The open-conversation surface: a solid backdrop over the orbital hub plus the
// chat panel itself (header, message search bar, pinned banner, message list,
// composer). Lifted out of ChatApp's render verbatim — presentational; all
// state and handlers are passed in. The two wrapping divs carry the iOS
// visual-viewport sizing (--vvt / --vvh) the keyboard handling depends on.
export function ChatPanel({
  bg0,
  bgRaised,
  isDark,
  displayRoomId,
  activeRoomId,
  activeRoom,
  activeRoomName,
  activeAvatarId,
  activeRoomOnline,
  avatarMap,
  isActiveChannel,
  isDmHeader,
  typingNames,
  myActiveRole,
  showMsgSearch,
  setShowMsgSearch,
  msgSearch,
  setMsgSearch,
  copiedSlug,
  setCopiedSlug,
  setEditChannelModal,
  setContextMenu,
  pinnedMessages,
  displayedMessages,
  messages,
  hasMoreMessages,
  loadingMore,
  newMarkerIndex,
  currentUser,
  inputText,
  canSend,
  inputError,
  nearLimit,
  overLimit,
  inputLength,
  inputRef,
  longPressTimerRef,
  messagesEndRef,
  closeRoom,
  openProfile,
  openGroupMembers,
  handleDeleteRoom,
  handleUnpinMessage,
  loadEarlierMessages,
  handleContextMenu,
  handleInputChange,
  handleKeyDown,
  stopTyping,
  sendMessage,
  ai,
  onFillInput,
}) {
  const roomKind = activeRoom
    ? isActiveChannel
      ? "channel"
      : activeRoom.is_group
        ? "group"
        : "dm"
    : "dm";
  // Mostly-opaque bars that still reveal the doodle backdrop behind them.
  const barBg = withAlpha(bgRaised, 0.6);
  return (
    <>
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
            isolation: "isolate",
          }}
        >
          {displayRoomId && activeRoom && (
            <>
              {/* Doodle backdrop behind the entire chat box. zIndex -1 keeps it
                  under the header/messages/composer; isolate (above) scopes it. */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: -1 }}
              >
                <ChatBackdrop kind={roomKind} isDark={isDark} />
              </div>
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
                bgRaised={barBg}
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
                aiEnabled={ai?.enabled}
                onCatchUp={() => ai?.openSummary(displayRoomId, activeRoomName)}
              />

              {/* Message search bar */}
              {showMsgSearch && (
                <div
                  className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0"
                  style={{
                    borderColor: isDark ? darkBorder : lightBorderMid,
                    background: isDark
                      ? withAlpha(darkBg2, 0.6)
                      : "rgba(248,250,252,0.78)",
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
                translations={ai?.translations}
                onClearTranslation={ai?.clearTranslation}
              />

              {ai && (
                <SmartReplies
                  enabled={ai.enabled}
                  replies={ai.replies && ai.replies.roomId === activeRoomId ? ai.replies : null}
                  isDark={isDark}
                  onLoad={() => ai.loadReplies(activeRoomId)}
                  onClear={ai.clearReplies}
                  onPick={(t) => {
                    onFillInput(t);
                    ai.clearReplies();
                  }}
                />
              )}

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
                bgRaised={barBg}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
