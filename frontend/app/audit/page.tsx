"use client";

import { useEffect, useState } from "react";
import { getAuditLog, explainCluster } from "@/lib/api";
import { Shield, Eye, Loader2, CheckCircle, XCircle, Clock, FileSearch, HeartPulse, Thermometer, Activity, Fingerprint } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

interface AuditEntry {
  timestamp: string;
  cluster_id: string;
  risk_score: number;
  trigger_reason: string;
  contributing_device_ids: string[];
  contributing_contact_events: number;
  recipient: string;
  delivery_status: string;
  notification_type: string;
}

interface ExplainData {
  cluster_id: string;
  summary: string;
  anomalous_vitals: any[];
  anomalous_device_ids: string[];
  contact_events_sample: any[];
  exposed_users: string[];
  explanations: string[];
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<ExplainData | null>(null);
  const [explaining, setExplaining] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getAuditLog();
        setEntries(res.data.entries || []);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const handleExplain = async (clusterId: string) => {
    setExplaining(true);
    setSelectedCluster(clusterId);
    try {
      const res = await explainCluster(clusterId);
      setExplanation(res.data);
    } catch (e) { console.error(e); }
    setExplaining(false);
  };

  const deliveryIcon = (status: string) => {
    if (status === "sent") return <CheckCircle className="w-5 h-5 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] rounded-full" />;
    if (status === "simulated") return <Clock className="w-5 h-5 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] rounded-full" />;
    return <XCircle className="w-5 h-5 text-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)] rounded-full" />;
  };

  const deliveryBadge = (status: string) => {
    if (status === "sent") return "bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-500/20";
    if (status === "simulated") return "bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-500/20";
    return "bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-500/20";
  };

  const prepareChartData = (vitals: any[]) => {
    if (!vitals) return [];
    const sorted = [...vitals].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return sorted.map(v => ({
      time: new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      temp: v.temperature,
      hr: v.heartbeat,
      device: v.device_id
    }));
  };

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {/* Premium Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border/40 rounded-tl-[1.5rem]">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-display font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              Audit Trail & Trust
            </h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 shadow-sm text-xs font-bold text-emerald-600">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            System Secure
          </div>
        </div>
      </header>

      <div className="flex-1 px-8 py-8 space-y-8 flex flex-col overflow-y-auto scrollbar-none">
        
        {/* Page Title Area */}
        <div>
          <h2 className="text-3xl font-display font-extrabold text-gray-900 tracking-tight drop-shadow-sm mb-1">
            System Audit Logs
          </h2>
          <p className="text-sm text-gray-500">
            Record of all system actions.
          </p>
        </div>


        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 flex-1 min-h-[700px]">
          
