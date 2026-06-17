import asyncio
import json
import math
from app.services.risk_scoring import score_all_users

def contains_nan(obj):
    if isinstance(obj, float):
        return math.isnan(obj) or math.isinf(obj)
    elif isinstance(obj, dict):
        return any(contains_nan(v) for v in obj.values())
    elif isinstance(obj, list):
        return any(contains_nan(v) for v in obj)
    return False

async def main():
    res = await score_all_users()
    if not res:
        print("Empty results")
        return
    
    has_nan = contains_nan(res)
    print(f"Contains NaN: {has_nan}")
    
    if has_nan:
        for i, item in enumerate(res):
            if contains_nan(item):
                print(f"Item {i} has NaN: {item}")
                break

if __name__ == "__main__":
    asyncio.run(main())
