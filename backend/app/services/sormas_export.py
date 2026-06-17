from datetime import datetime
from app.services.risk_scoring import get_dataframes
import os

async def generate_sormas_payload(cluster_id: str):
    """
    Generate a SORMAS/eIDSR-compatible case notification payload
    using real data from the Pandas dataframes.
    """
    TEMP_THRESHOLD = float(os.getenv("TEMP_THRESHOLD", "38.0"))
    HR_THRESHOLD = int(os.getenv("HR_THRESHOLD", "100"))

    _, con_df, vit_df = get_dataframes()
    
    contributing_devices = set()
    symptoms = set()
    max_temp = 0
    max_hr = 0
    lat, lon = 0, 0
    
    if not vit_df.empty:
        # Filter by geohash startswith cluster_id[:5]
        v_df = vit_df[vit_df['geohash'].astype(str).str.startswith(cluster_id[:5])]
        
        # Filter by anomalies
        mask = (
            (v_df['temp_status'] == 'high') |
            (v_df['hr_status'] == 'high') |
            (v_df['temperature'] >= TEMP_THRESHOLD) |
            (v_df['heartbeat'] > HR_THRESHOLD)
        )
        anomalous_v_df = v_df[mask].head(50)
        
        for _, row in anomalous_v_df.iterrows():
            contributing_devices.add(str(row.get('device_id', '')))
            
            t = float(row.get('temperature', 0))
            if t >= 38.0 or str(row.get('temp_status')) == 'high':
                symptoms.add("Fever")
                max_temp = max(max_temp, t)
                
            hr = float(row.get('heartbeat', 0))
            if hr > 100 or str(row.get('hr_status')) == 'high':
                symptoms.add("Elevated Heart Rate")
                max_hr = max(max_hr, hr)
                
            if pd.notnull(row.get('latitude')):
                lat = float(row['latitude'])
            if pd.notnull(row.get('longitude')):
                lon = float(row['longitude'])

    # Get contact chain size
    contact_count = 0
    if not con_df.empty and contributing_devices:
        contact_count = con_df[con_df['mac'].astype(str).isin(contributing_devices)].shape[0]

    # Map geohash to approximate region
    region_map = {
        "s179s": "Ondo State, Nigeria",
        "s179m": "Ondo State (Akure Area), Nigeria",
        "s179k": "Ondo State (Southern), Nigeria",
        "s0uyx": "Delta/Edo State, Nigeria",
        "s1quw": "Nasarawa State, Nigeria",
        "s1quy": "Nasarawa State (Northern), Nigeria",
        "s177k": "Kwara/Kogi State, Nigeria",
    }
    region = region_map.get(cluster_id[:5], "Nigeria (Unknown LGA)")

    return {
        "reportDate": datetime.utcnow().isoformat(),
        "region": region,
        "district": cluster_id,
        "diseaseDetails": "Suspected febrile illness — anomalous temperature and/or heart rate detected via IoT wearable surveillance",
        "symptoms": list(symptoms) if symptoms else ["Unspecified anomaly"],
        "maxTemperature": max_temp,
        "maxHeartRate": max_hr,
        "reportingUser": "SentinelMesh_Automated_System",
        "caseStatus": "SUSPECT",
        "contributingDevices": list(contributing_devices),
        "contactChainSize": contact_count,
        "geohash": cluster_id,
        "coordinates": {"latitude": lat, "longitude": lon},
        "dataSource": "Tracy IoT Wearable Mesh Network",
        "confidenceLevel": "AUTOMATED_DETECTION",
    }