          {/* Audit Log Panel */}
          <div className="premium-card flex flex-col h-full border border-gray-200/60 shadow-xl shadow-gray-200/40">
            <div className="p-6 border-b border-gray-100 bg-white/50 backdrop-blur-sm rounded-t-[1.5rem]">
              <h3 className="text-xl font-display font-bold text-gray-900 flex items-center gap-2">
                <FileSearch className="w-5 h-5 text-indigo-500" />
                Action Log
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <Shield className="w-16 h-16 mb-4 text-gray-300" />
                  <h4 className="text-lg font-display font-bold text-gray-900 mb-1">No Actions Logged</h4>
                  <p className="text-sm text-gray-500">
                    The system has not fired any automated alerts yet.
                  </p>
                </div>
              ) : (
                entries.map((entry, i) => {
                  const isSelected = selectedCluster === entry.cluster_id;
                  // Normalise fields — seeded logs use title/message; triggered logs use trigger_reason/recipient
                  const displayTitle = (entry as any).title || entry.trigger_reason || `Cluster ${entry.cluster_id}`;
                  const displayStatus = entry.delivery_status || (entry as any).status || "logged";
                  const displayRecipient = entry.recipient || (entry as any).message || "—";
                  return (
                    <div
                      key={i}
                      onClick={() => handleExplain(entry.cluster_id)}
                      className={`group relative p-5 rounded-2xl cursor-pointer transition-all duration-300 border ${
                        isSelected 
                          ? 'bg-white border-indigo-200 shadow-md ring-2 ring-indigo-500/20' 
                          : 'bg-white/60 border-gray-200 hover:bg-white hover:shadow-sm hover:border-gray-300'
                      }`}
                    >
                      {/* Selection indicator line */}
                      {isSelected && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-indigo-500 rounded-r-full" />}
                      
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {deliveryIcon(displayStatus)}
                          <div>
                            <span className="font-bold text-sm text-gray-900 block">{displayTitle}</span>
                            <div className="text-xs text-gray-500 mt-0.5">{new Date(entry.timestamp).toLocaleString()}</div>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${deliveryBadge(displayStatus)}`}>
                          {displayStatus}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                          <p className="text-xs text-gray-500 font-medium mb-1">Risk Score</p>
                          <p className="font-display font-bold text-gray-900 text-lg leading-none">{entry.risk_score ?? "—"}</p>
                        </div>
                        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                          <p className="text-xs text-gray-500 font-medium mb-1">Details</p>
                          <p className="font-medium text-gray-900 truncate text-xs" title={displayRecipient}>{displayRecipient}</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                        <span className="text-gray-500 truncate max-w-[70%]">
                          {entry.contributing_device_ids?.length
                            ? `Devices: ${entry.contributing_device_ids.slice(0,3).join(", ")}${entry.contributing_device_ids.length > 3 ? "…" : ""}`
                            : `Region: ${entry.cluster_id || "—"}`}
                        </span>
                        <span className={`font-medium flex items-center gap-1 transition-colors ${isSelected ? 'text-indigo-600' : 'text-indigo-400 group-hover:text-indigo-600'}`}>
                          <Eye className="w-3.5 h-3.5" />
                          View Details
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Explainability Panel */}
          <div className="h-full">
            {explaining ? (
              <div className="premium-card h-full flex flex-col items-center justify-center bg-white shadow-xl shadow-gray-200/40">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Activity className="w-8 h-8 text-cyan-500 animate-pulse" />
                  </div>
                </div>
                <p className="mt-6 text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Running Diagnostic Trace</p>
              </div>
            ) : explanation ? (
              <div className="h-full flex flex-col gap-6 animate-slide-up">
                
                {/* Summary Card */}
                <div className="premium-card bg-white shadow-xl shadow-gray-200/40 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center">
                      <Eye className="w-5 h-5 text-cyan-600" />
                    </div>
                    <h3 className="text-xl font-display font-bold text-gray-900">Explainability Trace</h3>
                  </div>
                  
                  <p className="text-gray-700 leading-relaxed font-medium mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    {explanation.summary}
                  </p>
                  
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Trigger Logic</h4>
                    {explanation.explanations.map((exp, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-indigo-600 text-xs font-bold">{i + 1}</span>
                        </div>
                        <span className="text-sm text-gray-700 leading-relaxed">{exp}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vitals Chart */}
                {explanation.anomalous_vitals.length > 0 && (
                  <div className="premium-card bg-white shadow-xl shadow-gray-200/40 p-6 flex-1 flex flex-col min-h-[300px]">
                    <h4 className="text-lg font-display font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <HeartPulse className="w-5 h-5 text-rose-500" />
                      Vitals Anomaly Trajectory
                    </h4>
                    <p className="text-sm text-gray-500 mb-6">Historical breakdown of temperature and heart rate fluctuations leading to the anomaly.</p>
                    <div className="flex-1 w-full relative">
                      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <ComposedChart data={prepareChartData(explanation.anomalous_vitals)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} dy={10} label={{ value: 'Time of Reading', position: 'insideBottomRight', offset: -10, fill: '#64748b', fontSize: 12 }} />
                          <YAxis yAxisId="left" stroke="#F43F5E" fontSize={11} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', offset: 0, fill: '#64748b', fontSize: 12 }} />
                          <YAxis yAxisId="right" orientation="right" stroke="#6366F1" fontSize={11} tickLine={false} axisLine={false} domain={[60, 160]} label={{ value: 'Heart Rate (bpm)', angle: -90, position: 'insideRight', offset: 0, fill: '#64748b', fontSize: 12 }} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', fontWeight: 'bold' }}
                            itemStyle={{ padding: '4px 0' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} iconType="circle" />
                          <Bar yAxisId="right" dataKey="hr" name="Heart Rate (bpm)" fill="url(#colorHr)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                          <Line yAxisId="left" type="monotone" dataKey="temp" name="Temperature (°C)" stroke="#F43F5E" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Exposed Users */}
                {explanation.exposed_users.length > 0 && (
                  <div className="premium-card bg-white shadow-xl shadow-gray-200/40 p-6">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Potentially Exposed Users ({explanation.exposed_users.length})</h4>
                    <div className="flex flex-wrap gap-2">
                      {explanation.exposed_users.map((u: string) => (
                        <div key={u} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-700 shadow-sm">
                          {u}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="premium-card h-full flex flex-col items-center justify-center text-center p-12 bg-white/50 border border-dashed border-gray-300">
                <div className="w-24 h-24 rounded-full bg-indigo-50 flex items-center justify-center mb-6">
                  <FileSearch className="w-10 h-10 text-indigo-200" />
                </div>
                <h3 className="text-xl font-display font-bold text-gray-900 mb-2">Select a Log Entry</h3>
                <p className="text-sm text-gray-500 max-w-sm">
                  Click on any notification entry in the Action Log to view its complete, step-by-step diagnostic trace.
                </p>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
