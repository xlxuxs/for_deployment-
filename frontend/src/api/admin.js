import { apiClient } from "./client";

export const adminApi = {
  // Dashboard & reports
  dashboardStats() {
    return apiClient.get("/admin/dashboard/stats");
  },
  getTrends(params = {}) {
    return apiClient.get("/admin/trends", { params });
  },
  getAuditLogs(params = {}) {
    return apiClient.get("/admin/audit-logs", { params });
  },
  exportAuditLogs(params = {}) {
    return apiClient.get("/admin/audit-logs/export", {
      params,
      responseType: "blob",
    });
  },
  getAIHealth() {
    return apiClient.get("/admin/ai/health");
  },

  // Planner management
  listPlanners(params = {}) {
    return apiClient.get("/admin/planners", { params });
  },
  getPlanner: (id) => apiClient.get(`/admin/planners/${id}`),
  createPlanner(payload) {
    return apiClient.post("/admin/planners", payload);
  },
  updatePlanner(id, payload) {
    return apiClient.put(`/admin/planners/${id}`, payload);
  },
  setPlannerStatus(id, active) {
    return apiClient.put(`/admin/planners/${id}/status`, { active });
  },

  // Comment moderator management
  listCommentModerators(params = {}) {
    return apiClient.get("/admin/comment-moderators", { params });
  },
  getCommentModerator(id) {
    return apiClient.get(`/admin/comment-moderators/${id}`);
  },
  createCommentModerator(payload) {
    return apiClient.post("/admin/comment-moderators", payload);
  },
  updateCommentModerator(id, payload) {
    return apiClient.put(`/admin/comment-moderators/${id}`, payload);
  },
  setCommentModeratorStatus(id, active) {
    return apiClient.put(`/admin/comment-moderators/${id}/status`, { active });
  },

  // Citizen management
  listCitizens(params = {}) {
    return apiClient.get("/admin/users/citizens", { params });
  },
  updateCitizenStatus(id, active) {
    return apiClient.put(`/admin/users/${id}/status`, { active });
  },
  initiatePasswordReset(id) {
    return apiClient.post(`/admin/users/${id}/initiate-password-reset`);
  },

  // Comment moderation – AI low confidence (visible)
  getAIReviewComments(params = {}) {
    return apiClient.get("/admin/comments/pending", { params });
  },

  // Comment moderation – reported comments (hidden)
  getReportedComments(params = {}) {
    return apiClient.get("/admin/comments/flagged", { params });
  },

  // Update comment (sentiment/keywords override)
  updateComment(id, payload) {
    return apiClient.put(`/admin/comments/${id}`, payload);
  },

  moderateComment(id, payload) {
    return apiClient.put(`/admin/comments/${id}/moderate`, payload);
  },

  // Retry single comment (strict)
  retryComment(id) {
    return apiClient.post(`/admin/comments/${id}/retry`);
  },

  // Force retry single comment (no checks)
  forceRetryComment(id) {
    return apiClient.post(`/admin/comments/${id}/force-retry`);
  },

  // Bulk retry by IDs (strict criteria)
  bulkRetryComments(commentIds, params = {}) {
    return apiClient.post(
      "/admin/comments/bulk/retry-by-ids",
      { commentIds },
      { params },
    );
  },

  // Soft delete comment
  deleteComment(id) {
    return apiClient.delete(`/admin/comments/${id}`);
  },

  // Report management
  getCommentReports(commentId) {
    return apiClient.get(`/admin/comments/${commentId}/reports`);
  },
  resolveReport(commentId, reportId, resolution, moderatorNote = "") {
    return apiClient.put(`/admin/comments/${commentId}/reports/${reportId}`, {
      resolution,
      moderatorNote,
    });
  },

  // Appeal management
  getPendingAppeals(params = {}) {
    return apiClient.get("/admin/appeals", { params });
  },
  resolveAppeal(commentId, decision, moderatorNote = "") {
    return apiClient.post(`/admin/appeals/${commentId}/resolve`, {
      decision,
      moderatorNote,
    });
  },

  // Emerging topics
  getEmergingTopics() {
    return apiClient.get("/admin/emerging-topics");
  },
  searchPlanners(query) {
    return apiClient.get("/admin/planners/search", { params: { q: query } });
  },
  simulateSms(payload) {
    return apiClient.post("/admin/sms/simulate", payload);
  },
  getSmsHistory(params = {}) {
    return apiClient.get("/admin/sms/history", { params });
  },
  getSmsPhoneState(phone) {
    return apiClient.get("/admin/sms/phone-state", { params: { phone } });
  },
};
