"use client";

import { useEffect, useState } from "react";
import {
  getCommunityRisks,
  generateAlerts,
  triggerNotification,
  getSormasExport,
  getRankedTable,
} from "@/lib/api";
import Link from "next/link";
import {
  Bell,
  FileText,
  Languages,
  Loader2,
  Send,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Globe,
  RadioTower,
  Users,
  TrendingUp,
  Activity,
  Zap,
  Ambulance,
} from "lucide-react";
import RankedUserTable from "@/components/RankedUserTable";
import DispatchPanel from "@/components/DispatchPanel";

import useSWR from "swr";
import { useWebSocketData } from "@/context/WebSocketContext";

interface RiskCluster {
  cluster_id: string;
  lat: number;
  lon: number;
  risk_score: number;
  contributing_device_count: number;
  anomalous_devices: string[];
  contact_count: number;
}

export default function AlertsPage() {
  const { data: clusterData, isLoading: loading } = useSWR("/api/risk/communities", async () => {
    const res = await getCommunityRisks();
    return res.data;
  }, { refreshInterval: 5000 });

  const clusters: RiskCluster[] = Array.isArray(clusterData) ? clusterData : [];
  
  const { rankedTable: rankedData, isConnected } = useWebSocketData();
  const rankedLoading = !isConnected && rankedData.length === 0;

  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Record<string, string> | null>(null);
  const [sormasData, setSormasData] = useState<any>(null);
  const [notifyResult, setNotifyResult] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dispatchingTarget, setDispatchingTarget] = useState<string | null>(null);

  // Show all users, matching the dashboard display
  const attentionData = rankedData;

  const handleGenerateAlerts = async (clusterId: string) => {
    setGenerating(true);
    setSelectedCluster(clusterId);
    setAlerts(null); setSormasData(null); setNotifyResult(null); setDispatchingTarget(null);
    try {
      const res = await generateAlerts(clusterId);
      setAlerts(res.data.alerts);
    } catch (e) { console.error(e); }
    setGenerating(false);
  };

  const handleExportSormas = async (clusterId: string) => {
    setExporting(true);
    setSelectedCluster(clusterId);
    setAlerts(null); setSormasData(null); setNotifyResult(null); setDispatchingTarget(null);
    try {
      const res = await getSormasExport(clusterId);
      setSormasData(res.data);
    } catch (e) { console.error(e); }
    setExporting(false);
  };

  const handleTriggerNotify = async (clusterId: string) => {
    setTriggering(true);
    setSelectedCluster(clusterId);
    setAlerts(null); setSormasData(null); setNotifyResult(null); setDispatchingTarget(null);
    try {
      const res = await triggerNotification(clusterId);
      setNotifyResult(res.data);
    } catch (e) { console.error(e); }
    setTriggering(false);
  };

  const riskColor = (score: number) => {
    if (score >= 80) return "#ef4444";
    if (score >= 50) return "#f59e0b";
    return "#10b981";
  };

  const riskLabel = (score: number) => {
    if (score >= 80) return { label: "Critical", cls: "bg-rose-50 text-rose-600 border-rose-200" };
    if (score >= 50) return { label: "High", cls: "bg-amber-50 text-amber-600 border-amber-200" };
    return { label: "Stable", cls: "bg-emerald-50 text-emerald-600 border-emerald-200" };
  };

  const totalAnomalies = clusters.reduce((a, c) => a + (c.anomalous_devices?.length || 0), 0);
  const criticalClusters = clusters.filter(c => c.risk_score >= 80).length;

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border/40 rounded-tl-[1.5rem]">
        <div className="px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-display font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            Community Health Watch
          </h1>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-100 shadow-sm text-xs font-bold text-rose-600">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            Live Detection
          </div>
        </div>
      </header>

      <div className="flex-1 px-8 py-8 space-y-8 overflow-y-auto scrollbar-none">
        {/* Page Heading */}
        <div>
          <h2 className="text-3xl font-display font-extrabold text-gray-900 tracking-tight drop-shadow-sm mb-1">
            Affected Neighborhoods
          </h2>
          <p className="text-sm text-gray-500">
            Monitor high-risk individuals, generate localized broadcasts, and escalate to public health systems.
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Regions", value: clusters.length, icon: Globe, color: "text-indigo-500", bg: "bg-indigo-50" },
            { label: "Critical Neighborhoods", value: criticalClusters, icon: Zap, color: "text-rose-500", bg: "bg-rose-50" },
            { label: "Total Unusual Readings", value: totalAnomalies, icon: Activity, color: "text-amber-500", bg: "bg-amber-50" },
            { label: "People Needing Care", value: attentionData.length, icon: Users, color: "text-purple-500", bg: "bg-purple-50" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="premium-card p-5 bg-white flex items-center gap-4 shadow-md shadow-gray-200/40">
                <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-display font-black text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* People Needing Attention */}
        <div className="premium-card bg-white border border-gray-200/60 shadow-xl shadow-gray-200/40">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-display font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-rose-500" />
              People Needing Care
            </h3>
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-3 py-1 rounded-full">
                Ranked by Risk
              </span>
              <Link href="/network" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors">
                See Contact Tracing Map
                <TrendingUp className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
          <div className="relative p-6">
            {rankedLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
              </div>
            ) : attentionData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-300 mb-3" />
                <p className="font-bold text-gray-700">No High-Risk Individuals</p>
                <p className="text-sm text-gray-400 mt-1">All monitored users are within normal parameters.</p>
              </div>
            ) : (
              <RankedUserTable data={attentionData as any} limit={5} hideControls={true} />
            )}
          </div>
        </div>

        {/* Risk Clusters + Action Panel */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 min-h-[600px]">
          {/* Left: Clusters */}
          <div className="premium-card flex flex-col border border-gray-200/60 shadow-xl shadow-gray-200/40">
            <div className="p-6 border-b border-gray-100 bg-white/50 backdrop-blur-sm rounded-t-[1.5rem]">
              <h3 className="text-lg font-display font-bold text-gray-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-500" />
                Affected Neighborhoods
              </h3>
              <p className="text-xs text-gray-500 mt-1">Select a neighborhood to generate warnings or alert the health system.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
              {loading ? (
                <div className="flex items-center justify-center h-full py-20">
                  <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              ) : clusters.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <ShieldAlert className="w-16 h-16 mb-4 text-gray-300" />
                  <h4 className="text-lg font-display font-bold text-gray-900 mb-1">No Active Risks</h4>
                  <p className="text-sm text-gray-500">The community mesh is reporting baseline health metrics.</p>
                </div>
              ) : (
                clusters.map((c) => {
                  const isSelected = selectedCluster === c.cluster_id;
                  const risk = riskLabel(c.risk_score);
                  return (
                    <div
                      key={c.cluster_id}
                      className={`group relative p-5 rounded-2xl cursor-pointer transition-all duration-300 border ${
                        isSelected
                          ? "bg-white border-rose-200 shadow-md ring-2 ring-rose-500/20"
                          : "bg-white/60 border-gray-200 hover:bg-white hover:shadow-sm hover:border-gray-300"
                      }`}
                      onClick={() => { setSelectedCluster(c.cluster_id); setAlerts(null); setSormasData(null); setNotifyResult(null); setDispatchingTarget(null); }}
                    >
                      {isSelected && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-rose-500 rounded-r-full" />}

                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-lg shadow-inner"
                            style={{ background: `${riskColor(c.risk_score)}15`, color: riskColor(c.risk_score), border: `1px solid ${riskColor(c.risk_score)}30` }}
                          >
                            {Math.round(c.risk_score)}
                          </div>
                          <div>
                            <span className="font-mono text-sm font-bold text-gray-900 block">{c.cluster_id}</span>
                            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Risk Score</span>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 text-[10px] font-bold tracking-wider border rounded-full ${risk.cls}`}>
                          {risk.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-gray-50 rounded-lg p-2 border border-gray-100 text-center">
                          <span className="block text-lg font-display font-bold text-gray-900">{c.contributing_device_count}</span>
                          <span className="text-[9px] text-gray-400 uppercase tracking-wider">Devices</span>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2 border border-gray-100 text-center">
                          <span className="block text-lg font-display font-bold text-rose-500">{c.anomalous_devices?.length || 0}</span>
                          <span className="text-[9px] text-gray-400 uppercase tracking-wider">Anomalies</span>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2 border border-gray-100 text-center">
                          <span className="block text-lg font-display font-bold text-indigo-500">{c.contact_count}</span>
                          <span className="text-[9px] text-gray-400 uppercase tracking-wider">Contacts</span>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleGenerateAlerts(c.cluster_id); }}
                            disabled={generating}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                          >
                            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                            Draft Local Warning
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleExportSormas(c.cluster_id); }}
                            disabled={exporting}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 text-xs font-bold rounded-lg border border-gray-200 transition-colors disabled:opacity-50"
                          >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            Send to Health System
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleTriggerNotify(c.cluster_id); }}
                            disabled={triggering}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold rounded-lg shadow-sm shadow-rose-500/20 transition-colors disabled:opacity-50"
                          >
                            {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Push Broadcast
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDispatchingTarget(c.cluster_id); setAlerts(null); setSormasData(null); setNotifyResult(null); }}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold rounded-lg shadow-sm shadow-emerald-500/20 transition-colors"
                          >
                            <Ambulance className="w-4 h-4" />
                            Send Health Workers
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Action Panel */}
          <div className="h-full">
            {generating || triggering || exporting ? (
              <div className="premium-card h-full flex flex-col items-center justify-center bg-white shadow-xl shadow-gray-200/40 min-h-[300px]">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RadioTower className="w-8 h-8 text-indigo-500 animate-pulse" />
                  </div>
                </div>
                <p className="mt-6 text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Processing Request</p>
              </div>
            ) : dispatchingTarget ? (
              <div className="h-full relative overflow-hidden animate-slide-up rounded-[1.5rem] bg-white border border-gray-200/60 shadow-xl">
                <DispatchPanel targetId={dispatchingTarget} />
              </div>
            ) : alerts || sormasData || notifyResult ? (
              <div className="flex flex-col gap-6 animate-slide-up">
                {alerts && (
                  <div className="premium-card bg-white p-6 shadow-xl shadow-gray-200/40">
                    <h3 className="text-lg font-display font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <Languages className="w-5 h-5 text-indigo-500" />
                      Localized Broadcast Drafts
                    </h3>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 scrollbar-none">
                      {Object.entries(alerts).map(([lang, text]) => (
                        <div key={lang} className="bg-gray-50 border border-gray-100 rounded-2xl p-5 relative">
                          <span className="absolute top-0 right-6 -translate-y-1/2 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm border border-indigo-200">
                            {lang}
                          </span>
                          <p className="text-gray-700 text-sm leading-relaxed mt-2">{text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {sormasData && (
                  <div className="premium-card bg-white p-6 shadow-xl shadow-gray-200/40">
                    <h3 className="text-lg font-display font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-500" />
                      SORMAS Export Payload
                    </h3>
                    <div className="bg-gray-900 rounded-2xl p-5 overflow-auto max-h-[400px] scrollbar-none border border-gray-800 shadow-inner">
                      <pre className="text-xs text-emerald-400 font-mono leading-relaxed">{JSON.stringify(sormasData, null, 2)}</pre>
                    </div>
                  </div>
                )}
                {notifyResult && (
                  <div className="premium-card bg-emerald-50 p-6 border border-emerald-100 shadow-xl shadow-emerald-500/10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                        <CheckCircle className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="text-lg font-display font-bold text-emerald-900">Broadcast Dispatched</h3>
                        <p className="text-sm text-emerald-700/80 mt-1">{notifyResult.message}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="premium-card h-full flex flex-col items-center justify-center text-center p-12 bg-white/50 border border-dashed border-gray-300 min-h-[300px]">
                <div className="w-24 h-24 rounded-full bg-gray-50 flex items-center justify-center mb-6">
                  <Bell className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-xl font-display font-bold text-gray-900 mb-2">No Cluster Selected</h3>
                <p className="text-sm text-gray-500 max-w-sm">
                  Select a risk cluster on the left to generate multilingual broadcasts, export to SORMAS, or push a live notification.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
