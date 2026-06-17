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

import useSWR from "swr";
import { getActivityTrend } from "@/lib/api";

// Helper to get week number
const getWeekNumber = (d: Date) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
};

interface ChartDataPoint {
  date: string;
  fullDate: string;
  activity: number;
  [key: string]: unknown;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1e2336] border border-[#262c40] p-3 rounded-xl shadow-xl text-white">
        <p className="text-xs text-slate-400 mb-1">{payload[0].payload.fullDate}</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <p className="font-bold text-sm">
            {payload[0].value} <span className="font-normal text-slate-300">checks</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export default function ActivityChart() {
  const { data: res } = useSWR("/api/risk/activity", async () => {
    const response = await getActivityTrend();
    return response.data;
  }, { refreshInterval: 60000 });

  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const indexRef = useRef(0);

  useEffect(() => {
    let initialData = [];
    const today = new Date();
    
    if (res?.trend && res.trend.length > 0) {
      initialData = res.trend.map((item: any, i: number) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (7 * (res.trend.length - 1 - i))); // Step back by weeks
        return {
          ...item,
          date: `Week ${getWeekNumber(d)}`,
          fullDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        };
      });
    } else {
      initialData = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (7 * (6 - i))); // Step back by weeks
        return {
          date: `Week ${getWeekNumber(d)}`,
          fullDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          activity: 0,
        };
      });
    }
    // eslint-disable-next-line
    setChartData(initialData);
  }, [res]);

  // Automated Timeline Simulation using REAL dataset values
  useEffect(() => {
    if (!res?.trend || res.trend.length === 0) return;

    const interval = setInterval(() => {
      setChartData(prev => {
        if (prev.length < 7) return prev;
        const newArray = [...prev];
        // Shift left
        newArray.shift();
        
        // Loop through the real dataset to simulate a moving trend based on actual data
        indexRef.current = (indexRef.current + 1) % res.trend.length;
        const realDataValue = res.trend[indexRef.current].activity;
        
        // Create a new future date point advancing by a week
        const lastDateStr = prev[prev.length - 1].fullDate;
        const nextDate = new Date(`${lastDateStr} ${new Date().getFullYear()}`);
        nextDate.setDate(nextDate.getDate() + 7); // Advance by 7 days
        
        newArray.push({
          date: `Week ${getWeekNumber(nextDate)}`,
          fullDate: nextDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          activity: realDataValue, // Tracking the real dataset trend!
        });
        
        return newArray;
      });
    }, 2000); // Couple of seconds interval

    return () => clearInterval(interval);
  }, [res]);


  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            dy={10}
            label={{ value: 'Timeline (Days)', position: 'insideBottomRight', offset: -15, fill: '#64748b', fontSize: 12 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            dx={-10}
            label={{ value: 'Daily Checks', angle: -90, position: 'insideLeft', offset: 0, fill: '#64748b', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Area
            type="monotone"
            dataKey="activity"
            stroke="#3b82f6"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorActivity)"
            activeDot={{ r: 6, fill: "#fff", stroke: "#3b82f6", strokeWidth: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
