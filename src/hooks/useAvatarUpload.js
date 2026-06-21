import { api } from "../lib/api.js";

// Largest data-URL we'll send. The server rejects avatars over 500,000 chars,
// so we stay just under that with a safety margin.
const MAX_AVATAR_CHARS = 480_000;

// Avatar upload: client-side downscale to a high-resolution JPEG, optimistically
// update local state + localStorage, then persist to the server. We keep the
// picture at up to 1024px so it stays crisp (no visible pixels) when the account
// modal blows it up to a full-screen lightbox, even on high-DPI phones — and
// pick the best JPEG quality that still fits under the server's avatar cap.
export function useAvatarUpload({ setMyAvatar, currentUser }) {
  function resizeImage(file, maxPx) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        // High-quality resampling so the downscale stays smooth, not blocky.
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Keep the full resolution; step quality down only as needed to fit the
        // size cap, so we preserve as much detail as possible.
        let out = canvas.toDataURL("image/jpeg", 0.92);
        for (const q of [0.85, 0.78, 0.7, 0.6, 0.5]) {
          if (out.length <= MAX_AVATAR_CHARS) break;
          out = canvas.toDataURL("image/jpeg", q);
        }
        resolve(out);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };
      img.src = url;
    });
  }

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const dataUrl = await resizeImage(file, 1024);
    setMyAvatar(dataUrl);
    const updated = { ...currentUser, avatar: dataUrl };
    localStorage.setItem("linkloop_user", JSON.stringify(updated));
    api.uploadAvatar(dataUrl).catch(console.error);
  }

  return { handleAvatarFile };
}
