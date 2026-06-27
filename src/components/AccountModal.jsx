import { useState } from "react";
import { X, Camera, LogOut, Sparkles, Crown } from "lucide-react";
import { Avatar } from "./ui/Avatar.jsx";
import { planLabel } from "@/lib/plans.js";
import {
  darkBg1,
  darkBorderMid,
  lightBg1,
  lightBorderMid,
} from "@/lib/constants.js";

// ─── Account / self profile ──────────────────────────────────────────────────
// The current user's own profile, opened by tapping their avatar in the hub.
// Tapping the picture enlarges it (a lightbox preview); the picture is changed
// from the separate "Change profile picture" button. Sign out lives here too.
export function AccountModal({
  currentUser,
  myAvatar,
  isDark,
  plan = "free",
  onUpgrade,
  onManageSubscription,
  onChangeAvatar,
  onLogout,
  onClose,
}) {
  const isPaid = plan === "lite" || plan === "pro";
  const headerColor = isDark ? "#eef2ff" : "#0f172a";
  const subColor = isDark ? "rgba(165,180,252,0.5)" : "#94a3b8";
  const divider = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  // Lightbox: tapping the avatar blows the picture up to a large preview.
  const [enlarged, setEnlarged] = useState(false);

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
        aria-label="Your profile"
        className="relative w-full sm:w-80 flex flex-col overflow-hidden rounded-2xl animate-scale-in"
        style={{
          background: isDark ? darkBg1 : lightBg1,
          border: `1px solid ${isDark ? darkBorderMid : lightBorderMid}`,
          boxShadow: isDark
            ? "0 32px 80px rgba(0,0,0,0.7)"
            : "0 32px 80px rgba(99,102,241,0.12)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all"
          style={{ color: isDark ? "rgba(238,242,255,0.45)" : "#64748b" }}
        >
          <X size={16} />
        </button>

        {/* Identity — tap the avatar to enlarge the picture */}
        <div className="flex flex-col items-center text-center px-6 pt-8 pb-5">
          <button
            onClick={() => setEnlarged(true)}
            title="View profile picture"
            aria-label="View profile picture"
            className="rounded-full transition-transform hover:scale-105 active:scale-95"
          >
            <Avatar
              userId={currentUser.id}
              username={currentUser.username}
              size={92}
              avatar={myAvatar}
            />
          </button>
          <div
            className="mt-3 text-lg font-semibold truncate max-w-full"
            style={{ color: headerColor }}
          >
            {currentUser.username}
          </div>
          {currentUser.email && (
            <div
              className="mt-0.5 text-xs truncate max-w-full"
              style={{ color: subColor }}
            >
              {currentUser.email}
            </div>
          )}
          <div
            className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={
              isPaid
                ? { background: "rgba(129,140,248,0.16)", color: "#a5b4fc" }
                : { background: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)", color: subColor }
            }
          >
            {isPaid ? <Crown size={12} /> : null}
            {planLabel(plan)} plan
          </div>
        </div>

        {/* Account actions */}
        <div
          className="px-4 pt-4 pb-5 space-y-2"
          style={{ borderTop: `1px solid ${divider}` }}
        >
          {!isPaid && (
            <button
              onClick={onUpgrade}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "linear-gradient(135deg,#6366f1,#3b82f6)", color: "#fff" }}
            >
              <Sparkles size={15} /> Upgrade to Pro
            </button>
          )}
          {isPaid && onManageSubscription && (
            <button
              onClick={onManageSubscription}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
                color: subColor,
              }}
            >
              Manage subscription
            </button>
          )}
          <button
            onClick={onChangeAvatar}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)",
              color: isDark ? "#a5b4fc" : "#4f46e5",
            }}
          >
            <Camera size={15} /> Change profile picture
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all bg-red-500/10 text-red-400 hover:bg-red-500/20"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </div>

      {/* Enlarged picture lightbox — tap anywhere to dismiss */}
      {enlarged && (
        <div
          className="fixed inset-0 z-700 flex items-center justify-center p-6 animate-scale-in"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
          onClick={() => setEnlarged(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Profile picture"
        >
          <button
            onClick={() => setEnlarged(false)}
            aria-label="Close"
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            <X size={20} />
          </button>
          {myAvatar ? (
            // Render the full-resolution source directly and let it scale with
            // the viewport, so the preview stays crisp instead of upscaling a
            // fixed-size box.
            <img
              src={myAvatar}
              alt={currentUser.username}
              className="rounded-full object-cover"
              style={{
                width: "min(82vw, 82vh, 460px)",
                height: "min(82vw, 82vh, 460px)",
              }}
            />
          ) : (
            <Avatar
              userId={currentUser.id}
              username={currentUser.username}
              size={260}
              avatar={null}
            />
          )}
        </div>
      )}
    </div>
  );
}
