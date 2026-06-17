"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import Map, { MapRef, Source, Layer, Marker, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import { Activity, ShieldAlert, Ambulance, Settings2, Map as MapIcon, Moon, Sun } from "lucide-react";
import DispatchPanel from "@/components/DispatchPanel";
import useSWR from "swr";
import { getCommunityRisks } from "@/lib/api";

// We center the map near Lagos/Southwest Nigeria where the mock clusters are.
const INITIAL_VIEW_STATE = {
  longitude: 3.38,
  latitude: 6.52,
  zoom: 11,
  pitch: 45,
  bearing: -17.6,
};

// Pre-compute random offsets so the heatmap points don't flicker on every render cycle
const POINT_OFFSETS = Array.from({ length: 50 }, () => ({
  weightMultiplier: Math.random(),
  offsetX: (Math.random() - 0.5) * 0.05,
  offsetY: (Math.random() - 0.5) * 0.05,
}));

// Generate static hotspots from actual centers
const generateHotspots = (centers: any[]) => {
  const features: any[] = [];
  
  centers.forEach((center) => {
    // Current weight is exactly the backend risk score
    const currentWeight = center.baseWeight;
    const spreadMultiplier = 1.0; // Base spread

    // Apply pre-computed offsets so they scale outwards cleanly
    POINT_OFFSETS.forEach((offset) => {
      features.push({
        type: "Feature",
        properties: {
          weight: offset.weightMultiplier * currentWeight,
        },
        geometry: {
          type: "Point",
          coordinates: [
            center.lon + (offset.offsetX * spreadMultiplier),
            center.lat + (offset.offsetY * spreadMultiplier),
          ],
        },
      });
    });
  });

  return { type: "FeatureCollection", features };
};

const heatmapLayer: any = {
  id: "risk-heatmap",
  type: "heatmap",
  paint: {
    "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 1, 1],
    "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3],
    "heatmap-color": [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0, "rgba(33,102,172,0)",
      0.2, "rgb(103,169,207)",
      0.4, "rgb(209,229,240)",
      0.6, "rgb(253,219,199)",
      0.8, "rgb(239,138,98)",
      1, "rgb(178,24,43)"
    ],
    "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 15, 40],
    "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 1, 15, 0.7],
  },
};

