from flask import Flask, request, jsonify, g
from flask_cors import CORS
from config import Config
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, date, timedelta
from decimal import Decimal
import threading
import time

app = Flask(__name__)
CORS(app, origins=["https://irl-svr.ee.yzu.edu.tw:5014", "http://localhost:3000", "http://localhost:9016", "https://irl-svr.ee.yzu.edu.tw:5016"])

# Auth and DB imports
from models import db, User, Page, OAConfig
from auth import generate_token, token_required, admin_required
import os
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

# Database configuration
DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

# Configuration for SQLAlchemy
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or 'dev_secret_key'
# Use Postgres for Metadata (Users, Permissions)
app.config['SQLALCHEMY_DATABASE_URI'] = f"postgresql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Register Admin Blueprint
from endpoints.admin import admin_bp
app.register_blueprint(admin_bp, url_prefix='/api/admin')

with app.app_context():
    db.create_all()

    # Seeding Data
    # Seeding Data
    def seed_data():
        print("Seeding/Updating pages...")
        default_pages = [
            {'name': 'Statistics', 'description': '綜合數據'},
            {'name': 'MessageCenter', 'description': '訊息中心'},
            {'name': 'Projects', 'description': '專案與排程'},
            {'name': 'Broadcast', 'description': '群發訊息'},
            {'name': 'ScheduledEvents', 'description': '定時觸發'},
            {'name': 'PrizeStatus', 'description': '獎品查詢'}
        ]
        
        for p in default_pages:
            page = Page.query.filter_by(name=p['name']).first()
            if page:
                if page.description != p['description']:
                    page.description = p['description']
                    print(f"Updated description for {p['name']}")
            else:
                page = Page(name=p['name'], description=p['description'])
                db.session.add(page)
                print(f"Created page {p['name']}")
        
        db.session.commit()
    
    seed_data()

import json

def json_response(data):
    return app.response_class(
        json.dumps(data, default=lambda x: float(x) if isinstance(x, Decimal) else (x.isoformat() if isinstance(x, (datetime, date)) else str(x))),
        mimetype='application/json'
    )

import socketio



WS_URL = "https://irl-svr.ee.yzu.edu.tw:5013"
BOT_NAME = "websoc"

def get_db_connection():
    # Check if a dynamic DB URL is set in the context
    if hasattr(g, 'current_db_url') and g.current_db_url:
        # Assuming g.current_db_url is a DSN string or suitable for psycopg2
        return psycopg2.connect(g.current_db_url)
    
    # Fallback to default DB
    conn = psycopg2.connect(**DB_CONFIG)
    return conn

@app.before_request
def load_oa_context():
    # Skip for OPTIONS requests
    if request.method == 'OPTIONS':
        return

    oa_id = request.headers.get('X-OA-ID')
    if oa_id:
        try:
            # We need to query OAConfig, which is in the default SQLAlchemy DB
            # Ensure we are inside app context (we are via before_request)
            oa_config = OAConfig.query.get(oa_id)
            if oa_config and oa_config.db_url:
                # Security/Permission Check
                # If user is logged in, verify they have access to this OA
                # Note: token_required decorator usually runs *after* before_request if applied to route.
                # However, g.current_user is set by token_required or similar.
                # Since we haven't decoded the token yet globally, we might defer permission check 
                # or we decode token here if we want strict enforcement.
                # For now, we trust the ID exists and rely on route-level @token_required to check permissions
                # But we MUST set the DB URL for the potential subsequent DB calls.
                g.current_oa_config = oa_config
                g.current_db_url = oa_config.db_url
                g.current_oa_id = oa_id
        except Exception as e:
            print(f"Error loading OA context: {e}")

