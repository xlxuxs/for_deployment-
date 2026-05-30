import { apiClient } from "./client";

export const publicApi = {
  getLandingData() {
    return apiClient.get("/public/landing");
  },
  getPolicyAnalytics(policyId) {
    return apiClient.get(`/public/policy/${policyId}/analytics`);
  },
  getPolicyComments(policyId) {
    return apiClient.get(`/public/policy/${policyId}/comments`);
  },
};