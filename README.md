# Sentinel Mesh 🌐🧬

**Sentinel Mesh** is a next-generation epidemiological intelligence platform designed to proactively monitor, analyze, and visualize public health risks in real-time. By leveraging edge computing (Tracy devices), secure data pipelines, and an advanced AI risk engine, Sentinel Mesh acts as an early warning system for infectious disease outbreaks.

This project was built to empower health operators, epidemiologists, and community responders to detect and contain emerging biological threats *before* they become full-scale pandemics.

---

## 🚀 Key Features

* **Real-time Risk Scoring**: An AI engine continuously evaluates user vitals (temperature, heart rate) combined with geographical proximity and mobility data to assign dynamic risk scores.
* **3D Contact Tracing**: A fully interactive 3D force-directed graph visualizes disease transmission vectors and clusters.
* **Geospatial Hotspot Mapping**: Mapbox GL integration provides a real-time heatmap of escalating risk zones across various regions.
* **Live Activity Dashboard**: Operational dashboards showing system health, active alerts, and live network tracking through WebSocket integration.
* **Intelligent Threat Insights**: Integrated LLM processing generates human-readable daily intelligence briefings and automated anomaly summaries for operators.
* **Field Dispatch System**: Allows dispatching rapid-response agents or medical personnel directly to identified hotspots.

---

## 📁 Repository Structure

```text
sentinel-mesh/
├── backend/            # FastAPI python backend
│   ├── app/            # API endpoints, ML risk models, WebSockets
│   ├── scripts/        # Data ingestion, Model training, deployment scripts
│   ├── requirements.txt
│   └── ...
├── frontend/           # Next.js 15 App Router frontend (React + Tailwind)
│   ├── app/            # Pages (Dashboard, Geography, Audit, Simulator)
│   ├── components/     # Reusable UI (Charts, 3D Graph, Modals)
│   ├── context/        # Global State & WebSocket connection
│   └── ...
├── data/               # Mock datasets (vitals, mobility, contact tracing)
├── docs/               # Comprehensive system architecture & solution documents
└── docker-compose.yml  # Local multi-container execution
```

---

## 📖 Documentation

For a deep dive into the system design, algorithms, and business logic, please refer to the `docs/` folder:

* **[Solution Documentation](./docs/solution_documentation.md)**: Problem statement, system overview, datasets, and future vision.
* **[System Architecture](./docs/system_architecture_diagram.md)**: The 5-layer physical and logical architecture.
* **[Sentinel Mesh Technical Spec](./docs/sentinel_mesh_documentation.md)**: Deep dive into the AI engine and data models.
* **[Presentation Slides](./docs/presentation_slides.md)**: Ready-to-use content for pitch decks and presentations.
* **[System Audit Report](./docs/system_audit_report.md)**: Review of security, performance, and operational readiness.

---

## 🛠️ Tech Stack

* **Frontend**: Next.js 15, React 19, Tailwind CSS, Recharts, Mapbox GL JS, Force-Graph 3D, Framer Motion.
* **Backend**: FastAPI, Python 3.11, Scikit-Learn (Isolation Forests), WebSockets.
* **Database**: MongoDB (via Motor Async).
* **AI & NLP**: Groq API (Llama models) for conversational intelligence.
* **Auth**: Firebase Authentication.
* **Deployment**: Docker, Azure App Services.

---

## 💻 Getting Started (Local Development)

### 1. Backend Setup
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Copy `.env.example` to `.env` and fill in your MongoDB, Firebase, and Groq credentials.
4. Run the data simulator (optional) to populate initial users:
   ```bash
   python scripts/seed_users.py
   python scripts/populate_audit.py
   ```
5. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### 2. Frontend Setup
1. Navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env.local` and configure your API URL, Mapbox Token, and Firebase variables.
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏆 Hackathon Context
This project represents a fully functional prototype designed to showcase how scalable cloud architecture, machine learning, and intuitive design can be combined to solve global health monitoring challenges. 

*Stay safe. Stay proactive. Sentinel Mesh.*
