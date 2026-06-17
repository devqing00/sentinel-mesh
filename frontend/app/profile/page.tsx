"use client";

import { useAuth } from "@/context/AuthContext";
import {
  UserCircle,
  Bell,
  Volume2,
  Laptop,
  MonitorSmartphone,
  Activity,
  Globe,
  Server,
  Database,
  RefreshCw
} from "lucide-react";
import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, Tooltip, Cell, XAxis, YAxis, Legend } from "recharts";
import { ingestAll } from "@/lib/api";

const performanceData = [
  { day: 'Mon', alerts: 14 },
  { day: 'Tue', alerts: 22 },
  { day: 'Wed', alerts: 18 },
  { day: 'Thu', alerts: 35 },
  { day: 'Fri', alerts: 28 },
  { day: 'Sat', alerts: 12 },
  { day: 'Sun', alerts: 8 },
];

export default function ProfilePage() {
  const { user, role } = useAuth();
  
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);
  const [darkTheme, setDarkTheme] = useState(false);
  const [ingesting, setIngesting] = useState(false);

  const handleIngest = async () => {
    if (confirm("This will ingest real baseline data into the MongoDB database. Continue?")) {
      setIngesting(true);
      try {
        await ingestAll();
        alert("Data ingestion completed successfully!");
      } catch (e) {
        alert("Data ingestion failed. See console.");
        console.error(e);
      }
      setIngesting(false);
    }
  };

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "SM";

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {/* Premium Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border/40 rounded-tl-[1.5rem]">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-display font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-indigo-500" />
              Account Profile
            </h1>
          </div>

        </div>
      </header>

      <div className="flex-1 px-8 py-8 space-y-8 overflow-y-auto scrollbar-none">
        
        {/* Elite Identity Hero Card */}
        <div className="premium-card bg-white p-8 rounded-[2rem] relative overflow-hidden group shadow-xl shadow-indigo-500/5 border border-indigo-100">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.01] mix-blend-overlay" />
          <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-indigo-500/10 to-transparent blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
          
          {/* Animated SVG Grid Background */}
          <div className="absolute inset-0 z-0 opacity-[0.02] group-hover:opacity-5 transition-opacity duration-1000">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="hexagons" width="50" height="43.4" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
                  <path d="M25 0L50 14.4v28.9L25 43.4L0 28.9V14.4z" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-indigo-500" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#hexagons)" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-emerald-500 p-1.5 shadow-[0_0_40px_rgba(99,102,241,0.5)] group-hover:scale-105 transition-transform duration-700">
              <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center border border-slate-800">
                <span className="text-4xl font-display font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 tracking-widest">{initials}</span>
              </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center gap-4 mb-2">
                <h2 className="text-3xl font-display font-black text-indigo-950 tracking-tight">
                  {user?.email?.split("@")[0] || "Administrator"}
                </h2>
              </div>
              <p className="text-gray-500 font-mono text-sm flex items-center justify-center md:justify-start gap-2">
                <UserCircle className="w-4 h-4 text-emerald-500" />
                {user?.email || "admin@sentinel.local"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Top Left: Stats */}
          <div className="premium-card p-6 bg-white shadow-xl shadow-gray-200/40">
            <h3 className="text-lg font-display font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-500" />
              Activity Summary
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Handled</span>
                <span className="text-3xl font-display font-black text-indigo-600">1,402</span>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Avg Time</span>
                <span className="text-3xl font-display font-black text-emerald-500">1.2m</span>
              </div>
            </div>

            <div className="h-32 w-full">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Weekly Activity</h4>
              <p className="text-xs text-gray-500 mb-2">The number of alerts handled by you over the past week.</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} dy={10} label={{ value: 'Day of Week', position: 'insideBottomRight', offset: -10, fill: '#64748b', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} label={{ value: 'Alerts', angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b', fontSize: 10 }} />
                  <Tooltip cursor={{ fill: 'rgba(99,102,241,0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  
                  <Bar dataKey="alerts" name="Alerts Handled" radius={[4, 4, 0, 0]}>
                    {performanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 3 ? '#6366f1' : '#e2e8f0'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Right: Preferences */}
          <div className="premium-card p-6 bg-white shadow-xl shadow-gray-200/40">
            <h3 className="text-lg font-display font-bold text-gray-900 mb-6 flex items-center gap-2">
              <MonitorSmartphone className="w-5 h-5 text-indigo-500" />
              App Preferences
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Push Notifications</p>
                    <p className="text-xs text-gray-500">Browser alerts for criticals.</p>
                  </div>
                </div>
                <button onClick={() => setNotifications(!notifications)} className={`w-10 h-5 rounded-full p-1 transition-colors ${notifications ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                  <div className={`w-3 h-3 bg-white rounded-full transition-transform ${notifications ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                    <Volume2 className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Sound Alerts</p>
                    <p className="text-xs text-gray-500">Play sounds for anomalies.</p>
                  </div>
                </div>
                <button onClick={() => setSound(!sound)} className={`w-10 h-5 rounded-full p-1 transition-colors ${sound ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                  <div className={`w-3 h-3 bg-white rounded-full transition-transform ${sound ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Full: Sessions */}
          <div className="xl:col-span-2 premium-card p-6 bg-white shadow-xl shadow-gray-200/40">
            <h3 className="text-lg font-display font-bold text-gray-900 mb-6 flex items-center gap-2">
              <MonitorSmartphone className="w-5 h-5 text-blue-500" />
              Active Devices
            </h3>
            
            <div className="space-y-4">
              {[
                { device: "MacBook Pro", location: "Lagos, NG", current: true, time: "Active Now" },
                { device: "iPhone", location: "Lagos, NG", current: false, time: "2 hours ago" },
                { device: "Windows Desktop", location: "Abuja, NG", current: false, time: "3 days ago" },
              ].map((session, i) => (
                <div key={i} className={`p-4 rounded-2xl border ${session.current ? 'bg-indigo-50/50 border-indigo-100 ring-1 ring-indigo-500/20' : 'bg-gray-50/50 border-gray-100'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${session.current ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' : 'bg-white border border-gray-200 text-gray-400'}`}>
                        {session.device.includes('iPhone') ? <MonitorSmartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className={`font-bold text-sm ${session.current ? 'text-indigo-900' : 'text-gray-700'}`}>
                          {session.device}
                          {session.current && <span className="ml-2 inline-block px-2 py-0.5 bg-indigo-500 text-white text-[9px] uppercase tracking-wider rounded-full">This Device</span>}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-medium">
                          <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> {session.location}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-gray-400">{session.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Administration */}
          <div className="xl:col-span-2 premium-card p-6 bg-white shadow-xl shadow-gray-200/40">
            <h3 className="text-lg font-display font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Database className="w-5 h-5 text-rose-500" />
              System Administration
            </h3>
            <div className="p-4 rounded-2xl border bg-rose-50/50 border-rose-100 flex items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-sm text-rose-900">Data Ingestion</h4>
                <p className="text-xs text-rose-700/80 mt-1">Reload the latest Sentinel datasets (mobility, contacts, vitals) into the database.</p>
              </div>
              <button
                onClick={handleIngest}
                disabled={ingesting}
                className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-rose-500/20 transition-all disabled:opacity-50"
              >
                {ingesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                {ingesting ? "Ingesting..." : "Ingest System Data"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
