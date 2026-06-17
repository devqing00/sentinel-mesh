"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

interface UserRisk {
  user_id: string;
  phase1_risk: number;
  phase2_risk: number;
  trajectory_shift: number;
  category: string;
}

const getColor = (category: string) => {
  switch (category) {
    case "escalating":
      return "#EF4444";
    case "persistently-high":
      return "#F59E0B";
    case "recovering":
      return "#10B981";
    case "low-risk":
      return "#CBD5E1";
    case "stable":
    default:
      return "#3B82F6";
  }
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const point = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-lg text-xs">
        <p className="font-bold text-gray-900 mb-1">{point.user_id}</p>
        <p className="text-gray-500">
          Phase 1 Risk:{" "}
          <span className="text-gray-900 font-mono">{point.phase1_risk}</span>
        </p>
        <p className="text-gray-500">
          Phase 2 Risk:{" "}
          <span className="text-gray-900 font-mono">{point.phase2_risk}</span>
        </p>
        <p
          className="mt-1 font-medium"
          style={{ color: getColor(point.category) }}
        >
          Shift: {point.trajectory_shift > 0 ? "+" : ""}
          {point.trajectory_shift}% ({point.category})
        </p>
      </div>
    );
  }
  return null;
};

export default function TrajectoryScatter({ data }: { data: UserRisk[] }) {

  return (
    <div className="w-full h-full relative">
      {/* Quadrant Labels */}
      <div className="absolute top-2 left-2 text-[10px] font-semibold text-emerald-400 uppercase z-10">
        Recovering
      </div>
      <div className="absolute top-2 right-2 text-[10px] font-semibold text-amber-400 uppercase z-10">
        Persistently High
      </div>
      <div className="absolute bottom-6 left-2 text-[10px] font-semibold text-gray-300 uppercase z-10">
        Low Risk
      </div>
      <div className="absolute bottom-6 right-2 text-[10px] font-semibold text-red-400 uppercase z-10">
        Escalating
      </div>

      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.5} />

          <XAxis
            type="number"
            dataKey="phase1_risk"
            name="Phase 1 Baseline"
            domain={[0, 100]}
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickLine={{ stroke: "#E2E8F0" }}
            axisLine={{ stroke: "#E2E8F0" }}
            label={{
              value: "Phase 1 Baseline Risk",
              position: "bottom",
              fill: "#94A3B8",
              fontSize: 10,
            }}
          />
          <YAxis
            type="number"
            dataKey="phase2_risk"
            name="Phase 2 Current"
            domain={[0, 100]}
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickLine={{ stroke: "#E2E8F0" }}
            axisLine={{ stroke: "#E2E8F0" }}
            label={{
              value: "Phase 2 Current Risk",
              angle: -90,
              position: "left",
              fill: "#94A3B8",
              fontSize: 10,
            }}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ strokeDasharray: "3 3" }}
          />

          <ReferenceLine x={50} stroke="#E2E8F0" strokeOpacity={0.7} />
          <ReferenceLine y={50} stroke="#E2E8F0" strokeOpacity={0.7} />
          <ReferenceLine
            y={70}
            stroke="#EF4444"
            strokeOpacity={0.2}
            strokeDasharray="3 3"
          />

          <Scatter name="Users" data={data}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getColor(entry.category)}
                opacity={entry.category === "low-risk" ? 0.4 : 0.8}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