export default function GeographyPage() {
  const mapRef = useRef<MapRef>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<any>(null);
  const [dispatchTarget, setDispatchTarget] = useState<string | null>(null);
  const [mapTheme, setMapTheme] = useState<"light-v11" | "dark-v11" | "satellite-streets-v12">("light-v11");
  const [showSettings, setShowSettings] = useState(false);
  
  // Fetch actual data from backend
  const { data: res } = useSWR("/api/risk/communities", async () => {
    const response = await getCommunityRisks();
    return response.data;
  }, { refreshInterval: 5000 });

  // Transform backend data to match the UI centers format
  const realCenters = useMemo(() => {
    if (!res) return [];
    return res.map((c: any) => ({
      id: c.cluster_id,
      name: `Zone ${c.cluster_id.toUpperCase()}`,
      lon: c.lon,
      lat: c.lat,
      baseWeight: c.risk_score / 100.0,
      anomalies: c.anomalous_devices?.length || 0,
      pop: c.contributing_device_count * 10,
      risk: c.risk_score > 80 ? "Critical" : c.risk_score > 50 ? "High" : "Elevated"
    }));
  }, [res]);

  const hotspotData = useMemo(() => generateHotspots(realCenters), [realCenters]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-focus map on data load (highest risk hotspot)
  useEffect(() => {
    if (realCenters.length > 0 && mapRef.current) {
      // Find the center with the highest risk score
      const highestRiskCenter = realCenters.reduce((max: any, current: any) => 
        (current.baseWeight > max.baseWeight) ? current : max
      , realCenters[0]);

      try {
        mapRef.current.flyTo({
          center: [highestRiskCenter.lon, highestRiskCenter.lat],
          zoom: 12,
          duration: 2500,
          essential: true
        });
      } catch (e) {
        console.error("FlyTo failed:", e);
      }
    }
  }, [realCenters]);

  if (!mounted) return null;

  return (
    <div className={`h-full w-full relative flex overflow-hidden transition-colors ${mapTheme === 'light-v11' ? 'bg-gray-50' : 'bg-[#0b1021]'}`}>
      {/* Map Container */}
      <div className="absolute inset-0 z-0">
        <Map
          ref={mapRef}
          initialViewState={INITIAL_VIEW_STATE}
          mapStyle={`mapbox://styles/mapbox/${mapTheme}`}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
          interactive={true}
          onClick={() => setSelectedCluster(null)}
        >
          {/* HOTSPOTS MODE */}
          <Source id="risk-heatmap-source" type="geojson" data={hotspotData as any}>
            <Layer {...heatmapLayer} />
          </Source>
          
          {/* Hotspot Labels & Markers */}
          {realCenters.map((cluster: any) => (
            <Marker key={cluster.id} longitude={cluster.lon} latitude={cluster.lat} anchor="center">
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCluster(cluster);
                }}
                className="group cursor-pointer flex flex-col items-center relative"
              >
                <div className="w-8 h-8 rounded-full border-2 border-rose-500/50 bg-rose-500/20 flex items-center justify-center animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.5)]">
                  <div className="w-2 h-2 rounded-full bg-rose-400" />
                </div>
                {/* Tooltip Label (Hidden until hovered) */}
                <div className="absolute top-full mt-1 opacity-0 group-hover:opacity-100 px-2 py-1 bg-black/80 backdrop-blur-md rounded border border-white/10 text-white text-[10px] font-bold tracking-widest uppercase shadow-lg transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {cluster.name.replace(' Hub', '')}
                </div>
              </div>
            </Marker>
          ))}

          {/* POPUPS FOR MORE DETAILS */}
          {selectedCluster && (
            <Popup
              longitude={selectedCluster.lon}
              latitude={selectedCluster.lat}
              anchor="bottom"
              onClose={() => setSelectedCluster(null)}
              closeOnClick={true}
              className="z-50"
              maxWidth="300px"
            >
              <div className="bg-[#111827] text-white p-4 rounded-xl shadow-2xl border border-gray-800 min-w-[220px]">
                <h3 className="text-white font-bold text-base mb-1">{selectedCluster.name}</h3>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    selectedCluster.risk === 'Critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                    selectedCluster.risk === 'High' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {selectedCluster.risk} Risk
                  </span>
                </div>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-1">
                    <span className="text-gray-400">Monitored Pop.</span>
                    <span className="font-bold text-white">{selectedCluster.pop}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-800 pb-1">
                    <span className="text-gray-400">Recent Anomalies</span>
                    <span className="font-bold text-rose-500">{selectedCluster.anomalies}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 mt-4">
                  <button 
                    onClick={() => setDispatchTarget(selectedCluster.name)}
                    className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-lg text-xs transition-colors"
                  >
                    <Ambulance className="w-4 h-4" />
                    Dispatch Agent
                  </button>
                  <Link href="/audit" className="w-full flex items-center justify-center bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-bold py-2 rounded-lg text-xs transition-colors">
                    View Detailed Audit
                  </Link>
                </div>
              </div>
            </Popup>
          )}
        </Map>

        {/* Floating Settings Button */}
        <div className="absolute top-6 right-6 z-50">
          <div className="relative">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center shadow-2xl transition-all"
            >
              <Settings2 className="w-5 h-5 text-gray-800 dark:text-white" />
            </button>
            
            {showSettings && (
              <div className="absolute top-14 right-0 w-48 bg-white/95 dark:bg-[#0b1021]/95 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-2 pt-1">Map Theme</p>
                <div className="flex flex-col gap-1">
                  <button 
                    onClick={() => { setMapTheme("light-v11"); setShowSettings(false); }}
                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${mapTheme === 'light-v11' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                  >
                    <Sun className="w-4 h-4" /> Light Mode
                  </button>
                  <button 
                    onClick={() => { setMapTheme("dark-v11"); setShowSettings(false); }}
                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${mapTheme === 'dark-v11' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                  >
                    <Moon className="w-4 h-4" /> Dark Mode
                  </button>
                  <button 
                    onClick={() => { setMapTheme("satellite-streets-v12"); setShowSettings(false); }}
                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${mapTheme === 'satellite-streets-v12' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                  >
                    <MapIcon className="w-4 h-4" /> Satellite
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right-Side Dispatch Panel */}
      {dispatchTarget && (
        <div className="absolute right-0 top-0 bottom-0 w-[400px] bg-white/90 backdrop-blur-xl shadow-2xl z-40 border-l border-white/20 p-6 flex flex-col animate-slide-left">
          <DispatchPanel targetId={dispatchTarget} onClose={() => setDispatchTarget(null)} />
        </div>
      )}

      {/* Floating UI Panel (Left Side) */}
      <div className="relative z-10 w-80 h-full p-6 flex flex-col pointer-events-none">
        
        {/* Header */}
        <div className={`backdrop-blur-2xl border rounded-2xl p-5 mb-6 shadow-2xl pointer-events-auto transition-colors ${mapTheme === 'light-v11' ? 'bg-white/80 border-gray-200' : 'bg-white/5 border-white/10'}`}>
          <h1 className={`text-xl font-display font-bold tracking-tight flex items-center gap-2 mb-1 ${mapTheme === 'light-v11' ? 'text-gray-900' : 'text-white'}`}>
            <Activity className="w-5 h-5 text-rose-500" />
            Geography
          </h1>
          <p className={`text-xs ${mapTheme === 'light-v11' ? 'text-rose-600/70' : 'text-rose-200/70'}`}>
            Real-time GNN epidemiological mapping
          </p>
        </div>

        {/* Dynamic Context Panel */}
        <div className={`mt-auto backdrop-blur-2xl border rounded-2xl p-5 shadow-2xl pointer-events-auto transition-colors ${mapTheme === 'light-v11' ? 'bg-white/80 border-gray-200' : 'bg-white/5 border-white/10'}`}>
          <div>
            <h3 className={`text-sm font-bold mb-2 flex items-center gap-2 ${mapTheme === 'light-v11' ? 'text-gray-900' : 'text-white'}`}>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              Hotspot Intelligence
            </h3>
            <p className={`text-xs leading-relaxed mb-4 ${mapTheme === 'light-v11' ? 'text-gray-600' : 'text-gray-400'}`}>
              This layer visualizes the concentration of high-risk users and recent vital anomalies. Bright red areas indicate a severe density of potential contagion spread, requiring immediate operator focus.
            </p>
            <div className={`flex items-center justify-between pt-4 border-t ${mapTheme === 'light-v11' ? 'border-gray-200' : 'border-white/10'}`}>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Active Clusters</p>
                <p className={`text-xl font-display font-bold ${mapTheme === 'light-v11' ? 'text-gray-900' : 'text-white'}`}>4</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">At-Risk Pop</p>
                <p className="text-xl font-display font-bold text-rose-400">~1.2k</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
