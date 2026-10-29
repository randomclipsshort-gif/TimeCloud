import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "../lib/supabase.js";

const fieldClassName =
  "w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

function getAuthErrorMessage(error, fallback) {
  if (error?.message === "Failed to fetch") {
    return "Could not reach Supabase. Check that VITE_SUPABASE_URL points to your active project and that your network can reach it.";
  }
  return error?.message || fallback;
}

function AuthField({ id, label, icon, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-600">
        {label}
      </label>
      <div className="relative">
        <i
          className={`fa-solid ${icon} absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400`}
          aria-hidden="true"
        />
        <input id={id} className={fieldClassName} {...inputProps} />
      </div>
    </div>
  );
}

export default function AuthPage({ open, recoveryMode = false, onRecoveryComplete }) {
  const [activeTab, setActiveTab] = useState("login");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveTab(recoveryMode ? "set-password" : "login");
    setError("");
    setMessage("");
  }, [open, recoveryMode]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setError("");
    setMessage("");
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email")).trim();
    const password = String(formData.get("password"));
    if (!supabase) return setError("Cloud authentication is not configured. Add the Supabase URL and publishable key.");
    setLoading(true);
    setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(getAuthErrorMessage(signInError, "Sign in failed. Try again."));
      }
    } catch (signInError) {
      setError(getAuthErrorMessage(
        signInError,
        "Sign in failed because the authentication service could not be reached. Try again.",
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name")).trim();
    const email = String(formData.get("email")).trim();
    const password = String(formData.get("password"));

    if (!supabase) return setError("Cloud authentication is not configured. Add the Supabase URL and publishable key.");
    setLoading(true);
    setError("");
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: name ? { full_name: name } : {} },
      });
      if (signUpError) {
        setError(getAuthErrorMessage(signUpError, "Registration failed. Try again."));
        return;
      }
      if (!data.session) {
        setMessage("Check your email to confirm your account, then sign in.");
      }
    } catch (signUpError) {
      setError(getAuthErrorMessage(
        signUpError,
        "Registration failed because the authentication service could not be reached. Try again.",
      ));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    if (!supabase) return setError("Cloud authentication is not configured. Add the Supabase URL and publishable key.");
    setLoading(true);
    setError("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setMessage("If an account exists for that email, a password reset link has been sent.");
    } catch {
      setError("Password reset could not be requested because the authentication service is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password"));
    const confirmation = String(formData.get("confirmPassword"));
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    if (!supabase) return setError("Cloud authentication is not configured.");
    setLoading(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setMessage("Password updated successfully.");
      onRecoveryComplete?.();
    } catch {
      setError("Password could not be updated because the authentication service is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const isLogin = activeTab === "login";
  const isRecovery = activeTab === "recover";

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm ${open ? "" : "hidden"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      aria-hidden={!open}
    >
      <section className="max-h-[95vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md">
            <i className="fa-solid fa-clock text-2xl" aria-hidden="true" />
          </div>
          <h2 id="auth-title" className="text-2xl font-bold text-slate-800">
            {recoveryMode
              ? "Set a new password"
              : isRecovery
                ? "Reset password"
                : isLogin
                  ? "Welcome back"
                  : "Create Account"}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {recoveryMode
              ? "Choose a new password for your account"
              : isRecovery
                ? "We'll email you a secure password reset link"
                : isLogin
                  ? "Sign in to access your personal hub & timekeeping"
                  : "Join TimeCloud to manage shifts, salary & logs"}
          </p>
        </div>

        {!recoveryMode && !isRecovery && (
        <div className="mb-6 flex border-b border-slate-200" role="tablist" aria-label="Account access">
          {[
            { id: "login", label: "Sign In" },
            { id: "register", label: "Register" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`auth-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`auth-panel-${tab.id}`}
              onClick={() => switchTab(tab.id)}
              className={`flex-1 border-b-2 pb-3 text-sm transition-all ${
                activeTab === tab.id
                  ? "border-teal-600 font-semibold text-teal-600"
                  : "border-transparent font-medium text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        )}

        {error && (
          <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800" role="status">
            {message}
          </p>
        )}
        {!supabaseConfigured && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="alert">
            Authentication is unavailable until <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> are configured.
          </p>
        )}

        {recoveryMode ? (
          <form key="set-password" onSubmit={handlePasswordUpdate} className="space-y-4">
            <AuthField
              id="newPassword"
              name="password"
              label="New Password"
              icon="fa-lock"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              placeholder="At least 8 characters"
            />
            <AuthField
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm Password"
              icon="fa-lock"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              placeholder="Re-enter your new password"
            />
            <button type="submit" disabled={loading} className="mt-2 w-full rounded-lg bg-teal-600 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-teal-700 disabled:opacity-60">
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        ) : isRecovery ? (
          <form key="recover" onSubmit={handlePasswordReset} className="space-y-4">
            <AuthField
              id="recoveryEmail"
              name="email"
              label="Email Address"
              icon="fa-envelope"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
            <button type="submit" disabled={loading} className="mt-2 w-full rounded-lg bg-teal-600 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-teal-700 disabled:opacity-60">
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
            <button type="button" onClick={() => switchTab("login")} className="w-full text-xs font-semibold text-slate-500 hover:text-teal-700">
              Back to sign in
            </button>
          </form>
        ) : isLogin ? (
          <form
            key="login"
            id="auth-panel-login"
            role="tabpanel"
            aria-labelledby="auth-tab-login"
            onSubmit={handleLogin}
            className="space-y-4"
          >
            <AuthField
              id="loginEmail"
              name="email"
              label="Email Address"
              icon="fa-envelope"
              type="email"
              autoComplete="email"
              required
              placeholder="alex@mycloud.dev"
            />
            <AuthField
              id="loginPassword"
              name="password"
              label="Password"
              icon="fa-lock"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Enter your password"
            />
            <button
              type="submit"
              disabled={loading || !supabaseConfigured}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-xs font-semibold text-white shadow-md shadow-teal-600/20 transition hover:bg-teal-700"
            >
              <i className="fa-solid fa-right-to-bracket" aria-hidden="true" />
              <span>{loading ? "Signing in..." : "Access My Hub"}</span>
            </button>
            <button type="button" onClick={() => switchTab("recover")} className="w-full text-right text-xs font-semibold text-teal-700 hover:text-teal-800">
              Forgot password?
            </button>
          </form>
        ) : (
          <form
            key="register"
            id="auth-panel-register"
            role="tabpanel"
            aria-labelledby="auth-tab-register"
            onSubmit={handleRegister}
            className="space-y-4"
          >
            <AuthField
              id="regName"
              name="name"
              label="Display Name (optional)"
              icon="fa-user"
              type="text"
              autoComplete="name"
              placeholder="Alex Morgan"
            />
            <AuthField
              id="regEmail"
              name="email"
              label="Email Address"
              icon="fa-envelope"
              type="email"
              autoComplete="email"
              required
              placeholder="alex@mycloud.dev"
            />
            <AuthField
              id="regPassword"
              name="password"
              label="Password"
              icon="fa-lock"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
            <button
              type="submit"
              disabled={loading || !supabaseConfigured}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-xs font-semibold text-white shadow-md shadow-teal-600/20 transition hover:bg-teal-700"
            >
              <i className="fa-solid fa-user-plus" aria-hidden="true" />
              <span>{loading ? "Creating account..." : "Start Tracking"}</span>
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
          TimeCloud stores your personal attendance, salary settings, expenses, and leave data in your private cloud workspace.
        </p>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          <i className="fa-solid fa-shield-halved mr-1" aria-hidden="true" />
          Your data is protected by account-scoped database policies; storage is not end-to-end encrypted.
        </p>
      </section>
    </div>
  );
}