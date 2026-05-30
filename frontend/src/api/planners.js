import axios from "axios";
import { API_BASE_URL, apiClient } from "./client";

const publicPlannerClient = axios.create({
  baseURL: API_BASE_URL,
});

publicPlannerClient.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === "object" && "status" in response.data) {
      return response.data.data;
    }
    return response.data;
  },
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;
    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      "Request failed";

    return Promise.reject({
      status,
      code,
      message,
      details: error.response?.data?.error,
    });
  },
);

export const plannerApi = {
  requestPlanner(payload) {
    return apiClient.post("/planners/request", payload);
  },
  requestPlannerPublic(payload) {
    return publicPlannerClient.post("/planners/request", payload);
  },
  completeTraining() {
    return apiClient.post("/planners/training/complete");
  },
  listPendingRequests() {
    return apiClient.get("/planners/requests/pending");
  },
  listRequestHistory(params = {}) {
    return apiClient.get("/planners/requests/history", { params });
  },
  approveRequest(id) {
    return apiClient.post(`/planners/requests/${id}/approve`);
  },
  rejectRequest(id, rejectionReason) {
    return apiClient.post(`/planners/requests/${id}/reject`, { rejectionReason });
  },
  submitDeactivationAppeal(payload) {
    return apiClient.post("/planners/appeals", payload);
  },
  listDeactivationAppeals(params = {}) {
    return apiClient.get("/planners/appeals", { params });
  },
  resolveDeactivationAppeal(id, payload) {
    return apiClient.post(`/planners/appeals/${id}/resolve`, payload);
  },
  search(language) {
    return apiClient.get("/planners/search", { params: { language } });
  },
  addAssociate(policyId, payload) {
    return apiClient.post(`/planners/policies/${policyId}/associates`, payload);
  },
  listAssociates(policyId) {
    return apiClient.get(`/planners/policies/${policyId}/associates`);
  },
  updateAssociate(policyId, associateId, permissions) {
    return apiClient.patch(`/planners/policies/${policyId}/associates/${associateId}`, { permissions });
  },
  revokeAssociate(policyId, associateId) {
    return apiClient.delete(`/planners/policies/${policyId}/associates/${associateId}`);
  },
  getPendingInvitations() {
    return apiClient.get("/planners/associates/invitations/pending");
  },
  getInvitationHistory() {
    return apiClient.get("/planners/associates/invitations/history");
  },
};
