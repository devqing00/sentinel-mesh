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
}

const WebSocketContext = createContext<WebSocketContextType>({
  rankedTable: [],
  latestActivity: 0,
  liveAlerts: [],
  isConnected: false,
  error: null,
});

export const useWebSocketData = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [rankedTable, setRankedTable] = useState<RankedUser[]>([]);
  const [latestActivity, setLatestActivity] = useState<number>(0);
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Start the global simulation once when the provider mounts
  useEffect(() => {
    if (!user) return;
    const startBackendSimulation = async () => {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/devices/simulation/start`, {
          method: "POST"
        });
      } catch (err) {
        console.error("Failed to start backend simulation", err);
      }
    };
    startBackendSimulation();
  }, [user]);

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

                // Show a slick organic toast popup
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
    <WebSocketContext.Provider value={{ rankedTable, latestActivity, liveAlerts, isConnected, error }}>
      {children}
    </WebSocketContext.Provider>
  );
};
