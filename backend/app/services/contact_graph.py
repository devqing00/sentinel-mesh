from collections import defaultdict
from datetime import datetime, timezone
from app.db import get_database
import networkx as nx


async def generate_contact_graph(end_date: str = None):
    """
    Build a real contact network graph:
    - Nodes: user_ids (U-prefix) and device_ids (D-prefix from mac column)
    - Edges: user detected device, weighted by frequency
    - Anomaly flags from vitals data
    """
    db = get_database()

    # 0. Handle end_date filter
    date_filter = None
    if end_date:
        dt_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        if dt_end.tzinfo is None:
            dt_end = dt_end.replace(tzinfo=timezone.utc)
        date_filter = {"$lte": dt_end}

    # 1. Get anomalous device IDs from vitals
    anomalous_devices = set()
    vitals_query = {
        "$or": [
            {"temp_status": "high"},
            {"hr_status": "high"},
            {"temperature": {"$gte": 38.0}},
            {"heartbeat": {"$gt": 100}},
        ]
    }
    if date_filter:
        vitals_query = {"$and": [{"timestamp": date_filter}, vitals_query]}

    cursor = db.vitals.find(vitals_query, {"device_id": 1})
    async for doc in cursor:
        anomalous_devices.add(doc["device_id"])

    # 2. Build edge weights from contacts (only close-proximity)
    edge_weights = defaultdict(int)
    node_positions = {}

    contacts_query = {"proximity": "close"}
    if date_filter:
        contacts_query["timestamp"] = date_filter

    contact_cursor = db.contacts.find(
        contacts_query,
        {"user_id": 1, "mac": 1, "latitude": 1, "longitude": 1}
    ).limit(50000)  # Limit for performance

    async for doc in contact_cursor:
        user = doc["user_id"]
        device = doc["mac"]
        edge_key = (user, device)
        edge_weights[edge_key] += 1

        # Store positions for geographic view
        if user not in node_positions:
            node_positions[user] = {"lat": doc["latitude"], "lon": doc["longitude"]}
        if device not in node_positions:
            node_positions[device] = {"lat": doc["latitude"], "lon": doc["longitude"]}

    # 3. Build networkx graph for centrality metrics
    G = nx.Graph()
    for (src, tgt), weight in edge_weights.items():
        G.add_edge(src, tgt, weight=weight)

    # Compute degree centrality
    centrality = nx.degree_centrality(G) if len(G.nodes) > 0 else {}

    # 4. Format output
    edges = []
    # Take top 2000 edges by weight
    sorted_edges = sorted(edge_weights.items(), key=lambda x: x[1], reverse=True)
    for (src, tgt), weight in sorted_edges[:2000]:
        edges.append({
            "source": src,
            "target": tgt,
            "weight": weight,
        })

    # Collect nodes ONLY from the selected edges to avoid "node not found" crashes
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

    # Sort so anomalous nodes come first
    nodes.sort(key=lambda x: (not x["anomaly"], -x["connections"]))

    return {
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
