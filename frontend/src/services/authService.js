/**
 * Auth API service.
 *
 * Components NEVER call axios directly. They call functions from this layer.
 * If the auth API contract changes, only this file needs to change.
 */
import api from "@/lib/api";

export const authService = {
  login: (email, password) =>
    api.post("/auth/login", { email, password }).then((r) => r.data),

  unlock: (password) =>
    api.post("/auth/unlock", { password }).then((r) => r.data),

  logout: () => api.post("/auth/logout").then((r) => r.data),

  me: () => api.get("/auth/me").then((r) => r.data),

  refresh: () => api.post("/auth/refresh").then((r) => r.data),

  forgotPassword: (email) =>
    api.post("/auth/forgot-password", { email }).then((r) => r.data),

  resetPassword: (token, newPassword) =>
    api
      .post("/auth/reset-password", { token, new_password: newPassword })
      .then((r) => r.data),
};
