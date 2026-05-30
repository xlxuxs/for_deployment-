import { apiClient } from "./client";

export const analyticsApi = {
  summary(policyId, params = {}) {
    return apiClient.get(`/analytics/${policyId}`, { params });
  },
  comments(policyId, params = {}) {
    return apiClient.get(`/analytics/${policyId}/comments`, { params });
  },
  async exportCsv(policyId, params = {}) {
    const response = await apiClient.get(`/analytics/${policyId}/export`, {
      params,
      responseType: "blob",
    });
    return response;
  },
  heatmap(params = {}) {
    return apiClient.get("/analytics/heatmap", { params });
  },
  timeseries(policyId, params = {}) {
    return apiClient.get(`/analytics/${policyId}/timeseries`, { params });
  },
  correlation(policyId, params = {}) {
    return apiClient.get(`/analytics/${policyId}/correlation`, { params });
  },
  demographics(policyId, params = {}) {
    return apiClient.get(`/analytics/${policyId}/demographics`, { params });
  },
  cross(params = {}) {
    return apiClient.get("/analytics/cross", { params });
  },
};
