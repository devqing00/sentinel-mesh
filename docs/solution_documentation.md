# Solution Documentation: Sentinel Mesh

## 1. Problem Statement
**What public health problem the system is designed to solve and for whom**
In underserved communities and dense urban environments, viral outbreaks often spread undetected until hospitals are already overwhelmed. Traditional contact tracing is highly manual, retrospective, and relies heavily on unreliable human memory. By the time a cluster is identified, the pathogen has already scaled. Furthermore, rural or under-resourced regions suffer from intermittent connectivity, making centralized cloud-only solutions ineffective. 

**Sentinel Mesh** is designed to solve the problem of delayed outbreak detection and response. It is built for **public health officials, Community Health Extension Workers (CHEWs), and epidemiological agencies** who need proactive, real-time, and localized intelligence to deploy interventions (e.g., targeted quarantines, SMS warnings, or dispatching medical teams) before an outbreak reaches epidemic proportions.

---

## 2. System Overview
**A plain-language description of the full system and how its components work together**
Sentinel Mesh is an end-to-end, privacy-first epidemiological platform. It begins with **Tracy Devices**—small, wearable sensors given to individuals that continuously monitor vital signs (temperature, heart rate, blood oxygen) while using Bluetooth to record who they come into close contact with. 

Instead of requiring constant internet access, these devices cache their data locally. When they come into range of a gateway or a smartphone, they securely beam this data to the **Sentinel Mesh Backend**. The system's intelligence layer acts as an algorithmic detective. It first looks for individuals showing early signs of infection (e.g., a spiked fever). Then, it maps out everyone that infected individual has recently been near. 

The system instantly highlights "risk clusters" on a live geographic map and contact-tracing web dashboard. Health workers monitoring the dashboard are alerted in real-time. Using an integrated AI assistant, they can understand exactly *why* a neighborhood is flashing red and instantly trigger actions like sending an SMS warning to that specific neighborhood or exporting official reports to global health systems like SORMAS.

---

## 3. Dataset Usage
The system ingests and cross-references three critical datasets at the **Data Ingestion** and **Intelligence** layers:

1. **Vitals Dataset (`vitals` file/collection)**
   * **Usage**: Contains time-series physiological data (Heart Rate, SpO2, Temperature).
   * **Layer**: Processed in Phase 1 of the Intelligence Layer to identify clinical anomalies indicating potential infection, establishing the "ground zero" nodes for risk scoring.
2. **Mobility Dataset (`mobility` file/collection)**
   * **Usage**: Contains GPS coordinates (Geohashes) and exposure scores representing a user's movement over time.
   * **Layer**: Used by the Intelligence Layer's geospatial clustering algorithms to group isolated high-risk individuals into "Affected Neighborhoods" and calculate geographic spread velocity.
3. **Contacts Dataset (`contacts` file/collection)**
   * **Usage**: Contains Bluetooth Low Energy (BLE) handshake records, including the IDs of interacting users, timestamps, and signal strength (RSSI) to determine physical proximity.
   * **Layer**: Fuel for the Phase 2 Intelligence Layer. It builds the force-directed contact tracing graph, determining disease vectors and calculating exposure risk for individuals who are currently asymptomatic but have been in contact with anomalous users.

---

## 4. Intelligence Components
The brain of Sentinel Mesh relies on multi-stage processing:

### 4.1. Phase 1 Risk Scoring (Physiological Anomalies)
* **Algorithm**: Threshold-based anomaly detection with temporal decay.
* **Features Consumed**: Temperature, Heart Rate, SpO2.
* **Output**: A base risk score. If a user exceeds safe biological thresholds (e.g., Temp > 38.0°C), their base score spikes. The system flags them as "escalating."

### 4.2. Phase 2 Risk Scoring (Network Centrality)
* **Algorithm**: Graph-based Exposure Propagation (similar to PageRank).
* **Features Consumed**: Base risk score (from Phase 1) + Bluetooth Contacts (RSSI).
* **Output**: A final composite risk score. An asymptomatic user connected to three "escalating" users will receive a high Phase 2 score, shifting them into a "persistently-high" or "needs attention" category.

### 4.3. Geospatial Risk Clustering
* **Algorithm**: Density-Based Spatial Clustering of Applications with Noise (DBSCAN) combined with K-Means.
* **Features Consumed**: Final user risk scores and Mobility Geohashes.
* **Output**: Bounding boxes of "Affected Neighborhoods" displayed on the alerts dashboard, prioritizing zones with the highest density of at-risk users.

