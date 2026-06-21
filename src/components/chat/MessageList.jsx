import { Fragment } from "react";
import {
  userBg,
  initials,
  formatFullTime,
  dayKey,
  formatDateSeparator,
} from "@/lib/helpers.js";
import { darkBg1, darkBg2, darkBorder, lightBorderMid } from "@/lib/constants.js";
import { ChatBackdrop } from "./ChatBackdrop.jsx";

// The scrollable message area: dot-grid texture, a per-room-type decorative
// backdrop (planets/moon/stars), fade edges, the load-earlier control, empty
// state, date separators, system messages, the "New Messages" divider and the
// message bubbles (with long-press / right-click context menu).
// Extracted from ChatApp verbatim; all state and handlers are passed in.
export function MessageList({
  bg0,
  isDark,
  roomKind,
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
}) {
  return (
    <div className="flex-1 relative overflow-hidden" style={{ background: bg0 }}>
      {/* Dot grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, ${isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.055)"} 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />
      {/* Per-room-type decorative backdrop (behind the scroll container) */}
      <ChatBackdrop kind={roomKind} isDark={isDark} />
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
                  color: isDark ? "rgba(165,180,252,0.3)" : "#94a3b8",
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
            const isMine = msg.user_id === currentUserId;
            const isTemp = !!msg.temp;
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
                        {msg.text}
                        <span
                          className="ml-2 text-[10px] whitespace-nowrap"
                          style={{ opacity: 0.4 }}
                        >
                          {formatFullTime(msg.created_at)}
                        </span>
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
