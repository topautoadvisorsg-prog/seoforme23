import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authService } from "@/services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // null = checking, false = unauth, object = authenticated
  const [operator, setOperator] = useState(null);

  const fetchMe = useCallback(async () => {
    try {
      setOperator(await authService.me());
    } catch (_e) {
      setOperator(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password);
    setOperator(data);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (_e) {
      /* ignore */
    }
    setOperator(false);
  }, []);

  return (
    <AuthContext.Provider value={{ operator, login, logout, refresh: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
