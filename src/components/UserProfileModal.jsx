import { useState } from "react";
import {
  X,
  MessageCircle,
  UserPlus,
  UserMinus,
  Check,
  Crown,
  ShieldCheck,
  UserCheck,
  User,
  VolumeX,
  Volume2,
  Users,
  Hash,
  Plus,
  ChevronRight,
} from "lucide-react";
import { Avatar } from "./ui/Avatar.jsx";
import { ConfirmModal } from "./ConfirmModal.jsx";
import {
  ROLE_LEVEL,
  darkBg1,
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

// Role pill metadata — mirrors GroupMembersPanel's roleBadge colours.
const ROLE_META = {
  owner: { label: "Owner", Icon: Crown, color: "#fbbf24", bg: "rgba(251,191,36,0.15)" },
  admin: { label: "Admin", Icon: ShieldCheck, color: "#5da8e8", bg: "rgba(12,68,124,0.28)" },
  moderator: { label: "Mod", Icon: UserCheck, color: "#40c99a", bg: "rgba(8,80,65,0.32)" },
  member: { label: "Member", Icon: User, color: "#a5b4fc", bg: "rgba(99,102,241,0.22)" },
};

// Roles an actor of `myRole` is allowed to assign (never their own level or up).
function assignableRoles(myRole) {
  if (myRole === "owner") return ["admin", "moderator", "member"];
  if (myRole === "admin") return ["moderator", "member"];
  return [];
}

// ─── User Profile ────────────────────────────────────────────────────────────
// One place for every action that can be taken on a user. Always shows the
// contact actions (Message / Add / Accept / Cancel / Remove). When opened from
// inside a channel (`manage` provided), it ALSO surfaces the role-gated
// moderation actions (set role, mute/unmute, transfer ownership, remove from
// channel) — so admins manage members here instead of a separate menu.
export function UserProfileModal({
  user,
  online,
  contactStatus,
  manage = null, // { myRole, targetRole, mutedUntil } when in a channel
  inMemberList = false, // opened from a channel/group member list
  groups = [],
  channels = [],
  sharedRoomIds = null, // Set of room ids the target is already in (async)
  isDark,
  onClose,
  onMessage,
  onAddContact,
  onAcceptContact,
  onCancelRequest,
  onRemoveContact,
  onAddToGroup,
  onAddToChannel,
  onRoleChange,
  onMute,
  onKick,
  onTransferOwnership,
}) {
  const [confirm, setConfirm] = useState(null);
  const [pickingMute, setPickingMute] = useState(false);
  const [expandAdd, setExpandAdd] = useState(null); // "group" | "channel" | null
  const [busyRoom, setBusyRoom] = useState(null);
  const [addedRooms, setAddedRooms] = useState(() => new Set());
  const [addError, setAddError] = useState(null); // { roomId, msg }
  const [nowSec] = useState(() => Math.floor(Date.now() / 1000));

  if (!user) return null;

  const myRole = manage?.myRole || null;
  const targetRole = manage?.targetRole || null;
  const lvl = ROLE_LEVEL;
  const canManage =
    !!manage &&
    !!myRole &&
    lvl[myRole] >= lvl.admin &&
    lvl[myRole] > lvl[targetRole] &&
    targetRole !== "owner";
  const canMute =
    !!manage &&
    !!myRole &&
    lvl[myRole] >= lvl.moderator &&
    lvl[myRole] > lvl[targetRole] &&
    targetRole !== "owner";
  const canTransfer = !!manage && myRole === "owner" && targetRole === "admin";
  const isMuted = !!manage?.mutedUntil && manage.mutedUntil > nowSec;
  // Always show all three assignable roles; the actor's permission decides
  // which are clickable (the current role and ones above the actor are shown
  // but disabled).
  const ALL_ROLES = ["admin", "moderator", "member"];
  const assignRoles = assignableRoles(myRole);
  const showManageSection = canManage || canMute || canTransfer;

  const headerColor = isDark ? "#eef2ff" : "#0f172a";
  const subColor = isDark ? "rgba(165,180,252,0.5)" : "#94a3b8";
  const divider = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  // A labelled section heading above a group of actions.
  const sectionLabel = (text) => (
    <p
      className="text-[10px] font-semibold uppercase tracking-widest px-0.5 mb-1.5"
      style={{ color: subColor }}
    >
      {text}
    </p>
  );

  const targetMeta = targetRole ? ROLE_META[targetRole] : null;

  // Rooms the target hasn't joined yet. `sharedRoomIds` is a Set once the
  // shared-rooms data is known (seeded instantly from cache on reopen, or after
  // the fetch on first open) and `null` while still loading. We only show the
  // "Add to" options once it's a Set — showing them before membership is known
  // makes already-joined rooms flash in and then vanish. `addedRooms` is also
  // excluded so a room the owner just added drops out of the list instantly.
  const sharedLoaded = sharedRoomIds instanceof Set;
  const isAddable = (r) =>
    sharedLoaded && !sharedRoomIds.has(r.id) && !addedRooms.has(r.id);
  const addableGroups = groups.filter(isAddable);
  const addableChannels = channels.filter(isAddable);

  // "Add to a group" needs the target to be a contact; "Add to a channel" is
  // owner-only (the `channels` list is already pre-filtered to owned channels).
  const canAddToGroup = contactStatus === "accepted" && addableGroups.length > 0;
  const canAddToChannel = addableChannels.length > 0;
  const showAddSection = canAddToGroup || canAddToChannel;

  // In a channel/group member list, hide the friend-list actions (Message and
  // Remove Friend). Adding a non-contact as a friend is still allowed.
  const showMessage = !inMemberList && contactStatus === "accepted";
  const showRemoveFriend = !inMemberList && contactStatus === "accepted";
  const showAddFriend = !contactStatus || contactStatus === "none";
  const showAccept = contactStatus === "pending_received";
  const showCancel = contactStatus === "pending_sent";
  const hasContactActions =
    showMessage || showRemoveFriend || showAddFriend || showAccept || showCancel;

  async function doAdd(kind, room) {
    setBusyRoom(room.id);
    setAddError(null);
    try {
      await (kind === "group" ? onAddToGroup(room.id) : onAddToChannel(room.id));
      setAddedRooms((prev) => new Set(prev).add(room.id));
    } catch (e) {
      setAddError({ roomId: room.id, msg: e.message || "Couldn't add to this room" });
    } finally {
      setBusyRoom(null);
    }
  }

  // Collapsible "Add to a group / channel" picker. `list` is already filtered
  // to the rooms the target hasn't joined (see addableGroups/addableChannels).
  const addPicker = (kind, label, Icon, list) => {
    const open = expandAdd === kind;
    return (
      <div>
        <button
          onClick={() => {
            setExpandAdd(open ? null : kind);
            setAddError(null);
          }}
          className="w-full flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all"
          style={{
            background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)",
            color: headerColor,
          }}
        >
          <Icon size={15} style={{ color: isDark ? "#a5b4fc" : "#6366f1" }} />
          <span className="flex-1 text-left">{label}</span>
          <ChevronRight
            size={15}
            style={{ color: subColor, transform: open ? "rotate(90deg)" : "none" }}
          />
        </button>
        {open && (
          <div className="mt-1 max-h-40 overflow-y-auto space-y-0.5 pl-1 pr-0.5">
            {list.length === 0 && (
              <p className="text-xs px-3 py-2" style={{ color: subColor }}>
                {kind === "group"
                  ? "No groups to add them to — create one in New Chat."
                  : "No channels you own."}
              </p>
            )}
            {list.map((r) => {
              const name =
                kind === "channel" ? `#${r.name || r.slug}` : r.name || "Group";
              const busy = busyRoom === r.id;
              return (
                <button
                  key={r.id}
                  disabled={busy}
                  onClick={() => doAdd(kind, r)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all"
                  style={{
                    color: headerColor,
                    background: "transparent",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (!busy)
                      e.currentTarget.style.background = isDark
                        ? "rgba(99,102,241,0.08)"
                        : "rgba(99,102,241,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    if (!busy) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span className="truncate">{name}</span>
                  {busy ? (
                    <span className="text-xs" style={{ color: subColor }}>
                      Adding…
                    </span>
                  ) : (
                    <Plus size={15} style={{ color: subColor }} />
                  )}
                </button>
              );
            })}
            {addError && (
              <p className="text-xs px-3 pt-1" style={{ color: "#f87171" }}>
                {addError.msg}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-600 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{
          background: isDark ? "rgba(7,13,28,0.88)" : "rgba(15,23,42,0.3)",
          backdropFilter: "blur(8px)",
        }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${user.username} profile`}
        className="relative w-full sm:w-80 max-h-[85dvh] flex flex-col overflow-hidden rounded-2xl animate-scale-in"
        style={{
          background: isDark ? darkBg1 : lightBg1,
          border: `1px solid ${isDark ? darkBorderMid : lightBorderMid}`,
          boxShadow: isDark
            ? "0 32px 80px rgba(0,0,0,0.7)"
            : "0 32px 80px rgba(99,102,241,0.12)",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all"
          style={{ color: isDark ? "rgba(238,242,255,0.45)" : "#64748b" }}
        >
          <X size={22} />
        </button>

        {/* Identity */}
        <div className="flex flex-col items-center text-center px-6 pt-8 pb-5">
          <Avatar
            userId={user.id}
            username={user.username}
            size={84}
            online={online}
            avatar={user.avatar}
          />
          <div
            className="mt-3 text-lg font-semibold truncate max-w-full"
            style={{ color: headerColor }}
          >
            {user.username}
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap justify-center">
            <span
              className="text-xs font-medium"
              style={{ color: online ? "#34d399" : subColor }}
            >
              {online ? "Online" : "Offline"}
            </span>
            {targetMeta && targetRole !== "member" && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                style={{ background: targetMeta.bg, color: targetMeta.color }}
              >
                <targetMeta.Icon size={10} strokeWidth={2.5} />
                {targetMeta.label}
              </span>
            )}
            {contactStatus === "accepted" && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                style={{
                  background: "rgba(99,102,241,0.15)",
                  color: isDark ? "#a5b4fc" : "#4f46e5",
                }}
              >
                <Check size={10} /> Friend
              </span>
            )}
            {isMuted && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                style={{ background: "rgba(248,113,113,0.14)", color: "#f87171" }}
              >
                <VolumeX size={10} /> Muted
              </span>
            )}
          </div>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto px-4 pb-5 space-y-4"
          style={{ borderTop: `1px solid ${divider}` }}
        >
          {/* Contact actions */}
          {hasContactActions && (
          <div className="pt-4">
            {showMessage && (
              <button
                onClick={onMessage}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 mb-2"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #6366f1)",
                  boxShadow: "0 2px 12px rgba(99,102,241,0.4)",
                }}
              >
                <MessageCircle size={16} /> Message
              </button>
            )}

            {showAccept && (
              <div className="flex gap-2">
                <button
                  onClick={onAcceptContact}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all"
                >
                  <Check size={15} /> Accept
                </button>
                <button
                  onClick={onCancelRequest}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                >
                  Decline
                </button>
              </div>
            )}

            {showCancel && (
              <button
                onClick={onCancelRequest}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isDark
                    ? "bg-white/6 text-white/55 hover:bg-red-500/15 hover:text-red-400"
                    : "bg-black/5 text-slate-500 hover:bg-red-500/10 hover:text-red-500"
                }`}
              >
                Cancel Friend Request
              </button>
            )}

            {showAddFriend && (
              <button
                onClick={onAddContact}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 transition-all"
              >
                <UserPlus size={15} /> Add Friend
              </button>
            )}

            {showRemoveFriend && (
              <button
                onClick={() =>
                  setConfirm({
                    title: "Remove friend?",
                    body: `Remove ${user.username} from your friends? You'll need to send a new request to reconnect.`,
                    confirmLabel: "Remove",
                    action: onRemoveContact,
                  })
                }
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isDark
                    ? "bg-white/6 text-white/55 hover:bg-red-500/15 hover:text-red-400"
                    : "bg-black/5 text-slate-500 hover:bg-red-500/10 hover:text-red-500"
                }`}
              >
                <UserMinus size={15} /> Remove Friend
              </button>
            )}
          </div>
          )}

          {/* Add to a group / channel */}
          {showAddSection && (
            <div className="pt-1" style={{ borderTop: `1px solid ${divider}` }}>
              <div className="pt-3 space-y-1.5">
                {sectionLabel("Add to")}
                {canAddToGroup &&
                  addPicker("group", "Add to a group", Users, addableGroups)}
                {canAddToChannel &&
                  addPicker("channel", "Add to a channel", Hash, addableChannels)}
              </div>
            </div>
          )}

          {/* Channel management */}
          {showManageSection && (
            <div className="pt-1" style={{ borderTop: `1px solid ${divider}` }}>
              <div className="pt-3 space-y-3">
                {canManage && (
                  <div>
                    {sectionLabel("Set Role")}
                    <div
                      className="grid gap-1.5"
                      style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
                    >
                      {ALL_ROLES.map((role) => {
                        const meta = ROLE_META[role];
                        const isCurrent = role === targetRole;
                        const canSet = assignRoles.includes(role) && !isCurrent;
                        return (
                          <button
                            key={role}
                            disabled={!canSet}
                            onClick={() => {
                              if (!canSet) return;
                              onRoleChange(role);
                              onClose();
                            }}
                            className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors"
                            style={{
                              background: isCurrent
                                ? meta.bg
                                : isDark
                                  ? "rgba(255,255,255,0.03)"
                                  : "rgba(0,0,0,0.025)",
                              color: meta.color,
                              opacity: canSet || isCurrent ? 1 : 0.4,
                              cursor: canSet ? "pointer" : "default",
                              boxShadow: isCurrent
                                ? `0 0 0 1.5px ${meta.color}`
                                : `0 0 0 1px ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
                            }}
                          >
                            <meta.Icon
                              size={15}
                              strokeWidth={isCurrent ? 2.5 : 2}
                            />
                            <span className="text-[10px] font-semibold leading-none">
                              {meta.label}
                            </span>
                            {isCurrent && (
                              <span className="text-[8px] font-medium opacity-70 leading-none">
                                current
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(canMute || canTransfer || canManage) && (
                  <div>
                    {sectionLabel("Moderation")}
                    {pickingMute ? (
                      <div className="flex flex-wrap gap-1.5">
                        {MUTE_DURATIONS.map(({ label, seconds }) => (
                          <button
                            key={label}
                            onClick={() => {
                              onMute(seconds);
                              setPickingMute(false);
                              onClose();
                            }}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                            style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}
                          >
                            {label}
                          </button>
                        ))}
                        <button
                          onClick={() => setPickingMute(false)}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                          style={{ color: subColor }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {canMute && (
                          <button
                            onClick={() => {
                              if (isMuted) {
                                onMute(0);
                                onClose();
                              } else {
                                setPickingMute(true);
                              }
                            }}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
                            style={
                              isMuted
                                ? { background: "rgba(34,197,94,0.10)", color: "#4ade80" }
                                : { background: "rgba(251,191,36,0.10)", color: "#fbbf24" }
                            }
                          >
                            {isMuted ? (
                              <>
                                <Volume2 size={13} /> Unmute
                              </>
                            ) : (
                              <>
                                <VolumeX size={13} /> Mute
                              </>
                            )}
                          </button>
                        )}
                        {canTransfer && (
                          <button
                            onClick={() => {
                              // The parent (handleTransferOwnership) shows its
                              // own confirmation dialog, so don't double-confirm.
                              onTransferOwnership();
                              onClose();
                            }}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
                            style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}
                          >
                            <Crown size={13} /> Transfer
                          </button>
                        )}
                        {canManage && (
                          <button
                            onClick={() =>
                              setConfirm({
                                title: "Remove from channel?",
                                body: `Remove ${user.username} from this channel? They'll need to be re-added or rejoin.`,
                                confirmLabel: "Remove",
                                action: onKick,
                              })
                            }
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
                            style={{ background: "rgba(239,68,68,0.10)", color: "#f87171" }}
                          >
                            <UserMinus size={13} /> Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {!contactStatus && !showManageSection && !showAddSection && (
            <p className="text-xs text-center pb-1" style={{ color: subColor }}>
              Not in your contacts yet.
            </p>
          )}
        </div>
      </div>

      {/* Destructive confirmation (remove friend / kick / transfer) — rendered
          after the panel so it stacks above it within this z-600 layer. */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          cancelLabel="Cancel"
          onConfirm={() => {
            confirm.action();
            onClose();
          }}
          onClose={() => setConfirm(null)}
          isDark={isDark}
        />
      )}
    </div>
  );
}
