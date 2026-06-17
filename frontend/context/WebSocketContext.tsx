"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { useAuth } from "./AuthContext";

interface RankedUser {
  user_id: string;
  top_geo: string;
  category: string;
  total_vitals_anomalies?: number;
  total_contacts?: number;
  [key: string]: unknown;
}

interface WebSocketContextType {
  rankedTable: RankedUser[];
  latestActivity: number;
  liveAlerts: any[];
  isConnected: boolean;
  error: string | null;
  isLiveMode: boolean;
  setIsLiveMode: (mode: boolean) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  rankedTable: [],
  latestActivity: 0,
  liveAlerts: [],
  isConnected: false,
  error: null,
  isLiveMode: false,
  setIsLiveMode: () => {},
});

export const useWebSocketData = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [rankedTable, setRankedTable] = useState<RankedUser[]>([]);
  const [latestActivity, setLatestActivity] = useState<number>(0);
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const isLiveModeRef = useRef(isLiveMode);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isLiveModeRef.current = isLiveMode;
    // Notify backend to start or stop global simulation
    const toggleBackendSimulation = async () => {
      try {
        const endpoint = isLiveMode ? "start" : "stop";
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/devices/simulation/${endpoint}`, {
          method: "POST"
        });

        // Clean UI state if we are turning off live mode
        if (!isLiveMode) {
          setLiveAlerts([]);
          setLatestActivity(0);
          setRankedTable([]);
          localStorage.removeItem("sentinel-ws-cache");
          // Optionally trigger a reload or refetch event for other components here if needed
          window.dispatchEvent(new Event("simulation-stopped"));
        }
      } catch (err) {
        console.error("Failed to toggle backend simulation", err);
      }
    };
    toggleBackendSimulation();
  }, [isLiveMode]);

  useEffect(() => {
    if (!user) return;

    let isComponentMounted = true;

    const connectWebSocket = async () => {
      try {
        const token = await user.getIdToken();
        const wsUrl = process.env.NEXT_PUBLIC_API_URL 
          ? process.env.NEXT_PUBLIC_API_URL.replace("http", "ws") 
          : "ws://localhost:8000";
        
        const ws = new WebSocket(`${wsUrl}/api/risk/ws?token=${token}`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isComponentMounted) {
            setIsConnected(true);
            setError(null);
          }
        };

        ws.onmessage = (event) => {
          if (isComponentMounted) {
            try {
              const payload = JSON.parse(event.data);
              if (payload.type === "ranked_table" && Array.isArray(payload.data)) {
                setRankedTable(payload.data);
                // Also cache it just in case
                localStorage.setItem("sentinel-ws-cache", JSON.stringify(payload.data));
              } else if (payload.type === "new_alert" && payload.data) {
                // Prepend to liveAlerts, keeping only the last 50
                setLiveAlerts((prev) => {
                  const newAlert = {
                    ...payload.data,
                    id: `live-${Date.now()}-${Math.random()}`,
                    type: "anomaly",
                    title: "Live Unusual Reading",
                    message: payload.data.message || `Anomalous readings detected for device ${payload.data.device_id}`,
                    timestamp: payload.data.timestamp || new Date().toISOString(),
                    read: false,
                  };
                  return [newAlert, ...prev].slice(0, 50);
                });

                // Show a slick organic toast popup only if in Live Mode
                if (isLiveModeRef.current) {
                  import("sonner").then(({ toast }) => {
                    toast.custom((t) => (
                      <div className="flex items-start gap-3 p-3 max-w-[320px] w-full bg-[#161b2c] border border-rose-500/30 shadow-2xl rounded-xl pointer-events-auto ring-1 ring-white/10">
                        <div className="flex-shrink-0 pt-0.5">
                          <div className="w-8 h-8 rounded-full border border-rose-500/50 bg-rose-500/20 flex items-center justify-center animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.3)]">
                             <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-white flex items-center gap-1.5">
                            Risk Alert: {payload.data.device_id}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-400 leading-tight">
                            {payload.data.message} <br/>
                            <span className="font-mono text-rose-400">HR: {payload.data.heartbeat} | Temp: {payload.data.temperature}°C</span>
                          </p>
                        </div>
                        <button
                          onClick={() => toast.dismiss(t)}
                          className="text-gray-500 hover:text-white transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ), { duration: 6000 });
                  });
                }
              } else if (payload.type === "activity_tick" && payload.data) {
                setLatestActivity(payload.data.activity);
              }
            } catch (e) {
              console.error("WebSocket message parsing error:", e);
            }
          }
        };

        ws.onclose = () => {
          if (isComponentMounted) {
            setIsConnected(false);
            // Exponential backoff or simple reconnect
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
          }
        };

        ws.onerror = (err) => {
          if (isComponentMounted) {
            setError("WebSocket connection error");
            ws.close();
          }
        };

      } catch (err) {
        console.error("Failed to get Firebase token for WebSocket:", err);
      }
    };

    connectWebSocket();

    // Load from cache initially for instant render
    const cachedData = localStorage.getItem("sentinel-ws-cache");
    if (cachedData) {
      try {
        // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
        setRankedTable(JSON.parse(cachedData));
      } catch (e) {
        // ignore
      }
    }

    return () => {
      isComponentMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user]);

  return (
    <WebSocketContext.Provider value={{ rankedTable, latestActivity, liveAlerts, isConnected, error, isLiveMode, setIsLiveMode }}>
      {children}
    </WebSocketContext.Provider>
  );
};
