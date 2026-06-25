import socketio
import time
import os
from flask import g
from models import OAConfig
import json
import hmac
import hashlib

WS_URL = os.environ.get('WS_URL', "https://irl-svr.ee.yzu.edu.tw:5013")
DEFAULT_BOT_NAME = "websoc"

_global_sios = {}

def generate_socket_auth():
    secret_key = os.environ.get('SIGNATURE_KEY', '')
    if not secret_key:
        return None
    
    timestamp = time.time()
    payload = {"timestamp": timestamp}
    message = json.dumps(payload, sort_keys=True).encode()
    signature = hmac.new(secret_key.encode(), message, hashlib.sha256).hexdigest()
    payload['signature'] = signature
    return payload

def get_shared_sio(target_ws_url, namespace):
    key = f"{target_ws_url}_{namespace}"
    sio = _global_sios.get(key)
    if not sio:
        sio = socketio.Client(reconnection=False, ssl_verify=False, request_timeout=60)
        _global_sios[key] = sio
    return sio

def send_socket_event(data, namespace=None, wait_time=0.5, poll_func=None, max_polls=15, poll_interval=1.0):
    """
    Sends an event via Socket.IO to the bot engine.
    Uses a persistent shared connection per target to prevent Heroku/eventlet connect/disconnect crashes.
    """
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
                
                bot_name = settings.get('socket_name') or DEFAULT_BOT_NAME
        except Exception as e:
            print(f"DEBUG: send_socket_event | Error reading from g.current_oa_config: {e}")

    if (bot_name == DEFAULT_BOT_NAME) and current_oa_id:
        try:
            oa = OAConfig.query.get(int(current_oa_id))
            if oa and oa.other_settings:
                settings = oa.other_settings
                if target_ws_url == WS_URL and settings.get('socket_url'):
                    target_ws_url = settings['socket_url']
                if settings.get('socket_name'):
                    bot_name = settings['socket_name']
        except Exception as e:
            pass

    if not target_ws_url:
        target_ws_url = WS_URL
    if not bot_name:
        bot_name = DEFAULT_BOT_NAME

    final_namespace = namespace if namespace else f"/{bot_name}"
    
    local_sio = get_shared_sio(target_ws_url, final_namespace)
    
    # Priority 3: Explicit override in data
    # Save the original target app_name to look up DB
    target_app_name = None
    if 'bot_name' in data:
         target_app_name = data['bot_name']
         
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

    final_namespace = namespace if namespace else f"/{bot_name}"
    local_sio = get_shared_sio(target_ws_url, final_namespace)
        
    print(f"DEBUG: [SOCKET_INIT] Target: {target_ws_url} | BotName: {bot_name} | Namespace: {final_namespace} | OA_ID: {current_oa_id}")
    
    try:
        if not local_sio.connected:
            transports = ['polling'] 
            auth_data = generate_socket_auth()
            connect_kwargs = {
                'namespaces': [final_namespace],
                'wait_timeout': 10,
                'transports': transports
            }
            if auth_data:
                connect_kwargs['auth'] = auth_data
                
            local_sio.connect(target_ws_url, **connect_kwargs)
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
            
        # Give some time for emission to flush before disconnect, or poll DB
        if poll_func:
            poll_result = None
            for _ in range(max_polls):
                time.sleep(poll_interval)
                poll_result = poll_func()
                if poll_result is not None:
                    break
            return poll_result
        else:
            time.sleep(wait_time)
            return None
    except Exception as e:
        print(f"SOCKET_ERROR: Emission failed: {e}")
    finally:
        # DO NOT disconnect here! We want to keep the connection alive in the global pool.
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
        auth_data = generate_socket_auth()
        connect_kwargs = {
            'namespaces': [final_namespace],
            'wait_timeout': 10,
            'transports': ['polling']
        }
        if auth_data:
            connect_kwargs['auth'] = auth_data
            
        local_sio.connect(target_ws_url, **connect_kwargs)
        print(f"DEBUG: [BATCH_CONNECTED] URL: {target_ws_url} | NS: {final_namespace}")
        for data in events:
            local_sio.emit(event_name, data, namespace=final_namespace)
            time.sleep(0.02)
        time.sleep(1.0) # Increased to ensure flush
        print(f"DEBUG: [BATCH_FLUSHED] Sent {len(events)} events")
    finally:
        try: local_sio.disconnect()
        except: pass

