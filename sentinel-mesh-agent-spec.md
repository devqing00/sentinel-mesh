# Sentinel Mesh: Agent Build Specification

This document is the build context for an AI coding agent. It contains the project goal, tech stack, data schemas, feature specs, file structure, and build order. Read this fully before generating code. Where real data isn't available yet, use the mock data generator spec in Section 4 so the project is fully runnable before the real dataset arrives.

---

## 1. Project Goal (condensed)

We are building a system for the HealthTrace Hackathon 2026 (Track 3: System Design and Innovation), based on the "Tracy" IoT dataset: a low-cost ESP32 wearable that is always listening for nearby signals and forwards whatever it captures to a hosted platform. The data comes as THREE separate datasets:

1. **Mobility dataset**: movement, location, and direction of each wearer over time. Answers "where were you."
2. **Contact dataset**: records of person-to-person contact events (who was near whom, when). Answers "who did you interact with."
3. **Vitals dataset**: temperature and heart rate readings, sparse (~1% of total records). Answers "are there noticeable symptoms."

The hackathon framing is explicit: imagine a new outbreak (Ebola-style), and these three questions are exactly what an outbreak investigation needs answered, automatically, in real time.

Core finding driving the design: vitals coverage is only ~1%. The system is designed around that gap, and around closing the loop from "data" to "action," not just producing an analytics dashboard.

What we are building (real, working software):
1. A backend that ingests all three datasets and computes facility/community-level risk scores by combining mobility patterns, contact chains, and vitals anomalies.
2. A contact network visualization.
3. A battery-aware predictive maintenance feature (using the often-ignored "battery percentage" field in the vitals dataset).
4. An **automated agency notification pipeline**: when risk crosses a threshold, the system automatically sends a real notification (email/SMS) containing a SORMAS/eIDSR-formatted payload to a demo "agency" endpoint. This is the "automated system that can contact agencies" requirement, and it's the centerpiece live-demo moment, not an optional extra.
5. A trust/audit layer: every automated alert is logged with full explainability (which devices, contacts, and vitals readings triggered it), and a visible consent/provenance flag per device. This is how we demonstrate "is your system trustable" directly rather than asserting it.
6. A multilingual alert generator (English, Yoruba, Hausa, Igbo, Pidgin) using Groq/Llama.
7. An operational dashboard (Next.js) tying all of this together.

Global relevance note: the mesh/edge/low-connectivity approach (Section 1 background, see prior architecture discussion) generalizes to any low-resource health system, not just Nigeria. Keep this framing in mind for any UI copy or presentation text the agent generates, it should not read as Nigeria-only.

What is design-only, do NOT attempt to build, just leave clearly-labeled placeholders/diagrams for:
- ESP32 on-device anomaly detection / firmware
- BLE mesh relay logic between devices
- Community Health Kiosks (solar charging + gateway hardware)

---

## 2. Tech Stack (use these exactly)

**Frontend:** Next.js 16, TypeScript, Tailwind CSS v4, TanStack Query, Zustand for state, Mapbox GL JS for maps/heatmaps, Recharts or similar for charts.

**Backend:** FastAPI (Python), Pydantic v2 for schemas, MongoDB for storage (use `motor` for async driver), networkx for contact graph computation.

**AI:** Groq API with Llama 3.3 70B for multilingual alert text generation.

**Infra:** Docker + docker-compose for local dev (backend, frontend, mongo as three services). Use `pip install --break-system-packages` if installing outside a venv.

**Env vars needed (put in `.env.example`):**
```
GROQ_API_KEY=
MAPBOX_TOKEN=
MONGODB_URI=mongodb://mongo:27017/sentinelmesh
# Automated agency notification (demo endpoint, e.g. a test inbox or Africa's Talking sandbox)
NOTIFY_EMAIL_TO=
NOTIFY_EMAIL_PROVIDER_API_KEY=
NOTIFY_SMS_TO=
AFRICASTALKING_API_KEY=
AFRICASTALKING_USERNAME=
```

---

## 3. Folder Structure

