import { X, LogOut } from "lucide-react";
import { Avatar } from "./ui/Avatar.jsx";
import {
  darkBg1,
  darkBorderMid,
  lightBg1,
  lightBorderMid,
} from "@/lib/constants.js";

// ─── Account / self profile ──────────────────────────────────────────────────
// The current user's own profile, opened by tapping their avatar in the hub.
// Shows the user's picture at a large size alongside their name/email, with
// sign out as the single account-level action.
export function AccountModal({
  currentUser,
  myAvatar,
  isDark,
  onLogout,
  onClose,
}) {
  const headerColor = isDark ? "#eef2ff" : "#0f172a";
  const subColor = isDark ? "rgba(165,180,252,0.5)" : "#94a3b8";
  const divider = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

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

        {/* Identity */}
        <div className="flex flex-col items-center text-center px-6 pt-10 pb-6">
          <Avatar
            userId={currentUser.id}
            username={currentUser.username}
            size={144}
            avatar={myAvatar}
          />
          <div
            className="mt-4 text-lg font-semibold truncate max-w-full"
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
        </div>

        {/* Account actions */}
        <div
          className="px-4 pt-4 pb-5 space-y-2"
          style={{ borderTop: `1px solid ${divider}` }}
        >
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all bg-red-500/10 text-red-400 hover:bg-red-500/20"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
