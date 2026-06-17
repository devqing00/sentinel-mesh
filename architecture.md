# Sentinel Mesh: Comprehensive System Design & Architecture

## 1. Project Context & Problem Statement

### 1.1 The Global Problem
The rapid transmission of infectious diseases (such as COVID-19, Lassa Fever, Ebola, and Marburg virus) presents an immense challenge to global public health infrastructure. Traditional outbreak management and contact tracing methodologies are fundamentally flawed due to a few critical bottlenecks:
1. **The Reporting Lag:** Public health agencies typically detect outbreaks only after infected individuals develop severe symptoms and present themselves at hospitals or clinics. By this time, the transmission chain has already spread exponentially through the community.
2. **Manual Tracing Inaccuracies:** Contact tracing relies on manual interviews. Human memory is fallible; individuals rarely remember every person they came into close proximity with on public transport, in markets, or at large gatherings.
3. **Data Silos:** Epidemiological data, hospital bed capacities, and field agent availability are often stored in disparate, disconnected systems, delaying rapid emergency deployment.

### 1.2 The Solution Paradigm
**Sentinel Mesh** acts as a decentralized, IoT-driven spatiotemporal outbreak intelligence system. It serves as an automated early warning network that bypasses the clinical reporting lag by fusing three distinct data streams continuously collected at the edge:
1. **IoT Vitals Telemetry:** Wearable devices continuously monitor physiological baselines (e.g., body temperature, resting heart rate). Abnormal spikes (e.g., sudden onset fever) are flagged immediately, days before clinical hospitalization.
2. **Contact Tracing (Proximity Graphs):** Utilizing Bluetooth Low Energy (BLE) and Ultra-Wideband (UWB), devices silently record peer-to-peer proximity events. This creates a persistent, mathematical graph of physical interactions.
3. **Mobility & Geolocation Data:** GPS and Geohash tracking map user movement through specific zones, identifying geographical "hotspots."

By feeding this continuous stream of data into a centralized Machine Learning engine, Sentinel Mesh utilizes a **probabilistic diffusion process** to calculate the risk of infection propagation across the network, automatically escalating high-risk individuals and deploying medical teams proactively.

---

## 2. High-Level Architecture & Tech Stack

Sentinel Mesh is built on a decoupled, highly scalable microservices architecture optimized for real-time telemetry processing, complex graph visualization, and machine learning inference.

### 2.1 Systems Used
- **Frontend Core:** React 18, Next.js 14 (App Router)
- **Frontend Visualizations:** Mapbox GL (`react-map-gl`), Force Graph 2D (`react-force-graph-2d`), Recharts
- **Backend Core:** Python 3.11, FastAPI, Uvicorn
- **Database:** MongoDB 6.0 (NoSQL, ideal for schemaless, high-velocity IoT streams)
- **Machine Learning:** Scikit-Learn (`RandomForestRegressor`), NetworkX
- **AI Integration:** Groq Cloud API (LLaMA-3 for epidemiological summaries)
- **Containerization:** Docker & Docker Compose

---

## 3. Backend Architecture: Microservices Breakdown

The FastAPI backend is compartmentalized into discrete functional services (routes), each handling a specific domain of the Sentinel Mesh pipeline.

### 3.1 Data Ingestion Microservice (`/api/ingest`)
**Role:** The edge gateway. Handles raw telemetry payloads sent from field IoT devices, mobile apps, or local mesh nodes via HTTPS.
- **`POST /api/ingest/vitals`:** Receives continuous physiological data. Validates thresholds (e.g., Temp > 38°C) and stores anomalies.
- **`POST /api/ingest/contacts`:** Receives edge pairings (Node A contacted Node B). Computes proximity strength ("close", "casual") based on RSSI (Received Signal Strength Indicator) values.
- **`POST /api/ingest/mobility`:** Receives GPS coordinates and converts them into standardized Geohashes for spatial indexing.

### 3.2 Network Graph Construction (`/api/network`)
**Role:** Transforms raw, tabular contact logs into a mathematical graph used by both the ML engine and the frontend UI.
- **Graph Assembly:** Queries the `contacts` collection for close-proximity events and the `vitals` collection for anomalies.
- **Engine (`contact_graph.py`):** Uses the `NetworkX` library to build nodes (users/devices) and edges (contacts weighted by frequency). 
- **Centrality Computation:** Calculates the *Degree Centrality* of every node, identifying "super-spreaders" or highly connected hubs within the community.
- **Timeline Engine:** Accepts an `end_date` parameter to dynamically rebuild the graph as it existed at any precise moment in the past, allowing public health officials to "rewind" the outbreak simulation.

### 3.3 The Risk Intelligence Layer (`/api/risk`)
**Role:** The brain of the system. Fuses all data streams and executes the Machine Learning models to score the risk of every user.
- **`GET /api/risk/ranked-table`:** Returns a globally ranked array of individuals from highest risk to lowest. Because scanning millions of edges and vitals is computationally heavy, this route relies on a **Persistent Database Cache (L2 Cache)**.
- **`GET /api/risk/user/{user_id}`:** Pulls a deep-dive dossier on a specific user, explaining exactly *why* the ML model assigned their specific risk score (e.g., "User experienced 3 fever spikes and had 14 close contacts").

