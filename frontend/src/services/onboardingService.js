import api from "@/lib/api";

export const onboardingService = {
  list: (clientId) =>
    api.get(`/clients/${clientId}/onboarding`).then((r) => r.data),
  setComplete: (itemId, completed) =>
    api
      .patch(`/onboarding-items/${itemId}`, { completed })
      .then((r) => r.data),
};
