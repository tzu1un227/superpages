import requests
import json

base_url = "http://localhost:5000/api" # Assuming it's running here

try:
    print("Testing /api/schedules...")
    resp = requests.get(f"{base_url}/schedules")
    print(f"Status: {resp.status_code}")
    print(f"Content-Type: {resp.headers.get('Content-Type')}")
    data = resp.json()
    print(f"Data type: {type(data)}")
    if isinstance(data, list):
        print(f"Count: {len(data)}")
        if len(data) > 0:
            print("First item preview:")
            print(json.dumps(data[0], indent=2, ensure_ascii=False))
    else:
        print("Data is not a list!")
        print(data)

    print("\nTesting /api/projects...")
    resp = requests.get(f"{base_url}/projects")
    print(f"Status: {resp.status_code}")
    data = resp.json()
    print(f"Data type: {type(data)}")
    
except Exception as e:
    print(f"Error: {e}")
