import { Fragment } from "react";
import { Sparkles, X, Languages, FileText, Download } from "lucide-react";
import { api } from "@/lib/api.js";
import {
  userBg,
  initials,
  formatFullTime,
  dayKey,
  formatDateSeparator,
} from "@/lib/helpers.js";
import { darkBg1, darkBg2, darkBorder, lightBorderMid } from "@/lib/constants.js";

function fmtBytes(n) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDuration(s) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

// Renders an image / voice / file attachment inside a message bubble. Uses the
// local object URL while a temp message is still uploading, otherwise the
// auth-gated stream URL.
function AttachmentBlock({ att, isMine, isDark }) {
  const url = att.localUrl || api.attachmentUrl(att.id);

  if (att.kind === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt={att.name || "image"}
          loading="lazy"
          className="rounded-lg max-w-full"
          style={{ maxHeight: 320, objectFit: "cover" }}
        />
      </a>
    );
  }

  if (att.kind === "voice") {
    return (
      <div className="flex items-center gap-2">
        <audio controls src={url} preload="metadata" style={{ maxWidth: 220, height: 36 }} />
        {att.duration ? (
          <span className="text-[11px] shrink-0" style={{ opacity: 0.6 }}>{fmtDuration(att.duration)}</span>
        ) : null}
      </div>
    );
  }

  return (
    <a
      href={url}
      download={att.name}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 min-w-45 max-w-full"
      style={{
        background: isMine ? "rgba(255,255,255,0.16)" : isDark ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.06)",
      }}
    >
      <FileText size={20} className="shrink-0" style={{ opacity: 0.8 }} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate">{att.name}</div>
        <div className="text-[10px]" style={{ opacity: 0.6 }}>{fmtBytes(att.size)}</div>
      </div>
      <Download size={15} className="shrink-0" style={{ opacity: 0.7 }} />
    </a>
  );
}

