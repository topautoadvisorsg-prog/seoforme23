import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { unlock } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!password) {
      setError("Enter the password");
      return;
    }
    setSubmitting(true);
    try {
      await unlock(password);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="login-page"
      className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-bg))] px-4"
    >
      <div className="w-full max-w-[360px]">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--color-text))]">
            SmartClix
          </h1>
          <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
            Enter your password to continue
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          data-testid="login-form"
          className="rounded-xl border border-[rgb(var(--color-border))] bg-white p-6 shadow-sm"
        >
          <div className="relative">
            <input
              data-testid="login-password-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              autoComplete="current-password"
              className={`focus-ring h-11 w-full rounded-md border px-3 pr-10 text-sm outline-none ${
                error ? "border-[rgb(var(--color-danger))]" : "border-[rgb(var(--color-border))]"
              }`}
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

          {error && (
            <div
              data-testid="login-error"
              className="mt-3 rounded-md border border-[rgb(var(--color-danger))] bg-red-50 px-3 py-2 text-sm text-[rgb(var(--color-danger))]"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            data-testid="login-submit-btn"
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[rgb(var(--color-primary))] text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
