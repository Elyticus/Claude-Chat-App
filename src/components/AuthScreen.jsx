import { useState, useRef, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { api } from "../lib/api.js";

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState("form"); // "form" | "verify"
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeDigits, setCodeDigits] = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        const data = await api.login(email, password);
        onAuth(data);
      } else {
        const data = await api.register(username, email, password);
        if (data.pending) {
          setStep("verify");
          setResendCooldown(60);
          setTimeout(() => inputRefs.current[0]?.focus(), 50);
        } else {
          onAuth(data);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    const code = codeDigits.join("");
    if (code.length !== 6) return;
    setError("");
    setLoading(true);
    try {
      const data = await api.verifyEmail(email, code);
      onAuth(data);
    } catch (err) {
      setError(err.message);
      setCodeDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError("");
    try {
      await api.resendCode(email);
      setResendCooldown(60);
      setCodeDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDigitChange(index, value) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...codeDigits];
    next[index] = digit;
    setCodeDigits(next);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyDown(index, e) {
    if (e.key === "Backspace" && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleDigitPaste(e) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setCodeDigits(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  }

  function switchMode(m) {
    setMode(m);
    setStep("form");
    setError("");
    setCodeDigits(["", "", "", "", "", ""]);
  }

  function backToRegister() {
    setStep("form");
    setError("");
    setCodeDigits(["", "", "", "", "", ""]);
  }

  return (
    <div className="h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background orbital rings */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="absolute w-175 h-175 rounded-full border border-white/4" />
        <div className="absolute w-125 h-125 rounded-full border border-white/4" />
        <div className="absolute w-80 h-80 rounded-full border border-white/4" />
        <div
          className="absolute w-32 h-32 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative w-full max-w-sm">
        <div
          className="bg-white/4 border border-white/10 rounded-2xl p-8 shadow-2xl"
          style={{ backdropFilter: "blur(20px)" }}
        >
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #6366f1, #3b82f6, #14b8a6)",
                boxShadow: "0 0 30px rgba(99,102,241,0.3)",
              }}
            >
              <MessageCircle size={22} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Chatloop<span className="text-purple-400">.</span>
            </h1>
          </div>

          {step === "verify" ? (
            /* ── Verification step ── */
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="text-center space-y-1">
                <p className="text-white font-semibold text-sm">Check your inbox</p>
                <p className="text-white/40 text-xs leading-relaxed">
                  We sent a 6-digit code to
                </p>
                <p className="text-indigo-300 text-sm font-medium">{email}</p>
              </div>

              {/* 6-digit boxes */}
              <div className="flex gap-2 justify-center">
                {codeDigits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    onPaste={handleDigitPaste}
                    className="w-10 h-12 text-center text-white text-xl font-bold bg-white/5 border border-white/10 rounded-xl outline-none focus:border-indigo-400 focus:bg-indigo-500/10 transition-colors"
                  />
                ))}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || codeDigits.join("").length !== 6}
                className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-all"
                style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
              >
                {loading ? "Verifying…" : "Verify Email"}
              </button>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={backToRegister}
                  className="text-white/30 text-xs hover:text-white/60 transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="text-white/30 text-xs hover:text-white/60 transition-colors disabled:pointer-events-none"
                >
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend code"}
                </button>
              </div>
            </form>
          ) : (
            /* ── Login / Register form ── */
            <>
              {/* Mode tabs */}
              <div className="flex bg-white/5 rounded-xl p-1 mb-6">
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
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder:text-white/20 focus:border-white/25 transition-colors"
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
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder:text-white/20 focus:border-white/25 transition-colors"
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
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder:text-white/20 focus:border-white/25 transition-colors"
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
                {mode === "register"
                  ? "We'll send a verification code to your email."
                  : "Let's get to know each other!"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
