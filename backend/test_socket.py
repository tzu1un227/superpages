import socketio
import time

def test_connection():
    sio = socketio.Client(ssl_verify=False)
    target_url = "https://irl-svr.ee.yzu.edu.tw:5013"
    namespace = "/websoc"
    
    print(f"Testing connection to {target_url} with namespace {namespace} (ssl_verify=False)...")
    try:
        sio.connect(target_url, namespaces=[namespace], wait_timeout=10, transports=['polling'])
        print("Successfully connected!")
        
        data = {'user': 'yzuadmin', 'type': 'Sensor', 'message': 'SQL|True'}
        print(f"Emitting test event: {data}")
        sio.emit('websoc_message', data, namespace=namespace)
        
        time.sleep(1)
        print("Event emitted.")
        sio.disconnect()
        print("Disconnected.")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_connection()
Line-Bot-Main
