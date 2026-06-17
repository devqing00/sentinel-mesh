import os
import pandas as pd
from datetime import datetime, timezone

DATA_DIR = os.path.join(os.path.dirname(__file__), "../../../data")
VITALS_CSV_PATH = os.path.join(DATA_DIR, "vitals.csv")

async def get_battery_predictions():
    """
    Real battery prediction bypassing MongoDB for O(1) performance.
    Reads directly from the pre-generated vitals.csv data.
    """
    if not os.path.exists(VITALS_CSV_PATH):
        print(f"[BatteryPredictor] Error: CSV not found at {VITALS_CSV_PATH}")
        return []
        
    # Read CSV via pandas
    df = pd.read_csv(VITALS_CSV_PATH)
    
    if df.empty:
        return []
        
    # Combine date and time to proper timestamp
    df['timestamp'] = pd.to_datetime(df['date'] + ' ' + df['time'], errors='coerce')
    
    # Sort chronologically
    df = df.sort_values('timestamp')
    
    results = []
    
    # Group by device_id
    grouped = df.groupby('device_id')
    
    for device_id, group in grouped:
        if group.empty:
            continue
            
        reading_count = len(group)
        first_row = group.iloc[0]
        latest_row = group.iloc[-1]
        
        latest_battery = float(latest_row.get('battery', 0))
        first_battery = float(first_row.get('battery', 0))
        
        # Calculate decline rate
        first_seen = first_row['timestamp']
        last_seen = latest_row['timestamp']
        
        decline_rate = 0
        projected_hours = 999
        
        if reading_count >= 2 and pd.notnull(first_seen) and pd.notnull(last_seen):
            time_span = last_seen - first_seen
            hours_span = max(time_span.total_seconds() / 3600, 0.1)
            battery_drop = first_battery - latest_battery
            
            if battery_drop > 0:
                decline_rate = battery_drop / hours_span
                projected_hours = latest_battery / decline_rate if decline_rate > 0 else 999
                
        if latest_battery <= 0:
            status = "dead"
        elif latest_battery < 10:
            status = "critical"
        elif latest_battery < 20 or projected_hours < 24:
            status = "needs_visit"
        else:
            status = "ok"
            
        near_charging = float(latest_row.get('movement', 1)) == 0 and latest_battery > first_battery
        
        # Build history (last 20 readings)
        last_20 = group.tail(20)
        history = []
        for _, row in last_20.iterrows():
            ts = row['timestamp']
            history.append({
                "battery": float(row.get('battery', 0)),
                "timestamp": ts.isoformat() if pd.notnull(ts) else None,
                "movement": float(row.get('movement', 0)),
                "temperature": float(row.get('temperature', 0)),
                "heartbeat": float(row.get('heartbeat', 0))
            })
            
        results.append({
            "device_id": str(device_id),
            "battery_percent": latest_battery,
            "projected_hours_remaining": round(min(projected_hours, 999), 1),
            "decline_rate_per_hour": round(decline_rate, 2),
            "status": status,
            "last_seen": last_seen.isoformat() if pd.notnull(last_seen) else None,
            "reading_count": reading_count,
            "near_charging": near_charging,
            "latest_temp": float(latest_row.get('temperature', 0)),
            "latest_hr": float(latest_row.get('heartbeat', 0)),
            "temp_status": str(latest_row.get('temp_status', 'normal')),
            "hr_status": str(latest_row.get('hr_status', 'normal')),
            "geohash": str(latest_row.get('geohash', '')),
            "lat": float(latest_row.get('latitude', 0)),
            "lon": float(latest_row.get('longitude', 0)),
            "vitals_history": history
        })
        
    # Sort: dead first, then critical, then needs_visit, then ok
    status_order = {"dead": 0, "critical": 1, "needs_visit": 2, "ok": 3}
    results.sort(key=lambda x: (status_order.get(x["status"], 4), x["battery_percent"]))
    
    return results