```
sentinel-mesh/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── models/
│       │   ├── mobility.py        # Pydantic schemas for mobility records
│       │   ├── contact.py         # Pydantic schemas for contact records
│       │   ├── vitals.py          # Pydantic schemas for vitals records
│       │   ├── risk.py            # Risk score / alert schemas
│       │   └── audit_log.py        # Schema for logged automated notifications
│       ├── routes/
│       │   ├── ingest.py         # data ingestion endpoints
│       │   ├── risk.py            # risk scoring endpoints
│       │   ├── network.py         # contact graph endpoints
│       │   ├── devices.py         # device/battery health endpoints
│       │   ├── alerts.py          # multilingual alert generation
│       │   ├── export.py          # SORMAS/eIDSR export
│       │   └── audit.py           # audit log / explainability endpoints
│       ├── services/
│       │   ├── risk_scoring.py
│       │   ├── battery_predictor.py
│       │   ├── contact_graph.py
│       │   ├── alert_generator.py
│       │   ├── sormas_export.py
│       │   └── notification_service.py  # automated agency notification (email/SMS)
│       └── data/
│           └── mock_data_generator.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── app/
        ├── dashboard/page.tsx     # overview / risk heatmap
        ├── network/page.tsx       # contact network graph
        ├── devices/page.tsx       # device/battery health monitor
        ├── alerts/page.tsx        # alert feed + automated notification trigger + SORMAS export action
        ├── audit/page.tsx         # trust layer: log of automated notifications with explainability + consent status
        └── kiosks/page.tsx        # static design view of kiosk network (uses placeholder/mock coordinates, this page is illustrative of the design layer, not live data)
```

---

## 4. Data Schemas (and Mock Data Generator)

Until the real Tracy dataset is available (expected to be shared shortly), generate synthetic data matching this schema so the full app is runnable end to end. The real data is split into THREE separate datasets, joined on `device_id` and `timestamp`. Build the ingestion layer to accept three separate files (CSV or JSON, confirm format once the real data arrives) rather than one combined table.

### 4.1 Mobility dataset
```json
{
  "device_id": "string",
  "timestamp": "ISO 8601 datetime",
  "latitude": "float",
  "longitude": "float",
  "geohash": "string",
  "direction_deg": "float | null",
  "speed": "float | null"
}
```

### 4.2 Contact dataset
```json
{
  "device_id": "string",
  "contact_device_id": "string",
  "timestamp": "ISO 8601 datetime",
  "duration_seconds": "int | null",
  "rssi": "float | null"
}
```

### 4.3 Vitals dataset (sparse, ~1% of total records should have this)
```json
{
  "device_id": "string",
  "timestamp": "ISO 8601 datetime",
  "body_temperature_c": "float",
  "heart_rate_bpm": "int",
  "movement_status": "0 or 1",
  "battery_percent": "float"
}
```

### 4.4 Mock data generator requirements
Build `mock_data_generator.py` to produce three separate collections/files matching the schemas above:
- ~235 simulated device IDs, consistent across all three datasets
- Mobility: a few thousand records across a handful of clustered GPS regions (simulate "communities")
- Contact: pairwise contact events derived from mobility (devices that are geographically close at the same timestamp generate a contact record)
- Vitals: records for ONLY ~1% of timestamps, to replicate the real coverage gap. Battery percentage should trend downward over time per device with occasional resets (simulating charging). A few intentional "anomaly" devices should have elevated temperature/heart rate clustered in one geographic area, to make risk scoring and the automated notification pipeline demo-able.

