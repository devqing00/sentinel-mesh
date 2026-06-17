'use client';

import { useEffect, useRef, useState } from 'react';

interface Node {
  user_id: string;
  risk_tier: string;
  latitude: number | null;
  longitude: number | null;
}

interface Edge {
  source: string;
  target: string;
  weight: number;
}

interface NetworkGraphDensityProps {
  nodes: Node[];
  edges: Edge[];
  isLive: boolean;
}

interface Position {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function NetworkGraphDensity({
  nodes,
  edges,
  isLive,
}: NetworkGraphDensityProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const positionsRef = useRef<Map<string, Position>>(new Map());

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Initialize positions
    if (positionsRef.current.size === 0) {
      nodes.forEach((node) => {
        positionsRef.current.set(node.user_id, {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: 0,
          vy: 0,
        });
      });
    }

    const positions = positionsRef.current;
    const K = 100; // Ideal spring length
    const G = 0.5; // Gravity
    const D = 0.85; // Damping
    const repulsionStrength = 500;
    const attractionStrength = 0.1;

    // Simulation loop
    let animationId: number;
    const animate = () => {
      // Clear canvas
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Apply forces
      nodes.forEach((node) => {
        const pos = positions.get(node.user_id);
        if (!pos) return;

        // Gravity to center
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const dx = centerX - pos.x;
        const dy = centerY - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          pos.vx += (dx / dist) * G;
          pos.vy += (dy / dist) * G;
        }

        // Repulsion from other nodes
        nodes.forEach((otherNode) => {
          if (otherNode.user_id === node.user_id) return;
          const otherPos = positions.get(otherNode.user_id);
          if (!otherPos) return;

          const dx = pos.x - otherPos.x;
          const dy = pos.y - otherPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const repulsion = repulsionStrength / (dist * dist);
          pos.vx += (dx / dist) * repulsion;
          pos.vy += (dy / dist) * repulsion;
        });

        // Attraction along edges
        edges.forEach((edge) => {
          if (edge.source !== node.user_id && edge.target !== node.user_id)
            return;
          const otherNodeId =
            edge.source === node.user_id ? edge.target : edge.source;
          const otherPos = positions.get(otherNodeId);
          if (!otherPos) return;

          const dx = otherPos.x - pos.x;
          const dy = otherPos.y - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const attraction =
            ((dist - K) / dist) * attractionStrength * Math.log((edge.weight ?? 1) + 1);
          pos.vx += dx * attraction;
          pos.vy += dy * attraction;
        });

        // Apply velocity
        pos.vx *= D;
        pos.vy *= D;
        pos.x += pos.vx;
        pos.y += pos.vy;

        // Boundary conditions
        pos.x = Math.max(20, Math.min(canvas.width - 20, pos.x));
        pos.y = Math.max(20, Math.min(canvas.height - 20, pos.y));
      });

      // Draw edges
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      edges.forEach((edge) => {
        const sourcePos = positions.get(edge.source);
        const targetPos = positions.get(edge.target);
        if (sourcePos && targetPos) {
          ctx.beginPath();
          ctx.moveTo(sourcePos.x, sourcePos.y);
          ctx.lineTo(targetPos.x, targetPos.y);
          ctx.stroke();
          
          // Draw interaction count label
          const midX = (sourcePos.x + targetPos.x) / 2;
          const midY = (sourcePos.y + targetPos.y) / 2;
          ctx.fillStyle = '#9ca3af';
          ctx.font = '10px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText((edge.weight ?? 1).toString(), midX, midY - 5);
        }
      });

      // Draw nodes
      nodes.forEach((node) => {
        const pos = positions.get(node.user_id);
        if (!pos) return;

        const tierColor =
          node.risk_tier === 'CRITICAL'
            ? '#dc2626'
            : node.risk_tier === 'HIGH'
              ? '#ea580c'
              : node.risk_tier === 'MODERATE'
                ? '#eab308'
                : '#16a34a';

        const nodeSize =
          node.risk_tier === 'CRITICAL'
            ? 8
            : node.risk_tier === 'HIGH'
              ? 7
              : node.risk_tier === 'MODERATE'
                ? 6
                : 5;

        ctx.fillStyle = tierColor;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeSize, 0, Math.PI * 2);
        ctx.fill();

        // Highlight on hover
        if (hoveredNode === node.user_id) {
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Label
          ctx.fillStyle = '#111827';
          ctx.font = 'bold 12px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(node.user_id, pos.x, pos.y - nodeSize - 10);
        }
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let found = null;
      nodes.forEach((node) => {
        const pos = positions.get(node.user_id);
        if (!pos) return;
        const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        if (dist < 15) found = node.user_id;
      });
      setHoveredNode(found);
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [nodes, edges, hoveredNode]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            User Interaction Network
          </h3>
          <p className="text-sm text-gray-700">
            Force-directed graph showing user-to-user interactions
          </p>
        </div>
        {isLive && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-green-600">Live</span>
          </div>
        )}
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-96 rounded-lg border-2 border-gray-200 shadow-md bg-white cursor-pointer"
      />

      <div className="grid grid-cols-4 gap-2">
        <div className="p-2 bg-red-50 rounded border border-red-200">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-600 rounded-full"></div>
            <span className="text-xs font-medium text-red-900">Critical</span>
          </div>
        </div>
        <div className="p-2 bg-orange-50 rounded border border-orange-200">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
            <span className="text-xs font-medium text-orange-900">High</span>
          </div>
        </div>
        <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-xs font-medium text-yellow-900">Moderate</span>
          </div>
        </div>
        <div className="p-2 bg-green-50 rounded border border-green-200">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-600 rounded-full"></div>
            <span className="text-xs font-medium text-green-900">Low</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-700">
            <span className="font-semibold">Total Users:</span> {nodes.length}
          </p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-700">
            <span className="font-semibold">Interactions:</span> {edges.length}
          </p>
        </div>
      </div>
    </div>
  );
}
