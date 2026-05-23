import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./globals.css";
import App from "./App.jsx";

// Pause caretBlink animation while text is selected so the selection is visible.
// selectionchange fires whenever the selection changes in any focused input/textarea.
document.addEventListener("selectionchange", () => {
  const el = document.activeElement;
  if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return;
  const hasSelection = el.selectionStart !== el.selectionEnd;
  el.style.animation = hasSelection ? "none" : "";
  el.style.caretColor = hasSelection ? "transparent" : "";
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