This generator should be runnable via a script/endpoint so the database can be seeded immediately. The moment the real datasets arrive, swap this for an ingestion script that loads the three real files into the same schema (confirm exact column names against the real data first, they likely won't match exactly).

---

## 5. Feature Specifications

### 5.1 Risk Scoring (`services/risk_scoring.py`)
Logic:
1. Flag a vitals record as "anomalous" if `body_temperature_c > 38.0` OR `heart_rate_bpm > 100` (these are placeholder thresholds, adjustable).
2. For each anomalous record, find all devices that had a contact event with that device (from the contact dataset) within a configurable time window (default 48 hours).
3. Use the mobility dataset to place each contributing device into a geographic cluster (group by geohash prefix or proximity radius), producing a community-level risk score (0-100), not individual-level.
4. Expose via `GET /api/risk/communities` returning a list of `{cluster_id, lat, lon, risk_score, contributing_device_count, last_updated}`.
5. This endpoint is the trigger source for the automated notification pipeline (5.6): whenever a cluster's risk_score crosses a configurable threshold (default 70) for the first time, fire the notification.

### 5.2 Contact Network (`services/contact_graph.py`)
- Build a graph using networkx where nodes are device IDs and edges are contact events from the contact dataset (weighted by frequency/duration).
- Expose `GET /api/network/graph` returning nodes and edges in a format consumable by a frontend graph visualization (e.g., `{nodes: [{id, anomaly: bool}], edges: [{source, target, weight}]}`).
- Also expose a geographic version for the map view, using the mobility dataset to position nodes: cluster contact density by location.

### 5.3 Battery-Aware Predictive Maintenance (`services/battery_predictor.py`)
- For each device, compute the rate of battery decline over recent vitals records.
- If a device's projected battery will hit 0% within a configurable threshold (default 24 hours) AND its movement_status pattern doesn't suggest it's near a charging point, flag it as "needs kiosk visit."
- Expose `GET /api/devices/health` returning `{device_id, battery_percent, projected_hours_remaining, status: "ok" | "needs_visit", last_seen}`.

### 5.4 Multilingual Alert Generator (`services/alert_generator.py`)
- Given a risk event (from 5.1), call Groq API (Llama 3.3 70B) with a prompt template to generate a short alert message for CHEWs/community members.
- Generate in English, Yoruba, Hausa, Igbo, and Nigerian Pidgin. Return all five as a dict.
- Prompt template should include: location/community name, risk level, and a recommended action (e.g., "increased monitoring recommended" / "report symptoms to nearest health post").
- Expose `POST /api/alerts/generate` with body `{cluster_id}`, returning `{alerts: {en: "...", yo: "...", ha: "...", ig: "...", pcm: "..."}}`.
- Text-to-speech is a stretch goal, not required for v1. If time allows, integrate any available TTS API and add an `audio_url` field per language.

### 5.5 SORMAS/eIDSR Export (`services/sormas_export.py`)
- Define a JSON structure that mirrors a SORMAS case notification: include fields like `reportDate`, `region`, `district` (map from our cluster/geohash), `diseaseDetails`, `symptoms` (derived from anomaly type), `reportingUser`, `caseStatus`.
- Expose `GET /api/export/sormas/{cluster_id}` returning this formatted JSON, and also support a CSV download via `GET /api/export/sormas/{cluster_id}/csv`.
- This is a format-compatibility demo, not a live API integration. Label it clearly in the UI as "Export formatted for NCDC eIDSR/SORMAS."
- This is also the payload format used by the automated notification pipeline below.

### 5.6 Automated Agency Notification Pipeline (`services/notification_service.py`)
This is the centerpiece "end-to-end automated system" feature, this is what gets demoed live and answers "automated system that can contact agencies" and "a system that works" directly.

Flow:
1. A background task (or a manually-triggerable demo endpoint, since real-time polling may be unreliable on conference wifi) checks `GET /api/risk/communities` for any cluster whose `risk_score` has newly crossed the threshold (default 70).
2. For each newly-triggered cluster, call the SORMAS export (5.5) to build the payload, and the alert generator (5.4) to build the multilingual messages.
3. Send the combined payload via email (any simple provider, e.g. Resend/SendGrid REST API) to `NOTIFY_EMAIL_TO`, and/or via SMS through Africa's Talking sandbox to `NOTIFY_SMS_TO`. The recipient represents a demo "NCDC regional desk" or "LGA health officer," label it as such in the UI and in the email/SMS subject line.
4. Write a record to the audit log (5.7) capturing: timestamp, cluster_id, risk_score, recipient, payload sent, and which specific device IDs/contact chains/vitals records contributed to the trigger.
5. Expose `POST /api/alerts/trigger/{cluster_id}` as a manual "fire now" endpoint for the live demo, in addition to any automated background check. The live demo should use this manual trigger for reliability, framed as "here's the automated pipeline, triggering it now."

### 5.7 Trust & Audit Layer (`models/audit_log.py`, `routes/audit.py`)
This directly answers "is your system trustable."

- Every automated notification (5.6) writes an audit log entry: `{timestamp, cluster_id, risk_score, trigger_reason, contributing_device_ids, contributing_contact_events, contributing_vitals_records, recipient, payload_sent, delivery_status}`.
- Expose `GET /api/audit/log` returning all entries, most recent first.
- Expose `GET /api/audit/explain/{cluster_id}` returning a human-readable breakdown of exactly why a given cluster's risk score is what it is (which vitals anomalies, which contact chains, which mobility clusters), so the dashboard can show "why did this fire" in plain language.
- Add a `consent_status` field to each device in the mock data generator (`opted_in: bool`), representing the Civic Data Rewards opt-in concept. Only devices with `opted_in: true` should contribute to risk scoring and notifications. Surface this on the audit page so it's visible that the system respects consent, not just collects everything.

---

## 6. Frontend Pages

### `/dashboard` (Overview)
- Risk heatmap using Mapbox, colored by community risk score from `/api/risk/communities`.
- Summary cards: total devices, active anomalies, devices needing battery service.

### `/network`
- Contact network graph visualization (force-directed) from `/api/network/graph`. Highlight anomalous nodes and their connected contacts.

### `/devices`
- Table/list of all devices with battery status from `/api/devices/health`, sorted by urgency (needs_visit first).

### `/alerts`
- List of current risk events/clusters. For each, show: a button to generate multilingual alerts (`/api/alerts/generate`), a button to export in SORMAS format (`/api/export/sormas/{cluster_id}`), and a "Notify Agency Now" button that calls `POST /api/alerts/trigger/{cluster_id}` (the automated notification pipeline, 5.6). This last button is the live demo centerpiece, after clicking it, show a confirmation that the notification was sent and link to the audit entry it created.

### `/audit`
- Trust layer page. Table of all entries from `GET /api/audit/log`: timestamp, cluster, risk score, recipient, delivery status.
- Clicking an entry shows the explainability breakdown from `GET /api/audit/explain/{cluster_id}`: which devices, contact events, and vitals readings contributed, in plain language.
- Also show overall consent stats (e.g., "X of 235 devices opted in") to make the consent/provenance model visible.

### `/kiosks`
- Static/illustrative map showing example Community Health Kiosk placements (mock coordinates near the simulated communities), labeled clearly as a design-layer visualization representing the proposed connectivity infrastructure, not live data.

---

## 7. Build Order

**Phase 0 (now, before real dataset):**
- Scaffold full repo structure, docker-compose, Dockerfiles.
- Build mock data generator for the three datasets (mobility, contact, vitals) and seed MongoDB, including the `opted_in` consent flag per device.
- Build all backend endpoints against mock data, including the automated notification pipeline (5.6) and audit/explainability endpoints (5.7), since these don't depend on real data to be functional.
- Build all frontend pages against the backend (everything should run end-to-end with mock data), including the "Notify Agency Now" button and the `/audit` page. Get one full end-to-end trigger working with mock data before the real dataset arrives.

**Phase 1 (real datasets arrive):**
- Confirm the actual file format/column names for the three datasets and write an ingestion script mapping them to the schemas in Section 4.
- Validate the ~1% vitals coverage stat against real numbers, adjust risk scoring thresholds if needed so at least one cluster realistically crosses the notification threshold for the demo.

**Phase 2:**
- Polish risk scoring, battery predictor, SORMAS export, alert generator, and the notification/audit pipeline with real data.
- Make sure the demo flow (dashboard to network to devices to alerts/notify to audit) is smooth and the "Notify Agency Now" trigger reliably works without depending on conference wifi (use a local/mock email transport with a visible log if real email/SMS delivery is unreliable on-site).

**Phase 3:**
- Visual polish, kiosk page, final architecture diagram (separate from this codebase, used in the presentation).
- Rehearse the live demo end to end, especially the "Notify Agency Now to Audit Log" moment.

---

## 8. Non-Goals (do not spend time on these)

- Real ESP32 firmware or embedded code.
- Real BLE mesh networking implementation.
- Real hardware for kiosks (solar panels, gateways).
- Real SORMAS API authentication/integration (format-matching only).
- User authentication/login systems (not needed for a hackathon demo).
- Don't block on real email/SMS provider credentials: if `NOTIFY_EMAIL_PROVIDER_API_KEY` / `AFRICASTALKING_API_KEY` aren't set, `notification_service.py` should fall back to a "mock transport" that just writes the would-be notification to the audit log with `delivery_status: "simulated"`. The pipeline and audit trail are what matter for the demo, real delivery is a bonus if credentials are available on-site.

Keep these as clearly-labeled design/architecture concepts in the presentation, not as code in this repo.
