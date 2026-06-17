import asyncio
from app.db import connect_to_mongo, close_mongo_connection
from app.services.risk_scoring import score_all_users, get_dataframes

async def main():
    print("Running score_all_users()...")
    try:
        res = await score_all_users()
        print("Success! Got", len(res), "users")
    except Exception as e:
        print("Exception occurred:")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
