import { useState } from "react";
import { X } from "lucide-react";
import { toSlug } from "@/lib/helpers.js";
import {
  darkBg1,
  darkBorder,
  darkBorderMid,
  lightBg1,
  lightBorderMid,
} from "@/lib/constants.js";

export function EditChannelModal({
  initialName,
  initialDescription,
  initialSlug,
  myRole,
  onSave,
  onClose,
  isDark,
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [slug, setSlug] = useState(initialSlug || "");
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const canEditSlug = myRole === "owner" || myRole === "admin";

  function handleNameChange(val) {
    setName(val);
    setErr("");
    if (canEditSlug && !slugManual) setSlug(toSlug(val));
  }

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Name is required");
      return;
    }
    setSaving(true);
    try {
      await onSave(
        name.trim(),
        description.trim(),
        canEditSlug ? slug : undefined,
      );
    } catch (ex) {
      setErr(ex.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-500 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(7,13,28,0.80)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-2xl overflow-hidden animate-scale-in"
        style={{
          background: isDark ? darkBg1 : lightBg1,
          border: `1px solid ${isDark ? darkBorderMid : lightBorderMid}`,
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: isDark ? darkBorder : lightBorderMid }}
        >
          <span
            className="font-semibold text-sm"
            style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
          >
            Edit Channel
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ color: isDark ? "rgba(238,242,255,0.4)" : "#64748b" }}
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: isDark ? "rgba(238,242,255,0.5)" : "#64748b" }}
            >
              Channel Name
            </label>
            <input
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: isDark
                  ? "rgba(99,102,241,0.08)"
                  : "rgba(99,102,241,0.05)",
                color: isDark ? "#eef2ff" : "#0f172a",
                border: `1px solid ${isDark ? darkBorder : lightBorderMid}`,
              }}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              maxLength={80}
            />
          </div>
          {canEditSlug && (
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: isDark ? "rgba(238,242,255,0.5)" : "#64748b" }}
              >
                Channel Address
              </label>
              <div
                className="flex items-center rounded-xl overflow-hidden"
                style={{
                  background: isDark
                    ? "rgba(99,102,241,0.08)"
                    : "rgba(99,102,241,0.05)",
                  border: `1px solid ${isDark ? darkBorder : lightBorderMid}`,
                }}
              >
                <span
                  className="pl-3 text-sm select-none"
                  style={{ color: isDark ? "rgba(238,242,255,0.35)" : "#94a3b8" }}
                >
                  #
                </span>
                <input
                  className="flex-1 px-2 py-2.5 text-sm outline-none bg-transparent"
                  style={{ color: isDark ? "#eef2ff" : "#0f172a" }}
                  value={slug}
                  onChange={(e) => {
                    setSlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    );
                    setSlugManual(true);
                    setErr("");
                  }}
                  maxLength={50}
                  placeholder="channel-address"
                />
              </div>
            </div>
          )}
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: isDark ? "rgba(238,242,255,0.5)" : "#64748b" }}
            >
              Description
            </label>
            <textarea
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{
                background: isDark
                  ? "rgba(99,102,241,0.08)"
                  : "rgba(99,102,241,0.05)",
                color: isDark ? "#eef2ff" : "#0f172a",
                border: `1px solid ${isDark ? darkBorder : lightBorderMid}`,
              }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={280}
            />
          </div>
          {err && (
            <p className="text-xs" style={{ color: "#f87171" }}>
              {err}
            </p>
          )}
        </div>
        <div className="flex gap-2.5 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: isDark
                ? "rgba(99,102,241,0.08)"
                : "rgba(99,102,241,0.06)",
              color: isDark ? "rgba(238,242,255,0.6)" : "#64748b",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: "rgba(99,102,241,0.85)", color: "#fff" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
