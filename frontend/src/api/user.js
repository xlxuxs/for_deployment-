import { apiClient } from "./client";

export const userApi = {
  me() {
    return apiClient.get("/users/me");
  },
  update(payload) {
    return apiClient.put("/users/me", payload);
  },
  changePassword(currentPassword, newPassword) {
    return apiClient.put("/users/me/password", { currentPassword, newPassword });
  },
  deleteMe() {
    return apiClient.delete("/users/me");
  },
  requestEmailChange(newEmail) {
    return apiClient.post("/users/me/email/request", { newEmail });
  },
  verifyEmailChange(code) {
    return apiClient.post("/users/me/email/verify", { code });
  },
  requestPhoneChange(newPhone) {
    return apiClient.post("/users/me/phone/request", { newPhone });
  },
  verifyPhoneChange(newPhone, code) {
    return apiClient.post("/users/me/phone/verify", { newPhone, code });
  },
  getNotifications(params = {}) {
    return apiClient.get("/users/me/notifications", { params });
  },
  markNotificationRead(id) {
    return apiClient.patch(`/users/me/notifications/${id}/read`);
  },
  markAllNotificationsRead() {
    return apiClient.patch("/users/me/notifications/read-all");
  },
  getHistory(params = {}) {
    return apiClient.get("/users/me/history", { params });
  },
};