### 4.4. Sentinel AI Reasoning Engine
* **Algorithm**: Large Language Model inference using LLaMA-3.3-70b-versatile via Groq.
* **Features Consumed**: The aggregated outputs of Phase 1, Phase 2, and Clustering.
* **Output**: Conversational insights, natural language justifications for risk scores, and automated generation of practitioner deployment checklists and executive agency reports.

---

## 5. Prototype Description
**What was built, how to run it and what it demonstrates**
The current prototype is a fully functioning web application consisting of a FastAPI Python backend and a Next.js React frontend. 

**What it demonstrates:**
* A **Live Simulator** featuring 50 organic, concurrent software agents mimicking humans wearing Tracy devices. 
* A real-time WebSocket architecture that instantly streams and updates the frontend Contact Tracing Force Graph and Dashboard metrics.
* A rich, interactive interface featuring **7 distinct data visualizations** (including Risk Trajectory Scatter plots, Network Density graphs, real-time Area Charts, and interactive Mapbox Geospatial clusters) to provide deep epidemiological intelligence.
* Live generation of localized alerts, SMS broadcast capabilities via Africa's Talking, and integration with the LLaMA 3.3 AI model for context-aware chat.

**How to run it:**
1. Clone the repository and configure `.env` (MongoDB URI, Groq API, Africa's Talking API).
2. Start the backend: `cd backend && pip install -r requirements.txt && python -m uvicorn app.main:app --reload`
3. Start the frontend: `cd frontend && npm install && npm run dev`
4. Open `localhost:3000`. The application connects to the WebSockets and automatically initiates the live simulation stream upon login.

---

## 6. Real-World Deployment Plan

### Handling Intermittent Device Connectivity
Tracy devices are equipped with onboard flash memory (e.g., via SQLite or simple flat files) to buffer weeks of BLE handshakes and vitals. The system operates asynchronously; devices do not require constant 4G/5G. Instead, they utilize opportunistic syncing—offloading encrypted payload batches whenever they pass a regional LoRaWAN gateway, a health clinic WiFi hotspot, or pair with a community worker's smartphone via BLE.

### Privacy and Health Data Protection
Data privacy is achieved through **pseudonymization**. Tracy devices do not broadcast personally identifiable information (PII). They broadcast rotating, cryptographically secure beacon IDs. The central database links these IDs to real identities only within highly secured, role-based access control (RBAC) boundaries. Community workers only see data corresponding to their assigned zones, while the raw telemetry data is encrypted at rest in MongoDB and in transit via TLS.

### Scaling from 35 to 3,500 Devices
* **Backend Scale**: FastAPI's asynchronous architecture handles thousands of concurrent WebSocket connections. The ingestion pipeline can be decoupled using a message broker (like Apache Kafka or RabbitMQ) to queue high-volume payloads before batch-writing to MongoDB.
* **Database Scale**: MongoDB scales horizontally via sharding. Collections are indexed by time and geohash to ensure aggregation queries remain sub-second even with millions of records.
* **Graph Scale**: The O(N^2) complexity of network graph calculation is mitigated by processing contact graphs in isolated geographic shards (e.g., calculating graphs per city district rather than globally).

### Estimated Cost and Maintenance
* **Hardware**: At scale, Tracy devices cost ~$15-$25 per unit to manufacture. 
* **Cloud Infrastructure**: ~$300-$500/month for managed MongoDB clusters, load-balanced containerized API servers, and AI API costs (Groq). 
* **Maintenance**: Maintained by a partnership between the regional Ministry of Health (funding and deployment) and an NGO or local tech consortium (software updates and server maintenance).

### Limitations and Next Steps
* **Current Limitations**: The prototype relies on a software simulator rather than physical Tracy hardware integrations. The anomaly detection thresholds are currently static (e.g., strictly Temp > 38.0).
* **What Comes Next**: 
  1. Development of the physical Tracy device firmware and BLE mesh protocols.
  2. Implementing Machine Learning for dynamic baseline generation (e.g., learning that an individual's normal resting heart rate is naturally higher, preventing false positives).
  3. Direct bidirectional integration with hospital SORMAS APIs, rather than relying on PDF exports.

### Impact Statement
**Who benefits and how it changes outcomes**
Sentinel Mesh shifts public health from a *reactive* posture to a *proactive* one. In underserved communities where medical resources are scarce, dispatching resources effectively is a matter of life and death. 
By instantly highlighting micro-clusters before they spread, health officials can deploy targeted interventions—such as isolating a single street or sending localized SMS warnings—rather than resorting to devastating city-wide lockdowns. Ultimately, it benefits the most vulnerable populations by ensuring they receive targeted medical care hours or days faster than traditional surveillance methods allow.
