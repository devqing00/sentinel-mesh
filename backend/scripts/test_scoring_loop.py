import asyncio
import pandas as pd
from app.services.live_simulation import start_simulation
from app.services.risk_scoring import score_all_users

async def main():
    print("Starting simulation...")
    await start_simulation()
    
    for i in range(5):
        print(f"Scoring iteration {i+1}...")
        try:
            res = await score_all_users()
            print(f"Iteration {i+1} got {len(res)} users")
        except Exception as e:
            print(f"Exception on iteration {i+1}:")
            import traceback
            traceback.print_exc()
        await asyncio.sleep(2)

if __name__ == "__main__":
    asyncio.run(main())
