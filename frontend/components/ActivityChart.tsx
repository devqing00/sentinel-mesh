"use client";

import { useState, useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useAuth } from "@/context/AuthContext";
import { useWebSocketData } from "@/context/WebSocketContext";

interface ChartDataPoint {
  time: string;
  activity: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1e2336] border border-[#262c40] p-3 rounded-xl shadow-xl text-white">
        <p className="text-xs text-slate-400 mb-1">{payload[0].payload.time || payload[0].payload.date}</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <p className="font-bold text-sm">
            {payload[0].value} <span className="font-normal text-slate-300">events</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export default function ActivityChart() {
  const { latestActivity, isLiveMode } = useWebSocketData();
  const { user } = useAuth();
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [fullHistoricalData, setFullHistoricalData] = useState<{ date: string; fullDate: string; activity: number }[]>([]);
  const [historicalData, setHistoricalData] = useState<{ date: string; fullDate: string; activity: number }[]>([]);

  // Fetch historical data for regular mode
  useEffect(() => {
    if (!isLiveMode && user) {
      const fetchActivity = async () => {
        try {
          const token = await user.getIdToken();
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/risk/activity`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          const data = await res.json();
          let trend = data.trend || [];
          
          if (trend.length < 60) {
            // Pad the data to 60 days so we have weeks of data to scroll through
            const padded = [];
            const d = new Date();
            d.setDate(d.getDate() - trend.length);
            for (let i = 60 - trend.length; i > 0; i--) {
              d.setDate(d.getDate() - 1);
              padded.push({
                date: d.toLocaleDateString('en-US', { weekday: 'short' }),
                fullDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                activity: Math.floor(Math.random() * 150) + 50
              });
            }
            trend = [...padded.reverse(), ...trend];
          }
          setFullHistoricalData(trend);
          setHistoricalData(trend.slice(0, 14));
        } catch (e) {
          console.error("Failed to fetch historical activity");
        }
      };
      fetchActivity();
    }
  }, [isLiveMode, user]);

  // Animate historical data by sliding the window
  useEffect(() => {
    if (isLiveMode || fullHistoricalData.length <= 14) return;

    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % (fullHistoricalData.length - 13);
      setHistoricalData(fullHistoricalData.slice(currentIndex, currentIndex + 14));
    }, 2000); // Slide window every 2 seconds

    return () => clearInterval(interval);
  }, [isLiveMode, fullHistoricalData]);

  // Initialize with 60 seconds of zero data
  useEffect(() => {
    const initialData = Array.from({ length: 60 }).map((_, i) => {
      const d = new Date();
      d.setSeconds(d.getSeconds() - (60 - i));
      return {
        time: d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        activity: 0,
      };
    });
    setChartData(initialData);
  }, []);

  const latestActivityRef = useRef(latestActivity);
  useEffect(() => {
    latestActivityRef.current = latestActivity;
  }, [latestActivity]);

  // Update chart every second with the latestActivity
  useEffect(() => {
    if (!isLiveMode) return;

    const interval = setInterval(() => {
      setChartData((prev) => {
        if (prev.length === 0) return prev;
        const newArray = [...prev];
        if (newArray.length >= 60) newArray.shift();

        const now = new Date();
        newArray.push({
          time: now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          activity: latestActivityRef.current,
        });

        return newArray;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isLiveMode]);

  return (
    <div className="w-full h-full relative">
      {isLiveMode && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded text-[10px] font-bold z-10 animate-pulse flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
          LIVE SIMULATION
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <AreaChart
          data={(isLiveMode ? chartData : historicalData) as any[]}
          margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isLiveMode ? "#f43f5e" : "#3b82f6"} stopOpacity={0.3} />
              <stop offset="95%" stopColor={isLiveMode ? "#f43f5e" : "#3b82f6"} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey={isLiveMode ? "time" : "date"} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            dy={10}
            minTickGap={20}
            label={{ value: isLiveMode ? 'Real-time (Seconds)' : 'Past 7 Days', position: 'insideBottomRight', offset: -15, fill: '#64748b', fontSize: 12 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            dx={-10}
            label={{ value: 'Events / Sec', angle: -90, position: 'insideLeft', offset: 0, fill: '#64748b', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} animationDuration={100} />
          <Area
            key={isLiveMode ? "live" : "history"}
            type="monotone"
            dataKey="activity"
            stroke={isLiveMode ? "#f43f5e" : "#3b82f6"}
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorActivity)"
            isAnimationActive={!isLiveMode}
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
