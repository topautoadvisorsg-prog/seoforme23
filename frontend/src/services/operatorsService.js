/**
 * Operators API service (admin-only endpoints).
 */
import api from "@/lib/api";

export const operatorsService = {
  list: () => api.get("/operators").then((r) => r.data),

  create: (payload) => api.post("/operators", payload).then((r) => r.data),

  update: (id, payload) =>
    api.patch(`/operators/${id}`, payload).then((r) => r.data),

  remove: (id) => api.delete(`/operators/${id}`).then((r) => r.data),
};