### 3.4 AI Briefing Service (`/api/ai`)
**Role:** Translates complex mathematical risk scores into actionable human language.
- Connects to the **Groq API** utilizing the **LLaMA-3** model.
- Automatically compiles system-wide statistics (total anomalous devices, critical clusters, system capacity) into executive epidemiological briefings for health ministers and directors.

---

## 4. Machine Learning Implementation: The Trajectory Engine

The core predictive power of Sentinel Mesh resides in `risk_scoring.py`, which features a custom feature extraction pipeline and a **Random Forest Regressor**.

### 4.1 Feature Engineering
The model transforms raw NoSQL documents into a numerical matrix:
1. **`vitals_anomalies`:** Total count of temperature and heart-rate threshold breaches.
2. **`log_contacts`:** The `log(1 + total_close_contacts)`. A logarithmic scale is used because disease transmission risk tapers off—having 5 contacts is vastly riskier than 0, but having 500 contacts isn't 100x riskier than 50 in a localized setting due to network saturation.
3. **`exposure_sum`:** The accumulated risk of the geographic regions (Geohashes) the user visited.

### 4.2 The Trajectory Shift Metric
Instead of a static snapshot, the engine evaluates *momentum*.
- The data is partitioned by a `split_date`. 
- **Phase 1 (Baseline):** The user's historical risk behavior.
- **Phase 2 (Recent):** The user's risk behavior in the last 72 hours.
- The delta between these two phases is the **Trajectory Shift**. A massive positive shift indicates an individual whose risk profile has suddenly exploded (e.g., they attended a massive indoor gathering while exhibiting a fever). These individuals are flagged as **Escalating Patient Zeroes**.

### 4.3 Database Persistent Caching
To ensure the Next.js frontend maintains a 60fps interactive experience, `score_all_users()` serializes its complex ML output and writes it directly to the `system_cache` MongoDB collection with a strictly enforced 5-minute Time-To-Live (TTL). When the frontend polls for data, the backend serves the cached array in milliseconds, completely bypassing the RandomForest inference unless the TTL has expired.

---

## 5. Frontend UI/UX Architecture

The frontend is a "glassmorphic" Command Center designed for high-stakes, fast-paced emergency response. It is built using Next.js App Router for optimal routing and performance.

### 5.1 Real-Time Data Synchronization
- The application uses `SWR` (Stale-While-Revalidate) to automatically poll the backend every 5 seconds.
- Incoming data arrays are seamlessly merged into the React component states. For example, in the Network Graph, nodes are mutated in-place rather than overwritten, preserving the physics engine's momentum and preventing the UI from visually "jumping."

### 5.2 Key Interface Modules
1. **Network Radar (`/network`):** 
   - Renders a 2D physics simulation of the outbreak using `react-force-graph-2d`. Red glowing nodes indicate physiological anomalies. Users can click any node to pull telemetry and trigger commands.
   - **Timeline Slider:** Allows operators to shift the `end_date` query parameter, seamlessly animating the graph backward or forward in time to trace the origin of a cluster.

2. **Geographical Mapping (`/geography`):**
   - Integrates Mapbox GL to project risk clusters and mesh gateway infrastructure onto a real-world map.
   - Hotspot mode renders a density heatmap of anomalies.
   - **Integrated Dispatch UI:** Clicking a hotspot opens a slide-out `DispatchPanel`.

3. **Alerts & Response (`/alerts`):**
   - Renders the global risk clusters in a grid.
   - Operators can select a cluster to generate multi-lingual localized broadcast warnings (powered by LLMs), export SORMAS (Surveillance Outbreak Response Management and Analysis System) payloads, or open the integrated `DispatchPanel` to deploy units.

4. **Integrated Dispatch Panel (`DispatchPanel.tsx`):**
   - Originally a standalone page, this core functionality was refactored into a highly modular React component.
   - It surfaces nearby Field Epidemiologists, Rapid Response Teams, and Mobile Clinics, automatically filtering by availability and calculating ETA.
   - It allows operators to instantly confirm deployment orders directly from the Map or Alerts page without losing context.

5. **Sentinel AI (`/sentinel-ai`):**
   - A conversational chat interface connecting directly to the backend's Groq pipeline, allowing operators to interrogate the system (e.g., "Summarize the current risk in Lagos").

---

## 6. Dockerization & Deployment

Sentinel Mesh is fully containerized, ensuring perfect parity between development, staging, and production environments.

1. **Frontend Container:** Utilizes a multi-stage Alpine Linux build. The Next.js configuration (`next.config.ts`) is explicitly set to `output: 'standalone'`. This strips away unnecessary development dependencies, resulting in a microscopic production image that contains only the server and static assets.
2. **Backend Container:** Runs on a slim Python 3.11 image. Dependencies are explicitly pinned in `requirements.txt`. Uvicorn binds to `0.0.0.0:8000`.
3. **Orchestration (`docker-compose.yml`):** Defines the three critical services (`frontend`, `backend`, `mongo`). Internal Docker networking allows the backend to resolve the database simply via `mongodb://mongo:27017/sentinel`, keeping infrastructure secure and isolated. Volumes are mapped to ensure MongoDB data persists across container restarts.

## 7. Future Roadmap
- Replacing the Random Forest model with a Temporal Graph Neural Network (TGNN) via PyTorch Geometric to natively model information diffusion across the network edges.
- Integrating real-time WebSockets to replace SWR polling for absolute zero-latency updates.
- Implementing edge-federated learning so IoT gateways can train localized risk models without transmitting raw PII (Personally Identifiable Information) back to the central server.
