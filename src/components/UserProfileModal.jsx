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
  isDark,
  onClose,
  onMessage,
  onAddContact,
  onAcceptContact,
  onCancelRequest,
  onRemoveContact,
  onRoleChange,
  onMute,
  onKick,
  onTransferOwnership,
}) {
  const [confirm, setConfirm] = useState(null);
  const [pickingMute, setPickingMute] = useState(false);
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
  const roleBtns = assignableRoles(myRole).filter((r) => r !== targetRole);
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

  return (
    <div className="fixed inset-0 z-600 flex items-end sm:items-center justify-center p-4">
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
          <X size={16} />
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
          <div className="pt-4">
            {contactStatus === "accepted" && (
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

            {contactStatus === "pending_received" && (
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

            {contactStatus === "pending_sent" && (
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

            {(!contactStatus || contactStatus === "none") && (
              <button
                onClick={onAddContact}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 transition-all"
              >
                <UserPlus size={15} /> Add Friend
              </button>
            )}

            {contactStatus === "accepted" && (
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

          {/* Channel management */}
          {showManageSection && (
            <div className="pt-1" style={{ borderTop: `1px solid ${divider}` }}>
              <div className="pt-3 space-y-3">
                {canManage && roleBtns.length > 0 && (
                  <div>
                    {sectionLabel("Set Role")}
                    <div
                      className="grid gap-1.5"
                      style={{ gridTemplateColumns: `repeat(${roleBtns.length}, 1fr)` }}
                    >
                      {roleBtns.map((role) => {
                        const meta = ROLE_META[role];
                        return (
                          <button
                            key={role}
                            onClick={() => {
                              onRoleChange(role);
                              onClose();
                            }}
                            className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors"
                            style={{
                              background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)",
                              color: meta.color,
                              boxShadow: `0 0 0 1px ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
                            }}
                          >
                            <meta.Icon size={15} strokeWidth={2} />
                            <span className="text-[10px] font-semibold leading-none">
                              {meta.label}
                            </span>
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

          {!contactStatus && !showManageSection && (
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
