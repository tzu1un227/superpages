
import sys
import os

# Add superpages backend to path
sys.path.append(os.path.abspath(r"C:\Users\70640\Documents\GitHub\superpages\backend"))

from app import app
from flask import json

def test_scheduled_events():
    with app.test_client() as client:
        # Mocking get_current_app_id/get_db_connection behavior implicitly by using the default app context
        # implementation in app.py which falls back to default DB if no g context.
        # However, app.py uses get_current_app_id() which checks g.
        # We might need to fake the app_id in g?
        # get_current_app_id defaults to '5013'.
        
        response = client.get('/api/scheduled-events')
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = json.loads(response.data)
            print(f"Data received ({len(data)} items):")
            for item in data[:5]: # Print first 5
                print(item)
        else:
            print(f"Error: {response.data.decode('utf-8')}")

if __name__ == "__main__":
    test_scheduled_events()
