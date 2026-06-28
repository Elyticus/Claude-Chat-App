import { useState } from "react";
import {
  X,
  UserPlus,
  VolumeX,
  Crown,
  ShieldCheck,
  UserCheck,
  ChevronRight,
} from "lucide-react";
import { Avatar } from "./ui/Avatar.jsx";
import {
  ROLE_LEVEL,
  darkBg1,
  darkBorder,
  darkBorderMid,
  lightBg1,
  lightBorderMid,
} from "@/lib/constants.js";

function roleBadge(role, isDark) {
  const config = {
    owner:     { bg: isDark ? "rgba(251,191,36,0.15)" : "#FEF9C3", color: isDark ? "#fbbf24" : "#92400e", Icon: Crown },
    admin:     { bg: isDark ? "rgba(12,68,124,0.22)"  : "#E6F1FB", color: isDark ? "#5da8e8" : "#0C447C", Icon: ShieldCheck },
    moderator: { bg: isDark ? "rgba(8,80,65,0.22)"    : "#E1F5EE", color: isDark ? "#40c99a" : "#085041", Icon: UserCheck },
  };
  const c = config[role];
  if (!c) return null;
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  return (
    <span
      className="inline-flex items-center gap-0.75 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0"
      style={{ background: c.bg, color: c.color }}
    >
      <c.Icon size={9} strokeWidth={2.5} />
      {label}
    </span>
  );
}

// Member list. Each member opens the shared UserProfileModal (via onOpenProfile)
// where every action on that user lives — messaging, friend management, and (for
// channel admins) role changes, mute and removal. This panel itself only lists
// members and lets admins add new ones.
export function GroupMembersPanel({
  members,
  onClose,
  onlineIds,
  avatarMap,
  isDark,
  isChannel,
  myRole,
  currentUserId,
  onOpenProfile,
  onAddMember,
  allUsers,
}) {
  const [showAdd, setShowAdd]     = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [nowSec]                  = useState(() => Math.floor(Date.now() / 1000));

  const canAdd = isChannel && ROLE_LEVEL[myRole] >= ROLE_LEVEL.admin;

  const sortedMembers = isChannel
    ? [...members].sort((a, b) => (ROLE_LEVEL[b.role] || 0) - (ROLE_LEVEL[a.role] || 0))
    : members;

  const memberIdSet = new Set(members.map((m) => m.id));
  const addableUsers = (allUsers || [])
    .filter((u) => !memberIdSet.has(u.id) && u.id !== currentUserId)
    .filter((u) => !addSearch || u.username.toLowerCase().includes(addSearch.toLowerCase()))
    .slice(0, 8);

  const btnBase   = { color: isDark ? "rgba(165,180,252,0.5)" : "#94a3b8" };
  const btnActive = { background: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)", color: isDark ? "#a5b4fc" : "#6366f1" };

  return (
    <div className="fixed inset-0 z-500 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: isDark ? "rgba(7,13,28,0.88)" : "rgba(15,23,42,0.25)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Members"
        className="relative w-full sm:w-80 max-h-[80dvh] flex flex-col overflow-hidden rounded-2xl animate-scale-in"
        style={{
          background: isDark ? darkBg1 : lightBg1,
          border: `1px solid ${isDark ? darkBorderMid : lightBorderMid}`,
          boxShadow: isDark ? "0 32px 80px rgba(0,0,0,0.7)" : "0 32px 80px rgba(99,102,241,0.12)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3.5 border-b shrink-0"
          style={{ borderColor: isDark ? darkBorder : lightBorderMid }}
        >
          <span className="font-semibold text-sm" style={{ color: isDark ? "#eef2ff" : "#0f172a" }}>
            {isChannel ? "Channel Members" : "Members"} ({members.length})
          </span>
          <div className="flex items-center gap-1">
            {canAdd && (
              <button
                onClick={() => { setShowAdd((v) => !v); setAddSearch(""); }}
                title="Add member"
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                style={showAdd ? btnActive : btnBase}
              >
                <UserPlus size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
              style={btnBase}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Add member search */}
        {showAdd && canAdd && (
          <div
            className="px-3 pt-2.5 pb-2 border-b shrink-0"
            style={{ borderColor: isDark ? darkBorder : lightBorderMid }}
          >
            <input
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{
                background: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.05)",
                color: isDark ? "#eef2ff" : "#0f172a",
                border: `1px solid ${isDark ? darkBorder : lightBorderMid}`,
              }}
              placeholder="Search users to add…"
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
            />
            <div className="mt-1.5 max-h-36 overflow-y-auto space-y-0.5">
              {addableUsers.length === 0 ? (
                <p className="text-xs px-2 py-2" style={{ color: isDark ? "rgba(238,242,255,0.3)" : "#94a3b8" }}>
                  {addSearch ? "No users found" : "All users are already members"}
                </p>
              ) : (
                addableUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { onAddMember(u.id); setShowAdd(false); setAddSearch(""); }}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-left transition-all"
                    style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                  >
                    <Avatar userId={u.id} username={u.username} size={28} online={onlineIds.has(u.id)} avatar={avatarMap[u.id]} />
                    <span className="truncate">{u.username}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Member list */}
        <div className="flex-1 min-h-0 overflow-y-auto py-2 px-3 space-y-0.5">
          {sortedMembers.map((m) => {
            const isOnline = onlineIds.has(m.id);
            const isMe     = m.id === currentUserId;
            const isMuted  = m.muted_until && m.muted_until > nowSec;

            const row = (
              <>
                <Avatar userId={m.id} username={m.username} size={38} online={isOnline} avatar={avatarMap[m.id]} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium truncate" style={{ color: isDark ? "#eef2ff" : "#0f172a" }}>
                      {m.username}
                      {isMe && <span className="ml-1 opacity-40 text-xs">(you)</span>}
                    </span>
                    {isChannel && roleBadge(m.role, isDark)}
                    {isMuted && <VolumeX size={10} style={{ color: "#f87171", flexShrink: 0 }} />}
                  </div>
                  {isOnline && <div className="text-xs text-emerald-400 font-medium">Online</div>}
                </div>
                {!isMe && (
                  <ChevronRight
                    size={16}
                    className="shrink-0"
                    style={{ color: isDark ? "rgba(165,180,252,0.4)" : "#94a3b8" }}
                  />
                )}
              </>
            );

            // Tapping a member (not yourself) opens their profile, where all the
            // actions live. Your own row is a static, non-interactive entry.
            return isMe ? (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                {row}
              </div>
            ) : (
              <button
                key={m.id}
                onClick={() => onOpenProfile(m.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
              >
                {row}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
