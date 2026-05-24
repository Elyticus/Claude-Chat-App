import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./globals.css";
import App from "./App.jsx";

// Pause caretBlink while text is selected so the selection highlight is visible.
//
// We listen on mouseup/touchend (pointer released) instead of selectionchange
// (fires during the gesture). On iOS, mutating element styles while the browser
// is tracking a long-press dismisses the native paste/cut menu. By deferring
// until the pointer is lifted we never touch the DOM during that window.
function syncCaretAnimation(el) {
  if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return;
  const hasSelection = el.selectionStart !== el.selectionEnd;
  el.style.animation = hasSelection ? "none" : "";
  el.style.caretColor = hasSelection ? "transparent" : "";
}

document.addEventListener("mouseup", () => syncCaretAnimation(document.activeElement));
document.addEventListener("touchend", () => {
  // Defer one tick so the browser has committed the final selection before we read it.
  requestAnimationFrame(() => syncCaretAnimation(document.activeElement));
});

// Reset when the user moves focus to a different input so it starts blinking fresh.
document.addEventListener("focusin", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    e.target.style.animation = "";
    e.target.style.caretColor = "";
  }
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
