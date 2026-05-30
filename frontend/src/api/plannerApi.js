import { apiClient } from "./client";

export const plannerApi = {
  searchByLanguage(language) {
    return apiClient.get("/planners/search", { params: { language } });
  },
  addAssociate(policyId, data) {
    return apiClient.post(`/planners/policies/${policyId}/associates`, data);
  },
  listAssociates(policyId) {
    return apiClient.get(`/planners/policies/${policyId}/associates`);
  },
  updateAssociatePermissions(policyId, associateId, permissions) {
    return apiClient.patch(
      `/planners/policies/${policyId}/associates/${associateId}`,
      { permissions },
    );
  },
  revokeAssociate(policyId, associateId) {
    return apiClient.delete(
      `/planners/policies/${policyId}/associates/${associateId}`,
    );
  },
  acceptInvitation(associateId) {
    return apiClient.post(`/planners/associates/${associateId}/accept`);
  },
  rejectInvitation(associateId, rejectionReason) {
    return apiClient.post(`/planners/associates/${associateId}/reject`, {
      rejectionReason,
    });
  },
  getMyAssociatePolicies() {
    return apiClient.get("/planners/associates/policies");
  },
  removeSelfAsAssociate(associateId) {
    return apiClient.delete(`/planners/associates/${associateId}`);
  },
  // NEW: pending invitations
  getPendingInvitations() {
    return apiClient.get("/planners/associates/invitations/pending");
  },
  getInvitationHistory() {
    return apiClient.get("/planners/associates/invitations/history");
  },
  getInvitationDetails(invitationId) {
    return apiClient.get(`/planners/associates/invitations/${invitationId}`);
  },
  // In plannerApi.js
  searchActivePlanners(params = {}) {
    return apiClient.get("/planners/active", { params });
  },
};
