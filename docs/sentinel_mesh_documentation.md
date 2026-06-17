# Sentinel Mesh: Full Context & Feature Documentation

This document serves as the comprehensive knowledge base for **Sentinel Mesh**, a real-time, privacy-first IoT contact tracing and epidemiological monitoring platform. It is designed to be fed into AI generators for creating slide decks, technical whitepapers, or stakeholder reports.

---

## 1. Executive Summary
**Sentinel Mesh** is an advanced epidemiological platform combining IoT wearable telemetry, real-time spatial contact tracing, and AI-driven risk scoring. It is designed to proactively detect viral outbreaks, monitor community health, and empower public health officials (like Community Health Extension Workers - CHEWs) to take immediate, localized action before an outbreak scales. 

The system operates on three primary pillars:
1. **Real-Time Data Ingestion**: Gathering continuous vitals (Heart Rate, SpO2, Temperature) and Bluetooth proximity events from distributed IoT nodes.
2. **Algorithmic Risk Scoring & Contact Tracing**: Utilizing multi-phase algorithms to map interaction graphs, calculate infection centrality, and group individuals into geographic risk clusters.
3. **AI-Assisted Orchestration**: Utilizing LLaMA 3.3 (via Groq) to provide conversational insights, context-aware reasoning for node isolation, and automated reporting.

---

## 2. Technical Stack
* **Frontend**: Next.js (React), TypeScript, Tailwind CSS, Lucide Icons, `react-force-graph-2d` for network maps, Mapbox for geographic maps, SWR for data fetching.
* **Backend**: FastAPI (Python, Async), WebSockets for real-time bi-directional streaming.
* **Database**: MongoDB (Motor Async Client) for document storage (telemetry, audit logs, devices).
* **AI Engine**: Groq API utilizing `llama-3.3-70b-versatile` for natural language processing and reasoning.
* **Integrations**: 
  * **SORMAS** (Surveillance Outbreak Response Management and Analysis System) via PDF generation and standardized export.
  * **Africa's Talking API** for SMS broadcasting to populations.

---

## 3. Core Capabilities & Backend Pipelines

### 3.1. Live IoT Simulation Engine
To demonstrate scale without needing physical hardware, the backend runs an advanced asynchronous Python simulator (`live_simulation.py`). 
* Simulates 50+ concurrent agents behaving organically (moving, interacting, transmitting vitals).
* Pushes real-time `activity_tick` payloads per second to the frontend via WebSockets.
* Dynamically generates "Unusual Readings" (Anomalies) based on configured thresholds (e.g., Temp > 38.0, HR > 100).

### 3.2. Multi-Phase Risk Scoring (`risk_scoring.py`)
A sophisticated pipeline that assigns actionable risk scores to individuals and communities.
* **Phase 1 (Vitals & Behavior)**: Evaluates spikes in body temperature, irregular heart rates, or drops in blood oxygen.
* **Phase 2 (Contact Tracing Graph)**: Evaluates a user's proximity to *other* high-risk individuals. A healthy user connected to 10 highly anomalous users will see an elevated risk score.
* **Categorization**: Users are slotted into dynamic states: `stable`, `recovering`, `escalating`, or `persistently-high`.
* **Spatial Clustering**: Groups high-risk individuals into "Affected Neighborhoods" based on GPS coordinate proximity.

### 3.3. AI Intelligence (`ai.py`)
* **Dashboard Insights**: Synthesizes live database states into punchy, 2-sentence situational awareness briefings.
* **Sentinel AI Assistant**: A conversational agent injected with the real-time context of the top 15 highest-risk individuals. It can explain *why* an individual is high risk (citing their exact contact count and vitals anomalies) and recommend clinical protocols.
* **Dynamic Reporting**: Generates heavily formatted Markdown reports tailored for either "Executive Agencies" (macro trends) or "Field Practitioners" (micro tasks and quarantines).

---

## 4. Frontend Application Features

