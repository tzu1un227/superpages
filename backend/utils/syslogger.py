import time
import logging
import socket
import ssl
import threading
import os
import json
from functools import wraps
from flask import request, g
from logging.handlers import SysLogHandler

class ReconnectingSSLSysLogHandler(SysLogHandler):
    def __init__(self, address, use_tls=False, facility=SysLogHandler.LOG_USER, max_retries=3, retry_interval=2):
        logging.Handler.__init__(self)
        socket.setdefaulttimeout(5.0)
        self.address = address
        self.facility = facility
        self.use_tls = use_tls
        self.max_retries = max_retries
        self.retry_interval = retry_interval
        self.socket = None
        self.last_failed_time = time.mktime(time.struct_time((1980,1,1,0,0,0,0,0,-1)))
        self.cooldown_time = 2 * 60  # 2 分鐘冷卻
        self._connecting = False
        self._connect_socket()

    def _can_reconnect(self):
        return (time.time() - self.last_failed_time) > self.cooldown_time

    def _connect_socket(self):
        if not self._can_reconnect(): return
        if self._connecting: return

        self._connecting = True
        t = threading.Thread(target=self._connect_socket_thread)
        t.daemon = True
        t.start()

    def _connect_socket_thread(self):
        retries = 0
        while retries < self.max_retries:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                if self.use_tls:
                    context = ssl.create_default_context()
                    context.check_hostname = False
                    context.verify_mode = ssl.CERT_NONE
                    self.socket = context.wrap_socket(s, server_hostname=self.address[0])
                else:
                    self.socket = s
                self.socket.connect(self.address)
                break
            except (OSError, ssl.SSLError) as e:
                retries += 1
                time.sleep(self.retry_interval)
                if retries >= self.max_retries:
                    self.last_failed_time = time.time()
                    self.socket = None
                    self._connecting = False
                    return
        self._connecting = False

    def close(self):
        if self.socket:
            try:
                self.socket.close()
            except:
                pass
            self.socket = None
        logging.Handler.close(self)

    def emit(self, record):
        try:
            msg = self.format(record) + '\n'
            prio = '<%d>' % self.encodePriority(self.facility, self.mapPriority(record.levelname))
            msg = (prio + msg).encode('utf-8')

            if not self.socket: 
                self._connect_socket()
                return
            if not self._connecting:
                self.socket.sendall(msg)
        except (OSError, ssl.SSLError):
            self.socket = None
        except Exception:
            pass


syslog_logger = logging.getLogger("superpages_syslog")
syslog_logger.setLevel(logging.INFO)
syslog_logger.propagate = False
_is_initialized = False

def init_syslogger():
    global _is_initialized
    if _is_initialized:
        return
        
    syslog_host = os.environ.get('NAS_SYSLOG_HOST')
    syslog_port = os.environ.get('NAS_SYSLOG_PORT')
    appname = os.environ.get('NAS_SYSLOG_APPNAME', 'superpages_docker')
    
    if syslog_host and syslog_port:
        try:
            syslog_port = int(syslog_port)
            use_tls = os.environ.get('NAS_SYSLOG_TLS', 'false').lower() == 'true'
            
            handler = ReconnectingSSLSysLogHandler(
                address=(syslog_host, syslog_port),
                use_tls=use_tls
            )
            # 相容 Line-Bot-Main BSD Format
            formatter = logging.Formatter(f'%(asctime)s {appname} {appname} %(message)s (%(module)s:%(lineno)d)', datefmt='%b %d %H:%M:%S')
            handler.setFormatter(formatter)
            handler.setLevel(logging.INFO)
            syslog_logger.addHandler(handler)
            _is_initialized = True
            print(f"[*] Syslog Logger Initialized ({appname} -> {syslog_host}:{syslog_port}, TLS={use_tls})")
        except Exception as e:
            print(f"Failed to initialize syslogger: {e}")

def get_client_ip():
    try:
        if request.headers.getlist("X-Forwarded-For"):
            return request.headers.getlist("X-Forwarded-For")[0].split(',')[0].strip()
        return request.remote_addr
    except:
        return ""

def syslog_action(action_name):
    """裝飾器：用於記錄 API 操作並拋送給 NAS Syslog"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                response = f(*args, **kwargs)
                status = "success"
                
                # Flask 的 response 可能是 Tuple 也可能是 Response object
                if isinstance(response, tuple) and len(response) > 1:
                    status_code = response[1]
                    if isinstance(status_code, int) and status_code >= 400:
                        status = "error"
                elif hasattr(response, 'status_code') and response.status_code >= 400:
                    status = "error"
                
                user_id = ""
                # superpages 中可能將 user 放進 request 或 session 等
                # 大部分的 backend endpoint 使用 jwt_required
                try:
                    from flask_jwt_extended import get_jwt_identity
                    user_id = get_jwt_identity() or ""
                except Exception:
                    pass
                
                log_data = {
                    "action": action_name,
                    "status": status,
                    "endpoint": request.path,
                    "method": request.method,
                    "user": user_id,
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z")
                }
                if kwargs:
                    log_data["details"] = kwargs
                
                syslog_logger.info(json.dumps(log_data, ensure_ascii=False))
                return response
                
            except Exception as e:
                user_id = ""
                try:
                    from flask_jwt_extended import get_jwt_identity
                    user_id = get_jwt_identity() or ""
                except Exception:
                    pass
                    
                log_data = {
                    "action": action_name,
                    "status": "error",
                    "endpoint": request.path,
                    "method": request.method,
                    "user": user_id,
                    "error_msg": str(e),
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z")
                }
                syslog_logger.info(json.dumps(log_data, ensure_ascii=False))
                raise e
        return decorated_function
    return decorator
