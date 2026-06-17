'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';

interface Node {
  user_id: string;
  risk_tier: string;
  is_superspreader: boolean;
}

interface Edge {
  source: string;
  target: string;
  weight: number;
  proximity?: string;
  rssi_avg?: number | null;
  shared_contacts?: number;
}

interface UserDetail {
  user_id: string;
  exposure_score: number;
  daily_exposure: number;
  close_contacts: number;
  active_days: number;
  anomaly_flag: number;
  anomaly_score: number;
  risk_tier: string;
  geo4?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface LLMResult {
  answer: string;
  highlight_nodes: string[];
  highlight_edges: { source: string; target: string }[];
  focus_note: string;
}

interface TooltipState {
  type: 'node' | 'edge';
  data: Record<string, any>;
  x: number;
  y: number;
}

interface NetworkGraphProps {
  nodes: Node[];
  edges: Edge[];
  users: UserDetail[];
  isLive: boolean;
  superspreaders: string[];
  r0_seed: string;
  r0_hop1: number;
  r0_hop2: number;
  spikedUsers?: Set<string>;
}

const TIER_COLOR: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH:     '#ea580c',
  MODERATE: '#eab308',
  LOW:      '#16a34a',
  UNKNOWN:  '#6b7280',
};

const PROX_EDGE_COLOR: Record<string, string> = {
  'very close': '#dc2626',
  'close':      '#f97316',
  'moderate':   '#94a3b8',
  'far':        '#cbd5e1',
};

const PROX_EDGE_WIDTH: Record<string, number> = {
  'very close': 4,
  'close':      2.5,
  'moderate':   1.5,
  'far':        1,
};

function rssiLabel(rssi: number | null | undefined): string {
  if (rssi == null) return '—';
  if (rssi > -50)  return `${rssi.toFixed(1)} dBm (< 1 m)`;
  if (rssi > -70)  return `${rssi.toFixed(1)} dBm (1–3 m)`;
  if (rssi > -85)  return `${rssi.toFixed(1)} dBm (3–10 m)`;
  return `${rssi.toFixed(1)} dBm (> 10 m)`;
}

