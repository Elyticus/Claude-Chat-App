import { useState } from "react";
import {
  X,
  User,
  UserPlus,
  UserMinus,
  VolumeX,
  Volume2,
  Crown,
  ShieldCheck,
  UserCheck,
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

const MUTE_DURATIONS = [
  { label: "5m", seconds: 300 },
  { label: "30m", seconds: 1800 },
  { label: "1h", seconds: 3600 },
  { label: "8h", seconds: 28800 },
  { label: "24h", seconds: 86400 },
];

// Static role button config — colours match roleBadge
const ROLE_BUTTONS = [
  {
    role: "admin",
    label: "Admin",
    Icon: ShieldCheck,
    dark:  { color: "#5da8e8", bg: "rgba(12,68,124,0.28)", ring: "rgba(93,168,232,0.55)", hover: "rgba(12,68,124,0.18)" },
    light: { color: "#1d4ed8", bg: "rgba(30,64,175,0.12)", ring: "rgba(30,64,175,0.45)", hover: "rgba(30,64,175,0.07)" },
  },
  {
    role: "moderator",
    label: "Mod",
    Icon: UserCheck,
    dark:  { color: "#40c99a", bg: "rgba(8,80,65,0.32)", ring: "rgba(64,201,154,0.55)", hover: "rgba(8,80,65,0.20)" },
    light: { color: "#085041", bg: "rgba(8,80,65,0.12)", ring: "rgba(8,80,65,0.45)",    hover: "rgba(8,80,65,0.07)" },
  },
  {
    role: "member",
    label: "Member",
    Icon: User,
    dark:  { color: "#a5b4fc", bg: "rgba(99,102,241,0.22)", ring: "rgba(165,180,252,0.55)", hover: "rgba(99,102,241,0.13)" },
    light: { color: "#4f46e5", bg: "rgba(99,102,241,0.12)", ring: "rgba(99,102,241,0.45)",  hover: "rgba(99,102,241,0.06)" },
  },
];

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

export function GroupMembersPanel({
  members,
  onClose,
  onlineIds,
  avatarMap,
  isDark,
  isChannel,
  myRole,
  currentUserId,
  onKick,
  onRoleChange,
  onMute,
  onTransferOwnership,
  onAddMember,
  allUsers,
}) {
  const [actionTarget, setActionTarget] = useState(null);
  const [muteTarget, setMuteTarget]     = useState(null);
  const [showAdd, setShowAdd]           = useState(false);
  const [addSearch, setAddSearch]       = useState("");
  const [nowSec]                        = useState(() => Math.floor(Date.now() / 1000));

  function canManage(targetRole) {
    if (!myRole || !isChannel) return false;
    return (
      ROLE_LEVEL[myRole] >= ROLE_LEVEL.admin &&
      ROLE_LEVEL[myRole] > ROLE_LEVEL[targetRole] &&
      targetRole !== "owner"
    );
  }

  function canMuteTarget(targetRole) {
    if (!myRole || !isChannel) return false;
    return (
      ROLE_LEVEL[myRole] >= ROLE_LEVEL.moderator &&
      ROLE_LEVEL[myRole] > ROLE_LEVEL[targetRole] &&
      targetRole !== "owner"
    );
  }

  // Roles the current actor is allowed to assign (excludes their own level+)
  function getAssignableRoles() {
    if (myRole === "owner") return ["admin", "moderator", "member"];
    if (myRole === "admin") return ["moderator", "member"];
    return [];
  }

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

  const assignableRoles = getAssignableRoles();
  const roleBtns = ROLE_BUTTONS.filter((rb) => assignableRoles.includes(rb.role));

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
            {isChannel && ROLE_LEVEL[myRole] >= ROLE_LEVEL.admin && (
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
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Add member search */}
        {showAdd && isChannel && ROLE_LEVEL[myRole] >= ROLE_LEVEL.admin && (
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
            const isOnline    = onlineIds.has(m.id);
            const isMe        = m.id === currentUserId;
            const isMuted     = m.muted_until && m.muted_until > nowSec;
            const showManage  = isChannel && !isMe && canManage(m.role);
            const showMuteBtn = isChannel && !isMe && canMuteTarget(m.role);
            const showActions = showManage || showMuteBtn;
            const isActing    = actionTarget === m.id;
            const isMutePick  = muteTarget === m.id;
            const canTransfer = myRole === "owner" && m.role === "admin";

            return (
              <div key={m.id} className="rounded-xl overflow-hidden">
                {/* Member row */}
                <div
                  className="flex items-center gap-3 px-3 py-2.5 transition-all"
                  onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.04)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                >
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
                  {showActions && (
                    <button
                      onClick={() => { setActionTarget(isActing ? null : m.id); setMuteTarget(null); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 transition-all"
                      style={{ ...btnBase, ...(isActing ? btnActive : {}) }}
                      title="Manage member"
                    >
                      •••
                    </button>
                  )}
                </div>

                {/* ── Expanded action panel ── */}
                {isActing && showActions && !isMutePick && (
                  <div
                    className="px-3 pt-2 pb-3 space-y-2.5"
                    style={{ background: isDark ? "rgba(99,102,241,0.04)" : "rgba(99,102,241,0.03)" }}
                  >
                    {/* Role assignment grid */}
                    {showManage && roleBtns.length > 0 && (
                      <div className="space-y-1.5">
                        <p
                          className="text-[10px] font-semibold uppercase tracking-widest px-0.5"
                          style={{ color: isDark ? "rgba(238,242,255,0.3)" : "#94a3b8" }}
                        >
                          Set Role
                        </p>
                        <div
                          className="grid gap-1.5"
                          style={{ gridTemplateColumns: `repeat(${roleBtns.length}, 1fr)` }}
                        >
                          {roleBtns.map((rb) => {
                            const isCurrent = m.role === rb.role;
                            const c = isDark ? rb.dark : rb.light;
                            return (
                              <button
                                key={rb.role}
                                disabled={isCurrent}
                                onClick={() => {
                                  if (!isCurrent) { onRoleChange(m.id, rb.role); setActionTarget(null); }
                                }}
                                className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors"
                                style={{
                                  background: isCurrent ? c.bg : isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)",
                                  color: isCurrent ? c.color : isDark ? "rgba(238,242,255,0.35)" : "#94a3b8",
                                  boxShadow: isCurrent
                                    ? `0 0 0 1.5px ${c.ring}`
                                    : `0 0 0 1px ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
                                  cursor: isCurrent ? "default" : "pointer",
                                }}
                                onMouseEnter={(e) => {
                                  if (!isCurrent) {
                                    e.currentTarget.style.background = c.hover;
                                    e.currentTarget.style.color = c.color;
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isCurrent) {
                                    e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)";
                                    e.currentTarget.style.color = isDark ? "rgba(238,242,255,0.35)" : "#94a3b8";
                                  }
                                }}
                              >
                                <rb.Icon size={14} strokeWidth={isCurrent ? 2.5 : 1.75} />
                                <span className="text-[10px] font-semibold leading-none">{rb.label}</span>
                                {isCurrent && (
                                  <span className="text-[8px] font-medium opacity-70 leading-none">current</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Divider between role grid and action buttons */}
                    {showManage && roleBtns.length > 0 && (canTransfer || showMuteBtn || showManage) && (
                      <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }} />
                    )}

                    {/* Action buttons: Transfer Ownership · Mute/Unmute · Kick */}
                    <div className="flex gap-1.5 flex-wrap">
                      {canTransfer && (
                        <button
                          onClick={() => { onTransferOwnership(m.id, m.username); setActionTarget(null); onClose(); }}
                          className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                          style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}
                        >
                          <Crown size={10} /> Transfer
                        </button>
                      )}
                      {showMuteBtn && (
                        <button
                          onClick={() => isMuted ? onMute(m.id, 0) : setMuteTarget(m.id)}
                          className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                          style={
                            isMuted
                              ? { background: "rgba(34,197,94,0.10)",  color: "#4ade80" }
                              : { background: "rgba(251,191,36,0.10)", color: "#fbbf24" }
                          }
                        >
                          {isMuted
                            ? <><Volume2 size={10} /> Unmute</>
                            : <><VolumeX size={10} /> Mute</>}
                        </button>
                      )}
                      {showManage && (
                        <button
                          onClick={() => { onKick(m.id); setActionTarget(null); onClose(); }}
                          className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                          style={{ background: "rgba(239,68,68,0.10)", color: "#f87171" }}
                        >
                          <UserMinus size={10} /> Kick
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Mute duration picker */}
                {isMutePick && (
                  <div
                    className="flex flex-wrap gap-1.5 px-3 pb-2.5"
                    style={{ background: isDark ? "rgba(251,191,36,0.04)" : "rgba(251,191,36,0.03)" }}
                  >
                    {MUTE_DURATIONS.map(({ label, seconds }) => (
                      <button
                        key={label}
                        onClick={() => { onMute(m.id, seconds); setMuteTarget(null); setActionTarget(null); }}
                        className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
                        style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      onClick={() => setMuteTarget(null)}
                      className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                      style={{ color: isDark ? "rgba(238,242,255,0.35)" : "#94a3b8" }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
