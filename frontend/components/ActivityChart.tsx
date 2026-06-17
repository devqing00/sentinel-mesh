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
    const value = payload[0].value;
    const time = payload[0].payload.time || payload[0].payload.date;
    
    let descriptor = "stable network activity";
    if (value > 80) descriptor = "an extreme spike in tracking events";
    else if (value > 50) descriptor = "elevated system activity";
    else if (value < 10) descriptor = "unusually quiet network conditions";

    return (
      <div className="bg-[#1e2336] border border-[#262c40] p-4 rounded-xl shadow-xl text-white max-w-[200px]">
        <p className="text-xs text-slate-400 mb-2">{time}</p>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${value > 50 ? 'bg-rose-500 animate-pulse' : 'bg-blue-500'}`} />
            <p className="font-bold text-lg leading-none">
              {value} <span className="font-normal text-sm text-slate-300">events/sec</span>
            </p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mt-1">
            Indicating <span className="text-white font-medium">{descriptor}</span>.
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export default function ActivityChart() {
  const { latestActivity } = useWebSocketData();
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

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
  }, []);

  return (
    <div className="w-full h-full relative">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <AreaChart
          data={chartData}
          margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="time" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            dy={10}
            minTickGap={20}
            label={{ value: 'Real-time (Seconds)', position: 'insideBottomRight', offset: -15, fill: '#64748b', fontSize: 12 }}
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
            key="live"
            type="monotone"
            dataKey="activity"
            stroke="#f43f5e"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorActivity)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
