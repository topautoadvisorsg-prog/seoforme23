import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ roles, children }) {
  const { operator } = useAuth();
  const location = useLocation();

  if (operator === null) {
    return (
      <div
        data-testid="auth-loading"
        className="flex h-screen w-screen items-center justify-center"
      >
        <div className="flex items-center gap-3 text-sm text-[rgb(var(--color-text-muted))]">
          <span className="h-3 w-3 animate-pulse rounded-full bg-[rgb(var(--color-primary))]" />
          Loading SmartClix…
        </div>
      </div>
    );
  }
  if (operator === false) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && roles.length && !roles.includes(operator.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
