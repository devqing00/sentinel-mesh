"use client";

import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { getContactGraph } from "@/lib/api";
import { Loader2, RadioTower, Users, Wifi, LayoutDashboard, ShieldAlert, Activity, Crosshair, Zap, CheckCircle } from "lucide-react";
import { toast } from "react-hot-toast";

import { useRouter } from "next/navigation";

// Dynamically import react-force-graph-2d to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface GraphNode {
  id: string;
  anomaly: boolean;
  type: string;
  connections: number;
  centrality: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    total_nodes: number;
    total_edges: number;
    anomalous_count: number;
    displayed_nodes: number;
    displayed_edges: number;
  };
}

export default function NetworkPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[], links: GraphEdge[] }>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const router = useRouter();
  
  // Use SWR for real-time auto-polling every 5 seconds
  const { data: res, error, isLoading: loading } = useSWR(
    "/api/network/graph",
    async () => {
      const response = await getContactGraph();
      return response.data as GraphData;
    },
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight || 500,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Sync incoming SWR data into GraphData without destroying physics references
  useEffect(() => {
    if (!res) return;

    setGraphData(prev => {
      const prevNodesMap = new Map(prev.nodes.map(n => [n.id, n]));
      
      const mergedNodes = res.nodes.map(incomingNode => {
        const existingNode = prevNodesMap.get(incomingNode.id);
        if (existingNode) {
          // Mutate existing object to preserve physics properties (x, y, vx, vy)
          existingNode.anomaly = incomingNode.anomaly;
          existingNode.connections = incomingNode.connections;
          existingNode.centrality = incomingNode.centrality;
          return existingNode;
        }
        return { ...incomingNode };
      });

      // Links can usually be replaced, but mapping to objects is safer
      const mergedLinks = res.edges.map(incomingEdge => ({
        ...incomingEdge
      }));

      return { nodes: mergedNodes, links: mergedLinks };
    });

    // If selected node was updated, refresh its state
    if (selectedNode) {
      const updatedSelection = res.nodes.find(n => n.id === selectedNode.id);
      if (updatedSelection) {
        setSelectedNode(prev => {
          if (!prev) return null;
          return { ...prev, anomaly: updatedSelection.anomaly, connections: updatedSelection.connections, centrality: updatedSelection.centrality };
        });
      }
    }
  }, [res]);

  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      fgRef.current.d3Force('charge').strength(-400);
      fgRef.current.d3Force('link').distance(60);
    }
  }, [graphData.nodes.length]);

  const handleNodeClick = (node: any) => {
    setSelectedNode(node);
    if (fgRef.current) {
      // Auto-center camera on selected node
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(3, 1000);
    }
  };

  const handleAction = (actionName: string) => {
    if (!selectedNode) return;
    toast.success(`${actionName} command deployed for ${selectedNode.id}`, {
      icon: '✅',
      style: {
        borderRadius: '10px',
        background: '#333',
        color: '#fff',
      },
    });
  };

  const anomalousNodes = graphData.nodes.filter(n => n.anomaly).sort((a, b) => b.connections - a.connections);

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {/* Premium Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border/40 rounded-tl-[1.5rem]">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-display font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <RadioTower className="w-5 h-5 text-blue-500" />
              Network Radar & Command Center
            </h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 shadow-sm text-xs font-bold text-blue-600">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Live Sync
          </div>
        </div>
      </header>

      <div className="flex-1 px-8 py-8 flex gap-6 overflow-hidden">
        
        {/* Left: Graph Canvas & Timeline */}
        <div className="flex-[2] flex flex-col gap-6 h-full overflow-hidden">
          
          {/* Stats */}
          {res?.stats && (
            <div className="grid grid-cols-4 gap-4 shrink-0">
              {[
                { icon: Users, label: "Nodes", value: res.stats.total_nodes.toLocaleString(), bg: "from-blue-500 to-indigo-600", shadow: "shadow-blue-500/30" },
                { icon: Wifi, label: "Edges", value: res.stats.total_edges.toLocaleString(), bg: "from-cyan-400 to-blue-500", shadow: "shadow-cyan-500/30" },
                { icon: ShieldAlert, label: "Anomalous", value: res.stats.anomalous_count, bg: "from-rose-500 to-red-600", shadow: "shadow-red-500/30", pulse: true },
                { icon: LayoutDashboard, label: "Displayed", value: res.stats.displayed_nodes, bg: "from-emerald-400 to-teal-500", shadow: "shadow-emerald-500/30" },
              ].map(({ icon: Icon, label, value, bg, shadow, pulse }) => (
                <div key={label} className="premium-card p-4 relative overflow-hidden group">
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
                      <p className="text-2xl font-display font-extrabold text-gray-900">
                        {value}
                      </p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${bg} flex items-center justify-center text-white shadow-md ${shadow}`}>
                      <Icon className={`w-5 h-5 ${pulse ? 'animate-pulse' : ''}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Dark Radar Canvas */}
          <div className="flex-1 premium-card shadow-2xl overflow-hidden relative border-0 ring-1 ring-gray-200/50 rounded-[1.5rem]">
            <div className="absolute inset-0 bg-[#0b1021]" />
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
            
            <div className="flex-1 relative z-10 w-full h-full" ref={containerRef}>
              {loading && graphData.nodes.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <RadioTower className="w-6 h-6 text-blue-500 animate-pulse" />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <ForceGraph2D
                    ref={fgRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    graphData={graphData}
                    nodeRelSize={5}
                    nodeColor={(node: any) => node.anomaly ? "#FF1A1A" : node.type === "user" ? "#00f0ff" : "#00ffcc"}
                    nodeVal={(node: any) => {
                      const isSelected = selectedNode?.id === node.id;
                      const baseSize = node.anomaly ? 4 : node.type === "user" ? 1.5 : 1;
                      return isSelected ? baseSize * 2 : baseSize;
                    }}
                    linkColor={() => "rgba(255, 255, 255, 0.08)"}
                    linkWidth={(link: any) => Math.max(0.5, Math.min(link.weight * 0.1, 2))}
                    backgroundColor="transparent"
                    onNodeClick={handleNodeClick}
                    nodeCanvasObjectMode={(node: any) => {
                      const isSelected = selectedNode?.id === node.id;
                      return isSelected ? "replace" : "after";
                    }}
                    nodePointerAreaPaint={(node: any, color, ctx) => {
                      let size = node.anomaly ? 12 : node.type === "user" ? 8 : 6; // Bigger hit area
                      ctx.fillStyle = color;
                      ctx.beginPath();
                      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
                      ctx.fill();
                    }}
                    nodeCanvasObject={(node: any, ctx, globalScale) => {
                      const isSelected = selectedNode?.id === node.id;
                      let size = node.anomaly ? 10 : node.type === "user" ? 3 : 2;
                      
                      if (isSelected) {
                        size *= 1.5; // Make selected node larger
                        // Draw selection ring
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, size + 8, 0, 2 * Math.PI, false);
                        ctx.strokeStyle = "#ffffff";
                        ctx.lineWidth = 2 / globalScale;
                        ctx.setLineDash([4 / globalScale, 4 / globalScale]);
                        ctx.stroke();
                        ctx.setLineDash([]);
                      }

                      if (node.anomaly) {
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, size + 6, 0, 2 * Math.PI, false);
                        ctx.fillStyle = "rgba(255, 26, 26, 0.4)";
                        ctx.fill();

                        ctx.beginPath();
                        ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI, false);
                        ctx.fillStyle = "#FF1A1A";
                        ctx.shadowBlur = 40;
                        ctx.shadowColor = "#FF1A1A";
                        ctx.fill();

                        ctx.beginPath();
                        ctx.arc(node.x, node.y, size * 0.4, 0, 2 * Math.PI, false);
                        ctx.fillStyle = "#FFFFFF";
                        ctx.shadowBlur = 0;
                        ctx.fill();
                      } else {
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
                        ctx.fillStyle = node.type === "user" ? "#00f0ff" : "#00ffcc";
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = ctx.fillStyle;
                        ctx.fill();
                      }

                      if ((node.anomaly || isSelected) && globalScale >= 1.2) {
                        const label = node.id;
                        const fontSize = (isSelected ? 16 : 12) / globalScale;
                        ctx.font = `bold ${fontSize}px Outfit, sans-serif`;
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillStyle = "white";
                        ctx.shadowBlur = 4;
                        ctx.shadowColor = "#000";
                        ctx.fillText(label, node.x, node.y - size - (4/globalScale));
                      }
                    }}
                  />
                  
                  {/* Legend Overlay */}
                  <div className="absolute bottom-6 left-6 flex flex-col gap-3 bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/20 shadow-2xl pointer-events-none">
                    <h4 className="text-white/90 text-xs font-bold uppercase tracking-widest mb-1">Radar Legend</h4>
                    <div className="flex items-center gap-3">
                      <div className="relative flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-[#FF1A1A] shadow-[0_0_20px_#FF1A1A] flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                        <div className="absolute w-8 h-8 rounded-full border-2 border-[#FF1A1A] animate-ping opacity-60" />
                      </div>
                      <span className="text-white text-sm font-medium">Critical Anomaly</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
                      <span className="text-white/80 text-sm font-medium">Active Operator</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#00ffcc] shadow-[0_0_6px_#00ffcc]" />
                      <span className="text-white/80 text-sm font-medium">IoT Node</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Node Command Center */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden max-w-sm shrink-0">
          
          {/* Target Action Panel */}
          <div className="premium-card rounded-[1.5rem] p-6 shadow-xl flex-1 flex flex-col relative overflow-hidden bg-white/90">
            {selectedNode ? (
              <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 pb-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`p-3 rounded-xl shadow-inner ${selectedNode.anomaly ? 'bg-red-100 text-red-600 shadow-red-200' : 'bg-blue-100 text-blue-600 shadow-blue-200'}`}>
                    <Crosshair className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-2xl text-gray-900 leading-none mb-1">
                      {selectedNode.id}
                    </h3>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">
                      {selectedNode.type === "user" ? "Operator Node" : "IoT Device"}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="text-sm text-gray-600 font-medium">Status</span>
                    {selectedNode.anomaly ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-100 px-3 py-1 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        CRITICAL ANOMALY
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        SECURE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="text-sm text-gray-600 font-medium">Direct Contacts</span>
                    <span className="font-mono font-bold text-gray-900">{selectedNode.connections}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="text-sm text-gray-600 font-medium">Centrality Score</span>
                    <span className="font-mono font-bold text-gray-900">{selectedNode.centrality.toFixed(4)}</span>
                  </div>
                </div>

                <div className="mt-auto space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Deploy Solutions</p>
                  <button 
                    onClick={() => handleAction("Diagnostic Ping")}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-lg shadow-gray-900/20"
                  >
                    <Activity className="w-4 h-4" />
                    Run Deep Diagnostics
                  </button>
                  <button 
                    onClick={() => router.push('/geography')}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                  >
                    <Users className="w-4 h-4" />
                    Dispatch Medic Team
                  </button>
                  {selectedNode.anomaly && (
                    <button 
                      onClick={() => handleAction("Network Isolation")}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                    >
                      <Zap className="w-4 h-4" />
                      Isolate Node
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
                <Crosshair className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="font-display font-bold text-gray-900 mb-1">No Target Selected</h3>
                <p className="text-sm text-gray-500 px-4">Click any node on the radar to view telemetry and deploy solutions.</p>
              </div>
            )}
          </div>

          {/* Critical Targets List */}
          <div className="premium-card rounded-[1.5rem] p-6 shadow-xl flex-1 flex flex-col overflow-hidden bg-white/90">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              <h3 className="font-display font-bold text-gray-900">Critical Targets</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-200">
              {anomalousNodes.length > 0 ? (
                anomalousNodes.map(node => (
                  <button
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    className={`w-full text-left flex items-center justify-between p-3 rounded-xl border transition-all ${
                      selectedNode?.id === node.id 
                        ? 'border-red-500 bg-red-50 ring-2 ring-red-500/20' 
                        : 'border-gray-100 bg-gray-50 hover:border-red-200 hover:bg-red-50/50'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        {node.id}
                        {selectedNode?.id === node.id && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      </p>
                      <p className="text-xs text-gray-500">{node.connections} Contacts</p>
                    </div>
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                  No critical anomalies detected in the current mesh slice.
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
