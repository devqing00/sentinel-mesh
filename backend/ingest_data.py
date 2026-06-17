import os
import requests

os.environ["DATA_DIR"] = "c:/Users/QING/Desktop/Qing/sentinel-mesh"

response = requests.post("http://localhost:8000/api/ingest/all")
print("Status Code:", response.status_code)
print("Response:", response.json())
