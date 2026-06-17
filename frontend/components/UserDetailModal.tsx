"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getUserDetail } from "@/lib/api";
import {
  X,
  Thermometer,
  Heart,
  MapPin,
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Cpu,
  Clock,
  ShieldAlert,
  Activity,
  ArrowUpRight,
} from "lucide-react";

interface Props {
  userId: string;
  rankEntry: any;
  onClose: () => void;
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  "escalating":        { label: "Escalating",        color: "text-rose-600",    bg: "bg-rose-50",    icon: ArrowUpRight },
  "persistently-high": { label: "Persistently High", color: "text-amber-600",   bg: "bg-amber-50",   icon: AlertTriangle },
  "recovering":        { label: "Recovering",         color: "text-emerald-600", bg: "bg-emerald-50", icon: TrendingDown },
  "stable":            { label: "Stable",             color: "text-blue-600",    bg: "bg-blue-50",    icon: Minus },
  "low-risk":          { label: "Low Risk",           color: "text-gray-500",    bg: "bg-gray-50",    icon: Minus },
};

export default function UserDetailModal({ userId, rankEntry, onClose }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "vitals" | "contacts" | "mobility">("overview");

  useEffect(() => {
    (async () => {
      try {
        const res = await getUserDetail(userId);
        setData(res.data);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, [userId]);

  const cfg = CATEGORY_CONFIG[rankEntry?.category] || CATEGORY_CONFIG["stable"];
  const CatIcon = cfg.icon;

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).id === "modal-backdrop") onClose();
  };

  // Ensure portal only runs on client
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      id="modal-backdrop"
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50/80 via-white to-white flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>

          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
              <span className="text-white font-display font-black text-xl">
                {userId.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase()}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="font-display font-black text-xl text-gray-900">{userId}</h2>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.color} border-current/20`}>
                  <CatIcon className="w-3.5 h-3.5" />
                  {cfg.label}
                </span>
              </div>
              {rankEntry && (
                <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                  <span>Region: <strong className="text-gray-700">{rankEntry.top_geo || "—"}</strong></span>
                  <span>Risk Score: <strong className="text-gray-700">{rankEntry.phase2_risk?.toFixed(1)}</strong></span>
                  <span>Trajectory: <strong className={rankEntry.trajectory_shift > 0 ? "text-rose-600" : "text-emerald-600"}>
                    {rankEntry.trajectory_shift > 0 ? "+" : ""}{rankEntry.trajectory_shift?.toFixed(1)}%
                  </strong></span>
                </div>
              )}
            </div>

            {/* Risk Score Ring */}
            {rankEntry && (
              <div className="flex-shrink-0 relative w-14 h-14 mr-8">
                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="#E5E7EB" strokeWidth="6" />
                  <circle
                    cx="28" cy="28" r="22" fill="none"
                    stroke={rankEntry.phase2_risk >= 80 ? "#EF4444" : rankEntry.phase2_risk >= 50 ? "#F59E0B" : "#10B981"}
                    strokeWidth="6"
                    strokeDasharray={`${(rankEntry.phase2_risk / 100) * 138.2} 138.2`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-gray-900">
                  {Math.round(rankEntry.phase2_risk || 0)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
          {(["overview", "vitals", "contacts", "mobility"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                activeTab === tab
                  ? "text-indigo-600 border-b-2 border-indigo-500 bg-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-none">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
              <p className="text-sm text-gray-500 font-medium">Loading profile...</p>
            </div>
          ) : !data ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-8">
              <ShieldAlert className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500">No data available for this user.</p>
            </div>
          ) : (
            <div className="p-6">
              {/* ─── OVERVIEW ─── */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Risk Summary Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Vitals Anomalies", value: data.anomalous_vitals?.length || 0, color: "text-rose-600", icon: Thermometer },
                      { label: "Contact Events", value: data.contacts?.length || 0, color: "text-indigo-600", icon: Users },
                      { label: "People Exposed", value: data.exposed_users?.length || 0, color: "text-amber-600", icon: ShieldAlert },
                    ].map((s) => {
                      const Icon = s.icon;
                      return (
                        <div key={s.label} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
                          <Icon className={`w-5 h-5 ${s.color} mx-auto mb-2`} />
                          <p className={`text-2xl font-display font-black ${s.color}`}>{s.value}</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">{s.label}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Risk Trajectory */}
                  {rankEntry && (
                    <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5">
                      <h4 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Risk Trajectory
                      </h4>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-xs text-indigo-600/70 mb-1">Historical Baseline</p>
                          <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-300 rounded-full" style={{ width: `${rankEntry.phase1_risk}%` }} />
                          </div>
                          <p className="text-xs text-indigo-700 font-bold mt-1">{rankEntry.phase1_risk?.toFixed(1)}</p>
                        </div>
                        <div className={`flex items-center gap-1 font-black text-lg ${rankEntry.trajectory_shift > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                          {rankEntry.trajectory_shift > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                          {rankEntry.trajectory_shift > 0 ? "+" : ""}{rankEntry.trajectory_shift?.toFixed(1)}%
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-rose-600/70 mb-1">Current Risk</p>
                          <div className="h-2 bg-rose-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${rankEntry.phase2_risk}%`,
                                background: rankEntry.phase2_risk >= 80 ? "#EF4444" : rankEntry.phase2_risk >= 50 ? "#F59E0B" : "#10B981"
                              }}
                            />
                          </div>
                          <p className="text-xs font-bold mt-1" style={{ color: rankEntry.phase2_risk >= 80 ? "#EF4444" : "#F59E0B" }}>
                            {rankEntry.phase2_risk?.toFixed(1)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-indigo-200/50">
                        <p className="text-xs text-indigo-900/80 leading-relaxed">
                          <strong>Operator Note:</strong> This user's recent risk score is <strong>{rankEntry.phase2_risk?.toFixed(1)}</strong>, 
                          which is a {rankEntry.trajectory_shift > 0 ? 'jump' : 'drop'} of <strong>{Math.abs(rankEntry.trajectory_shift)?.toFixed(1)}%</strong> compared to their normal baseline. 
                          {rankEntry.vitals_anomalies_p2 > 0 ? 
                            " This risk is primarily driven by physical symptoms (elevated vitals) recorded by their device." : 
                            " They are currently asymptomatic (0 vitals anomalies recorded). This high risk score is driven purely by heavy exposure to infected individuals or movement through high-risk contact zones."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Risk Factors */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" /> Contributing Risk Factors
                    </h4>
                    <div className="space-y-2">
                      {data.risk_factors?.length > 0 ? data.risk_factors.map((f: string, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                          <div className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-amber-700 text-[10px] font-bold">{i + 1}</span>
                          </div>
                          <p className="text-sm text-amber-800 leading-relaxed">{f}</p>
                        </div>
                      )) : (
                        <p className="text-sm text-gray-400">No specific risk factors identified.</p>
                      )}
                    </div>
                  </div>

                  {/* Exposed Users */}
                  {data.exposed_users?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-500" /> Individuals in Contact
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {data.exposed_users.map((u: string) => (
                          <span key={u} className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-mono font-bold text-indigo-700">
                            {u}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── VITALS ─── */}
              {activeTab === "vitals" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-gray-700">Recent Vitals Readings</h4>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      data.anomalous_vitals?.length > 0 ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    }`}>
                      {data.anomalous_vitals?.length || 0} anomalous
                    </span>
                  </div>
                  {data.vitals?.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No vitals data on record.</p>
                  ) : (
                    data.vitals.map((v: any, i: number) => {
                      const isAnomaly = v.temp_status === "high" || v.hr_status === "high" ||
                        v.temperature >= 38 || v.heartbeat > 100;
                      return (
                        <div key={i} className={`p-4 rounded-xl border flex items-center gap-4 ${isAnomaly ? "bg-rose-50 border-rose-200" : "bg-gray-50 border-gray-100"}`}>
                          <div className={`w-2 h-full self-stretch rounded-full ${isAnomaly ? "bg-rose-500" : "bg-emerald-400"}`} style={{ width: "3px" }} />
                          <div className="flex items-center gap-3 flex-1 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <Thermometer className={`w-4 h-4 ${isAnomaly ? "text-rose-500" : "text-gray-400"}`} />
                              <span className={`font-bold text-sm ${isAnomaly ? "text-rose-700" : "text-gray-700"}`}>
                                {v.temperature?.toFixed(1) ?? "—"}°C
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Heart className={`w-4 h-4 ${isAnomaly ? "text-rose-500 animate-pulse" : "text-gray-400"}`} />
                              <span className={`font-bold text-sm ${isAnomaly ? "text-rose-700" : "text-gray-700"}`}>
                                {v.heartbeat ?? "—"} bpm
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Cpu className="w-4 h-4 text-gray-400" />
                              <span className="text-xs text-gray-500 font-mono">{v.device_id}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            {timeAgo(v.timestamp)}
                          </div>
                          {isAnomaly && (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-bold rounded-full border border-rose-200 uppercase">
                              Alert
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ─── CONTACTS ─── */}
              {activeTab === "contacts" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-gray-700">Contact Trace Events</h4>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100">
                      {data.contacts?.filter((c: any) => c.proximity === "close").length || 0} close proximity
                    </span>
                  </div>
                  {data.contacts?.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No contact events recorded.</p>
                  ) : (
                    data.contacts.map((c: any, i: number) => {
                      const isClose = c.proximity === "close";
                      return (
                        <div key={i} className={`p-4 rounded-xl border flex items-center gap-4 ${isClose ? "bg-indigo-50 border-indigo-200" : "bg-gray-50 border-gray-100"}`}>
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isClose ? "bg-indigo-100" : "bg-white border border-gray-200"}`}>
                            <Users className={`w-4 h-4 ${isClose ? "text-indigo-500" : "text-gray-400"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-mono text-sm font-bold text-gray-900">{c.mac || "—"}</span>
                              <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-full ${isClose ? "bg-indigo-200 text-indigo-700" : "bg-gray-200 text-gray-600"}`}>
                                {c.proximity || "unknown"}
                              </span>
                            </div>
                            {c.geohash && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <MapPin className="w-3 h-3" />
                                {c.geohash?.slice(0, 6)}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeAgo(c.timestamp)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ─── MOBILITY ─── */}
              {activeTab === "mobility" && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-gray-700 mb-2">Movement & Location History</h4>
                  {data.mobility?.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No mobility data on record.</p>
                  ) : (
                    data.mobility.map((m: any, i: number) => (
                      <div key={i} className="p-4 rounded-xl border bg-gray-50 border-gray-100 flex items-center gap-4">
                        <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs font-bold text-gray-700 mb-0.5">{m.geohash || "Unknown location"}</p>
                          <div className="flex items-center gap-3 text-[10px] text-gray-400 flex-wrap">
                            {m.latitude && <span>Lat: {m.latitude?.toFixed(4)}</span>}
                            {m.longitude && <span>Lon: {m.longitude?.toFixed(4)}</span>}
                            {m.movement !== undefined && <span>Movement: {m.movement}</span>}
                            {m.exposure_score && <span className="text-amber-500 font-bold">Exposure: {m.exposure_score?.toFixed(2)}</span>}
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" />
                          {timeAgo(m.timestamp)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
