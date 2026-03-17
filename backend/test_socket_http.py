import socketio
import time

def test_connection():
    sio = socketio.Client()
    target_url = "http://140.138.176.197:5013"
    namespace = "/websoc"
    
    print(f"Testing connection to {target_url} with namespace {namespace} (Plain HTTP)...")
    try:
        sio.connect(target_url, namespaces=[namespace], wait_timeout=10, transports=['websocket', 'polling'])
        print("Successfully connected via HTTP!")
        sio.disconnect()
    except Exception as e:
        print(f"HTTP connection failed: {e}")

if __name__ == "__main__":
    test_connection()
