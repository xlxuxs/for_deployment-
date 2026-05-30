import { apiClient } from "./client";

export const smsStudioApi = {
  simulate(payload) {
    return apiClient.post("/sms/mock/simulate", payload);
  },
  history(params = {}) {
    return apiClient.get("/sms/mock/history", { params });
  },
  reset(phone) {
    return apiClient.post("/sms/mock/reset", { phone });
  },
};
