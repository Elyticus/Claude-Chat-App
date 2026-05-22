import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { api } from "../lib/api.js";

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data =
        mode === "login"
          ? await api.login(email, password)
          : await api.register(username, email, password);
      onAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m) {
    setMode(m);
    setError("");
  }

  return (
    <div className="h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background orbital rings */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="absolute w-[700px] h-[700px] rounded-full border border-white/[0.04]" />
        <div className="absolute w-[500px] h-[500px] rounded-full border border-white/[0.04]" />
        <div className="absolute w-[320px] h-[320px] rounded-full border border-white/[0.04]" />
        <div
          className="absolute w-32 h-32 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div
          className="bg-white/[0.04] border border-white/[0.1] rounded-2xl p-8 shadow-2xl"
          style={{ backdropFilter: "blur(20px)" }}
        >
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, #6366f1, #3b82f6, #14b8a6)",
                boxShadow: "0 0 30px rgba(99,102,241,0.3)",
              }}
            >
              <MessageCircle size={22} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Chatloop<span className="text-purple-400">.</span>
            </h1>
          </div>

          {/* Mode tabs */}
          <div className="flex bg-white/[0.05] rounded-xl p-1 mb-6">
            {["login", "register"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === m
                    ? "bg-white text-black"
                    : "text-white/45 hover:text-white"
                }`}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-white/50 text-xs font-medium mb-1.5 uppercase tracking-wider">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username"
                  autoComplete="username"
                  required
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm outline-none placeholder:text-white/20 focus:border-white/25 transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-white/50 text-xs font-medium mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm outline-none placeholder:text-white/20 focus:border-white/25 transition-colors"
              />
            </div>

            <div>
              <label className="block text-white/50 text-xs font-medium mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={6}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm outline-none placeholder:text-white/20 focus:border-white/25 transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-all mt-1"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #2563eb)",
              }}
            >
              {loading
                ? "Please wait…"
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          <p className="text-white/20 text-xs text-center mt-6 leading-relaxed">
            Let's get to know each other!
          </p>
        </div>
      </div>
    </div>
  );
}
