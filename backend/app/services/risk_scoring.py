import os
import pandas as pd
from datetime import datetime, timezone
from collections import defaultdict
import joblib

DATA_DIR = os.path.join(os.path.dirname(__file__), "../../../data")

# Memory Cache
_ranked_table_cache = None
_cache_time = None

_mob_df_cache = None
_con_df_cache = None
_vit_df_cache = None

import threading
_live_mob_buffer = []
_live_con_buffer = []
_live_vit_buffer = []
_live_lock = threading.Lock()
MAX_LIVE_BUFFER = 5000

def append_live_records(mob_doc=None, con_doc=None, vit_doc=None):
    global _ranked_table_cache, _cache_time
    with _live_lock:
        if mob_doc:
            _live_mob_buffer.append(mob_doc)
            if len(_live_mob_buffer) > MAX_LIVE_BUFFER: _live_mob_buffer.pop(0)
        if con_doc:
            _live_con_buffer.append(con_doc)
            if len(_live_con_buffer) > MAX_LIVE_BUFFER: _live_con_buffer.pop(0)
        if vit_doc:
            _live_vit_buffer.append(vit_doc)
            if len(_live_vit_buffer) > MAX_LIVE_BUFFER: _live_vit_buffer.pop(0)
        # Invalidate ranking cache to ensure dashboard updates instantly
        _ranked_table_cache = None
        _cache_time = None

def get_dataframes():
    global _mob_df_cache, _con_df_cache, _vit_df_cache
    
    if _mob_df_cache is None or _con_df_cache is None or _vit_df_cache is None:
        mob_df = pd.DataFrame()
        con_df = pd.DataFrame()
        vit_df = pd.DataFrame()
        
        mob_path = os.path.join(DATA_DIR, "mobility.csv")
        if os.path.exists(mob_path):
            mob_df = pd.read_csv(mob_path)
            if not mob_df.empty:
                mob_df['timestamp'] = pd.to_datetime(mob_df['date'] + ' ' + mob_df['time'], errors='coerce')
                if mob_df['timestamp'].dt.tz is None:
                    mob_df['timestamp'] = mob_df['timestamp'].dt.tz_localize('UTC')

        con_path = os.path.join(DATA_DIR, "contact_tracing.csv")
        if os.path.exists(con_path):
            con_df = pd.read_csv(con_path)
            if not con_df.empty:
                con_df['timestamp'] = pd.to_datetime(con_df['date'] + ' ' + con_df['time'], errors='coerce')
                if con_df['timestamp'].dt.tz is None:
                    con_df['timestamp'] = con_df['timestamp'].dt.tz_localize('UTC')

        vit_path = os.path.join(DATA_DIR, "vitals.csv")
        if os.path.exists(vit_path):
            vit_df = pd.read_csv(vit_path)
            if not vit_df.empty:
                vit_df['timestamp'] = pd.to_datetime(vit_df['date'] + ' ' + vit_df['time'], errors='coerce')
                if vit_df['timestamp'].dt.tz is None:
                    vit_df['timestamp'] = vit_df['timestamp'].dt.tz_localize('UTC')

        _mob_df_cache = mob_df
        _con_df_cache = con_df
        _vit_df_cache = vit_df

    with _live_lock:
        live_mob = pd.DataFrame(_live_mob_buffer)
        live_con = pd.DataFrame(_live_con_buffer)
        live_vit = pd.DataFrame(_live_vit_buffer)

    final_mob = pd.concat([_mob_df_cache, live_mob], ignore_index=True) if not live_mob.empty else _mob_df_cache
    final_con = pd.concat([_con_df_cache, live_con], ignore_index=True) if not live_con.empty else _con_df_cache
    final_vit = pd.concat([_vit_df_cache, live_vit], ignore_index=True) if not live_vit.empty else _vit_df_cache

    return final_mob, final_con, final_vit

