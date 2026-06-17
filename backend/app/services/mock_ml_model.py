import random
import math
from datetime import datetime, timezone

class MLRiskPredictor:
    """
    A simulated Machine Learning Engine for Sentinel Mesh.
    In a production environment, this would load a serialized model (e.g., model.pkl from scikit-learn or XGBoost)
    and run inference. Here, we use advanced mathematical heuristics to simulate an Isolation Forest 
    for anomaly detection and a predictive regressor for trajectory forecasting.
    """
    def __init__(self):
        self.version = "v2.1.0-xgb"
        self.confidence_base = 0.85
        
    def predict_anomaly_score(self, temp: float, hr: float, resp: float) -> dict:
        """
        Simulates an Isolation Forest anomaly detection model.
        Returns a probability score (0.0 to 1.0) and a list of feature importances.
        """
        if temp is None or hr is None or resp is None:
            return {"anomaly_probability": 0.0, "confidence": 0.0, "features": []}
            
        # Standardize inputs based on typical baselines
        z_temp = (temp - 36.5) / 0.8
        z_hr = (hr - 75.0) / 15.0
        z_resp = (resp - 16.0) / 4.0
        
        # Calculate Euclidean distance from centroid in feature space
        distance = math.sqrt(z_temp**2 + z_hr**2 + z_resp**2)
        
        # Sigmoid activation to bound between 0 and 1
        probability = 1 / (1 + math.exp(-(distance - 2.5)))
        
        features = []
        if abs(z_temp) > 1.5: features.append("temperature_deviance")
        if abs(z_hr) > 1.5: features.append("heart_rate_deviance")
        if abs(z_resp) > 1.5: features.append("resp_rate_deviance")
        
        # Add some stochastic noise to simulate model variance
        probability = min(0.99, max(0.01, probability + random.uniform(-0.02, 0.02)))
        confidence = self.confidence_base + random.uniform(-0.05, 0.05)
        
        return {
            "anomaly_probability": round(probability, 3),
            "confidence": round(confidence, 2),
            "features": features
        }

    def predict_exposure_risk(self, direct_contacts: int, unique_locations: int, time_in_hotzones: float) -> dict:
        """
        Simulates a Network Graph + Random Forest exposure predictor.
        """
        # Feature weighting
        w_contacts = 0.4
        w_locations = 0.2
        w_hotzones = 0.4
        
        # Normalize
        norm_contacts = min(1.0, direct_contacts / 20.0)
        norm_locations = min(1.0, unique_locations / 5.0)
        norm_hotzones = min(1.0, time_in_hotzones / 24.0)
        
        raw_score = (norm_contacts * w_contacts) + (norm_locations * w_locations) + (norm_hotzones * w_hotzones)
        probability = 1 / (1 + math.exp(-10 * (raw_score - 0.5)))
        
        return {
            "exposure_probability": round(probability, 3),
            "predicted_r_naught": round(1.2 + (probability * 3.5), 2)
        }

    def forecast_trajectory(self, current_risk: float, historical_risk_points: list) -> str:
        """
        Simulates an ARIMA or LSTM time-series forecast for the next 48 hours.
        """
        if not historical_risk_points or len(historical_risk_points) < 2:
            return "stable"
            
        # Calculate recent gradient
        delta = current_risk - historical_risk_points[-1]
        
        if delta > 15:
            return "escalating"
        elif delta < -10:
            return "recovering"
        return "stable"

# Singleton instance
ml_engine = MLRiskPredictor()
