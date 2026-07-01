import api from "@/lib/api";

export const clientsService = {
  list: () => api.get("/clients").then((r) => r.data),
  get: (id) => api.get(`/clients/${id}`).then((r) => r.data),
  create: (payload) => api.post("/clients", payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/clients/${id}`, payload).then((r) => r.data),
  setStatus: (id, status) =>
    api.patch(`/clients/${id}/status`, { status }).then((r) => r.data),
  remove: (id) => api.delete(`/clients/${id}`).then((r) => r.data),
  activity: (id) => api.get(`/clients/${id}/activity`).then((r) => r.data),
};
