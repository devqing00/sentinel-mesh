"use client";
import { useEffect } from "react";

export default function KeepAlive() {
  useEffect(() => {
    const pingBackend = () => {
      const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      fetch(`${url}/api/health`).catch(() => {});
    };

    pingBackend();
    const interval = setInterval(pingBackend, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
