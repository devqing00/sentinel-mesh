from fastapi import APIRouter
import random

router = APIRouter()

# Generate a realistic mock dataset
MOCK_AGENTS = [
    {"id": f"A-{i:03d}", "name": name, "role": role, "status": random.choice(["Available", "On Mission", "In Transit", "Resting"]), "location": loc, "distance": f"{random.uniform(0.5, 15.0):.1f} km", "ETA": f"{random.randint(5, 45)} mins"}
    for i, (name, role, loc) in enumerate([
        ("Dr. Amara Eze", "Field Epidemiologist", "Lagos, NG"),
        ("Paramedic Team Alpha", "Rapid Response", "Abuja, NG"),
        ("Dr. Tunde Okafor", "Infectious Disease Spec.", "Port Harcourt, NG"),
        ("Mobile Clinic Unit 7", "Testing & Triage", "Lagos, NG"),
        ("Dr. Ngozi Aliu", "Medical Officer", "Ibadan, NG"),
        ("Paramedic Team Bravo", "Rapid Response", "Lagos, NG"),
        ("Contact Tracing Squad 1", "Tracing", "Kano, NG"),
        ("Dr. Yemi Adebayo", "Field Epidemiologist", "Abuja, NG"),
        ("Mobile Clinic Unit 3", "Testing & Triage", "Enugu, NG"),
        ("Hazmat Team Delta", "Decontamination", "Lagos, NG"),
        ("Dr. Fatima Bello", "Public Health Spec.", "Kaduna, NG"),
        ("Drone Delivery Unit", "Logistics", "Abuja, NG")
    ], start=1)
]

MOCK_FACILITIES = [
    {"id": f"F-{i:03d}", "name": name, "type": typ, "capacity": f"{random.randint(30, 100)}%", "beds": random.randint(0, 50)}
    for i, (name, typ) in enumerate([
        ("Lagos University Teaching Hospital", "Tertiary"),
        ("NCDC Reference Lab", "Testing Center"),
        ("Mainland Infectious Disease Hospital", "Specialized Isolation"),
        ("Abuja National Hospital", "Tertiary"),
        ("Kano State Isolation Center", "Specialized Isolation"),
        ("Port Harcourt Diagnostic Lab", "Testing Center"),
        ("Ibadan Central Clinic", "Primary Care"),
        ("Enugu Mobile Triage Center", "Triage")
    ], start=1)
]

@router.get("/agents")
async def get_agents():
    """
    Returns a list of all active field agents and rapid response teams.
    """
    return {"agents": MOCK_AGENTS}

@router.get("/facilities")
async def get_facilities():
    """
    Returns a list of nearby medical facilities, testing centers, and their capacities.
    """
    return {"facilities": MOCK_FACILITIES}
