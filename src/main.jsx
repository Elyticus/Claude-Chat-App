import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./globals.css";
import App from "./App.jsx";

// Pause caretBlink on touchstart so no repaint fires while the iOS paste /
// autofill menu is open. The menu appears ~500 ms after touchstart, so pausing
// at the very start of the touch means zero animation repaints during the
// window iOS is tracking the gesture. Resume on touchend / touchcancel.
function onTouchStart(e) {
  const el = e.target;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    el.classList.add("caret-paused");
  }
}
function onTouchEnd(e) {
  const el = e.target;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    requestAnimationFrame(() => el.classList.remove("caret-paused"));
  }
}
document.addEventListener("touchstart", onTouchStart, { passive: true });
document.addEventListener("touchend",   onTouchEnd,   { passive: true });
document.addEventListener("touchcancel",onTouchEnd,   { passive: true });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