### 4.1. Dashboard Overview (`/dashboard`)
The central command view for health officials.
* **Dynamic Summary Cards**: Real-time counters for "People Monitored", "Needs Attention" (escalating), "Getting Better" (recovering), and "Locations".
* **Live Activity Stream**: A rolling 60-second line chart showing the exact velocity of IoT packets hitting the server per second, paired with conversational text ("Traffic is currently busy/normal").
* **Risk Heatmap Override**: A visual mini-map aggregating the density of vitals anomalies.
* **AI Insight Widget**: Displays the live 2-sentence situational briefing from Groq.
* **Ranked Table Preview**: A quick view of the top individuals needing attention.
* **Recent Alerts Timeline**: A chronological feed of recent anomalies.

### 4.2. Community Health Watch (`/alerts`)
The response and orchestration hub.
* **Affected Neighborhoods (Risk Clusters)**: Lists actively surging geographic clusters.
* **Action Center**:
  * **Draft Local Warning**: Auto-generates localized advisory text.
  * **Send to Health System**: Triggers a backend process to package the cluster's data into a SORMAS-compliant PDF.
  * **Push Broadcast**: Connects to Africa's Talking to send SMS warnings to citizens in the affected geographic bounding box.
  * **Send Health Workers**: Flags the cluster for immediate physical dispatch.
* **People Needing Care**: A deeply detailed table ranking individuals by algorithmic risk score.

### 4.3. Contact Tracing Map (`/network`)
A visual network graph rendered using `react-force-graph-2d`.
* **Visual Graph**: Nodes represent "Monitored Individuals" and "Connected Devices". Edges represent Bluetooth handshakes. Node size and color change based on anomaly status (Unusual Vitals glow red).
* **Physics Engine**: Automatically repels and attracts nodes based on connection weight and centrality.
* **Target Action Panel**: Clicking a node reveals its Risk Centrality Score, Recent Contacts, and status. Officials can trigger "Review Health Log", "Send Health Workers", or "Flag for Quarantine".

### 4.4. Unified Notifications (`/notifications`)
* **Hybrid Data Source**: Merges historical, persistent audit logs fetched via REST API with live, ephemeral alerts pushed via WebSockets.
* **Pagination & Filtering**: Allows slicing notifications into chunks of 10 and filtering by "Unusual Reading", "System Update", "Hardware", or "Security".
* **Conversational Readouts**: Formatted using time-ago timestamps and human-readable text. Critical items link directly to case reviews.

### 4.5. Sentinel AI Chat (`/sentinel-ai`)
* Full-screen chat interface.
* Retains conversational memory for deep-dive analysis.
* Includes quick-action chips (e.g., "Summarize network anomalies", "Generate SORMAS report").

### 4.6. Geographic Map (`/geography`)
* Deep Mapbox GL integration.
* Overlays physical boundaries, IoT node coordinates, and risk heatmaps onto physical city topography.

### 4.7. Interactive Simulator (`/simulator`)
* An educational/testing UI where a developer or demo-user acts as an IoT node.
* Displays a beating heart animation, pulsing Bluetooth rings, and sliders to manually induce an "anomaly" (e.g., spiking heart rate).
* Pushes real HTTP payloads to the `/api/ingest/telemetry` endpoint, instantaneously affecting the graphs on the other pages.

---

## 5. Security & Access
* **Role-Based Views**: If a user logs in as a "chew" (Community Health Extension Worker) assigned to "Zone A", the dashboard and alerts filter out all data not belonging to Zone A.
* **Audit Logging**: Every action (dispatching a team, sending an SMS, generating a report) is immutably logged to the MongoDB `audit_logs` collection.

## 6. Target Audience & Impact
Sentinel Mesh is built for Ministries of Health, Epidemiologists, and NGO Field Workers. It transforms raw, noisy IoT data into actionable intelligence, bridging the gap between passive wearable monitoring and active, boots-on-the-ground outbreak suppression.
