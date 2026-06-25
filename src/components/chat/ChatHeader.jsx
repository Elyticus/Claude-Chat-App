import {
  ArrowLeft,
  Search,
  Pencil,
  Copy,
  Check,
  Users,
  Trash2,
  Lock,
  Sparkles,
} from "lucide-react";
import { Avatar } from "../ui/Avatar.jsx";
import { TypingIndicator } from "../ui/TypingIndicator.jsx";
import { ROLE_LEVEL, darkBorder, lightBorderMid } from "@/lib/constants.js";

// The chat panel's top bar: back button, the room identity (tap to open a DM
// partner's profile), and the contextual action buttons. Extracted from ChatApp
// verbatim; all behavior lives in the passed-in callbacks.
export function ChatHeader({
  activeRoom,
  activeRoomName,
  activeAvatarId,
  activeRoomOnline,
  avatarMap,
  isActiveChannel,
  isDmHeader,
  typingNames,
  myActiveRole,
  isDark,
  bgRaised,
  onClose,
  onOpenProfile,
  searchActive,
  onToggleSearch,
  onEditChannel,
  copiedSlug,
  onCopySlug,
  onOpenMembers,
  onDeleteRoom,
  aiEnabled,
  onCatchUp,
}) {
  const actions = [
    {
      icon: <Sparkles size={16} />,
      active: false,
      onClick: onCatchUp,
      title: "Catch me up (AI summary)",
      show: !!aiEnabled,
    },
    {
      icon: <Search size={16} />,
      active: searchActive,
      onClick: onToggleSearch,
      title: "Search messages",
      show: true,
    },
    {
      icon: <Pencil size={16} />,
      active: false,
      onClick: onEditChannel,
      title: "Edit channel",
      show: !!isActiveChannel && ROLE_LEVEL[myActiveRole] >= ROLE_LEVEL.admin,
    },
    {
      icon: copiedSlug ? <Check size={16} /> : <Copy size={16} />,
      active: copiedSlug,
      onClick: onCopySlug,
      title: copiedSlug ? "Copied!" : `Copy channel address (#${activeRoom.slug})`,
      show: !!isActiveChannel,
    },
    {
      icon: <Users size={16} />,
      active: false,
      onClick: onOpenMembers,
      title: "View members",
      show: !!activeRoom.is_group,
    },
    {
      icon: <Trash2 size={16} />,
      active: false,
      onClick: onDeleteRoom,
      title: isActiveChannel
        ? myActiveRole === "owner"
          ? "Delete channel"
          : "Leave channel"
        : "Delete chat",
      danger: true,
      show: true,
    },
  ];

  return (
    <div
      className="flex items-center gap-1.5 sm:gap-3 px-3 sm:px-4 py-3.5 border-b shrink-0"
      style={{
        borderColor: isDark ? darkBorder : lightBorderMid,
        background: bgRaised,
      }}
    >
      <button
        onClick={onClose}
        aria-label="Back to conversations"
        className="w-11 h-11 rounded-full flex items-center justify-center transition-all shrink-0"
        style={{ color: isDark ? "rgba(238,242,255,0.5)" : "#64748b" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isDark
            ? "rgba(99,102,241,0.1)"
            : "rgba(99,102,241,0.07)";
          e.currentTarget.style.color = isDark ? "#eef2ff" : "#0f172a";
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
      <div
        className={`flex items-center gap-1.5 sm:gap-3 flex-1 min-w-0 ${isDmHeader ? "cursor-pointer" : ""}`}
        onClick={isDmHeader ? onOpenProfile : undefined}
        role={isDmHeader ? "button" : undefined}
        title={isDmHeader ? `View ${activeRoomName}'s profile` : undefined}
      >
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
            {isActiveChannel && activeRoom.type === "private_channel" && (
              <Lock
                size={11}
                style={{
                  color: isDark ? "rgba(165,180,252,0.35)" : "#94a3b8",
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
                  ? activeRoom.description || activeRoom.name || "Channel"
                  : activeRoom.is_group
                    ? "Group chat"
                    : activeRoomOnline
                      ? "Active now"
                      : "Offline"}
              </span>
            )}
          </div>
        </div>
      </div>

      {actions
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
  );
}
