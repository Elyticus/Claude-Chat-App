import { useState, lazy, Suspense } from "react";
import AuthScreen from "./components/AuthScreen.jsx";

const ChatApp = lazy(() => import("./ChatApp.jsx"));

export default function App() {
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
    <Suspense fallback={<div style={{ height: "100%", background: "#070d1c" }} />}>
      <ChatApp
        token={authData.token}
        currentUser={authData.user}
        onLogout={handleLogout}
      />
    </Suspense>
  );
}
