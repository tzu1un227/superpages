import socketio
import time
import os
from flask import g
from models import OAConfig

WS_URL = os.environ.get('WS_URL', "https://irl-svr.ee.yzu.edu.tw:5013")
DEFAULT_BOT_NAME = "websoc"

def send_socket_event(data, namespace=None, wait_time=0.5):
    """
    Sends an event via Socket.IO to the bot engine.
    Ensures thread-safe connection by creating a new client instance per call.
    wait_time: The time to keep the connection alive after emitting the event.
    """
    # Create a fresh client for every call to prevent concurrency race conditions
    # ssl_verify=False is needed due to internal Docker/Proxy cert issues
    local_sio = socketio.Client(reconnection=False, ssl_verify=False, request_timeout=15)
    
    target_ws_url = WS_URL
    bot_name = DEFAULT_BOT_NAME
    current_oa_id = getattr(g, 'current_oa_id', None)
    current_oa_config = getattr(g, 'current_oa_config', None)
    
    # 1. Resolve Target URL and Bot Name
    if current_oa_config:
        try:
            if current_oa_config.other_settings:
                settings = current_oa_config.other_settings
                if settings.get('socket_url'):
                    target_ws_url = settings['socket_url']
                
                # Resolve bot name: 
                # According to user, project standard is 'websoc' regardless of app_name.
                # Priority: 1. socket_name (explicit override) 2. DEFAULT_BOT_NAME ('websoc')
                bot_name = settings.get('socket_name') or DEFAULT_BOT_NAME
                
        except Exception as e:
            print(f"DEBUG: send_socket_event | Error reading from g.current_oa_config: {e}")


    # Fallback to DB query if ID provided but names missing in g
    if (bot_name == DEFAULT_BOT_NAME) and current_oa_id:
        try:
            oa = OAConfig.query.get(int(current_oa_id))
            if oa and oa.other_settings:
                settings = oa.other_settings
                if target_ws_url == WS_URL and settings.get('socket_url'):
                    target_ws_url = settings['socket_url']
                if bot_name == DEFAULT_BOT_NAME:
                    bot_name = settings.get('socket_name') or DEFAULT_BOT_NAME
        except Exception as e:
            print(f"DEBUG: send_socket_event | Error querying OAConfig: {e}")

    # Priority 3: Explicit override in data
    # Save the original target app_name to look up DB
    target_app_name = None
    if 'bot_name' in data:
         target_app_name = data['bot_name']
         # Don't overwrite bot_name yet, we need it to default to websoc
         
    if 'target_ws_url' in data:
         target_ws_url = data['target_ws_url']

    # Priority 4: Dynamic lookup by app_name if target_ws_url is still default
    if target_app_name and target_app_name != DEFAULT_BOT_NAME:
        try:
            # Look through all OAConfigs to find a matching app_name
            for oa in OAConfig.query.all():
                if oa.other_settings and oa.other_settings.get('app_name') == target_app_name:
                    if target_ws_url == WS_URL and oa.other_settings.get('socket_url'):
                        target_ws_url = oa.other_settings['socket_url']
                    if bot_name == DEFAULT_BOT_NAME and oa.other_settings.get('socket_name'):
                        bot_name = oa.other_settings['socket_name']
                    break
        except Exception as e:
            print(f"DEBUG: send_socket_event | Error querying OAConfig by app_name: {e}")

    # Ensure bot_name falls back to websoc if not overridden by DB or 'socket_name'
    if not bot_name:
        bot_name = DEFAULT_BOT_NAME

    # Resolve Namespace
    final_namespace = namespace if namespace else f"/{bot_name}"

    print(f"DEBUG: [SOCKET_INIT] Target: {target_ws_url} | BotName: {bot_name} | Namespace: {final_namespace} | OA_ID: {current_oa_id}")
    
    try:
        # Use polling for better robustness across proxies and faster connection in one-off calls
        transports = ['polling'] 
        
        # Connect to *only* the specific namespace needed to avoid "One or more namespaces failed" error
        # Some servers/load balancers (especially on Heroku) are picky about multi-namespace requests
        local_sio.connect(target_ws_url, namespaces=[final_namespace], wait_timeout=10, transports=transports)
        print(f"DEBUG: [SOCKET_CONNECTED] Active Transport: {local_sio.transport}")
    except Exception as e:

        print(f"SOCKET_ERROR: Connection failed to {target_ws_url}: {e}")
        raise Exception(f"無法連線至機器人服務 ({target_ws_url}): {str(e)}")
    
    try:
        content = data.get('message', '')
        msg_type = data.get('type', '')
        event_name = f'{bot_name}_message'
        
        # Split event for Postback with tags (maintain existing logic)
        if msg_type == 'Postback' and '|set_tag|' in content:
            msg_content, tag_part = content.split('|set_tag|', 1)
            
            data_msg = data.copy()
            data_msg['message'] = msg_content
            data_msg['type'] = 'Message'
            local_sio.emit(event_name, data_msg, namespace=final_namespace)
            
            time.sleep(0.1)
            
            data_pb = data.copy()
            data_pb['message'] = f"set_tag|{tag_part}"
            local_sio.emit(event_name, data_pb, namespace=final_namespace)
            print(f"DEBUG: [SOCKET_EMITTED] Split Postback/Tag events with event_name: {event_name}")
        else:
            local_sio.emit(event_name, data, namespace=final_namespace)
            print(f"DEBUG: [SOCKET_EMITTED] Event: {event_name} | Type: {msg_type}")
            
        # Give some time for emission to flush before disconnect
        time.sleep(wait_time)
    except Exception as e:
        print(f"SOCKET_ERROR: Emission failed: {e}")
    finally:
        try:
            local_sio.disconnect()
            print(f"DEBUG: [SOCKET_DISCONNECTED]")
        except:
            pass

def send_socket_events_batch(events, namespace=None, socket_url=None, bot_name=None):
    """
    Sends multiple events via a single Socket.IO connection.
    events: List of data dicts.
    """
    if not events: return
    
    local_sio = socketio.Client(ssl_verify=False)
    target_ws_url = socket_url if socket_url else WS_URL
    target_bot_name = bot_name if bot_name else DEFAULT_BOT_NAME
    
    if not socket_url or not bot_name:
        try:
            current_oa_config = getattr(g, 'current_oa_config', None)
            if current_oa_config:
                settings = current_oa_config.other_settings
                if settings:
                    if not socket_url: target_ws_url = settings.get('socket_url') or WS_URL
                    if not bot_name: target_bot_name = settings.get('socket_name') or DEFAULT_BOT_NAME
        except: pass

    final_namespace = namespace if namespace else f"/{target_bot_name}"
    event_name = f'{target_bot_name}_message'

    try:
        local_sio.connect(target_ws_url, namespaces=[final_namespace], wait_timeout=10, transports=['polling'])
        print(f"DEBUG: [BATCH_CONNECTED] URL: {target_ws_url} | NS: {final_namespace}")
        for data in events:
            local_sio.emit(event_name, data, namespace=final_namespace)
            time.sleep(0.02)
        time.sleep(1.0) # Increased to ensure flush
        print(f"DEBUG: [BATCH_FLUSHED] Sent {len(events)} events")
    finally:
        try: local_sio.disconnect()
        except: pass

