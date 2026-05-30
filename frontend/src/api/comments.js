import { apiClient } from "./client";

export const commentApi = {
  // Post a comment (top‑level or reply)
  post(payload) {
    return apiClient.post("/comments", payload);
  },

  // Get comments for a policy (public, with filters)
  getPolicyComments(policyId, params = {}) {
    return apiClient.get(`/comments/policy/${policyId}`, { params });
  },

  // Get a single comment by ID
  getById(id) {
    return apiClient.get(`/comments/${id}`);
  },

  // Get replies of a comment (paginated)
  getReplies(commentId, params = {}) {
    return apiClient.get(`/comments/${commentId}/replies`, { params });
  },

  // Report a comment
  report(commentId, payload) {
    return apiClient.post(`/comments/${commentId}/report`, payload);
  },

  // Edit a comment (author only)
  edit(id, payload) {
    return apiClient.put(`/comments/${id}`, payload);
  },

  // Delete a comment (author or admin)
  delete(id) {
    return apiClient.delete(`/comments/${id}`);
  },

  // Restore a soft‑deleted comment (author or admin)
  restore(id) {
    return apiClient.put(`/comments/${id}/restore`);
  },

  // Moderate a comment (planner/admin with permission)
  moderate(commentId, payload) {
    return apiClient.put(`/comments/${commentId}/moderate`, payload);
  },

  // Submit an appeal (citizen only)
  appeal(commentId, payload) {
    return apiClient.post(`/comments/${commentId}/appeal`, payload);
  },

  // Get my own reports (citizen)
  getMyReports(params = {}) {
    return apiClient.get("/comments/my-reports", { params });
  },

  // Get full event history (planner/admin only)
  getHistory(commentId) {
    return apiClient.get(`/comments/${commentId}/history`);
  },

  // Get comments needing review (planner/admin) – uses backend filter
  getNeedsReview(params = {}) {
    return apiClient.get("/comments/needs-review", { params });
  },
  // ... inside commentApi
  getVersions(commentId) {
    return apiClient.get(`/comments/${commentId}/versions`);
  },
};
