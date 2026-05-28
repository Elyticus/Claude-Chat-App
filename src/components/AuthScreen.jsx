import { useState, useRef, useEffect } from "react";
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
  const [codeDigits, setCodeDigits] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
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
    if (code.length !== 8) return;
    setError("");
    setLoading(true);
    try {
      const data = await api.verifyEmail(email, code);
      onAuth(data);
    } catch (err) {
      setError(err.message);
      setCodeDigits(["", "", "", "", "", "", "", ""]);
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
      setCodeDigits(["", "", "", "", "", "", "", ""]);
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
      setCodeDigits(["", "", "", "", "", "", "", ""]);
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
    if (code.length !== 8) return;
    setError("");
    setLoading(true);
    try {
      await api.resetPassword(email, code, newPassword);
      setSuccess("Password reset successfully! Please sign in.");
      switchMode("login");
    } catch (err) {
      setError(err.message);
      setCodeDigits(["", "", "", "", "", "", "", ""]);
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
      setCodeDigits(["", "", "", "", "", "", "", ""]);
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
    if (digit && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyDown(index, e) {
    if (e.key === "Backspace" && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleDigitPaste(e) {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 8);
    if (pasted.length === 8) {
      e.preventDefault();
      setCodeDigits(pasted.split(""));
      inputRefs.current[7]?.focus();
    }
  }

  function switchMode(m) {
    setMode(m);
    setStep("form");
    setError("");
    setCodeDigits(["", "", "", "", "", "", "", ""]);
    setNewPassword("");
    setConfirmPassword("");
  }

  function backToRegister() {
    setStep("form");
    setError("");
    setCodeDigits(["", "", "", "", "", "", "", ""]);
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
    <div className="flex gap-1.5" role="group" aria-label="Verification code">
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
          aria-label={`Digit ${i + 1} of 8`}
          className="flex-1 min-w-0 h-11 text-center text-[#eef2ff] text-lg font-bold rounded-xl outline-none cursor-text bg-popover border border-indigo-500/15"
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
      {/* Ambient glow blobs — rendered as soft radial gradients, no filter:blur so zero extra compositor layers */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute"
          style={{
            top: "-30%",
            left: "-20%",
            width: "90%",
            height: "90%",
            background:
              "radial-gradient(ellipse at center, rgba(99,102,241,0.14) 0%, rgba(99,102,241,0.05) 40%, transparent 70%)",
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: "-30%",
            right: "-20%",
            width: "90%",
            height: "90%",
            background:
              "radial-gradient(ellipse at center, rgba(124,58,237,0.12) 0%, rgba(124,58,237,0.04) 40%, transparent 70%)",
          }}
        />
        <div
          className="absolute"
          style={{
            top: "20%",
            left: "20%",
            width: "60%",
            height: "60%",
            background:
              "radial-gradient(ellipse at center, rgba(6,182,212,0.08) 0%, rgba(6,182,212,0.02) 45%, transparent 70%)",
          }}
        />
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
              className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(145deg, #9f7aea, #6366f1, #3b82f6)",
              }}
            >
              {/* Specular highlight */}
              <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
                }}
              />
              <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="text-white relative z-10">
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
              </svg>
            </div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "#eef2ff" }}
            >
              Linkloop<span style={{ color: "#818cf8" }}>.</span>
            </h1>
          </div>

          {step === "verify" ? (
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="text-center space-y-1.5">
                <p
                  className="font-semibold text-sm"
                  style={{ color: "#eef2ff" }}
                >
                  Check your inbox
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "rgba(238,242,255,0.45)" }}
                >
                  We sent an 8-digit code to
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
                disabled={loading || codeDigits.join("").length !== 8}
                className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-all hover:opacity-90 active:scale-[0.98]"
                style={{
                  background:
                    "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)",
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
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend code"}
                </button>
              </div>
            </form>
          ) : step === "forgot" ? (
            <form onSubmit={handleForgotRequest} className="space-y-6">
              <div className="text-center space-y-1.5">
                <p
                  className="font-semibold text-sm"
                  style={{ color: "#eef2ff" }}
                >
                  Forgot your password?
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "rgba(238,242,255,0.45)" }}
                >
                  Enter your email and we'll send a reset code.
                </p>
              </div>

              <div>
                <label
                  htmlFor="forgot-email"
                  className="block text-xs font-medium mb-2 uppercase tracking-wider"
                  style={{ color: "rgba(165,180,252,0.6)" }}
                >
                  Email
                </label>
                <input
                  id="forgot-email"
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
                  background:
                    "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)",
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
                <p
                  className="font-semibold text-sm"
                  style={{ color: "#eef2ff" }}
                >
                  Set new password
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "rgba(238,242,255,0.45)" }}
                >
                  Enter the code sent to
                </p>
                <p className="text-sm font-medium" style={{ color: "#a5b4fc" }}>
                  {email}
                </p>
              </div>

              {digitInputs}

              <div>
                <label
                  htmlFor="reset-new-password"
                  className="block text-xs font-medium mb-2 uppercase tracking-wider"
                  style={{ color: "rgba(165,180,252,0.6)" }}
                >
                  New Password
                </label>
                <input
                  id="reset-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className={inputCls}
                  {...focusProps}
                />
              </div>

              <div>
                <label
                  htmlFor="reset-confirm-password"
                  className="block text-xs font-medium mb-2 uppercase tracking-wider"
                  style={{ color: "rgba(165,180,252,0.6)" }}
                >
                  Confirm Password
                </label>
                <input
                  id="reset-confirm-password"
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
                  codeDigits.join("").length !== 8 ||
                  !newPassword ||
                  !confirmPassword
                }
                className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-all hover:opacity-90 active:scale-[0.98]"
                style={{
                  background:
                    "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)",
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
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend code"}
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
                      htmlFor="auth-username"
                      className="block text-xs font-medium mb-2 uppercase tracking-wider"
                      style={{ color: "rgba(165,180,252,0.6)" }}
                    >
                      Username
                    </label>
                    <input
                      id="auth-username"
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
                    htmlFor="auth-email"
                    className="block text-xs font-medium mb-2 uppercase tracking-wider"
                    style={{ color: "rgba(165,180,252,0.6)" }}
                  >
                    Email
                  </label>
                  <input
                    id="auth-email"
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
                      htmlFor="auth-password"
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
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    required
                    minLength={8}
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
                    background:
                      "linear-gradient(135deg, #7c3aed, #6366f1, #2563eb)",
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
                  ? "We'll send an 8-digit verification code to your email."
                  : "Welcome back — let's chat."}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
