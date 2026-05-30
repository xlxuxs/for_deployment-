import axios from "axios";
import { clearStoredAuth, readStoredAuth } from "../lib/storage";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? "/api" : "http://localhost:5000/api");

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const auth = readStoredAuth();
  if (auth?.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

apiClient.interceptors.response.use(
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

    if ((status === 401 && code !== "INVALID_CREDENTIALS") || ["ACCOUNT_DISABLED", "NOT_VERIFIED"].includes(code)) {
      clearStoredAuth();
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    return Promise.reject({
      status,
      code,
      message,
      details: error.response?.data?.error,
    });
  },
);

export { API_BASE_URL };
