import { api } from "../lib/api.js";

// Avatar upload: client-side downscale to a 256px JPEG, optimistically update
// local state + localStorage, then persist to the server. Lifted out of ChatApp
// verbatim; deps passed in.
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
        canvas
          .getContext("2d")
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
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
    const dataUrl = await resizeImage(file, 256);
    setMyAvatar(dataUrl);
    const updated = { ...currentUser, avatar: dataUrl };
    localStorage.setItem("linkloop_user", JSON.stringify(updated));
    api.uploadAvatar(dataUrl).catch(console.error);
  }

  return { handleAvatarFile };
}
