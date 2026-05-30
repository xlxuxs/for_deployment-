import { apiClient } from "./client";

// Note: This is an extended version with unpublish and other lifecycle methods
export const policyApi = {
  list(params = {}) {
    return apiClient.get("/policies", { params });
  },
  get(id) {
    return apiClient.get(`/policies/${id}`);
  },
  create(payload) {
    return apiClient.post("/policies", payload);
  },
  update(id, payload) {
    return apiClient.put(`/policies/${id}`, payload);
  },
  publish(id) {
    return apiClient.patch(`/policies/${id}/publish`);
  },
  unpublish(id) {
    return apiClient.patch(`/policies/${id}/unpublish`);
  },
  pause(id) {
    return apiClient.patch(`/policies/${id}/pause`);
  },
  resume(id) {
    return apiClient.patch(`/policies/${id}/resume`);
  },
  extend(id, newEndDate) {
    return apiClient.patch(`/policies/${id}/extend`, { newEndDate });
  },
  close(id) {
    return apiClient.post(`/policies/${id}/close`);
  },
  delete(id) {
    return apiClient.delete(`/policies/${id}`);
  },
  clone(id) {
    return apiClient.post(`/policies/${id}/clone`);
  },
  archive(id) {
    return apiClient.patch(`/policies/${id}/archive`);
  },
  restore(id) {
    return apiClient.patch(`/policies/${id}/restore`);
  },
  history(id) {
    return apiClient.get(`/policies/${id}/history`);
  },
  suggestTopics(text) {
    return apiClient.post("/policies/suggest-topics", { text });
  },
  // In policyApi.js, add this method after the existing ones
  getCategorizedPolicies(params) {
    return apiClient.get("/policies/categorized", { params });
  },
};
