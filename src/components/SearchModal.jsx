import { useState, useEffect, useRef, Fragment } from "react";
import { Search, X, Hash, Users, MessageCircle } from "lucide-react";
import { api } from "@/lib/api.js";
import { formatFullTime } from "@/lib/helpers.js";
import { darkBg1, darkBg2, darkBorderMid, lightBg1, lightBorderMid } from "@/lib/constants.js";

// Split a ts_headline snippet (« » markers) into plain/highlight runs so the
// matched terms can be emphasised without dangerouslySetInnerHTML.
function renderSnippet(snippet, isDark) {
  const parts = [];
  const re = /«([^»]*)»/g;
  let last = 0;
  let m;
  while ((m = re.exec(snippet)) !== null) {
    if (m.index > last) parts.push({ t: snippet.slice(last, m.index), hl: false });
    parts.push({ t: m[1], hl: true });
    last = m.index + m[0].length;
  }
  if (last < snippet.length) parts.push({ t: snippet.slice(last), hl: false });
  return parts.map((p, i) =>
    p.hl ? (
      <mark
        key={i}
        style={{ background: "transparent", color: isDark ? "#a5b4fc" : "#4f46e5", fontWeight: 600 }}
      >
        {p.t}
      </mark>
    ) : (
      <Fragment key={i}>{p.t}</Fragment>
    ),
  );
}

function RoomIcon({ result, isDark }) {
  const color = isDark ? "rgba(165,180,252,0.6)" : "#94a3b8";
  if (result.type === "channel" || result.type === "private_channel") return <Hash size={14} style={{ color }} />;
  if (result.is_group) return <Users size={14} style={{ color }} />;
  return <MessageCircle size={14} style={{ color }} />;
}

// ─── Global search command palette (Linkloop Pro) ───────────────────────────
// Cmd/Ctrl-K full-text search across every conversation. Free users hit the
// paywall (routed via onGateError); Pro users get ranked, highlighted results
// that open the source room on click.
export function SearchModal({ isDark, onClose, onOpenRoom, onGateError, roomName }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    // Desktop only — focusing on mobile pops the keyboard over the sheet.
    if (window.innerWidth >= 640) inputRef.current?.focus();
  }, []);

  // Debounced search. All state updates happen inside deferred callbacks (never
  // synchronously in the effect body) so React's set-state-in-effect rule is
  // satisfied — short queries reset on a 0ms tick, real queries after 280ms.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      const t0 = setTimeout(() => {
        setResults([]);
        setSearched(false);
        setLoading(false);
      }, 0);
      return () => clearTimeout(t0);
    }
    const t = setTimeout(() => {
      setLoading(true);
      api.searchMessages(q)
        .then(({ results: rows }) => {
          setResults(rows);
          setSearched(true);
        })
        .catch((err) => {
          if (onGateError?.(err)) onClose();
        })
        .finally(() => setLoading(false));
    }, 280);
    return () => clearTimeout(t);
  }, [query, onGateError, onClose]);

  const headerColor = isDark ? "#eef2ff" : "#0f172a";
  const subColor = isDark ? "rgba(165,180,252,0.55)" : "#64748b";

  return (
    <div className="fixed inset-0 flex items-start justify-center p-3 sm:pt-24" style={{ zIndex: 700 }}>
      <div
        className="absolute inset-0"
        style={{ background: isDark ? "rgba(7,13,28,0.9)" : "rgba(15,23,42,0.35)", backdropFilter: "blur(10px)" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search messages"
        className="relative w-full sm:max-w-xl rounded-2xl overflow-hidden animate-scale-in flex flex-col max-h-[80vh]"
        style={{
          background: isDark ? darkBg1 : lightBg1,
          border: `1px solid ${isDark ? darkBorderMid : lightBorderMid}`,
          boxShadow: "0 40px 100px rgba(0,0,0,0.55)",
        }}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-2.5 px-4 py-3.5 shrink-0"
          style={{ borderBottom: `1px solid ${isDark ? darkBorderMid : lightBorderMid}` }}
        >
          <Search size={16} style={{ color: subColor, flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all conversations…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: headerColor }}
          />
          {loading && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />}
          <button onClick={onClose} aria-label="Close" className="shrink-0" style={{ color: subColor }}>
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto no-scrollbar">
          {query.trim().length < 2 ? (
            <div className="px-4 py-10 text-center text-sm" style={{ color: subColor }}>
              Type at least 2 characters to search across all your chats.
            </div>
          ) : searched && results.length === 0 && !loading ? (
            <div className="px-4 py-10 text-center text-sm" style={{ color: subColor }}>
              No messages found for “{query.trim()}”.
            </div>
          ) : (
            results.map((r) => (
              <button
                key={r.message_id}
                onClick={() => {
                  onOpenRoom(r.room_id);
                  onClose();
                }}
                className="w-full text-left px-4 py-3 flex flex-col gap-1 transition-all"
                style={{ borderBottom: `1px solid ${isDark ? "rgba(99,102,241,0.06)" : "rgba(226,232,240,0.7)"}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? darkBg2 : "rgba(99,102,241,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <RoomIcon result={r} isDark={isDark} />
                  <span className="text-xs font-semibold truncate" style={{ color: headerColor }}>
                    {r.room_name || roomName?.(r.room_id) || "Direct message"}
                  </span>
                  <span className="text-[11px] shrink-0 ml-auto" style={{ color: subColor }}>
                    {formatFullTime(r.created_at)}
                  </span>
                </div>
                <div className="text-sm leading-snug line-clamp-2" style={{ color: isDark ? "rgba(238,242,255,0.78)" : "#334155" }}>
                  <span className="font-medium" style={{ color: subColor }}>{r.author}: </span>
                  {renderSnippet(r.snippet || "", isDark)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
