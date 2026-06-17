"use client";

import {
  Bell,
  CheckCircle2,
  ShieldAlert,
  Cpu,
  Activity,
  AlertTriangle,
  RadioTower,
  Filter,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { getAuditLog } from "@/lib/api";
import Link from "next/link";

import { useWebSocketData } from "@/context/WebSocketContext";

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; border: string; label: string }> = {
  anomaly: { icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-50", border: "border-rose-100", label: "Unusual Reading" },
  system:  { icon: Activity,      color: "text-blue-500",  bg: "bg-blue-50",  border: "border-blue-100",  label: "System Update"  },
  hardware:{ icon: Cpu,           color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-100", label: "Hardware"},
  security:{ icon: ShieldAlert,   color: "text-emerald-500",bg:"bg-emerald-50",border:"border-emerald-100",label:"Security"},
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const FILTERS = ["All", "Unusual Reading", "System Update", "Hardware", "Security"];

export default function NotificationsPage() {
  const { data: res } = useSWR("/api/audit/log", async () => {
    const r = await getAuditLog();
    return r.data;
  }, { refreshInterval: 8000 });

  const { liveAlerts } = useWebSocketData();

  const [localReadState, setLocalReadState] = useState<Record<string, boolean>>({});
  const [activeFilter, setActiveFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const rawEntries: any[] = res?.entries || [];

  // Merge live WebSocket alerts with the fetched audit log, avoiding duplicates by id
  const mergedEntries = [...liveAlerts];
  const liveAlertIds = new Set(liveAlerts.map(a => a.id));
  for (const entry of rawEntries) {
    const id = entry._id || (entry.title + entry.timestamp);
    if (!liveAlertIds.has(id)) {
      mergedEntries.push({ ...entry, id });
    }
  }

  // Sort by timestamp descending
  mergedEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const notifications = mergedEntries.map((n: any) => {
    const type = n.type || "system";
    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.system;
    const id = n.id;
    const isRead = localReadState[id] !== undefined ? localReadState[id] : (n.read ?? false);
    return { ...n, id, type, cfg, unread: !isRead };
  });

  const filtered = activeFilter === "All"
    ? notifications
    : notifications.filter(n => n.cfg.label === activeFilter);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAllRead = () => {
    const next = { ...localReadState };
    notifications.forEach(n => { next[n.id] = true; });
    setLocalReadState(next);
  };

  const markRead = (id: string) => setLocalReadState(prev => ({ ...prev, [id]: true }));

  const handleFilterChange = (f: string) => {
    setActiveFilter(f);
    setCurrentPage(1);
  };

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border/40 rounded-tl-[1.5rem]">
        <div className="px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-display font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-500" />
            Notifications
          </h1>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 shadow-sm text-xs font-bold text-gray-600">
            {unreadCount > 0 ? (
              <>
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                {unreadCount} Unread
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                All Caught Up
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 px-8 py-8 overflow-y-auto scrollbar-none">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Title + Mark All */}
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-display font-extrabold text-gray-900 tracking-tight drop-shadow-sm mb-1">
                Recent Activity
              </h2>
              <p className="text-sm text-gray-500">
                Live system events — unusual readings, hardware updates, and broadcasts.
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  activeFilter === f
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
                    : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Notifications Feed */}
          {filtered.length === 0 ? (
            <div className="premium-card p-12 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                <Bell className="w-9 h-9 text-gray-300" />
              </div>
              <h3 className="text-lg font-display font-bold text-gray-800 mb-1">All quiet right now</h3>
              <p className="text-sm text-gray-500">We'll let you know if anything unusual happens.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedData.map((n) => {
                const Icon = n.cfg.icon;
                return (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`premium-card relative p-5 cursor-pointer transition-all duration-300 group ${
                      n.unread
                        ? "bg-white shadow-md border-indigo-100 ring-1 ring-indigo-500/10"
                        : "bg-gray-50/60 hover:bg-white shadow-sm opacity-80 hover:opacity-100"
                    }`}
                  >
                    {/* Unread indicator */}
                    {n.unread && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-indigo-500 rounded-r-full" />
                    )}

                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${n.cfg.bg} ${n.cfg.border}`}>
                        <Icon className={`w-5 h-5 ${n.cfg.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <h3 className={`font-display font-bold text-base ${n.unread ? "text-gray-900" : "text-gray-700"}`}>
                            {n.title || "System Event"}
                          </h3>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">
                            {timeAgo(n.timestamp)}
                          </span>
                        </div>

                        <p className={`text-sm leading-relaxed ${n.unread ? "text-gray-600 font-medium" : "text-gray-500"}`}>
                          {n.message || n.trigger_reason || "No details."}
                        </p>

                        {/* Metadata pills */}
                        {n.cluster_id && n.cluster_id !== "SYSTEM" && (
                          <div className="flex items-center gap-2 mt-3">
                            <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider rounded-full">
                              Region: {n.cluster_id}
                            </span>
                            {n.risk_score != null && (
                              <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                                n.risk_score >= 80
                                  ? "bg-rose-50 text-rose-600 border border-rose-100"
                                  : n.risk_score >= 50
                                  ? "bg-amber-50 text-amber-600 border border-amber-100"
                                  : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              }`}>
                                Score: {Math.round(n.risk_score)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Actions for anomalies */}
                        {n.type === "anomaly" && n.unread && (
                          <div className="mt-4 flex gap-2">
                            <Link
                              href="/audit"
                              onClick={(e) => e.stopPropagation()}
                              className="px-4 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold rounded-lg hover:bg-rose-100 transition-colors flex items-center gap-1.5"
                            >
                              View Audit Trace <ArrowRight className="w-3 h-3" />
                            </Link>
                            <Link
                              href="/alerts"
                              onClick={(e) => e.stopPropagation()}
                              className="px-4 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                            >
                              Review Case <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 pb-8">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm font-bold text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}

          {/* Footer link */}
          {filtered.length > 0 && (
            <div className="text-center pt-4 pb-8">
              <Link href="/audit" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-2 justify-center">
                View Full Audit Trail <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
