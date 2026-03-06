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
    """
    target_ws_url = WS_URL
    current_oa_id = getattr(g, 'current_oa_id', None)
    current_oa_config = getattr(g, 'current_oa_config', None)
    
    print(f"DEBUG: send_socket_event | initial target_ws_url={target_ws_url}, g.current_oa_id={current_oa_id}")

    # Priority 1: Use g.current_oa_config if available
    if current_oa_config:
        try:
            if current_oa_config.other_settings and 'socket_url' in current_oa_config.other_settings:
                if current_oa_config.other_settings['socket_url']:
                    target_ws_url = current_oa_config.other_settings['socket_url']
                    print(f"DEBUG: send_socket_event | Found socket_url in g.current_oa_config: {target_ws_url}")
        except Exception as e:
            print(f"DEBUG: send_socket_event | Error reading from g.current_oa_config: {e}")

    # Priority 2: Use g.current_oa_id to query if config not in g or URL not found
    if target_ws_url == WS_URL and current_oa_id:
        try:
            oa = OAConfig.query.get(int(current_oa_id))
            if oa and oa.other_settings and 'socket_url' in oa.other_settings:
                if oa.other_settings['socket_url']:
                    target_ws_url = oa.other_settings['socket_url']
                    print(f"DEBUG: send_socket_event | Found socket_url by querying ID {current_oa_id}: {target_ws_url}")
        except Exception as e:
            print(f"DEBUG: send_socket_event | Error querying OAConfig for ID {current_oa_id}: {e}")

    # Priority 3: Check if data itself has a preferred URL
    if 'target_ws_url' in data:
         target_ws_url = data['target_ws_url']
         print(f"DEBUG: send_socket_event | Overridden by data['target_ws_url']: {target_ws_url}")

    print(f"DEBUG: Final Socket URL decided: {target_ws_url} (Namespace: {namespace})")
    
    try:
        transports = ['polling', 'websocket']
        if 'herokuapp.com' in target_ws_url:
            transports = ['polling']
            print(f"DEBUG: send_socket_event | Forcing polling transport for Heroku: {target_ws_url}")
            
        sio.connect(target_ws_url, namespaces=[namespace], wait_timeout=10, transports=transports)
    except Exception as e:
        print(f"SOCKET_ERROR: Failed to connect to {target_ws_url}: {e}")
        raise Exception(f"無法連線至機器人服務 ({target_ws_url}): {str(e)}")
    
    content = data.get('message', '')
    msg_type = data.get('type', '')
    
    # Split event for Postback with tags
    if msg_type == 'Postback' and '|set_tag|' in content:
        try:
            msg_content, tag_part = content.split('|set_tag|', 1)
            data_msg = data.copy()
            data_msg['message'] = msg_content
            data_msg['type'] = 'Message'
            sio.emit(f'{BOT_NAME}_message', data_msg, namespace=namespace)
            time.sleep(0.1)
            data_pb = data.copy()
            data_pb['message'] = f"set_tag|{tag_part}"
            sio.emit(f'{BOT_NAME}_message', data_pb, namespace=namespace)
        except Exception as e:
            print(f"Error splitting event in trigger: {e}")
            sio.emit(f'{BOT_NAME}_message', data, namespace=namespace)
    else:
        sio.emit(f'{BOT_NAME}_message', data, namespace=namespace)
    
    time.sleep(0.5)
    sio.disconnect()
