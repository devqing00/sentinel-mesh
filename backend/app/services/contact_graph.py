from collections import defaultdict
from datetime import datetime, timezone
import networkx as nx
from app.services.risk_scoring import get_dataframes
import pandas as pd
import os

_graph_cache = {}

async def generate_contact_graph(end_date: str = None):
    """
    Build a real contact network graph from CSV using Pandas:
    - Nodes: user_ids and device_ids
    - Edges: user detected device, weighted by frequency
    """
    global _graph_cache
    now = datetime.now(timezone.utc)
    
    cache_key = f"network_graph_{end_date or 'live'}"
    if cache_key in _graph_cache:
        cached_data, cache_time = _graph_cache[cache_key]
        if (now - cache_time).total_seconds() < 120:
            return cached_data

    mob_df, con_df, vit_df = get_dataframes()

    date_filter = None
    if end_date:
        dt_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        if dt_end.tzinfo is None:
            dt_end = dt_end.replace(tzinfo=timezone.utc)
        date_filter = dt_end

    anomalous_devices = set()
    TEMP_THRESHOLD = float(os.getenv("TEMP_THRESHOLD", "38.0"))
    HR_THRESHOLD = int(os.getenv("HR_THRESHOLD", "100"))

    if not vit_df.empty:
        v_df = vit_df
        if date_filter:
            v_df = v_df[v_df['timestamp'] <= date_filter]
        
        mask = (
            (v_df['temp_status'] == 'high') |
            (v_df['hr_status'] == 'high') |
            (v_df['temperature'] >= TEMP_THRESHOLD) |
            (v_df['heartbeat'] > HR_THRESHOLD)
        )
        anomalous_devices.update(v_df[mask]['device_id'].dropna().astype(str).tolist())

    edge_weights = defaultdict(int)
    node_positions = {}

    if not con_df.empty:
        c_df = con_df[con_df['proximity'] == 'close']
        if date_filter:
            c_df = c_df[c_df['timestamp'] <= date_filter]

        # Process most recent first to mimic .sort("timestamp", -1)
        c_df = c_df.sort_values('timestamp', ascending=False).head(5000)

        for _, row in c_df.iterrows():
            user = str(row.get("user_id", ""))
            device = str(row.get("mac", ""))
            if not user or user == "nan" or not device or device == "nan":
                continue
                
            edge_key = (user, device)
            edge_weights[edge_key] += 1
            
            lat = float(row.get("latitude", 0)) if pd.notnull(row.get("latitude")) else 0
            lon = float(row.get("longitude", 0)) if pd.notnull(row.get("longitude")) else 0

            if user not in node_positions:
                node_positions[user] = {"lat": lat, "lon": lon}
            if device not in node_positions:
                node_positions[device] = {"lat": lat, "lon": lon}

    G = nx.Graph()
    for (src, tgt), weight in edge_weights.items():
        G.add_edge(src, tgt, weight=weight)

    centrality = nx.degree_centrality(G) if len(G.nodes) > 0 else {}

    edges = []
    sorted_edges = sorted(edge_weights.items(), key=lambda x: x[1], reverse=True)
    for (src, tgt), weight in sorted_edges[:2000]:
        edges.append({
            "source": src,
            "target": tgt,
            "weight": weight,
        })

    active_nodes = set()
    for e in edges:
        active_nodes.add(e["source"])
        active_nodes.add(e["target"])

    nodes = []
    for node_id in active_nodes:
        pos = node_positions.get(node_id, {"lat": 0, "lon": 0})
        is_anomalous = node_id in anomalous_devices
        node_type = "user" if node_id.startswith("U") else "device"

        nodes.append({
            "id": node_id,
            "anomaly": is_anomalous,
            "type": node_type,
            "lat": pos["lat"],
            "lon": pos["lon"],
            "centrality": round(centrality.get(node_id, 0), 4),
            "connections": G.degree(node_id) if node_id in G else 0,
        })

    nodes.sort(key=lambda x: (not x["anomaly"], -x["connections"]))

    result = {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "total_nodes": len(G.nodes),
            "total_edges": len(edge_weights),
            "anomalous_count": len([n for n in nodes if n["anomaly"]]),
            "displayed_nodes": len(nodes),
            "displayed_edges": len(edges),
        }
    }
    
    _graph_cache[cache_key] = (result, now)
    return result
