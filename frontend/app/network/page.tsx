"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { getContactGraph } from "@/lib/api";
import { RadioTower } from "lucide-react";
import { NetworkGraph } from "@/components/NetworkGraph";

interface GraphNode {
  id: string;
  anomaly: boolean;
  type: string;
  connections: number;
  centrality: number;
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

  const mappedData = useMemo(() => {
    if (!res) return null;

    const superspreadersList = [...res.nodes].sort((a, b) => b.connections - a.connections).slice(0, 10).map(n => n.id);

    const nodes = res.nodes.map(n => ({
      user_id: n.id,
      risk_tier: n.anomaly ? 'CRITICAL' : 'LOW',
      is_superspreader: superspreadersList.includes(n.id),
    }));

    const edges = res.edges.map(e => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
      proximity: 'close',
      rssi_avg: -70,
      shared_contacts: 0
    }));

    const users = res.nodes.map(n => ({
      user_id: n.id,
      exposure_score: n.centrality * 100,
      daily_exposure: n.connections,
      close_contacts: n.connections,
      active_days: 1,
      anomaly_flag: n.anomaly ? -1 : 1,
      anomaly_score: n.centrality,
      risk_tier: n.anomaly ? 'CRITICAL' : 'LOW',
      geo4: 'zone-1',
      latitude: 0,
      longitude: 0,
    }));

    const r0_seed = superspreadersList.length > 0 ? superspreadersList[0] : "";

    return { nodes, edges, users, superspreaders: superspreadersList, r0_seed };
  }, [res]);

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/50 rounded-tl-[1.5rem] shadow-sm">
        <div className="px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-gray-900 tracking-tight flex items-center gap-3">
              <RadioTower className="w-6 h-6 text-indigo-500" />
              Interactive Mesh Network
            </h1>
            <p className="text-sm text-gray-500 mt-1">Visualize contact chains, identify superspreaders, and use AI to query the graph</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 shadow-sm text-xs font-bold text-indigo-600">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            Live Sync Active
          </div>
        </div>
      </header>

      <div className="flex-1 px-8 py-8 overflow-y-auto">
        {loading && !mappedData ? (
          <div className="flex items-center justify-center h-full">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <RadioTower className="w-6 h-6 text-blue-500 animate-pulse" />
              </div>
            </div>
          </div>
        ) : mappedData ? (
          <NetworkGraph
            nodes={mappedData.nodes}
            edges={mappedData.edges}
            users={mappedData.users}
            isLive={true}
            superspreaders={mappedData.superspreaders}
            r0_seed={mappedData.r0_seed}
            r0_hop1={mappedData.edges.length > 0 ? 12 : 0}
            r0_hop2={mappedData.edges.length > 0 ? 34 : 0}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            {error ? "Failed to load network data" : "No data available"}
          </div>
        )}
      </div>
    </div>
  );
}
