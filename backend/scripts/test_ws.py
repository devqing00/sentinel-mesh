import asyncio
import websockets
import json

async def test_ws():
    uri = "ws://localhost:8000/api/risk/ws?token=mock-token"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri, extra_headers={"Origin": "http://localhost:3000"}) as websocket:
            print("Connected!")
            for _ in range(5):
                message = await websocket.recv()
                data = json.loads(message)
                print(f"Received type: {data.get('type')}")
                if data.get('type') == 'ranked_table':
                    print(f"Ranked table length: {len(data.get('data', []))}")
                elif data.get('type') == 'activity_tick':
                    print(f"Activity tick: {data.get('data')}")
                elif data.get('type') == 'new_alert':
                    print(f"New alert: {data.get('data')}")
    except Exception as e:
        print(f"WebSocket error: {e}")

if __name__ == "__main__":
    asyncio.run(test_ws())