async def score_all_users(start_date=None, end_date=None, split_date=None, force_refresh=False):
    global _ranked_table_cache, _cache_time
    now = datetime.now(timezone.utc)
    
    if _ranked_table_cache and not force_refresh:
        if _cache_time and (now - _cache_time).total_seconds() < 300:
            return _ranked_table_cache

    if not split_date:
        split_date = datetime(2024, 3, 1, tzinfo=timezone.utc)
    if isinstance(split_date, str):
        split_date = datetime.fromisoformat(split_date.replace("Z", "+00:00"))

    TEMP_THRESHOLD = float(os.getenv("TEMP_THRESHOLD", "38.0"))
    HR_THRESHOLD = int(os.getenv("HR_THRESHOLD", "100"))

    user_metrics = defaultdict(lambda: {
        "phase1": {"vitals_anomalies": 0, "contacts": 0, "exposure_sum": 0, "exposure_count": 0, "devices": set()},
        "phase2": {"vitals_anomalies": 0, "contacts": 0, "exposure_sum": 0, "exposure_count": 0, "devices": set()},
        "geohashes": defaultdict(int)
    })

    mob_df, con_df, vit_df = get_dataframes()

    if not mob_df.empty:
        for row in mob_df.itertuples():
            uid = str(getattr(row, 'user_id', ''))
            if not uid or uid == 'nan': continue
            ts = getattr(row, 'timestamp', None)
            if pd.isnull(ts): continue
            phase = "phase1" if ts < split_date else "phase2"
            
            exp = float(getattr(row, 'exposure_score', 0))
            if not pd.isnull(exp):
                user_metrics[uid][phase]["exposure_sum"] += exp
                user_metrics[uid][phase]["exposure_count"] += 1
                
            gh = str(getattr(row, 'geohash', ''))
            if gh and gh != 'nan':
                user_metrics[uid]["geohashes"][gh[:4]] += 1

    if not con_df.empty:
        for row in con_df.itertuples():
            uid = str(getattr(row, 'user_id', ''))
            if not uid or uid == 'nan': continue
            ts = getattr(row, 'timestamp', None)
            if pd.isnull(ts): continue
            phase = "phase1" if ts < split_date else "phase2"
            
            user_metrics[uid][phase]["contacts"] += 1
            gh = str(getattr(row, 'geohash', ''))
            if gh and gh != 'nan':
                user_metrics[uid]["geohashes"][gh[:4]] += 1

    if not vit_df.empty:
        for row in vit_df.itertuples():
            temp = float(getattr(row, 'temperature', 0))
            hr = float(getattr(row, 'heartbeat', 0))
            temp_status = str(getattr(row, 'temp_status', ''))
            hr_status = str(getattr(row, 'hr_status', ''))
            
            is_anomalous = (
                temp >= TEMP_THRESHOLD or
                temp_status == "high" or
                hr > HR_THRESHOLD or
                hr_status == "high"
            )
            if not is_anomalous:
                continue
            
            mac = str(getattr(row, 'device_id', ''))
            if not mac or mac == 'nan': continue
            uid = mac.replace("D", "U")
            
            ts = getattr(row, 'timestamp', None)
            if pd.isnull(ts): continue
            phase = "phase1" if ts < split_date else "phase2"
            user_metrics[uid][phase]["vitals_anomalies"] += 1

    model_path = os.path.join(os.path.dirname(__file__), "sentinel_risk_model.pkl")
    try:
        model = joblib.load(model_path)
    except Exception as e:
        print(f"Error loading ML model: {e}")
        model = None

    ranked_table = []
    uids = list(user_metrics.keys())
    
    if model and uids:
        p1_features = []
        p2_features = []
        for uid in uids:
            data = user_metrics[uid]
            p1_v = data["phase1"]["vitals_anomalies"]
            p1_c = data["phase1"]["contacts"]
            t_v = p1_v + data["phase2"]["vitals_anomalies"]
            t_c = p1_c + data["phase2"]["contacts"]
            ts_shift = len(data["geohashes"]) * 10
            p1_features.append({'vitals_anomalies': p1_v, 'direct_contacts': p1_c, 'trajectory_shift': ts_shift})
            p2_features.append({'vitals_anomalies': t_v, 'direct_contacts': t_c, 'trajectory_shift': ts_shift})
            
        p1_preds = model.predict(pd.DataFrame(p1_features))
        p2_preds = model.predict(pd.DataFrame(p2_features))
    else:
        p1_preds = []
        p2_preds = []

    for idx, uid in enumerate(uids):
        data = user_metrics[uid]
        p1_v = data["phase1"]["vitals_anomalies"]
        p1_c = data["phase1"]["contacts"]
        t_v = p1_v + data["phase2"]["vitals_anomalies"]
        t_c = p1_c + data["phase2"]["contacts"]
        
        if model:
            p1_risk = float(p1_preds[idx])
            p2_risk = float(p2_preds[idx])
            confidence = 0.94
        else:
            p1_risk = min(100.0, p1_v * 5 + p1_c * 2)
            p2_risk = min(100.0, t_v * 5 + t_c * 2)
            confidence = 0.5
            
        shift = p2_risk - p1_risk
        
        if p2_risk >= 70 and shift > 5:
            category = "escalating"
        elif p2_risk >= 70:
            category = "persistently-high"
        elif p1_risk >= 70 and shift < -5:
            category = "recovering"
        elif p2_risk < 40:
            category = "low-risk"
        else:
            category = "stable"
            
        top_geo = None
        if data["geohashes"]:
            top_geo = max(data["geohashes"].items(), key=lambda x: x[1])[0]
            
        ranked_table.append({
            "user_id": uid,
            "phase1_risk": round(p1_risk, 1),
            "phase2_risk": round(p2_risk, 1),
            "trajectory_shift": round(shift, 1),
            "category": category,
            "top_geo": top_geo,
            "total_vitals_anomalies": t_v,
            "total_contacts": t_c,
            "ml_confidence": confidence
        })

    ranked_table.sort(key=lambda x: (x["phase2_risk"], x["trajectory_shift"]), reverse=True)
    
    _ranked_table_cache = ranked_table
    _cache_time = now
    return ranked_table

async def calculate_community_risks():
    return []

async def get_anomalous_vitals_summary():
    return []