function coordLabel(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toFixed(5);
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const SUGGESTED_QUESTIONS = [
  'Who is most likely to spread infection to others?',
  'What is the exposure risk in zone s179?',
  'Which users are connected to the superspreader?',
  'Show me the highest risk transmission chain.',
];

const CY_STYLE = [
  {
    selector: 'node',
    style: {
      'background-color':    'data(color)',
      'label':               'data(label)',
      'font-size':           '8px',
      'font-weight':         'bold',
      'text-valign':         'center',
      'text-halign':         'center',
      'color':               '#fff',
      'text-outline-width':  1.5,
      'text-outline-color':  '#00000060',
      'width':               'data(size)',
      'height':              'data(size)',
      'border-width':        'data(borderWidth)',
      'border-color':        'data(borderColor)',
      'cursor':              'pointer',
      'transition-property': 'opacity, border-width, border-color',
      'transition-duration': '150ms',
    },
  },
  {
    selector: 'edge',
    style: {
      'width':                'data(edgeWidth)',
      'line-color':           'data(edgeColor)',
      'opacity':              0.75,
      'curve-style':          'bezier',
      // Directed arrow — shows contact direction (source → target)
      'target-arrow-shape':   'triangle',
      'target-arrow-color':   'data(edgeColor)',
      'arrow-scale':          1.3,
      'transition-property':  'opacity, line-color, width',
      'transition-duration':  '150ms',
    },
  },
  { selector: 'node.highlighted', style: { 'border-color': '#3b82f6', 'border-width': 6, 'opacity': 1, 'z-index': 10 } },
  { selector: 'node.dimmed',      style: { 'opacity': 0.1 } },
  {
    selector: 'edge.highlighted',
    style: {
      'line-color':         '#3b82f6',
      'target-arrow-color': '#3b82f6',
      'width':              4,
      'opacity':            1,
      'z-index':            10,
    },
  },
  { selector: 'edge.dimmed',  style: { 'opacity': 0.04 } },
  { selector: 'node.hovered', style: { 'border-color': '#ffffff', 'border-width': 4, 'opacity': 1 } },
  {
    selector: 'edge.hovered',
    style: {
      'line-color':         '#1d4ed8',
      'target-arrow-color': '#1d4ed8',
      'width':              5,
      'opacity':            1,
      'arrow-scale':        1.6,
    },
  },
];

export function NetworkGraph({
  nodes, edges, users, isLive,
  superspreaders, r0_seed, r0_hop1, r0_hop2,
  spikedUsers,
}: NetworkGraphProps) {
  const cyRef              = useRef<any>(null);
  const containerRef       = useRef<HTMLDivElement>(null);
  const usersRef           = useRef(users);
  const superspreadsersRef = useRef(superspreaders);
  const prevSpikedRef      = useRef<Set<string>>(new Set());
  useEffect(() => { usersRef.current = users; },                    [users]);
  useEffect(() => { superspreadsersRef.current = superspreaders; }, [superspreaders]);

  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [question,     setQuestion]     = useState('');
  const [isQuerying,   setIsQuerying]   = useState(false);
  const [llmResult,    setLlmResult]    = useState<LLMResult | null>(null);
  const [queryError,   setQueryError]   = useState<string | null>(null);
  const [tooltip,      setTooltip]      = useState<TooltipState | null>(null);

  // ── Destroy Cytoscape only on component unmount ──────────────────────────────
  useEffect(() => {
    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, []);

  // ── Build node/edge data objects ─────────────────────────────────────────────
  const makeNodeData = useCallback((n: Node, deg: Record<string, number>) => ({
    id:               n.user_id,
    label:            n.user_id,
    risk_tier:        n.risk_tier,
    is_superspreader: n.is_superspreader,
    color:            TIER_COLOR[n.risk_tier] || TIER_COLOR.UNKNOWN,
    size:             Math.max(24, Math.min(52, 24 + (deg[n.user_id] || 0) * 3)),
    borderColor:      n.is_superspreader ? '#fbbf24' : 'rgba(255,255,255,0.6)',
    borderWidth:      n.is_superspreader ? 4 : 2,
  }), []);

  const makeEdgeData = useCallback((e: Edge) => {
    const prox = e.proximity || 'close';
    return {
      id:              `${e.source}__${e.target}`,
      source:          e.source,
      target:          e.target,
      weight:          e.weight,
      proximity:       prox,
      rssi_avg:        e.rssi_avg ?? null,
      shared_contacts: e.shared_contacts ?? 0,
      edgeWidth:       PROX_EDGE_WIDTH[prox] ?? 2,
      edgeColor:       PROX_EDGE_COLOR[prox] ?? '#94a3b8',
    };
  }, []);

  // ── Initialize graph (first time) or patch in-place (live updates) ───────────
  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;

    // Degree map for node sizing
    const degree: Record<string, number> = {};
    nodes.forEach((n) => { degree[n.user_id] = 0; });
    edges.forEach((e) => {
      degree[e.source] = (degree[e.source] || 0) + 1;
      degree[e.target] = (degree[e.target] || 0) + 1;
    });

    if (!cyRef.current) {
      // ── First load: create Cytoscape with layout ──────────────────────────
      import('cytoscape').then((mod) => {
        const cytoscape = mod.default;
        if (!containerRef.current || cyRef.current) return; // guard double-init

        const elements = [
          ...nodes.map((n) => ({ group: 'nodes' as const, data: makeNodeData(n, degree) })),
          ...edges.map((e) => ({ group: 'edges' as const, data: makeEdgeData(e) })),
        ];

        const cy = cytoscape({
          container: containerRef.current,
          elements,
          style: CY_STYLE as any,
          layout: {
            name:              'cose',
            animate:           true,
            animationDuration: 1200,
            fit:               true,
            padding:           30,
            nodeRepulsion:     () => 450000,
            idealEdgeLength:   () => 90,
            edgeElasticity:    () => 100,
            nestingFactor:     5,
            gravity:           80,
            numIter:           1000,
            initialTemp:       200,
            coolingFactor:     0.95,
            minTemp:           1.0,
            randomize:         false,
          },
        });

        // Click: pin detail card
        cy.on('tap', 'node', (evt: any) => {
          const id     = evt.target.data('id');
          const detail = usersRef.current.find((u) => u.user_id === id) || null;
          setSelectedUser(detail);
        });
        cy.on('tap', (evt: any) => {
          if (evt.target === cy) setSelectedUser(null);
        });

        // Node hover
        cy.on('mouseover', 'node', (evt: any) => {
          const domEvt = evt.originalEvent as MouseEvent | undefined;
          if (!domEvt) return;
          evt.target.addClass('hovered');
          const userId     = evt.target.data('id') as string;
          const userDetail = usersRef.current.find((u) => u.user_id === userId);
          setTooltip({
            type: 'node',
            data: {
              id:               userId,
              risk_tier:        evt.target.data('risk_tier'),
              is_superspreader: evt.target.data('is_superspreader'),
              ...(userDetail || {}),
            },
            x: domEvt.clientX + 16,
            y: domEvt.clientY - 10,
          });
        });
        cy.on('mouseout', 'node', (evt: any) => {
          evt.target.removeClass('hovered');
          setTooltip(null);
        });

        // Edge hover
        cy.on('mouseover', 'edge', (evt: any) => {
          const domEvt = evt.originalEvent as MouseEvent | undefined;
          if (!domEvt) return;
          evt.target.addClass('hovered');
          setTooltip({
            type: 'edge',
            data: {
              source:          evt.target.data('source'),
              target:          evt.target.data('target'),
              weight:          evt.target.data('weight'),
              proximity:       evt.target.data('proximity'),
              rssi_avg:        evt.target.data('rssi_avg'),
              shared_contacts: evt.target.data('shared_contacts'),
            },
            x: domEvt.clientX + 16,
            y: domEvt.clientY - 10,
          });
        });
        cy.on('mouseout', 'edge', (evt: any) => {
          evt.target.removeClass('hovered');
          setTooltip(null);
        });

        // Keep tooltip following cursor
        cy.on('mousemove', 'node, edge', (evt: any) => {
          const domEvt = evt.originalEvent as MouseEvent | undefined;
          if (!domEvt) return;
          setTooltip((prev) =>
            prev ? { ...prev, x: domEvt.clientX + 16, y: domEvt.clientY - 10 } : null
          );
        });

        cyRef.current = cy;
      });
    } else {
      // ── Live update: patch element data in-place — no relayout, no rezoom ──
      const cy = cyRef.current;

      const existingNodeIds = new Set<string>(cy.nodes().map((n: any) => n.id()));
      const existingEdgeIds = new Set<string>(cy.edges().map((e: any) => e.id()));
      const newNodeIds      = new Set(nodes.map((n) => n.user_id));
      const newEdgeIds      = new Set(edges.map((e) => `${e.source}__${e.target}`));

      cy.batch(() => {
        nodes.forEach((n) => {
          const data = makeNodeData(n, degree);
          if (existingNodeIds.has(n.user_id)) {
            cy.getElementById(n.user_id).data(data);
          } else {
            cy.add({ group: 'nodes', data });
          }
        });

        edges.forEach((e) => {
          const data = makeEdgeData(e);
          if (existingEdgeIds.has(data.id)) {
            cy.getElementById(data.id).data(data);
          } else {
            cy.add({ group: 'edges', data });
          }
        });

        // Remove nodes/edges that disappeared from the dataset
        cy.nodes().filter((n: any) => !newNodeIds.has(n.id())).remove();
        cy.edges().filter((e: any) => !newEdgeIds.has(e.id())).remove();
      });
    }
  }, [nodes, edges, makeNodeData, makeEdgeData]); // no cleanup here — handled by [] effect

  // ── Apply LLM highlights (zoom in once; user controls zoom-out) ──────────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.elements().removeClass('highlighted dimmed');
    if (!llmResult || llmResult.highlight_nodes.length === 0) return;

    cy.elements().addClass('dimmed');

    const highlighted = cy
      .nodes()
      .filter((n: any) => llmResult.highlight_nodes.includes(n.data('id')));

    highlighted.removeClass('dimmed').addClass('highlighted');

    llmResult.highlight_edges.forEach((e) => {
      cy.edges(`[source = "${e.source}"][target = "${e.target}"]`)
        .removeClass('dimmed').addClass('highlighted');
      cy.edges(`[source = "${e.target}"][target = "${e.source}"]`)
        .removeClass('dimmed').addClass('highlighted');
    });
    highlighted.connectedEdges().removeClass('dimmed').addClass('highlighted');

    // Zoom in once to show nodes of interest; user must manually zoom out
    if (highlighted.length > 0) {
      cy.animate({
        fit:      { eles: highlighted, padding: 80 },
        duration: 700,
        easing:   'ease-in-out',
      });
    }
  }, [llmResult]);

  // ── Vitals spike animation (node grows + flashes red) ───────────────────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !spikedUsers || spikedUsers.size === 0) return;

    // Only animate users who just appeared in the set
    const newlySpike = [...spikedUsers].filter((uid) => !prevSpikedRef.current.has(uid));
    prevSpikedRef.current = new Set(spikedUsers);

    newlySpike.forEach((userId) => {
      const node = cy.getElementById(userId);
      if (!node || node.length === 0) return;

      const origSize        = node.data('size')        ?? 28;
      const origColor       = node.data('color')       ?? '#16a34a';
      const origBorderColor = node.data('borderColor') ?? 'rgba(255,255,255,0.6)';
      const origBorderWidth = node.data('borderWidth') ?? 2;

      node
        .animate({
          style: {
            'background-color': '#ef4444',
            'border-color':     '#fbbf24',
            'width':            origSize * 1.9,
            'height':           origSize * 1.9,
            'border-width':     5,
          },
          duration: 380,
          easing:   'ease-out',
        })
        .animate({
          style: {
            'background-color': origColor,
            'border-color':     origBorderColor,
            'width':            origSize,
            'height':           origSize,
            'border-width':     origBorderWidth,
          },
          duration: 850,
          easing:   'ease-in',
        });
    });
  }, [spikedUsers]);

  const handleQuery = useCallback(async () => {
    if (!question.trim() || isQuerying) return;
    setIsQuerying(true);
    setQueryError(null);
    try {
      const anomalousNodes = nodes.filter(n => n.risk_tier === 'CRITICAL' || n.risk_tier === 'HIGH').map(n => n.user_id);
      const networkContext = {
        total_nodes: nodes.length,
        total_edges: edges.length,
        anomalous_nodes: anomalousNodes.slice(0, 50),
        top_connected_ids: superspreaders.slice(0, 10)
      };
      const { data } = await axios.post<LLMResult>(`${API}/api/network/query`, { question, context: networkContext });
      setLlmResult(data);
    } catch {
      setQueryError('Query failed — make sure the backend is running.');
    } finally {
      setIsQuerying(false);
    }
  }, [question, isQuerying, nodes, edges, superspreaders]);

  const resetHighlight = () => {
    setLlmResult(null);
    setQueryError(null);
    if (cyRef.current) {
      cyRef.current.elements().removeClass('highlighted dimmed hovered');
    }
  };

  // Manual fit-all button — user-controlled
  const fitAll = () => cyRef.current?.fit(undefined, 30);

  const criticalCount = nodes.filter((n) => n.risk_tier === 'CRITICAL').length;
  const highCount     = nodes.filter((n) => n.risk_tier === 'HIGH').length;

  const highlightedUsers = llmResult
    ? llmResult.highlight_nodes
        .map((id) => ({
          node:   nodes.find((n) => n.user_id === id),
          detail: users.find((u) => u.user_id === id),
          id,
        }))
        .filter((x) => x.node)
    : [];

  const highlightedSet = new Set(llmResult?.highlight_nodes ?? []);
  const interestEdges  = edges.filter(
    (e) => highlightedSet.has(e.source) && highlightedSet.has(e.target)
  );

  return (
    <div className="space-y-4">

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.type === 'node' ? (
            <NodeTooltip data={tooltip.data} superspreaders={superspreaders} />
          ) : (
            <EdgeTooltip data={tooltip.data} />
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Interactive Contact Network</h3>
          <p className="text-sm text-gray-500">
            Hover nodes/edges for metrics · Click to pin detail · Ask AI to highlight a subgraph
          </p>
        </div>
        {isLive ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-red-600">LIVE — simulation running</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full" />
            <span className="text-xs font-medium text-gray-500">SNAPSHOT</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">

        {/* Graph canvas */}
        <div className="xl:col-span-2 space-y-2">
          <div
            className="premium-card overflow-hidden"
            style={{ height: 520 }}
          >
            {nodes.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No network data loaded yet
              </div>
            ) : (
              <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
            )}
          </div>

          {/* Legend + controls */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              {Object.entries(TIER_COLOR)
                .filter(([k]) => k !== 'UNKNOWN')
                .map(([tier, color]) => (
                  <div key={tier} className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                    <span className="text-xs text-gray-500 font-medium">{tier}</span>
                  </div>
                ))}
              <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
                <div className="w-3 h-3 rounded-full border-2 border-yellow-400" style={{ backgroundColor: '#dc2626' }} />
                <span className="text-xs text-gray-500 font-medium">Superspreader</span>
              </div>
              <div className="flex items-center gap-2 border-l border-gray-200 pl-2">
                {Object.entries(PROX_EDGE_COLOR).map(([prox, color]) => (
                  <div key={prox} className="flex items-center gap-1">
                    <svg width="20" height="10" className="flex-shrink-0">
                      <line x1="0" y1="5" x2="14" y2="5" stroke={color} strokeWidth="2" />
                      <polygon points="14,2 20,5 14,8" fill={color} />
                    </svg>
                    <span className="text-[10px] text-gray-500">{prox}</span>
                  </div>
                ))}
                <span className="text-[10px] text-gray-400 border-l border-gray-200 pl-2">
                  Arrow = contact direction
                </span>
              </div>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                onClick={resetHighlight}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Reset
              </button>
              <button
                onClick={fitAll}
                className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors border border-blue-200"
              >
                Fit All
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Users',     value: nodes.length,  color: 'text-gray-900'   },
              { label: 'Contacts',  value: edges.length,  color: 'text-gray-900'   },
              { label: 'Critical',  value: criticalCount, color: 'text-red-700'    },
              { label: 'High Risk', value: highCount,     color: 'text-orange-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="premium-card p-4 text-center">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-gray-500 font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-3">

          {/* Transmission chain */}
          <div className="premium-card p-5">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Transmission Chain</h4>
            <div className="grid grid-cols-2 gap-2 text-center">
              {[
                { label: 'Seed User',      value: r0_seed || '—',        color: 'text-red-700',    bg: 'bg-red-50 border-red-100'       },
                { label: 'Superspreaders', value: superspreaders.length, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-100' },
                { label: 'Hop-1 Reach',    value: r0_hop1,               color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-100'   },
                { label: 'Hop-2 Reach',    value: r0_hop2,               color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-100' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`rounded-lg p-2 border ${bg}`}>
                  <div className={`text-lg font-bold ${color}`}>{value}</div>
                  <div className="text-[10px] text-gray-500 font-medium">{label}</div>
                </div>
              ))}
            </div>
            {superspreaders.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {superspreaders.map((s) => (
                  <span key={s} className="font-mono text-xs bg-yellow-50 border border-yellow-300 text-yellow-800 px-1.5 py-0.5 rounded">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* LLM query */}
          <div className="premium-card p-5 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="relative z-10">
              <h4 className="text-xs font-bold text-gray-900 flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Sentinel Mesh AI
              </h4>
              <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
                Highlight subgraphs, find patterns, or query specific users across the entire network.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuestion(q)}
                    className="text-[10px] px-2.5 py-1 bg-white hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 text-gray-600 hover:text-indigo-700 rounded-full transition-all shadow-sm hover:shadow"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuery(); }
                }}
                placeholder="Ask about exposure risk, contacts, zones…"
                className="w-full text-xs border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-gray-800 placeholder-gray-400 bg-white/50 backdrop-blur-sm shadow-inner transition-all"
                rows={3}
              />
              <button
                onClick={handleQuery}
                disabled={isQuerying || !question.trim()}
                className="mt-3 w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 disabled:from-gray-300 disabled:to-gray-300 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg disabled:shadow-none transition-all flex items-center justify-center gap-2"
              >
                {isQuerying ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing network topology…
                  </>
                ) : (
                  <>
                    Run Intelligence Query
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
              {queryError && <p className="mt-2 text-xs text-red-500 font-medium">{queryError}</p>}
            </div>
          </div>

          {/* LLM answer + nodes of interest */}
          {llmResult && (
            <>
              <div className="premium-card bg-indigo-50/50 border-indigo-200 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-blue-900">AI Analysis</span>
                </div>
                <p className="text-xs text-blue-900 leading-relaxed">{llmResult.answer}</p>
                {llmResult.focus_note && (
                  <p className="text-xs text-blue-600 mt-2 italic">{llmResult.focus_note}</p>
                )}
              </div>

              {highlightedUsers.length > 0 && (
                <div className="premium-card border-indigo-200 p-5 space-y-4">
                  <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                    Nodes of Interest ({highlightedUsers.length})
                  </h4>

                  <div className="space-y-2">
                    {highlightedUsers.map(({ node, detail, id }) => {
                      const isSS = superspreaders.includes(id);
                      const tier = node?.risk_tier || detail?.risk_tier || 'UNKNOWN';
                      return (
                        <div
                          key={id}
                          className="border border-gray-200 rounded-lg p-3 bg-gray-50 cursor-pointer hover:border-blue-300 transition-colors"
                          onClick={() => {
                            setSelectedUser(detail || null);
                            cyRef.current?.getElementById(id)?.select();
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono font-bold text-gray-900 text-sm">{id}</span>
                            <div className="flex gap-1">
                              {isSS && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-yellow-100 border border-yellow-300 text-yellow-800">
                                  SUPERSPREADER
                                </span>
                              )}
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded font-bold text-white"
                                style={{ backgroundColor: TIER_COLOR[tier] || TIER_COLOR.UNKNOWN }}
                              >
                                {tier}
                              </span>
                            </div>
                          </div>

                          {detail ? (
                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                              {[
                                ['Daily Exp.',  (detail.daily_exposure  ?? 0).toFixed(1)],
                                ['Exp. Score',  (detail.exposure_score  ?? 0).toFixed(1)],
                                ['Contacts',    detail.close_contacts   ?? '—'],
                                ['Active Days', detail.active_days      ?? '—'],
                                ['Anomaly',     detail.anomaly_flag === -1 ? '⚠ YES' : 'No'],
                                ['Zone',        detail.geo4             || '—'],
                                ['Lat',         coordLabel(detail.latitude)],
                                ['Lon',         coordLabel(detail.longitude)],
                              ].map(([k, v]) => (
                                <div key={String(k)} className="bg-white rounded p-1 border border-gray-100">
                                  <div className="text-gray-400">{k}</div>
                                  <div className={`font-semibold ${k === 'Anomaly' && v === '⚠ YES' ? 'text-red-600' : 'text-gray-800'}`}>
                                    {String(v)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-gray-400">No profile data available</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {interestEdges.length > 0 && (
                    <div>
                      <h5 className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">
                        Contact Edges ({interestEdges.length})
                      </h5>
                      <div className="space-y-1">
                        {interestEdges.map((e) => {
                          const prox  = e.proximity || 'close';
                          const color = PROX_EDGE_COLOR[prox] || '#94a3b8';
                          return (
                            <div
                              key={`${e.source}--${e.target}`}
                              className="bg-gray-50 border border-gray-200 rounded p-2 text-[10px]"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono font-bold text-gray-800">
                                  {e.source} → {e.target}
                                </span>
                                <span
                                  className="px-1.5 py-0.5 rounded font-bold text-white text-[9px]"
                                  style={{ backgroundColor: color }}
                                >
                                  {prox.toUpperCase()}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-1">
                                <div>
                                  <div className="text-gray-400">RSSI</div>
                                  <div className="font-semibold text-gray-700">
                                    {e.rssi_avg != null ? `${e.rssi_avg.toFixed(1)} dBm` : '—'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-400">Detections</div>
                                  <div className="font-semibold text-gray-700">{e.weight}</div>
                                </div>
                                <div>
                                  <div className="text-gray-400">Shared</div>
                                  <div className="font-semibold text-gray-700">{e.shared_contacts ?? '—'}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Clicked node detail */}
          {selectedUser && (
            <div className="premium-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono font-bold text-gray-900">{selectedUser.user_id}</span>
                <div className="flex gap-1">
                  {superspreaders.includes(selectedUser.user_id) && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-yellow-100 border border-yellow-300 text-yellow-800">
                      SUPERSPREADER
                    </span>
                  )}
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold text-white"
                    style={{ backgroundColor: TIER_COLOR[selectedUser.risk_tier] || TIER_COLOR.UNKNOWN }}
                  >
                    {selectedUser.risk_tier}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  ['Daily Exp.',   (selectedUser.daily_exposure  ?? 0).toFixed(1)],
                  ['Exp. Score',   (selectedUser.exposure_score  ?? 0).toFixed(1)],
                  ['Contacts',     selectedUser.close_contacts   ?? '—'],
                  ['Active Days',  selectedUser.active_days      ?? '—'],
                  ['Anomaly Sc.',  (selectedUser.anomaly_score   ?? 0).toFixed(4)],
                  ['Zone',         selectedUser.geo4             || '—'],
                  ['Latitude',     coordLabel(selectedUser.latitude)],
                  ['Longitude',    coordLabel(selectedUser.longitude)],
                ].map(([k, v]) => (
                  <div key={String(k)} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                    <div className="text-[10px] text-gray-500">{k}</div>
                    <div className="text-xs font-semibold text-gray-900">{String(v)}</div>
                  </div>
                ))}
              </div>
              <div className={`mt-2 text-xs font-semibold text-center py-1 rounded ${
                selectedUser.anomaly_flag === -1
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {selectedUser.anomaly_flag === -1 ? 'ANOMALY DETECTED' : 'No anomaly'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tooltip sub-components ─────────────────────────────────────────────────────

function NodeTooltip({ data, superspreaders }: { data: Record<string, any>; superspreaders: string[] }) {
  const tier  = data.risk_tier || 'UNKNOWN';
  const color = TIER_COLOR[tier] || TIER_COLOR.UNKNOWN;
  const isSS  = superspreaders.includes(data.id) || data.is_superspreader;
  return (
    <div className="premium-card p-4 min-w-[200px] max-w-[240px]">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono font-bold text-gray-900 text-sm">{data.id}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold text-white" style={{ backgroundColor: color }}>
          {tier}
        </span>
      </div>
      {isSS && (
        <div className="text-[10px] font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.5 mb-2">
          SUPERSPREADER
        </div>
      )}
      <div className="space-y-1 text-[11px]">
        {data.daily_exposure != null && (
          <Row label="Daily Exposure" value={(+data.daily_exposure).toFixed(1)} />
        )}
        {data.exposure_score != null && (
          <Row label="Exposure Score" value={(+data.exposure_score).toFixed(1)} />
        )}
        {data.close_contacts != null && (
          <Row label="Close Contacts" value={data.close_contacts} />
        )}
        {data.geo4 && (
          <Row label="Zone" value={data.geo4} mono />
        )}
        {data.latitude != null && (
          <Row label="Latitude" value={(+data.latitude).toFixed(5)} mono />
        )}
        {data.longitude != null && (
          <Row label="Longitude" value={(+data.longitude).toFixed(5)} mono />
        )}
        {data.anomaly_flag != null && (
          <Row
            label="Anomaly"
            value={data.anomaly_flag === -1 ? '⚠ DETECTED' : 'None'}
            highlight={data.anomaly_flag === -1}
          />
        )}
      </div>
    </div>
  );
}

function EdgeTooltip({ data }: { data: Record<string, any> }) {
  const prox  = data.proximity || 'close';
  const color = PROX_EDGE_COLOR[prox] || '#94a3b8';
  return (
    <div className="premium-card p-4 min-w-[200px]">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[11px] font-bold text-gray-900">
          {data.source} → {data.target}
        </span>
      </div>
      <div
        className="text-[10px] font-bold text-white rounded px-1.5 py-0.5 mb-2 inline-block"
        style={{ backgroundColor: color }}
      >
        {prox.toUpperCase()}
      </div>
      <div className="space-y-1 text-[11px]">
        <Row label="RSSI Signal"     value={rssiLabel(data.rssi_avg)} />
        <Row label="Detections"      value={data.weight ?? '—'} />
        <Row label="Shared contacts" value={data.shared_contacts ?? '—'} />
      </div>
      <div className="mt-2 text-[9px] text-gray-400">
        Arrow shows direction of contact · RSSI closer to 0 = physically closer
      </div>
    </div>
  );
}

function Row({
  label, value, mono = false, highlight = false,
}: {
  label: string; value: any; mono?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold ${highlight ? 'text-red-600' : 'text-gray-900'} ${mono ? 'font-mono' : ''}`}>
        {String(value)}
      </span>
    </div>
  );
}
