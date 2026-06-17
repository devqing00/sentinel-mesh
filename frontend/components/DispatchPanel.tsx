"use client";

import { useState } from "react";
import { MapPin, PhoneCall, ShieldCheck, Ambulance, Clock, Activity, Crosshair, X } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";
import { getAgents, getFacilities } from "@/lib/api";

const fetchAgents = async () => {
  const res = await getAgents();
  return res.data.agents || [];
};

const fetchFacilities = async () => {
  const res = await getFacilities();
  return res.data.facilities || [];
};

export default function DispatchPanel({ targetId, onClose }: { targetId: string; onClose?: () => void }) {
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [dispatching, setDispatching] = useState(false);

  const { data: agents = [], isLoading: agentsLoading } = useSWR("/api/resources/agents", fetchAgents, { refreshInterval: 60000 });
  const { data: facilities = [], isLoading: facilitiesLoading } = useSWR("/api/resources/facilities", fetchFacilities, { refreshInterval: 60000 });

  const handleDispatch = () => {
    if (!selectedAgent) return;
    setDispatching(true);
    setTimeout(() => {
      setDispatching(false);
      toast.success(`${selectedAgent.name} dispatched to ${targetId}!`, {
        icon: '🚑',
        style: { borderRadius: '10px', background: '#333', color: '#fff' }
      });
      setSelectedAgent(null);
      if (onClose) onClose();
    }, 1500);
  };

  return (
    <div className="w-full h-full flex flex-col gap-6 overflow-y-auto scrollbar-none animate-slide-up pb-10">
      
      {/* Header if onClose provided */}
      {onClose && (
        <div className="flex items-center justify-between bg-gray-900 text-white p-4 rounded-xl shadow-lg">
          <h3 className="font-display font-bold text-sm flex items-center gap-2">
            <Ambulance className="w-4 h-4 text-rose-500" />
            Dispatch Order for {targetId}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dispatch Control */}
      <div className="premium-card p-6 bg-white shrink-0 border border-gray-200">
        <h3 className="text-lg font-display font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Crosshair className="w-5 h-5 text-rose-500" />
          {!onClose && `Deployment Order: ${targetId}`}
          {onClose && `Confirm Deployment`}
        </h3>
        {selectedAgent ? (
          <div className="space-y-4">
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
              <p className="text-xs text-indigo-500 font-bold uppercase mb-1">Selected Unit</p>
              <p className="font-bold text-indigo-950">{selectedAgent.name}</p>
              <p className="text-sm text-indigo-700/80">{selectedAgent.role}</p>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-indigo-200">
                <span className="text-xs font-bold text-indigo-900 flex items-center gap-1"><MapPin className="w-3 h-3"/> {selectedAgent.distance}</span>
                <span className="text-xs font-bold text-indigo-900 flex items-center gap-1"><Clock className="w-3 h-3"/> {selectedAgent.ETA}</span>
              </div>
            </div>
            <button
              onClick={handleDispatch}
              disabled={dispatching}
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {dispatching ? <Activity className="w-4 h-4 animate-spin" /> : <Ambulance className="w-4 h-4" />}
              {dispatching ? "Deploying..." : "Confirm Deployment"}
            </button>
          </div>
        ) : (
          <div className="p-6 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center">
            <p className="text-sm font-bold text-gray-400">Select an agent below to initiate deployment.</p>
          </div>
        )}
      </div>

      {/* Agents List */}
      <div className="premium-card p-6 bg-white shrink-0 border border-gray-200">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Field Operatives</h3>
        {agentsLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-gray-100 rounded-xl"></div>
            <div className="h-16 bg-gray-100 rounded-xl"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent: any) => (
            <div 
              key={agent.id}
              onClick={() => agent.status === "Available" && setSelectedAgent(agent)}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                selectedAgent?.id === agent.id 
                  ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500" 
                  : agent.status === "Available" 
                    ? "bg-white border-gray-100 hover:border-indigo-300 hover:shadow-md" 
                    : "bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">{agent.name}</h4>
                  <p className="text-xs text-gray-500">{agent.role}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${agent.status === "Available" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {agent.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {agent.distance}</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {agent.ETA}</span>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Facilities List */}
      <div className="premium-card p-6 bg-white shrink-0 border border-gray-200">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Nearby Facilities</h3>
        {facilitiesLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-gray-100 rounded-xl"></div>
            <div className="h-16 bg-gray-100 rounded-xl"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {facilities.map((fac: any, i: number) => (
            <div key={i} className="p-4 rounded-xl border border-gray-100 bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">{fac.name}</h4>
                  <p className="text-xs text-gray-500">{fac.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> Cap: {fac.capacity}</span>
                <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Beds: {fac.beds}</span>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
