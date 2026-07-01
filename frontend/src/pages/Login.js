import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { authService } from "@/services/authService";
import { formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("This field is required");
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      const dest = location.state?.from || "/dashboard";
      navigate(dest, { replace: true });
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    try {
      await authService.forgotPassword(forgotEmail);
      setForgotSent(true);
    } catch (err) {
      // Same message regardless — security
      setForgotSent(true);
    }
  };

  return (
    <div
      data-testid="login-page"
      className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-bg))] px-4"
    >
      <div className="w-full max-w-[420px]">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--color-text))]">
            SmartClix
          </h1>
          <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
            Agency Operations Platform
          </p>
        </div>

        <div className="rounded-xl border border-[rgb(var(--color-border))] bg-white p-8 shadow-sm">
          {!showForgot ? (
            <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
                  Email Address
                </label>
                <input
                  data-testid="login-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`focus-ring h-10 w-full rounded-md border px-3 text-sm outline-none ${
                    error ? "border-[rgb(var(--color-danger))]" : "border-[rgb(var(--color-border))]"
                  }`}
                  autoFocus
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
                  Password
                </label>
                <div className="relative">
                  <input
                    data-testid="login-password-input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`focus-ring h-10 w-full rounded-md border px-3 pr-10 text-sm outline-none ${
                      error ? "border-[rgb(var(--color-danger))]" : "border-[rgb(var(--color-border))]"
                    }`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    data-testid="login-toggle-password"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowForgot(true)}
                data-testid="login-forgot-link"
                className="text-xs text-[rgb(var(--color-primary))] hover:underline"
              >
                Forgot password?
              </button>

              {error && (
                <div
                  data-testid="login-error"
                  className="rounded-md border border-[rgb(var(--color-danger))] bg-red-50 px-3 py-2 text-sm text-[rgb(var(--color-danger))]"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                data-testid="login-submit-btn"
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[rgb(var(--color-primary))] text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Sign In
              </button>
            </form>
          ) : (
            <div data-testid="forgot-password-modal" className="space-y-4">
              <h2 className="text-lg font-semibold">Reset your password</h2>
              {!forgotSent ? (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
                      Email Address
                    </label>
                    <input
                      data-testid="forgot-email-input"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      className="focus-ring h-10 w-full rounded-md border border-[rgb(var(--color-border))] px-3 text-sm outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowForgot(false)}
                      className="h-10 flex-1 rounded-md border border-[rgb(var(--color-border))] text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      data-testid="forgot-submit-btn"
                      className="h-10 flex-1 rounded-md bg-[rgb(var(--color-primary))] text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Send Reset Link
                    </button>
                  </div>
                </form>
              ) : (
                <div data-testid="forgot-success" className="space-y-4">
                  <p className="text-sm text-[rgb(var(--color-text-muted))]">
                    If that email is registered, you&apos;ll receive a reset link
                    shortly.
                  </p>
                  <button
                    onClick={() => {
                      setShowForgot(false);
                      setForgotSent(false);
                      setForgotEmail("");
                    }}
                    className="h-10 w-full rounded-md border border-[rgb(var(--color-border))] text-sm hover:bg-gray-50"
                  >
                    Back to sign in
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[rgb(var(--color-text-muted))]">
          Having trouble? Contact your admin.
        </p>
      </div>
    </div>
  );
}
