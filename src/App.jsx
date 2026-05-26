import { useState, lazy, Suspense, useEffect } from "react";
import AuthScreen from "./components/AuthScreen.jsx";

const ChatApp = lazy(() => import("./ChatApp.jsx"));

export default function App() {
  useEffect(() => {
    document.getElementById("splash")?.remove();
  }, []);

  const [authData, setAuthData] = useState(() => {
    try {
      const token = localStorage.getItem("chatloop_token");
      const user = JSON.parse(localStorage.getItem("chatloop_user") || "null");
      return token && user ? { token, user } : { token: null, user: null };
    } catch {
      return { token: null, user: null };
    }
  });

  function handleAuth({ token, user }) {
    localStorage.setItem("chatloop_token", token);
    localStorage.setItem("chatloop_user", JSON.stringify(user));
    setAuthData({ token, user });
  }

  function handleLogout() {
    localStorage.removeItem("chatloop_token");
    localStorage.removeItem("chatloop_user");
    setAuthData({ token: null, user: null });
  }

  if (!authData.token || !authData.user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return (
    <Suspense fallback={
      <div style={{ height: "100%", background: "#070d1c", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
        <span style={{ color: "#eef2ff", fontSize: "1.5rem", fontWeight: 700 }}>
          Chatloop<span style={{ color: "#818cf8" }}>.</span>
        </span>
      </div>
    }>
      <ChatApp
        token={authData.token}
        currentUser={authData.user}
        onLogout={handleLogout}
      />
    </Suspense>
  );
}
