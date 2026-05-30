import { apiClient } from "./client";

export const messageApi = {
  send(payload) {
    return apiClient.post("/messages", payload);
  },
  conversations(params = {}) {
    return apiClient.get("/messages/conversations", { params });
  },
  inbox(params = {}) {
    return apiClient.get("/messages/inbox", { params });
  },
  get(id) {
    return apiClient.get(`/messages/${id}`);
  },
  reply(id, body) {
    return apiClient.post(`/messages/${id}/reply`, { body });
  },
};
