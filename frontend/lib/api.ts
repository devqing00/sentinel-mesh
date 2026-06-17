import axios from "axios";
import { auth } from "./firebase";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
});

import { signOut } from "firebase/auth";

// Interceptor to attach Firebase ID token
api.interceptors.request.use(async (config) => {
  await auth.authStateReady();
  if (auth.currentUser) {
    try {
      // Force refresh if token is close to expiry
      const token = await auth.currentUser.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    } catch (e) {
      console.error("Error getting auth token", e);
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor to handle 401 Unauthorized globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("401 Unauthorized received. Logging out...");
      try {
        await signOut(auth);
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      } catch (e) {
        console.error("Error signing out", e);
      }
    }
    return Promise.reject(error);
  }
);

// ========== Ingest ==========
export const ingestAll = () => api.post("/api/ingest/all");
export const getIngestionStats = () => api.get("/api/ingest/stats");

// ========== Risk ==========
export const runAnalysis = () => api.post("/api/risk/run-analysis", {});
export const getRankedTable = () => api.get("/api/risk/ranked-table");
export const getActivityTrend = () => api.get("/api/risk/activity");
export const getCommunityRisks = () => api.get("/api/risk/communities"); // Legacy
export const getAnomalies = () => api.get("/api/risk/anomalies"); // Legacy
// ========== Network ==========
export const getContactGraph = (endDate?: string) => 
  api.get("/api/network/graph", { params: endDate ? { end_date: endDate } : {} });

// ========== Devices ==========
export const getDevicesHealth = () => api.get("/api/devices/health");

// ========== Alerts ==========
export const generateAlerts = (clusterId: string) =>
  api.post("/api/alerts/generate", { cluster_id: clusterId });

export const triggerNotification = (clusterId: string) =>
  api.post(`/api/alerts/trigger/${clusterId}`);

// ========== Export ==========
export const getSormasExport = (clusterId: string) =>
  api.get(`/api/export/sormas/${clusterId}`);

export const getSormasExportCsv = (clusterId: string) =>
  api.get(`/api/export/sormas/${clusterId}/csv`, { responseType: "text" });

// ========== Audit ==========
export const getAuditLog = () => api.get("/api/audit/log");
export const explainCluster = (clusterId: string) => api.get(`/api/audit/explain/${clusterId}`);
export const getAllAnomalies = () => api.get("/api/audit/anomalies");

export const fetchAuditLog = () => api.get("/api/audit/log");
export const triggerExport = (clusterId: string) => api.post(`/api/export/sormas/${clusterId}`);
export const triggerAlert = (clusterId: string) => api.post(`/api/alerts/trigger/${clusterId}`);

export const chatWithAI = (messages: {role: string, content: string}[], context?: string) => api.post("/api/ai/chat", { messages, context });
export const getAIReport = (audience: string = "agency") => api.get(`/api/ai/report?audience=${audience}`);
export const getAIInsight = () => api.get("/api/ai/insight");
export const fetchConversations = (operatorId: string) => api.get(`/api/ai/conversations/${operatorId}`);
export const syncConversations = (operatorId: string, conversations: Record<string, unknown>[]) => api.post(`/api/ai/conversations/${operatorId}`, { conversations });
export const getUserDetail = (userId: string) =>
  api.get(`/api/risk/user/${userId}`);

// ========== Resources ==========
export const getAgents = () => api.get("/api/resources/agents");
export const getFacilities = () => api.get("/api/resources/facilities");

export default api;
