import { useState, lazy, Suspense, useEffect } from "react";
import AuthScreen from "./components/AuthScreen.jsx";

const ChatApp = lazy(() => import("./ChatApp.jsx"));

const SPLASH_LOGO = (
  <div style={{ height: "100%", background: "#070d1c", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }}>
    <div style={{ width: 88, height: 88, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#3b82f6,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 48px rgba(99,102,241,0.45)", animation: "scaleIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both" }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      </svg>
    </div>
    <span style={{ color: "#eef2ff", fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.5px", animation: "fadeInUp 0.35s ease 0.2s both" }}>
      Linkloop<span style={{ color: "#818cf8" }}>.</span>
    </span>
  </div>
);

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1000);
    return () => clearTimeout(t);
  }, []);

  const [authData, setAuthData] = useState(() => {
    try {
      const token = localStorage.getItem("linkloop_token");
      const user = JSON.parse(localStorage.getItem("linkloop_user") || "null");
      return token && user ? { token, user } : { token: null, user: null };
    } catch {
      return { token: null, user: null };
    }
  });

  function handleAuth({ token, user }) {
    localStorage.setItem("linkloop_token", token);
    localStorage.setItem("linkloop_user", JSON.stringify(user));
    setAuthData({ token, user });
  }

  function handleLogout() {
    localStorage.removeItem("linkloop_token");
    localStorage.removeItem("linkloop_user");
    setAuthData({ token: null, user: null });
  }

  if (!ready) return SPLASH_LOGO;

  if (!authData.token || !authData.user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return (
    <Suspense fallback={<div style={{ height: "100%", background: "#070d1c" }} />}>
      <ChatApp
        token={authData.token}
        currentUser={authData.user}
        onLogout={handleLogout}
      />
    </Suspense>
  );
}
