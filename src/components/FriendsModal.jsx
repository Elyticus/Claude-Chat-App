import { useState } from "react";
import { Search, X, UserPlus, Users } from "lucide-react";
import { Avatar } from "./ui/Avatar.jsx";
import {
  darkBg1,
  darkBg2,
  darkBorder,
  darkBorderMid,
  lightBg1,
  lightBorderMid,
} from "@/lib/constants.js";

// ─── Friends ─────────────────────────────────────────────────────────────────
// Your friends list, lifted out of the "New Chat" modal into its own surface.
// Lists accepted friends (click a row to open their profile, where Message and
// every other action lives) plus any incoming friend requests. "Add" jumps to
// the New Chat → Find flow for sending new requests.
export function FriendsModal({
  contacts,
  pendingUsers = [],
  onlineIds,
  avatarMap,
  isDark,
  onOpenProfile,
  onAcceptContact,
  onRemoveContact,
  onAddFriend,
  onClose,
}) {
  const [search, setSearch] = useState("");
  const friends = contacts.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-500 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{
          background: isDark ? "rgba(7,13,28,0.88)" : "rgba(15,23,42,0.25)",
          backdropFilter: "blur(8px)",
        }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Friends"
        className="relative w-full sm:w-100 max-h-[85dvh] flex flex-col overflow-hidden rounded-2xl animate-scale-in"
        style={{
          background: isDark ? darkBg1 : lightBg1,
          border: `1px solid ${isDark ? darkBorderMid : lightBorderMid}`,
          boxShadow: isDark
            ? "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.06)"
            : "0 32px 80px rgba(99,102,241,0.12)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: isDark ? darkBorder : lightBorderMid }}
        >
          <span
            className="font-semibold flex items-center gap-2"
            style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
          >
            <Users size={17} style={{ color: isDark ? "#a5b4fc" : "#6366f1" }} />
            Friends
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onAddFriend}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #6366f1)",
                boxShadow: "0 2px 12px rgba(99,102,241,0.4)",
              }}
            >
              <UserPlus size={15} /> Add
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
              style={{ color: isDark ? "rgba(238,242,255,0.4)" : "#64748b" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Incoming friend requests */}
        {pendingUsers.length > 0 && (
          <div
            className="border-b shrink-0"
            style={{ borderColor: isDark ? darkBorder : lightBorderMid }}
          >
            <p
              className="text-[10px] uppercase tracking-widest px-5 pt-2.5 pb-1"
              style={{ color: isDark ? "rgba(251,191,36,0.8)" : "#92400e" }}
            >
              Requests ({pendingUsers.length})
            </p>
            <div className="max-h-44 overflow-y-auto px-2 pb-2">
              {pendingUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                >
                  <Avatar
                    userId={u.id}
                    username={u.username}
                    size={40}
                    online={onlineIds.has(u.id)}
                    avatar={avatarMap[u.id]}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-medium truncate"
                      style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
                    >
                      {u.username}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: isDark ? "rgba(251,191,36,0.7)" : "#b45309" }}
                    >
                      wants to connect
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => onAcceptContact(u.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => onRemoveContact(u.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-4 pt-3 shrink-0">
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{
              background: isDark ? darkBg2 : "#f8fafc",
              border: `1px solid ${isDark ? darkBorder : lightBorderMid}`,
            }}
          >
            <Search
              size={14}
              className="shrink-0"
              style={{ color: isDark ? "rgba(165,180,252,0.4)" : "#94a3b8" }}
            />
            <input
              type="text"
              placeholder="Search friends…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
            />
          </div>
        </div>

        {/* Friends list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 mt-1">
          {friends.length === 0 ? (
            <p
              className="text-center text-sm py-10"
              style={{ color: isDark ? "rgba(238,242,255,0.22)" : "#94a3b8" }}
            >
              {contacts.length === 0
                ? 'No friends yet — tap "Add" to find people'
                : "No friends match your search"}
            </p>
          ) : (
            <div className="space-y-0.5">
              {friends.map((u) => (
                <button
                  key={u.id}
                  onClick={() => onOpenProfile(u)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark
                      ? "rgba(99,102,241,0.07)"
                      : "rgba(99,102,241,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Avatar
                    userId={u.id}
                    username={u.username}
                    size={40}
                    online={onlineIds.has(u.id)}
                    avatar={avatarMap[u.id]}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-medium truncate"
                      style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
                    >
                      {u.username}
                    </div>
                    {onlineIds.has(u.id) && (
                      <div className="text-[11px] text-emerald-400 font-medium">
                        Online
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