def init_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS scheduled_events (
                event_id SERIAL PRIMARY KEY,
                target_user_id VARCHAR(255),
                message_content TEXT,
                message_type VARCHAR(50) DEFAULT 'Sensor',
                interval_hours FLOAT,
                last_executed_at TIMESTAMP,
                is_enabled BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error initializing database: {e}")

init_db()

def scheduled_event_processor():
    while True:
        try:
            conn = get_db_connection()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            now = datetime.now()
            # Fetch enabled events that are due for next execution
            # Due if never executed OR (last_executed + interval <= now)
            cur.execute("""
                SELECT * FROM scheduled_events 
                WHERE is_enabled = TRUE 
                AND (last_executed_at IS NULL OR (last_executed_at + (interval_hours || ' hours')::interval <= %s))
            """, (now,))
            events = cur.fetchall()
            
            for event in events:
                try:
                    # Reuse trigger logic
                    sio = socketio.Client()
                    namespace = f"/{BOT_NAME}"
                    data = {
                        "user": event['target_user_id'],
                        "message": event['message_content'],
                        "type": event['message_type'],
                        "api_index": 0
                    }
                    print(f"Recurring Trigger: Emitting to {namespace}: {data}")
                    sio.connect(WS_URL, namespaces=[namespace], wait_timeout=3)
                    sio.emit(f'{BOT_NAME}_message', data, namespace=namespace)
                    time.sleep(0.5)
                    sio.disconnect()
                    
                    # Update last execution time
                    cur.execute("UPDATE scheduled_events SET last_executed_at = %s WHERE event_id = %s", (now, event['event_id']))
                    conn.commit()
                except Exception as trigger_err:
                    print(f"Error processing scheduled event {event['event_id']}: {trigger_err}")
            
            cur.close()
            conn.close()
        except Exception as e:
            print(f"Error in scheduled_event_processor: {e}")
        
        time.sleep(10) # Check every 10 seconds

# Start background thread
threading.Thread(target=scheduled_event_processor, daemon=True).start()

@app.route('/api/login', methods=['POST'])
def login():
    # Deprecated simple auth, keeping for compatibility if needed, but prioritizing Google Login
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if username == "admin" and password == "admin":
        return jsonify({"status": "success", "user": {"id": 1, "username": "admin"}})
    return jsonify({"status": "error", "message": "Invalid credentials"}), 401

@app.route('/api/auth/google-login', methods=['POST'])
def google_login():
    try:
        data = request.get_json()
        google_token = data.get('token')
        
        if not google_token:
            return jsonify({'message': 'No token provided'}), 400
        
        try:
            # Verify Google token
            # In production, specify your CLIENT_ID as the second argument
            idinfo = id_token.verify_oauth2_token(google_token, google_requests.Request())
        except ValueError as e:
            print(f"Token verification error: {e}")
            return jsonify({'message': f'Invalid Google token: {str(e)}'}), 400
        
        email = idinfo['email']
        user = User.query.filter_by(email=email).first()
        
        if not user:
            # Auto-register logic or Fail?
            # Requirement: "原先設定好可以有所有權限的google帳號後...新增其他人的帳號"
            # This implies the first user (Super Admin) might need to be created manually or we auto-create the *first* one.
            # For now, let's return 401 if not found, implying they need to be added by an admin.
            # EXCEPTION: If the DB is empty (no users), we could allow the first one to be Admin?
            if User.query.count() == 0:
                user = User(email=email, name=idinfo.get('name'), role='admin')
                db.session.add(user)
                db.session.commit()
            else:
                return jsonify({'message': 'User not authorized'}), 401
        
        # Update user name
        google_name = idinfo.get('name')
        if google_name and user.name != google_name:
            user.name = google_name
            db.session.commit()
        
        token = generate_token(user)
        
        return jsonify({
            'token': token,
            'user': {
                'id': user.id,
                'email': user.email,
                'name': user.name,
                'role': user.role,
                'allowed_oa_configs': user.allowed_oa_configs
            }
        })
    except Exception as e:
        print(e)
        return jsonify({'message': 'Login failed', 'error': str(e)}), 500

@app.route('/api/my_oas', methods=['GET'])
@token_required
def get_my_oas():
    user = g.current_user
    try:
        if user.role == 'admin':
            configs = OAConfig.query.all()
        else:
            # configs = OAConfig.query.filter(OAConfig.id.in_(allowed_ids)).all()
            # If allowed_ids is a list of integers
            if allowed_ids:
                configs = OAConfig.query.filter(OAConfig.id.in_(allowed_ids)).all()
            else:
                configs = []
        
        # Build hierarchical response
        oa_list = []
        
        # Pre-fetch all pages to avoid N+1 queries ideally, but here list is small
        all_pages = Page.query.all()
        pages_map = {p.id: p for p in all_pages}
        
        for c in configs:
            oa_data = {
                'id': c.id, 
                'oa_name': c.oa_name, 
                # 'db_url': c.db_url, # Security: Don't expose DB URL to frontend if not necessary
                'pages': []
            }
            
            if c.page_ids:
                for pid in c.page_ids:
                    if pid in pages_map:
                        p = pages_map[pid]
                        oa_data['pages'].append({
                            'id': p.id,
                            'name': p.name,
                            'description': p.description,
                            'path': f"/oa/{c.id}/{p.name.lower()}" # Frontend can use this or build it
                        })
            oa_list.append(oa_data)
        
        return jsonify({
            'configs': oa_list
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Projects CRUD
@app.route('/api/projects', methods=['GET'])
def get_projects():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM projects ORDER BY project_id")
        projects = cur.fetchall()
        
        # Calculate Status
        now = datetime.now()
        for p in projects:
            start = p['start_date']
            end = p['end_date']
            is_enabled = p['is_enabled']
            
            p['status'] = "未知"
            if not is_enabled:
                if now < start:
                    p['status'] = "編輯中"
                elif now > end:
                    p['status'] = "已終止"
                else:
                    p['status'] = "已暫停"
            else:
                if now < start:
                    p['status'] = "已排程"
                elif now > end:
                    p['status'] = "已完成"
                else:
                    p['status'] = "進行中"

        cur.close()
        conn.close()
        return json_response(projects)
    except Exception as e:
        print(f"Error in get_projects: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.json
    try:
        start_date = datetime.fromisoformat(data['start_date'])
        end_date = datetime.fromisoformat(data['end_date'])
        
        if end_date <= start_date:
            return jsonify({"status": "error", "message": "結束時間必須大於開始時間"}), 400

        import json
        anchor_config = json.dumps(data.get('anchor_config', {}))
        dormancy_config = json.dumps(data.get('dormancy_config', {}))

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO projects (project_name, start_date, end_date, is_enabled, anchor_config, dormancy_config) VALUES (%s, %s, %s, %s, %s, %s) RETURNING project_id",
            (data['project_name'], data['start_date'], data['end_date'], data['is_enabled'], anchor_config, dormancy_config)
        )
        project_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success", "project_id": project_id})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/projects/<int:id>', methods=['PUT'])
def update_project(id):
    data = request.json
    try:
        start_date = datetime.fromisoformat(data['start_date'])
        end_date = datetime.fromisoformat(data['end_date'])
        
        if end_date <= start_date:
            return jsonify({"status": "error", "message": "結束時間必須大於開始時間"}), 400

        import json
        anchor_config = json.dumps(data.get('anchor_config', {}))
        dormancy_config = json.dumps(data.get('dormancy_config', {}))

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE projects SET project_name=%s, start_date=%s, end_date=%s, is_enabled=%s, anchor_config=%s, dormancy_config=%s WHERE project_id=%s",
            (data['project_name'], data['start_date'], data['end_date'], data['is_enabled'], anchor_config, dormancy_config, id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/projects/<int:id>', methods=['DELETE'])
def delete_project(id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM projects WHERE project_id=%s", (id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/projects/<int:id>/users', methods=['GET'])
def get_project_users(id):
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT DISTINCT c.user_id, p.value as user_name 
            FROM cron_table c
            LEFT JOIN "Private_var:5013" p ON c.user_id = p.user_id AND p.name = 'name'
            WHERE c.project_id = %s
        """, (id,))
        users = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(users)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Schedules CRUD
@app.route('/api/schedules', methods=['GET'])
def get_schedules():
    try:
        project_id = request.args.get('project_id')
        print(f"Fetching schedules for project_id: {project_id}")
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if project_id and project_id != "":
            cur.execute("SELECT * FROM project_schedules WHERE project_id = %s ORDER BY schedule_id", (project_id,))
        else:
            cur.execute("SELECT * FROM project_schedules ORDER BY schedule_id")
        schedules = cur.fetchall()
        cur.close()
        conn.close()
        print(f"Successfully fetched {len(schedules)} schedules")
        return json_response(schedules)
    except Exception as e:
        print(f"Error in get_schedules: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/schedules', methods=['POST'])
def create_schedule():
    data = request.json
    try:
        if float(data['interval_hours']) <= 0:
            return jsonify({"status": "error", "message": "間隔時間必須大於 0"}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO project_schedules (project_id, step_id, interval_hours, message_content) VALUES (%s, %s, %s, %s) RETURNING schedule_id",
            (data['project_id'], data['step_id'], data['interval_hours'], data['message_content'])
        )
        schedule_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success", "schedule_id": schedule_id})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/schedules/<int:id>', methods=['PUT'])
def update_schedule(id):
    data = request.json
    try:
        if float(data['interval_hours']) <= 0:
            return jsonify({"status": "error", "message": "間隔時間必須大於 0"}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE project_schedules SET project_id=%s, step_id=%s, interval_hours=%s, message_content=%s WHERE schedule_id=%s",
            (data['project_id'], data['step_id'], data['interval_hours'], data['message_content'], id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/schedules/<int:id>', methods=['DELETE'])
def delete_schedule(id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM project_schedules WHERE schedule_id=%s", (id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Statistics and Super8 Features
@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    try:
        start_time = request.args.get('start_time', (datetime.now().replace(hour=0, minute=0, second=0)).isoformat())
        end_time = request.args.get('end_time', datetime.now().isoformat())
        group_unit = request.args.get('group_unit', 'day')

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        results = {}
        for category in ['follow', 'user', 'message']:
            cur.execute(
                "SELECT * FROM get_events_count_by_category_and_tag(%s, %s, %s, %s)",
                (start_time, end_time, category, group_unit)
            )
            results[category] = cur.fetchall()
            
        cur.close()
        conn.close()
        return json_response(results)
    except Exception as e:
        print(f"Error in get_statistics: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/history/<user_id>', methods=['GET'])
def get_user_history(user_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            'SELECT * FROM "history:5013" WHERE user_id = %s AND category = \'Message\' ORDER BY timestamp ASC',
            (user_id,)
        )
        history = cur.fetchall()
        cur.close()
        conn.close()
        return json_response(history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/registered-users', methods=['GET'])
def get_registered_users():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Fetch users who have a name in Private_var
        cur.execute("""
            SELECT u1.user_id, u1.value as name, u2.value as pic
            FROM "Private_var:5013" u1
            LEFT JOIN "Private_var:5013" u2 ON u1.user_id = u2.user_id AND u2.name = 'pic'
            WHERE u1.name = 'name'
            ORDER BY u1.value
        """)
        users = cur.fetchall()
        cur.close()
        conn.close()
        return json_response(users)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/users', methods=['GET'])
def get_users_list():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Fetch unique user IDs with their latest activity or tags if available
        # Based on requirement to show user list in Message Center
        cur.execute("""
            SELECT DISTINCT h.user_id, 
                   (SELECT content FROM "history:5013" WHERE user_id = h.user_id ORDER BY timestamp DESC LIMIT 1) as last_message,
                   (SELECT timestamp FROM "history:5013" WHERE user_id = h.user_id ORDER BY timestamp DESC LIMIT 1) as last_time,
                   (SELECT string_agg(value, '|') FROM "Private_var:5013" WHERE user_id = h.user_id AND name = 'tag') as tags
            FROM "history:5013" h
            ORDER BY last_time DESC NULLS LAST
        """)
        users = cur.fetchall()
        cur.close()
        conn.close()
        return json_response(users)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/trigger', methods=['POST'])
def trigger_socket_event():
    data = request.json
    # Expected data: { "user": "target_id", "message": "content", "type": "Sensor" }
    # Plus potential "api_index"
    try:
        sio = socketio.Client()
        namespace = f"/{BOT_NAME}"
        
        # Ensure api_index is explicitly included as 0 if not provided
        if 'api_index' not in data:
            data['api_index'] = 0
        
        print(f"Emitting {BOT_NAME}_message to {namespace}: {data}")
            
        @sio.on('connect', namespace=namespace)
        def on_connect():
            print(f"Connected to {namespace}")

        sio.connect(WS_URL, namespaces=[namespace], wait_timeout=3)
        sio.emit(f'{BOT_NAME}_message', data, namespace=namespace)
        time_to_wait = 0.5 # Small delay to ensure message is sent
        import time
        time.sleep(time_to_wait)
        sio.disconnect()
        
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"Socket.IO Trigger Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Scheduled Events CRUD
@app.route('/api/scheduled-events', methods=['GET'])
def get_scheduled_events():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM scheduled_events ORDER BY created_at DESC")
        events = cur.fetchall()
        cur.close()
        conn.close()
        return json_response(events)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/scheduled-events', methods=['POST'])
def create_scheduled_event():
    data = request.json
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO scheduled_events (target_user_id, message_content, message_type, interval_hours) VALUES (%s, %s, %s, %s)",
            (data['target_user_id'], data['message_content'], data.get('message_type', 'Sensor'), data['interval_hours'])
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/scheduled-events/<int:id>', methods=['DELETE'])
def delete_scheduled_event(id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM scheduled_events WHERE event_id = %s", (id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Ticket Table Status
@app.route('/api/tickets', methods=['GET'])
def get_tickets():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute('SELECT id, name, "order", user_id FROM ticket_table ORDER BY id::integer')
        tickets = cur.fetchall()
        cur.close()
        conn.close()
        return json_response(tickets)
    except Exception as e:
        print(f"Error in get_tickets: {e}")
        return jsonify({"error": str(e)}), 500

# QA Bank CRUD
@app.route('/api/qa-bank/<tag>', methods=['GET'])
def get_qa_bank_by_tag(tag):
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Assuming appNAME is 5013, so table is "QA_bank:5013"
        cur.execute('SELECT * FROM "QA_bank:5013" WHERE tag = %s', (tag,))
        result = cur.fetchone()
        cur.close()
        conn.close()
        if result:
            return json_response(result)
        else:
            return jsonify({"status": "not_found"}), 404
    except Exception as e:
        print(f"Error in get_qa_bank_by_tag: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/qa-bank', methods=['POST'])
def save_qa_bank():
    data = request.json
    tag = data.get('tag')
    msg_rpy = data.get('msg_rpy') # Should be list of dicts (JSON objects)
    
    if not tag:
        return jsonify({"status": "error", "message": "Tag is required"}), 400

    try:
        import json
        msg_rpy_json = json.dumps(msg_rpy) # Convert list to JSON string for ARRAY[JSON] ??
        # Postgres ARRAY of JSON might need special handling.
        # However, psycopg2 usually handles list of dicts -> ARRAY of JSON if type is specified?
        # Or simpler: cast to text array if schema is ARRAY(TEXT) containing JSON strings?
        # Inspector said "msg_rpy (ARRAY)". Migration said "ARRAY(postgresql.JSON(astext_type=sa.Text()))".
        # Let's try passing list of strings (json dumped).
        
        # User Requirement: msg_rpy column needs to be formatted as {"{\"Line\": {\"OTYPE\": ...}}"}
        # This implies each element in the array is a stringified JSON object with a root key "Line".
        
        msg_rpy_strings = []
        if msg_rpy:
            for m in msg_rpy:
                wrapped_message = {"Line": m}
                msg_rpy_strings.append(json.dumps(wrapped_message, ensure_ascii=False))
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check if exists
        cur.execute('SELECT id FROM "QA_bank:5013" WHERE tag = %s', (tag,))
        existing = cur.fetchone()
        
        if existing:
            # Update
            cur.execute(
                'UPDATE "QA_bank:5013" SET msg_rpy = %s::json[] WHERE tag = %s',
                (msg_rpy_strings, tag)
            )
        else:
            # Insert
            # Default columns: io='Output', ans=ARRAY[''], check=ARRAY[''], function=''
            cur.execute(
                '''INSERT INTO "QA_bank:5013" 
                   (tag, msg_rpy, "io", "check", "function", ans) 
                   VALUES (%s, %s::json[], 'Output', ARRAY[''], '', ARRAY[''])''',
                (tag, msg_rpy_strings)
            )
            
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"Error in save_qa_bank: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
