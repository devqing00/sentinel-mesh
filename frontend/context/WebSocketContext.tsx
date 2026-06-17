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
  isConnected: boolean;
  error: string | null;
}

const WebSocketContext = createContext<WebSocketContextType>({
  rankedTable: [],
  isConnected: false,
  error: null,
});

export const useWebSocketData = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [rankedTable, setRankedTable] = useState<RankedUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    <WebSocketContext.Provider value={{ rankedTable, isConnected, error }}>
      {children}
    </WebSocketContext.Provider>
  );
};
