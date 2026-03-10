import socketio
import time
from flask import g
from models import OAConfig

sio = socketio.Client()
WS_URL = "https://irl-svr.ee.yzu.edu.tw:5013"
BOT_NAME = "websoc"

def send_socket_event(data, namespace='/websoc'):
    """
    Sends an event via Socket.IO to the bot engine.
    Ensures thread-safe connection by creating a new client instance per call.
    """
    # Create a fresh client for every call to prevent concurrency race conditions
    local_sio = socketio.Client()
    
    target_ws_url = WS_URL
    current_oa_id = getattr(g, 'current_oa_id', None)
    current_oa_config = getattr(g, 'current_oa_config', None)
    
    print(f"DEBUG: send_socket_event | namespace={namespace}, g.current_oa_id={current_oa_id}")

    # Priority 1: Use g.current_oa_config if available
    if current_oa_config:
        try:
            if current_oa_config.other_settings and 'socket_url' in current_oa_config.other_settings:
                if current_oa_config.other_settings['socket_url']:
                    target_ws_url = current_oa_config.other_settings['socket_url']
                    print(f"DEBUG: send_socket_event | Using socket_url from g.current_oa_config: {target_ws_url}")
        except Exception as e:
            print(f"DEBUG: send_socket_event | Error reading from g.current_oa_config: {e}")

    # Priority 2: Use g.current_oa_id to query if config not in g or URL not found
    if target_ws_url == WS_URL and current_oa_id:
        try:
            oa = OAConfig.query.get(int(current_oa_id))
            if oa and oa.other_settings and 'socket_url' in oa.other_settings:
                if oa.other_settings['socket_url']:
                    target_ws_url = oa.other_settings['socket_url']
                    print(f"DEBUG: send_socket_event | Using socket_url from DB query (ID {current_oa_id}): {target_ws_url}")
        except Exception as e:
            print(f"DEBUG: send_socket_event | Error querying OAConfig: {e}")

    # Priority 3: Explicit override in data
    if 'target_ws_url' in data:
         target_ws_url = data['target_ws_url']
         print(f"DEBUG: send_socket_event | Overridden by data payload: {target_ws_url}")

    print(f"DEBUG: [SOCKET_CONNECTING] URL: {target_ws_url} | Namespace: {namespace}")
    
    try:
        # Default Socket.IO behavior: try websocket, fallback to polling
        # Removed hard-coded restriction for herokuapp.com to allow better protocol selection
        transports = ['websocket', 'polling'] 
        
        local_sio.connect(target_ws_url, namespaces=[namespace], wait_timeout=10, transports=transports)
        print(f"DEBUG: [SOCKET_CONNECTED] Active Transport: {local_sio.transport}")
    except Exception as e:
        print(f"SOCKET_ERROR: Connection failed to {target_ws_url}: {e}")
        raise Exception(f"無法連線至機器人服務 ({target_ws_url}): {str(e)}")
    
    try:
        content = data.get('message', '')
        msg_type = data.get('type', '')
        
        # Split event for Postback with tags (maintain existing logic)
        if msg_type == 'Postback' and '|set_tag|' in content:
            msg_content, tag_part = content.split('|set_tag|', 1)
            
            data_msg = data.copy()
            data_msg['message'] = msg_content
            data_msg['type'] = 'Message'
            local_sio.emit(f'{BOT_NAME}_message', data_msg, namespace=namespace)
            
            time.sleep(0.1)
            
            data_pb = data.copy()
            data_pb['message'] = f"set_tag|{tag_part}"
            local_sio.emit(f'{BOT_NAME}_message', data_pb, namespace=namespace)
            print(f"DEBUG: [SOCKET_EMITTED] Split Postback/Tag events")
        else:
            local_sio.emit(f'{BOT_NAME}_message', data, namespace=namespace)
            print(f"DEBUG: [SOCKET_EMITTED] Standard event: {msg_type}")
            
        # Give some time for emission to flush before disconnect
        time.sleep(0.5)
    except Exception as e:
        print(f"SOCKET_ERROR: Emission failed: {e}")
    finally:
        try:
            local_sio.disconnect()
            print(f"DEBUG: [SOCKET_DISCONNECTED]")
        except:
            pass
