import api from "@/lib/api";

export const workspaceService = {
  get: (clientId) =>
    api.get(`/clients/${clientId}/workspace`).then((r) => r.data),
  toggleServices: (clientId, services) =>
    api
      .patch(`/clients/${clientId}/workspace/services`, services)
      .then((r) => r.data),
};
