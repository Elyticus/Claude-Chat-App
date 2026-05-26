export function ContactStatusButton({ status, onAdd, onRemove, isDark }) {
  if (status === "accepted") {
    return (
      <button
        onClick={onRemove}
        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${isDark ? "bg-white/6 text-white/45 hover:bg-red-500/15 hover:text-red-400" : "bg-black/5 text-slate-500 hover:bg-red-500/10 hover:text-red-500"}`}
      >
        Remove
      </button>
    );
  }
  if (status === "pending_sent") {
    return (
      <span
        className={`px-3 py-1 rounded-lg text-xs font-semibold opacity-50 ${isDark ? "bg-white/6 text-white/40" : "bg-black/5 text-slate-500"}`}
      >
        Pending
      </span>
    );
  }
  if (status === "pending_received") {
    return (
      <button
        onClick={onRemove}
        className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"
      >
        Decline
      </button>
    );
  }
  return (
    <button
      onClick={onAdd}
      className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 transition-all"
    >
      Add
    </button>
  );
}
