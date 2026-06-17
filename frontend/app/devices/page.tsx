"use client";

import { useEffect, useState } from "react";
import { getDevicesHealth } from "@/lib/api";
import {
  Battery,
  BatteryWarning,
  Heart,
  Thermometer,
  Loader2,
  Zap,
  Cpu,
  SignalHigh,
  Search,
  Filter,
  Activity,
  AlertTriangle,
  MapPin,
} from "lucide-react";
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

interface DeviceHealth {
  device_id: string;
  battery_percent: number;
  projected_hours_remaining: number;
  decline_rate_per_hour: number;
  status: string;
  last_seen: string;
  reading_count: number;
  near_charging: boolean;
  latest_temp: number;
  latest_hr: number;
  temp_status: string;
  hr_status: string;
  geohash: string;
  vitals_history?: any[];
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const res = await getDevicesHealth();
        setDevices(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      dead: {
        cls: "bg-red-50 text-red-600 border-red-200 ring-1 ring-red-500/20",
        label: "DEAD",
      },
      critical: {
        cls: "bg-red-50 text-red-600 border-red-200 ring-1 ring-red-500/20",
        label: "CRITICAL",
      },
      needs_visit: {
        cls: "bg-amber-50 text-amber-600 border-amber-200 ring-1 ring-amber-500/20",
        label: "NEEDS VISIT",
      },
      healthy: {
        cls: "bg-emerald-50 text-emerald-600 border-emerald-200 ring-1 ring-emerald-500/20",
        label: "HEALTHY",
      },
    };
    const s = map[status] || { cls: "bg-gray-50 text-gray-600 border-gray-200", label: status.toUpperCase() };
    return (
      <span className={`px-2.5 py-1 text-[10px] font-bold tracking-wider rounded-full border ${s.cls}`}>
        {s.label}
      </span>
    );
  };

  const getBatteryColor = (percent: number) => {
    if (percent <= 15) return "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]";
    if (percent <= 30) return "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]";
    return "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]";
  };

  // Filtered logic
  const filteredDevices = devices.filter((d) => {
    const matchesSearch = d.device_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Summary Metrics
  const totalDevices = devices.length;
  const criticalCount = devices.filter(d => d.status === "critical" || d.battery_percent <= 15).length;
  const needsVisitCount = devices.filter(d => d.status === "needs_visit" || d.status === "dead").length;

  const prepareChartData = (vitals: any[]) => {
    if (!vitals || vitals.length === 0) return [];
    const sorted = [...vitals].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return sorted.map(v => ({
      time: new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      temp: v.temperature,
      hr: v.heartbeat,
    }));
  };

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {/* Premium Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border/40 rounded-tl-[1.5rem]">
        <div className="px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-display font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-500" />
              Device Fleet Management
            </h1>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            {/* Search Bar */}
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Device ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-sm text-gray-700 rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-sm"
              />
            </div>
            
            {/* Filter Dropdown */}
            <div className="relative shrink-0">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-white border border-gray-200 text-sm font-medium text-gray-700 rounded-lg pl-9 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm cursor-pointer hover:bg-gray-50"
              >
                <option value="all">All Statuses</option>
                <option value="healthy">Healthy</option>
                <option value="needs_visit">Needs Visit</option>
                <option value="critical">Critical</option>
                <option value="dead">Dead</option>
              </select>
              <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 px-8 py-8 space-y-8 overflow-y-auto scrollbar-none">
        
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
          <div className="premium-card p-5 relative overflow-hidden group border-indigo-100">
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <p className="text-[11px] text-gray-500 font-bold mb-1 uppercase tracking-wider">Total Active Nodes</p>
                <p className="text-4xl font-display font-bold text-gray-900 tracking-tight">
                  {totalDevices.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-full flex items-center justify-center opacity-80 group-hover:scale-110 transition-transform duration-500">
              <SignalHigh className="w-10 h-10 text-indigo-400 opacity-60" />
            </div>
          </div>

          <div className="premium-card p-5 relative overflow-hidden group border-rose-100">
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <p className="text-[11px] text-gray-500 font-bold mb-1 uppercase tracking-wider">Battery Critical</p>
                <p className="text-4xl font-display font-bold text-rose-600 tracking-tight">
                  {criticalCount.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-full flex items-center justify-center opacity-80 group-hover:scale-110 transition-transform duration-500">
              <BatteryWarning className="w-10 h-10 text-rose-400 opacity-60" />
            </div>
          </div>

          <div className="premium-card p-5 relative overflow-hidden group border-amber-100">
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <p className="text-[11px] text-gray-500 font-bold mb-1 uppercase tracking-wider">Field Visit Required</p>
                <p className="text-4xl font-display font-bold text-amber-600 tracking-tight">
                  {needsVisitCount.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-full flex items-center justify-center opacity-80 group-hover:scale-110 transition-transform duration-500">
              <AlertTriangle className="w-10 h-10 text-amber-400 opacity-60" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="premium-card p-12 text-center flex flex-col items-center">
            <Search className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-display font-bold text-gray-900">No Devices Found</h3>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your search query or status filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {filteredDevices.map((device) => (
              <div 
                key={device.device_id} 
                className={`premium-card flex flex-col justify-between group overflow-hidden cursor-pointer transition-all ${
                  (device.status === 'dead' || device.status === 'critical')
                    ? 'border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.4)] hover:border-rose-400 hover:shadow-[0_0_25px_rgba(244,63,94,0.6)]'
                    : 'hover:border-indigo-200'
                }`}
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm group-hover:scale-110 transition-transform ${
                        device.status === 'dead' ? 'bg-gray-100 border-gray-200' : 'bg-indigo-50 border-indigo-100'
                      }`}>
                        <Cpu className={`w-5 h-5 ${device.status === 'dead' ? 'text-gray-400' : 'text-indigo-600'}`} />
                      </div>
                      <div>
                        <h3 className="font-mono font-bold text-gray-900 text-base">{device.device_id}</h3>
                        <p className="text-[11px] text-gray-400 font-medium tracking-wide">
                          LAST SEEN: {new Date(device.last_seen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                    {statusBadge(device.status)}
                  </div>

                  {/* Battery Section */}
                  <div className="mb-4 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5 uppercase tracking-wider">
                        {device.battery_percent <= 15 ? (
                          <BatteryWarning className="w-3.5 h-3.5 text-red-500" />
                        ) : (
                          <Battery className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                        Bat: {device.battery_percent.toFixed(1)}%
                      </span>
                      <span className="text-[11px] font-bold text-gray-500 font-mono">
                        ~{device.projected_hours_remaining.toFixed(1)}h left
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${getBatteryColor(device.battery_percent)}`}
                        style={{ width: `${Math.max(0, Math.min(100, device.battery_percent))}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-[10px] text-gray-400 font-medium">Drain Rate</span>
                      <span className="text-[10px] font-mono text-gray-600 font-bold">{device.decline_rate_per_hour.toFixed(2)}%/hr</span>
                    </div>
                  </div>

                  {/* Sensors Row */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex flex-col items-center">
                      <div className="flex items-center gap-1.5 mb-1 text-gray-400">
                        <Heart className={`w-3.5 h-3.5 ${device.hr_status === 'anomalous' ? 'text-rose-500 animate-pulse' : ''}`} />
                        <span className="text-[9px] font-bold uppercase tracking-widest">Heart Rate</span>
                      </div>
                      <span className={`font-display font-bold text-xl ${device.hr_status === 'anomalous' ? 'text-rose-600' : 'text-gray-900'}`}>
                        {device.latest_hr ? Math.round(device.latest_hr) : "--"}
                      </span>
                    </div>
                    
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex flex-col items-center">
                      <div className="flex items-center gap-1.5 mb-1 text-gray-400">
                        <Thermometer className={`w-3.5 h-3.5 ${device.temp_status === 'anomalous' ? 'text-rose-500 animate-pulse' : ''}`} />
                        <span className="text-[9px] font-bold uppercase tracking-widest">Body Temp</span>
                      </div>
                      <span className={`font-display font-bold text-xl ${device.temp_status === 'anomalous' ? 'text-rose-600' : 'text-gray-900'}`}>
                        {device.latest_temp ? device.latest_temp.toFixed(1) : "--"}°
                      </span>
                    </div>
                  </div>

                  {/* Vitals Chart */}
                  {device.vitals_history && device.vitals_history.length > 0 && (
                    <div className="h-32 w-full mt-2 bg-gray-50/30 rounded-xl p-2 border border-gray-100">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={prepareChartData(device.vitals_history)} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                          <defs>
                            <linearGradient id={`colorHr-${device.device_id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '10px' }}
                            itemStyle={{ padding: '2px 0' }}
                            labelStyle={{ color: '#64748b' }}
                          />
                          <Bar dataKey="hr" name="HR" fill={`url(#colorHr-${device.device_id})`} radius={[2, 2, 0, 0]} maxBarSize={20} yAxisId="right" />
                          <Line type="monotone" dataKey="temp" name="Temp" stroke="#F43F5E" strokeWidth={2} dot={false} activeDot={{ r: 4 }} yAxisId="left" />
                          <YAxis yAxisId="left" hide domain={['dataMin - 1', 'dataMax + 1']} />
                          <YAxis yAxisId="right" hide orientation="right" domain={[60, 160]} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Footer status / Action */}
                <div className="bg-gray-50 border-t border-gray-100 p-3 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="font-mono uppercase">{device.geohash}</span>
                  </div>
                  {device.near_charging && (
                    <div className="flex items-center gap-1 font-bold text-indigo-600">
                      <Zap className="w-3.5 h-3.5 animate-pulse" />
                      Charging Near
                    </div>
                  )}
                  {!device.near_charging && (
                    <span className="text-indigo-600 font-semibold group-hover:underline">View Logs &rarr;</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
