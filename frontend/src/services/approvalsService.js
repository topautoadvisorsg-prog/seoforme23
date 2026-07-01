/**
 * Approval Queue API service.
 * Components never call axios directly — they go through here.
 */
import api from "@/lib/api";

export const approvalsService = {
  list: (params = {}) => api.get("/approvals", { params }).then((r) => r.data),

  get: (id) => api.get(`/approvals/${id}`).then((r) => r.data),

  approve: (id, body = {}) =>
    api.post(`/approvals/${id}/approve`, body).then((r) => r.data),

  reject: (id, review_notes) =>
    api.post(`/approvals/${id}/reject`, { review_notes }).then((r) => r.data),

  flag: (id) => api.post(`/approvals/${id}/flag`).then((r) => r.data),

  update: (id, payload) =>
    api.patch(`/approvals/${id}`, { payload }).then((r) => r.data),

  requeue: (id) => api.post(`/approvals/${id}/requeue`).then((r) => r.data),

  remove: (id) => api.delete(`/approvals/${id}`).then((r) => r.data),
};
