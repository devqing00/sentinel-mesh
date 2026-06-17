"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1e2336] border border-[#262c40] p-3 rounded-xl shadow-xl text-white">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.color }} />
          <p className="font-bold text-sm">
            {payload[0].name}: {payload[0].value.toFixed(1)}%
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export default function SystemHealthChart({ data }: { data: any[] }) {
  const chartData = useMemo(() => {
    // Mock system health data based on the provided users
    // For a real scenario, this would be computed from device vitals/status
    const healthy = Math.max(90, 100 - (data.length * 0.1));
    const offline = 100 - healthy;

    return [
      { name: "Active", value: healthy, color: "#3b82f6" },
      { name: "Offline", value: offline, color: "#e2e8f0" }
    ];
  }, [data]);

  return (
    <div className="w-full h-full relative">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius="65%"
            outerRadius="90%"
            stroke="none"
            dataKey="value"
            cornerRadius={10}
            paddingAngle={2}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Centered text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xl font-bold font-mono text-gray-900">
          {chartData[0].value.toFixed(1)}%
        </span>
        <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">Health</span>
      </div>
    </div>
  );
}
