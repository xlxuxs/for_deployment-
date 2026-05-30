import { apiClient } from "./client";

export const authApi = {
  login(email, password) {
    return apiClient.post("/auth/login", { email, password });
  },
  register(email, password, phone, region) {
    return apiClient.post("/auth/register", { email, password, phone, region });
  },
  sendOtp(email) {
    return apiClient.post("/auth/send-otp", { email });
  },
  verifyOtp(email, code) {
    return apiClient.post("/auth/verify-otp", { email, code });
  },
  forgotPassword(email) {
    return apiClient.post("/auth/forgot-password", { email });
  },
  resetPassword(token, newPassword) {
    return apiClient.post("/auth/reset-password", { token, newPassword });
  },
};
