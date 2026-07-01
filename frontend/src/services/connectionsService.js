import api from "@/lib/api";

export const connectionsService = {
  list: (clientId) =>
    api.get(`/clients/${clientId}/connections`).then((r) => r.data),
  upsert: (clientId, serviceName, credentials) =>
    api
      .put(`/clients/${clientId}/connections/${serviceName}`, { credentials })
      .then((r) => r.data),
  remove: (clientId, serviceName) =>
    api
      .delete(`/clients/${clientId}/connections/${serviceName}`)
      .then((r) => r.data),
  test: (clientId, serviceName) =>
    api
      .post(`/clients/${clientId}/connections/${serviceName}/test`)
      .then((r) => r.data),
};
