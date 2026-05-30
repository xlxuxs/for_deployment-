import { apiClient } from "./client";

export const voteApi = {
  submit(payload) {
    // POST /votes
    // payload: { policyId, rating, comment? }
    return apiClient.post("/votes", payload);
  },
};
