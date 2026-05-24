import { useState, useRef, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { api } from "../lib/api.js";

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState("form");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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

  async function handleForgotRequest(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setStep("forgot-code");
      setResendCooldown(60);
      setCodeDigits(["", "", "", "", "", ""]);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    const code = codeDigits.join("");
    if (code.length !== 6) return;
    setError("");
    setLoading(true);
    try {
      await api.resetPassword(email, code, newPassword);
      setSuccess("Password reset successfully! Please sign in.");
      switchMode("login");
    } catch (err) {
      setError(err.message);
      setCodeDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotResend() {
    if (resendCooldown > 0) return;
    setError("");
    try {
      await api.forgotPassword(email);
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
    setNewPassword("");
    setConfirmPassword("");
  }

  function backToRegister() {
    setStep("form");
    setError("");
    setCodeDigits(["", "", "", "", "", ""]);
  }

  function goToForgot() {
    setStep("forgot");
    setEmail("");
    setError("");
    setSuccess("");
  }

  const inputCls =
    "w-full rounded-xl px-4 py-3 text-sm outline-none cursor-text bg-[#10192e] border border-indigo-500/15 text-[#eef2ff] placeholder:text-indigo-300/25";

  const focusProps = {
    onFocus: (e) => {
      e.target.style.borderColor = "rgba(99,102,241,0.55)";
      e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.10)";
    },
    onBlur: (e) => {
      e.target.style.borderColor = "";
      e.target.style.boxShadow = "";
    },
  };

  const digitInputs = (
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
          className="w-11 h-13 text-center text-[#eef2ff] text-xl font-bold rounded-xl outline-none cursor-text bg-[#10192e] border border-indigo-500/15"
          {...focusProps}
        />
      ))}
    </div>
  );

  return (
    <div
      className="h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "#070d1c" }}
    >
      {/* Ambient glow blobs — static (no animation) so filter:blur is composited once */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute" style={{
          top: "-25%", left: "-15%",
          width: "72%", height: "72%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%)",
          filter: "blur(60px)",
        }} />
        <div className="absolute" style={{
          bottom: "-25%", right: "-15%",
          width: "72%", height: "72%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)",
          filter: "blur(60px)",
        }} />
        <div className="absolute" style={{
          top: "45%", left: "45%",
          transform: "translate(-50%,-50%)",
          width: "56%", height: "56%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)",
          filter: "blur(70px)",
        }} />
      </div>

      {/* Background orbital rings */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div
          style={{
            position: "absolute",
            width: 680,
            height: 680,
            borderRadius: "50%",
            border: "1px solid rgba(99,102,241,0.07)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 480,
            height: 480,
            borderRadius: "50%",
            border: "1px solid rgba(99,102,241,0.09)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 300,
            height: 300,
            borderRadius: "50%",
            border: "1px solid rgba(99,102,241,0.12)",
          }}
        />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Backdrop blur as its own layer — inputs must NOT be children of a
            backdrop-filter element or iOS Safari renders the caret outside the field */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{ backdropFilter: "blur(24px)" }}
        />
        <div
          className="relative rounded-3xl p-8"
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(99,102,241,0.12)",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.025), 0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div
              className="relative w-14 h-14 rounded-2xl flex items-center justify-center hub-breathe"
              style={{
                background: "linear-gradient(145deg, #9f7aea, #6366f1, #3b82f6)",
              }}
            >
              {/* Specular highlight */}
              <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
                }}
              />
              <MessageCircle size={24} className="text-white relative z-10" strokeWidth={1.8} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#eef2ff" }}>
              Chatloop<span style={{ color: "#818cf8" }}>.</span>
            </h1>
          </div>

          {step === "verify" ? (
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="text-center space-y-1.5">
                <p className="font-semibold text-sm" style={{ color: "#eef2ff" }}>
                  Check your inbox
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(238,242,255,0.45)" }}>
                  We sent a 6-digit code to
                </p>
                <p className="text-sm font-medium" style={{ color: "#a5b4fc" }}>
                  {email}
                </p>
              </div>

              {digitInputs}

              {error && (
                <div
                  className="text-sm px-4 py-3 rounded-xl"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: "#f87171",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || codeDigits.join("").length !== 6}
                className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-all hover:opacity-90 active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)",
                  boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
                }}
              >
                {loading ? "Verifying…" : "Verify Email"}
              </button>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={backToRegister}
                  className="text-xs transition-colors hover:text-indigo-300"
                  style={{ color: "rgba(238,242,255,0.35)" }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="text-xs transition-colors hover:text-indigo-300 disabled:pointer-events-none"
                  style={{ color: "rgba(238,242,255,0.35)" }}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          ) : step === "forgot" ? (
            <form onSubmit={handleForgotRequest} className="space-y-6">
              <div className="text-center space-y-1.5">
                <p className="font-semibold text-sm" style={{ color: "#eef2ff" }}>
                  Forgot your password?
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(238,242,255,0.45)" }}>
                  Enter your email and we'll send a reset code.
                </p>
              </div>

              <div>
                <label
                  className="block text-xs font-medium mb-2 uppercase tracking-wider"
                  style={{ color: "rgba(165,180,252,0.6)" }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className={inputCls}
                  {...focusProps}
                />
              </div>

              {error && (
                <div
                  className="text-sm px-4 py-3 rounded-xl"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: "#f87171",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-all hover:opacity-90 active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)",
                  boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
                }}
              >
                {loading ? "Sending…" : "Send Reset Code"}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="text-xs transition-colors hover:text-indigo-300"
                  style={{ color: "rgba(238,242,255,0.35)" }}
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          ) : step === "forgot-code" ? (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="text-center space-y-1.5">
                <p className="font-semibold text-sm" style={{ color: "#eef2ff" }}>
                  Set new password
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(238,242,255,0.45)" }}>
                  Enter the code sent to
                </p>
                <p className="text-sm font-medium" style={{ color: "#a5b4fc" }}>
                  {email}
                </p>
              </div>

              {digitInputs}

              <div>
                <label
                  className="block text-xs font-medium mb-2 uppercase tracking-wider"
                  style={{ color: "rgba(165,180,252,0.6)" }}
                >
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className={inputCls}
                  {...focusProps}
                />
              </div>

              <div>
                <label
                  className="block text-xs font-medium mb-2 uppercase tracking-wider"
                  style={{ color: "rgba(165,180,252,0.6)" }}
                >
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  className={inputCls}
                  {...focusProps}
                />
              </div>

              {error && (
                <div
                  className="text-sm px-4 py-3 rounded-xl"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: "#f87171",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  loading ||
                  codeDigits.join("").length !== 6 ||
                  !newPassword ||
                  !confirmPassword
                }
                className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-all hover:opacity-90 active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)",
                  boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
                }}
              >
                {loading ? "Resetting…" : "Reset Password"}
              </button>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep("forgot")}
                  className="text-xs transition-colors hover:text-indigo-300"
                  style={{ color: "rgba(238,242,255,0.35)" }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleForgotResend}
                  disabled={resendCooldown > 0}
                  className="text-xs transition-colors hover:text-indigo-300 disabled:pointer-events-none"
                  style={{ color: "rgba(238,242,255,0.35)" }}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Mode tabs */}
              <div
                className="flex rounded-xl p-1 mb-7"
                style={{ background: "rgba(99,102,241,0.08)" }}
              >
                {["login", "register"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
                    style={
                      mode === m
                        ? {
                            background: "#6366f1",
                            color: "#ffffff",
                            boxShadow: "0 2px 12px rgba(99,102,241,0.4)",
                          }
                        : { color: "rgba(238,242,255,0.45)" }
                    }
                  >
                    {m === "login" ? "Sign In" : "Register"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "register" && (
                  <div>
                    <label
                      className="block text-xs font-medium mb-2 uppercase tracking-wider"
                      style={{ color: "rgba(165,180,252,0.6)" }}
                    >
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="your_username"
                      autoComplete="username"
                      required
                      className={inputCls}
                      {...focusProps}
                    />
                  </div>
                )}

                <div>
                  <label
                    className="block text-xs font-medium mb-2 uppercase tracking-wider"
                    style={{ color: "rgba(165,180,252,0.6)" }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className={inputCls}
                    {...focusProps}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      className="block text-xs font-medium uppercase tracking-wider"
                      style={{ color: "rgba(165,180,252,0.6)" }}
                    >
                      Password
                    </label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={goToForgot}
                        className="text-xs transition-colors hover:text-indigo-300"
                        style={{ color: "rgba(238,242,255,0.35)" }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    minLength={6}
                    className={inputCls}
                    {...focusProps}
                  />
                </div>

                {error && (
                  <div
                    className="text-sm px-4 py-3 rounded-xl"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: "#f87171",
                    }}
                  >
                    {error}
                  </div>
                )}

                {success && (
                  <div
                    className="text-sm px-4 py-3 rounded-xl"
                    style={{
                      background: "rgba(34,197,94,0.08)",
                      border: "1px solid rgba(34,197,94,0.2)",
                      color: "#4ade80",
                    }}
                  >
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-all hover:opacity-90 active:scale-[0.98] mt-1"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)",
                    boxShadow: "0 4px 24px rgba(99,102,241,0.45)",
                  }}
                >
                  {loading
                    ? "Please wait…"
                    : mode === "login"
                      ? "Sign In"
                      : "Create Account"}
                </button>
              </form>

              <p
                className="text-xs text-center mt-6 leading-relaxed"
                style={{ color: "rgba(238,242,255,0.22)" }}
              >
                {mode === "register"
                  ? "We'll send a verification code to your email."
                  : "Welcome back — let's chat."}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
