import { useState, useRef, useEffect } from "react";
import { Search, X, Globe, Lock, Check } from "lucide-react";
import { Avatar } from "./ui/Avatar.jsx";
import { ContactStatusButton } from "./ui/ContactStatusButton.jsx";
import { ConfirmModal } from "./ConfirmModal.jsx";
import { api } from "@/lib/api.js";
import { toSlug } from "@/lib/helpers.js";
import {
  darkBg1,
  darkBg2,
  darkBorder,
  darkBorderMid,
  lightBg1,
  lightBorderMid,
} from "@/lib/constants.js";

export function NewChatModal({
  contacts,
  allUsers,
  onlineIds,
  onCreateGroup,
  onCreateChannel,
  onJoinChannel,
  onSendRequest,
  onAcceptContact,
  onRemoveContact,
  onClose,
  isDark,
  avatarMap,
  initialMode = "group",
}) {
  const [mode, setMode] = useState(initialMode);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [findError, setFindError] = useState("");
  const [findSuccess, setFindSuccess] = useState("");

  // Auto-dismiss the "request sent" confirmation after a few seconds.
  useEffect(() => {
    if (!findSuccess) return;
    const t = setTimeout(() => setFindSuccess(""), 4000);
    return () => clearTimeout(t);
  }, [findSuccess]);

  const [channelMode, setChannelMode] = useState("create");
  const [channelName, setChannelName] = useState("");
  const [channelSlug, setChannelSlug] = useState("");
  const [channelDesc, setChannelDesc] = useState("");
  const [channelPrivate, setChannelPrivate] = useState(false);
  const [slugManual, setSlugManual] = useState(false);
  const [joinSlug, setJoinSlug] = useState("");
  const [channelPreview, setChannelPreview] = useState(null);
  const [channelLookupError, setChannelLookupError] = useState("");
  const [channelError, setChannelError] = useState("");
  const lookupTimer = useRef(null);
  // Friend action awaiting confirmation — drives the warning dialog.
  // Shape: { user, kind: "cancel" (sent request) | "remove" (existing friend) }.
  const [confirmAction, setConfirmAction] = useState(null);

  const incoming = allUsers.filter(
    (u) => u.contact_status === "pending_received",
  );

  // Friend requests you've sent that haven't been accepted yet — shown in Find
  // so they're visible and cancelable without searching the person up again.
  const outgoing = allUsers.filter((u) => u.contact_status === "pending_sent");

  const searching = search.trim().length > 0;

  // "Find" is search-driven — never dump the whole user directory. Results
  // only appear once the user types a username to look someone up, so they
  // deliberately choose who to add as a friend.
  const findResults = searching
    ? allUsers
        .filter((u) => u.contact_status !== "pending_received")
        .filter((u) => u.username.toLowerCase().includes(search.toLowerCase()))
    : [];

  // "Direct" / "Group" tabs list only the user's accepted friends.
  const friends = contacts.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase()),
  );

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function submitGroup() {
    if (!groupName.trim() || selectedIds.length < 1) return;
    setCreating(true);
    await onCreateGroup(selectedIds, groupName.trim());
    setCreating(false);
  }

  function handleChannelNameChange(e) {
    const val = e.target.value;
    setChannelName(val);
    if (!slugManual) setChannelSlug(toSlug(val));
  }

  function handleSlugChange(e) {
    setSlugManual(true);
    setChannelSlug(
      e.target.value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .slice(0, 50),
    );
  }

  async function submitChannel() {
    setChannelError("");
    if (!channelName.trim()) {
      setChannelError("Channel name required");
      return;
    }
    if (!channelSlug.trim()) {
      setChannelError("Channel address required");
      return;
    }
    if (!/^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/.test(channelSlug)) {
      setChannelError(
        "Address must be lowercase letters, numbers, and dashes (e.g. my-channel)",
      );
      return;
    }
    setCreating(true);
    try {
      await onCreateChannel(
        channelName.trim(),
        channelSlug,
        channelDesc.trim(),
        channelPrivate,
      );
    } catch (err) {
      setChannelError(err.message || "Failed to create channel");
    } finally {
      setCreating(false);
    }
  }

  function handleJoinSlugChange(e) {
    const val = e.target.value;
    setJoinSlug(val);
    setChannelPreview(null);
    setChannelLookupError("");
    clearTimeout(lookupTimer.current);
    const clean = val.trim().toLowerCase().replace(/^#/, "");
    if (!clean) return;
    lookupTimer.current = setTimeout(async () => {
      try {
        const data = await api.lookupChannel(clean);
        setChannelPreview(data);
        setChannelLookupError("");
      } catch {
        setChannelPreview(null);
        setChannelLookupError("Channel not found");
      }
    }, 500);
  }

  async function submitJoin() {
    if (!joinSlug.trim()) return;
    setCreating(true);
    try {
      await onJoinChannel(joinSlug.trim());
    } catch (err) {
      setChannelLookupError(err.message || "Failed to join channel");
    } finally {
      setCreating(false);
    }
  }

  const tabs = [
    { id: "group", label: "Group" },
    { id: "channel", label: "Channel" },
    { id: "find", label: "Find", badge: incoming.length },
  ];

  const headerTitle =
    mode === "group"
      ? "New Group"
      : mode === "channel"
        ? "Channel"
        : "Add Friends";

  const inputCls = `w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all ${
    isDark
      ? "bg-[#10192e] border border-indigo-500/15 text-[#eef2ff] placeholder:text-indigo-300/20 focus:border-indigo-500/45"
      : "bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"
  }`;

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
        aria-label={headerTitle}
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
            className="font-semibold"
            style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
          >
            {headerTitle}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
            style={{ color: isDark ? "rgba(238,242,255,0.4)" : "#64748b" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 p-3 pb-0 shrink-0">
          {tabs.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMode(m.id);
                setSelectedIds([]);
                setSearch("");
                setFindError("");
                setFindSuccess("");
                setChannelError("");
                setChannelLookupError("");
              }}
              className="flex-1 relative py-2 rounded-xl text-xs font-medium transition-all"
              style={
                mode === m.id
                  ? {
                      background: isDark ? "#6366f1" : "#0f172a",
                      color: "#ffffff",
                      boxShadow: isDark
                        ? "0 2px 12px rgba(99,102,241,0.4)"
                        : "none",
                    }
                  : { color: isDark ? "rgba(238,242,255,0.45)" : "#64748b" }
              }
            >
              {m.label}
              {m.badge > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-4 h-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1"
                  style={{
                    background: "linear-gradient(135deg,#ef4444,#dc2626)",
                    boxShadow: "0 2px 6px rgba(239,68,68,0.5)",
                  }}
                >
                  {m.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Group name input */}
        {mode === "group" && (
          <div className="px-4 pt-3 shrink-0">
            <input
              className={inputCls}
              placeholder="Group name…"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>
        )}

        {/* Channel mode */}
        {mode === "channel" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex gap-1 px-4 pt-3 shrink-0">
              {["create", "join"].map((sub) => (
                <button
                  key={sub}
                  onClick={() => {
                    setChannelMode(sub);
                    setChannelError("");
                    setChannelLookupError("");
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
                  style={
                    channelMode === sub
                      ? {
                          background: isDark
                            ? "rgba(99,102,241,0.18)"
                            : "rgba(99,102,241,0.12)",
                          color: isDark ? "#a5b4fc" : "#4f46e5",
                        }
                      : { color: isDark ? "rgba(238,242,255,0.4)" : "#64748b" }
                  }
                >
                  {sub === "create" ? "Create" : "Join"}
                </button>
              ))}
            </div>

            {channelMode === "create" && (
              <div className="flex-1 overflow-y-auto px-4 pt-3 pb-5 space-y-3">
                <input
                  className={inputCls}
                  placeholder="Channel name…"
                  value={channelName}
                  onChange={handleChannelNameChange}
                />
                <div className="relative">
                  <span
                    className="absolute left-4 top-1/2 -translate-y-1/2 font-bold select-none"
                    style={{
                      color: isDark ? "rgba(165,180,252,0.5)" : "#94a3b8",
                    }}
                  >
                    #
                  </span>
                  <input
                    className={inputCls}
                    style={{ paddingLeft: "1.75rem" }}
                    placeholder="channel-address"
                    value={channelSlug}
                    onChange={handleSlugChange}
                  />
                </div>
                <input
                  className={inputCls}
                  placeholder="Description (optional)…"
                  value={channelDesc}
                  onChange={(e) => setChannelDesc(e.target.value)}
                />
                <button
                  onClick={() => setChannelPrivate((v) => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left"
                  style={{
                    background: channelPrivate
                      ? isDark
                        ? "rgba(99,102,241,0.12)"
                        : "rgba(99,102,241,0.07)"
                      : isDark
                        ? darkBg2
                        : "#f8fafc",
                    border: `1px solid ${isDark ? darkBorder : lightBorderMid}`,
                  }}
                >
                  {channelPrivate ? (
                    <Lock
                      size={15}
                      style={{ color: isDark ? "#a5b4fc" : "#6366f1" }}
                    />
                  ) : (
                    <Globe
                      size={15}
                      style={{
                        color: isDark ? "rgba(165,180,252,0.5)" : "#94a3b8",
                      }}
                    />
                  )}
                  <span
                    className="flex-1 text-sm"
                    style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
                  >
                    {channelPrivate ? "Private" : "Public"}
                  </span>
                  <span
                    className="text-xs"
                    style={{
                      color: isDark ? "rgba(165,180,252,0.4)" : "#94a3b8",
                    }}
                  >
                    {channelPrivate ? "Invite only" : "Anyone with the address"}
                  </span>
                </button>
                {channelError && (
                  <div
                    className="px-3 py-2 rounded-xl text-xs"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: "#f87171",
                    }}
                  >
                    {channelError}
                  </div>
                )}
                <button
                  onClick={submitChannel}
                  disabled={
                    !channelName.trim() || !channelSlug.trim() || creating
                  }
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-35 disabled:cursor-not-allowed transition-all hover:opacity-90"
                  style={{
                    background:
                      "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)",
                    boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
                  }}
                >
                  {creating ? "Creating…" : "Create Channel"}
                </button>
              </div>
            )}

            {channelMode === "join" && (
              <div className="flex-1 overflow-y-auto px-4 pt-3 pb-5 space-y-3">
                <div className="relative">
                  <span
                    className="absolute left-4 top-1/2 -translate-y-1/2 font-bold select-none"
                    style={{
                      color: isDark ? "rgba(165,180,252,0.5)" : "#94a3b8",
                    }}
                  >
                    #
                  </span>
                  <input
                    className={inputCls}
                    style={{ paddingLeft: "1.75rem" }}
                    placeholder="channel-address"
                    value={joinSlug}
                    onChange={handleJoinSlugChange}
                  />
                </div>
                {channelPreview && (
                  <div
                    className="rounded-xl px-4 py-3 space-y-1"
                    style={{
                      background: isDark ? darkBg2 : "#f8fafc",
                      border: `1px solid ${isDark ? darkBorder : lightBorderMid}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {channelPreview.type === "private_channel" ? (
                        <Lock
                          size={13}
                          style={{
                            color: isDark ? "rgba(165,180,252,0.5)" : "#94a3b8",
                          }}
                        />
                      ) : (
                        <Globe
                          size={13}
                          style={{
                            color: isDark ? "rgba(165,180,252,0.5)" : "#94a3b8",
                          }}
                        />
                      )}
                      <span
                        className="font-semibold text-sm"
                        style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
                      >
                        #{channelPreview.slug}
                      </span>
                      <span
                        className="text-xs"
                        style={{
                          color: isDark ? "rgba(165,180,252,0.4)" : "#94a3b8",
                        }}
                      >
                        · {channelPreview.memberCount} member
                        {channelPreview.memberCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {channelPreview.name && (
                      <div
                        className="text-sm font-medium"
                        style={{
                          color: isDark ? "rgba(238,242,255,0.8)" : "#334155",
                        }}
                      >
                        {channelPreview.name}
                      </div>
                    )}
                    {channelPreview.description && (
                      <div
                        className="text-xs"
                        style={{
                          color: isDark ? "rgba(165,180,252,0.5)" : "#64748b",
                        }}
                      >
                        {channelPreview.description}
                      </div>
                    )}
                    {channelPreview.isMember && (
                      <div className="text-xs text-emerald-400 font-medium">
                        You are already a member
                      </div>
                    )}
                  </div>
                )}
                {channelLookupError && (
                  <div
                    className="px-3 py-2 rounded-xl text-xs"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: "#f87171",
                    }}
                  >
                    {channelLookupError}
                  </div>
                )}
                <button
                  onClick={submitJoin}
                  disabled={
                    !joinSlug.trim() ||
                    creating ||
                    channelPreview?.type === "private_channel"
                  }
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-35 disabled:cursor-not-allowed transition-all hover:opacity-90"
                  style={{
                    background:
                      "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)",
                    boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
                  }}
                >
                  {creating
                    ? "Joining…"
                    : channelPreview?.isMember
                      ? "Open Channel"
                      : "Join Channel"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Selected chips */}
        {mode === "group" && selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3 shrink-0">
            {selectedIds.map((id) => {
              const u = contacts.find((x) => x.id === id);
              return u ? (
                <button
                  key={id}
                  onClick={() => toggleSelect(id)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-all"
                  style={{
                    background: isDark
                      ? "rgba(99,102,241,0.15)"
                      : "rgba(99,102,241,0.1)",
                    color: isDark ? "#a5b4fc" : "#4f46e5",
                  }}
                >
                  {u.username} <X size={10} />
                </button>
              ) : null;
            })}
          </div>
        )}

        {/* Search */}
        {mode !== "channel" && (
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
                placeholder={
                  mode === "group"
                    ? "Add friends…"
                    : "Search by username to add a friend…"
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
              />
            </div>
          </div>
        )}

        {/* User list */}
        {mode !== "channel" && (
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 mt-1">
            {mode === "find" ? (
              <div className="space-y-0.5">
                {incoming.length > 0 && !search && (
                  <div className="mb-2">
                    <p
                      className="text-[10px] uppercase tracking-widest px-3 py-1"
                      style={{
                        color: isDark ? "rgba(165,180,252,0.35)" : "#94a3b8",
                      }}
                    >
                      Requests
                    </p>
                    {incoming.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                        style={{
                          background: isDark
                            ? "rgba(99,102,241,0.07)"
                            : "rgba(99,102,241,0.05)",
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
                    <div
                      className="mx-3 my-2 border-t"
                      style={{
                        borderColor: isDark ? darkBorder : lightBorderMid,
                      }}
                    />
                  </div>
                )}
                {outgoing.length > 0 && !search && (
                  <div className="mb-2">
                    <p
                      className="text-[10px] uppercase tracking-widest px-3 py-1"
                      style={{
                        color: isDark ? "rgba(165,180,252,0.35)" : "#94a3b8",
                      }}
                    >
                      Sent
                    </p>
                    {outgoing.map((u) => (
                      <div
                        key={u.id}
                        className="group/sent flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isDark
                            ? "rgba(99,102,241,0.06)"
                            : "rgba(99,102,241,0.04)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "";
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
                          <div
                            className="text-[11px]"
                            style={{
                              color: isDark
                                ? "rgba(165,180,252,0.45)"
                                : "#94a3b8",
                            }}
                          >
                            Request sent
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            setConfirmAction({ user: u, kind: "cancel" })
                          }
                          aria-label={`Cancel request to ${u.username}`}
                          className={`shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            isDark
                              ? "bg-white/6 text-white/45 hover:bg-red-500/15 hover:text-red-400"
                              : "bg-black/5 text-slate-500 hover:bg-red-500/10 hover:text-red-500"
                          }`}
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                    <div
                      className="mx-3 my-2 border-t"
                      style={{
                        borderColor: isDark ? darkBorder : lightBorderMid,
                      }}
                    />
                  </div>
                )}
                {findError && (
                  <div
                    className="mx-1 mb-2 px-3 py-2 rounded-xl text-xs"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: "#f87171",
                    }}
                  >
                    {findError}
                  </div>
                )}
                {findSuccess && (
                  <div
                    className="mx-1 mb-2 px-3 py-2 rounded-xl text-xs flex items-center gap-2"
                    style={{
                      background: "rgba(34,197,94,0.08)",
                      border: "1px solid rgba(34,197,94,0.2)",
                      color: "#4ade80",
                    }}
                  >
                    <Check size={13} className="shrink-0" />
                    {findSuccess}
                  </div>
                )}
                {!searching && (
                  <div className="flex flex-col items-center text-center px-6 py-10">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                      style={{
                        background: isDark
                          ? "rgba(99,102,241,0.1)"
                          : "rgba(99,102,241,0.07)",
                      }}
                    >
                      <Search
                        size={20}
                        style={{
                          color: isDark ? "rgba(165,180,252,0.6)" : "#6366f1",
                        }}
                      />
                    </div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
                    >
                      Find people to add
                    </p>
                    <p
                      className="text-xs mt-1 leading-relaxed max-w-[16rem]"
                      style={{
                        color: isDark ? "rgba(238,242,255,0.4)" : "#94a3b8",
                      }}
                    >
                      Search by username to send a friend request. Accepted
                      friends appear in your Direct and Group lists.
                    </p>
                  </div>
                )}
                {searching && findResults.length === 0 && (
                  <p
                    className="text-center text-sm py-8"
                    style={{
                      color: isDark ? "rgba(238,242,255,0.22)" : "#94a3b8",
                    }}
                  >
                    No users found
                  </p>
                )}
                {findResults.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDark
                        ? "rgba(99,102,241,0.06)"
                        : "rgba(99,102,241,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "";
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
                    </div>
                    <ContactStatusButton
                      status={u.contact_status}
                      onAdd={async () => {
                        setFindError("");
                        setFindSuccess("");
                        try {
                          await onSendRequest(u.id);
                          setFindSuccess(
                            `Friend request sent to ${u.username}`,
                          );
                        } catch (err) {
                          setFindError(err.message || "Failed to send request");
                        }
                      }}
                      onRemove={() =>
                        // Both warn first: canceling a sent request vs. removing
                        // an already-accepted friend.
                        setConfirmAction({
                          user: u,
                          kind:
                            u.contact_status === "pending_sent"
                              ? "cancel"
                              : "remove",
                        })
                      }
                      isDark={isDark}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-0.5">
                {friends.length === 0 && (
                  <p
                    className="text-center text-sm py-10"
                    style={{
                      color: isDark ? "rgba(238,242,255,0.22)" : "#94a3b8",
                    }}
                  >
                    {contacts.length === 0
                      ? 'No friends yet — use "Find" to add some'
                      : "No friends match your search"}
                  </p>
                )}
                {friends.map((u) => {
                  // Group mode: a single selectable row toggles membership.
                  const selected = selectedIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                      style={{
                        background: selected
                          ? isDark
                            ? "rgba(99,102,241,0.14)"
                            : "rgba(99,102,241,0.08)"
                          : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!selected)
                          e.currentTarget.style.background = isDark
                            ? "rgba(99,102,241,0.07)"
                            : "rgba(99,102,241,0.05)";
                      }}
                      onMouseLeave={(e) => {
                        if (!selected)
                          e.currentTarget.style.background = "transparent";
                      }}
                      onClick={() => toggleSelect(u.id)}
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
                      </div>
                      {selected && (
                        <span className="text-indigo-400 font-bold shrink-0">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Create group CTA */}
        {mode === "group" && (
          <div
            className="px-4 pb-5 pt-3 border-t shrink-0"
            style={{ borderColor: isDark ? darkBorder : lightBorderMid }}
          >
            <button
              onClick={submitGroup}
              disabled={selectedIds.length < 1 || !groupName.trim() || creating}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-35 disabled:cursor-not-allowed transition-all hover:opacity-90 active:scale-[0.99]"
              style={{
                background:
                  "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)",
                boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
              }}
            >
              {creating
                ? "Creating…"
                : `Create Group${selectedIds.length > 0 ? ` (${selectedIds.length} selected)` : ""}`}
            </button>
          </div>
        )}
      </div>

      {/* Warning before canceling a sent request or removing a friend. Renders
          at z-600 (above this modal's z-500) so it sits on top. */}
      {confirmAction && (
        <ConfirmModal
          title={
            confirmAction.kind === "cancel"
              ? "Cancel friend request?"
              : "Remove friend?"
          }
          body={
            confirmAction.kind === "cancel"
              ? `Cancel your friend request to ${confirmAction.user.username}? You can always send it again later.`
              : `Remove ${confirmAction.user.username} from your friends? You'll need to send a new request to reconnect.`
          }
          confirmLabel={
            confirmAction.kind === "cancel" ? "Cancel Request" : "Remove"
          }
          cancelLabel="Keep"
          onConfirm={() => onRemoveContact(confirmAction.user.id)}
          onClose={() => setConfirmAction(null)}
          isDark={isDark}
        />
      )}
    </div>
  );
}