// The scrollable message area: dot-grid texture, fade edges, the load-earlier
// control, empty state, date separators, system messages, the "New Messages"
// divider and the message bubbles (with long-press / right-click context menu).
// The per-room-type doodle backdrop lives one level up in ChatPanel so it spans
// the whole chat surface; this area is transparent so it shows through.
// Extracted from ChatApp verbatim; all state and handlers are passed in.
export function MessageList({
  bg0,
  isDark,
  displayedMessages,
  roomLoaded,
  hasMore,
  loadingMore,
  onLoadEarlier,
  activeAvatarId,
  activeRoomName,
  isGroup,
  msgSearch,
  newMarkerIndex,
  currentUserId,
  onContextMenu,
  setContextMenu,
  longPressTimerRef,
  messagesEndRef,
  translations = {},
  onClearTranslation,
}) {
  return (
    <div className="flex-1 relative overflow-hidden" style={{ background: "transparent" }}>
      {/* Dot grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, ${isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.055)"} 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />
      {/* Top fade */}
      <div
        className="absolute top-0 left-0 right-0 h-10 z-10 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, ${bg0}, transparent)`,
        }}
      />
      {/* Scroll container */}
      <div className="absolute inset-0 overflow-y-auto px-4 py-4 no-scrollbar">
        <div className="relative flex flex-col justify-end min-h-full gap-2.5">
          {hasMore && (
            <div className="flex justify-center py-2 shrink-0">
              <button
                onClick={onLoadEarlier}
                disabled={loadingMore}
                className="text-xs px-4 py-1.5 rounded-full transition-all disabled:opacity-40"
                style={{
                  color: isDark ? "rgba(165,180,252,0.7)" : "#6366f1",
                  background: isDark
                    ? "rgba(99,102,241,0.08)"
                    : "rgba(99,102,241,0.06)",
                  border: `1px solid ${isDark ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.2)"}`,
                }}
              >
                {loadingMore ? "Loading…" : "↑ Load earlier messages"}
              </button>
            </div>
          )}
          {displayedMessages.length === 0 && roomLoaded && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{
                  background: userBg(activeAvatarId),
                  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                }}
              >
                <span className="text-white text-xl font-bold">
                  {initials(activeRoomName)}
                </span>
              </div>
              <p
                className="text-sm font-medium"
                style={{
                  color: isDark ? "rgba(238,242,255,0.55)" : "#475569",
                }}
              >
                {activeRoomName}
              </p>
              <p
                className="text-xs mt-1"
                style={{
                  color: isDark ? "#ffffff" : "#94a3b8",
                }}
              >
                {msgSearch
                  ? "No matching messages"
                  : "No messages yet — say hello! 👋"}
              </p>
            </div>
          )}

          {displayedMessages.map((msg, index) => {
            const prev = displayedMessages[index - 1];
            const showSeparator =
              !!msg.created_at &&
              (!prev || dayKey(msg.created_at) !== dayKey(prev.created_at));
            const dateSeparator = showSeparator && (
              <div className="flex justify-center py-3">
                <span
                  className="text-[11px] px-3 py-1 rounded-full select-none"
                  style={{
                    background: isDark
                      ? "rgba(99,102,241,0.08)"
                      : "rgba(0,0,0,0.06)",
                    color: isDark ? "rgba(165,180,252,0.55)" : "#64748b",
                  }}
                >
                  {formatDateSeparator(msg.created_at)}
                </span>
              </div>
            );
            if (msg.system) {
              return (
                <Fragment key={msg.id}>
                  {dateSeparator}
                  <div className="flex justify-center py-1">
                    <span
                      className="text-xs px-3 py-1 rounded-full"
                      style={{
                        background: isDark
                          ? "rgba(99,102,241,0.08)"
                          : "rgba(99,102,241,0.06)",
                        color: isDark ? "rgba(165,180,252,0.5)" : "#6366f1",
                        border: `1px solid ${isDark ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.12)"}`,
                      }}
                    >
                      {msg.text}
                    </span>
                  </div>
                </Fragment>
              );
            }
            // Ephemeral AI answer (from /ask) — local-only, distinctly styled,
            // never persisted or broadcast.
            if (msg.ai) {
              return (
                <Fragment key={msg.id}>
                  {dateSeparator}
                  <div className="self-start max-w-[85%] animate-fade-in-up flex items-start gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: "linear-gradient(135deg,#6366f1,#3b82f6,#14b8a6)" }}
                    >
                      <Sparkles size={13} color="#fff" />
                    </div>
                    <div
                      className="px-4 py-2.5 text-sm leading-relaxed rounded-2xl rounded-bl-sm whitespace-pre-wrap"
                      style={{
                        background: isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)",
                        color: isDark ? "#eef2ff" : "#1e293b",
                        border: `1px solid ${isDark ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.2)"}`,
                      }}
                    >
                      {msg.aiLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                          Linkloop AI is thinking…
                        </span>
                      ) : (
                        msg.text
                      )}
                    </div>
                  </div>
                </Fragment>
              );
            }
            const isMine = msg.user_id === currentUserId;
            const isTemp = !!msg.temp;
            const translation = translations[msg.id];
            return (
              <Fragment key={msg.id}>
                {dateSeparator}
                {index === newMarkerIndex && (
                  <div
                    className="flex items-center gap-3 py-2 select-none"
                    aria-label="New messages below"
                  >
                    <span
                      className="flex-1 h-px"
                      style={{
                        background: isDark
                          ? "rgba(248,113,113,0.35)"
                          : "rgba(220,38,38,0.3)",
                      }}
                    />
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: isDark ? "#f87171" : "#dc2626" }}
                    >
                      New Messages
                    </span>
                    <span
                      className="flex-1 h-px"
                      style={{
                        background: isDark
                          ? "rgba(248,113,113,0.35)"
                          : "rgba(220,38,38,0.3)",
                      }}
                    />
                  </div>
                )}
                <div
                  className={`relative flex items-end gap-2 animate-fade-in-up max-w-[78%] ${isMine ? "self-end" : "self-start"} ${msg.reaction ? "mb-3 z-1" : ""}`}
                  onContextMenu={(e) => !isTemp && onContextMenu(e, msg)}
                  onTouchStart={(e) => {
                    if (isTemp) return;
                    const touch = e.touches[0];
                    const x = touch.clientX;
                    const y = touch.clientY;
                    longPressTimerRef.current = setTimeout(() => {
                      setContextMenu({ msg, x, y });
                    }, 500);
                  }}
                  onTouchEnd={() => clearTimeout(longPressTimerRef.current)}
                  onTouchMove={() => clearTimeout(longPressTimerRef.current)}
                  onTouchCancel={() => clearTimeout(longPressTimerRef.current)}
                >
                  <div
                    className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                  >
                    {!isMine && !!isGroup && (
                      <span
                        className="text-[11px] mb-1 ml-1 font-medium"
                        style={{
                          color: isDark ? "rgba(165,180,252,0.5)" : "#94a3b8",
                        }}
                      >
                        {msg.username}
                      </span>
                    )}
                    <div className="relative">
                      <div
                        className={`px-4 py-2.5 text-sm leading-relaxed wrap-break-word ${
                          isMine
                            ? "rounded-2xl rounded-br-sm"
                            : "rounded-2xl rounded-bl-sm"
                        } ${isTemp ? "opacity-50" : ""}`}
                        style={
                          isMine
                            ? {
                                background:
                                  "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)",
                                color: "#ffffff",
                                boxShadow: "0 2px 16px rgba(99,102,241,0.4)",
                                userSelect: "none",
                                WebkitUserSelect: "none",
                                WebkitTouchCallout: "none",
                              }
                            : isDark
                              ? {
                                  background: darkBg2,
                                  color: "#eef2ff",
                                  border: `1px solid ${darkBorder}`,
                                  userSelect: "none",
                                  WebkitUserSelect: "none",
                                  WebkitTouchCallout: "none",
                                }
                              : {
                                  background: "#ffffff",
                                  color: "#1e293b",
                                  border: "1px solid rgba(226,232,240,1)",
                                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                                  userSelect: "none",
                                  WebkitUserSelect: "none",
                                  WebkitTouchCallout: "none",
                                }
                        }
                      >
                        {msg.attachment ? (
                          <div className="flex flex-col gap-1.5">
                            <AttachmentBlock att={msg.attachment} isMine={isMine} isDark={isDark} />
                            {msg.text ? <span className="text-sm">{msg.text}</span> : null}
                            <span className="self-end text-[10px]" style={{ opacity: 0.4 }}>
                              {formatFullTime(msg.created_at)}
                            </span>
                          </div>
                        ) : (
                          <>
                            {msg.text}
                            <span
                              className="ml-2 text-[10px] whitespace-nowrap"
                              style={{ opacity: 0.4 }}
                            >
                              {formatFullTime(msg.created_at)}
                            </span>
                          </>
                        )}
                      </div>
                      {msg.reaction && (
                        <span
                          className="absolute -bottom-3.5 right-1 text-base rounded-full px-1.5 py-0.5 leading-none"
                          style={{
                            background: isDark ? darkBg1 : "#ffffff",
                            border: `1px solid ${isDark ? darkBorder : lightBorderMid}`,
                            boxShadow: isDark
                              ? "0 2px 8px rgba(0,0,0,0.4)"
                              : "0 2px 8px rgba(0,0,0,0.08)",
                          }}
                        >
                          {msg.reaction}
                        </span>
                      )}
                    </div>
                    {/* AI translation, shown under the bubble it belongs to */}
                    {translation && (
                      <div
                        className={`mt-1.5 max-w-full text-xs rounded-xl px-3 py-2 ${msg.reaction ? "mt-4" : ""}`}
                        style={{
                          background: isDark ? "rgba(45,212,191,0.1)" : "rgba(13,148,136,0.06)",
                          border: `1px solid ${isDark ? "rgba(45,212,191,0.22)" : "rgba(13,148,136,0.18)"}`,
                          color: isDark ? "#5eead4" : "#0d9488",
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="inline-flex items-center gap-1 font-medium" style={{ opacity: 0.85 }}>
                            <Languages size={11} /> Translation
                          </span>
                          <button
                            onClick={() => onClearTranslation?.(msg.id)}
                            aria-label="Dismiss translation"
                            className="shrink-0"
                            style={{ opacity: 0.7 }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                        {translation.loading ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" /> Translating…
                          </span>
                        ) : translation.error ? (
                          <span className="text-red-400">{translation.error}</span>
                        ) : (
                          <span style={{ color: isDark ? "#e6fffb" : "#0f766e" }}>{translation.text}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>
      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-10 z-10 pointer-events-none"
        style={{
          background: `linear-gradient(to top, ${bg0}, transparent)`,
        }}
      />
    </div>
  );
}
