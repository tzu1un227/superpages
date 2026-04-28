from flask import Flask, request, jsonify, g, redirect
from flask_cors import CORS
from config import Config
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from datetime import datetime, date, timedelta
from decimal import Decimal
import threading
import time
import json
import requests
import urllib.parse

app = Flask(__name__)
CORS(app, origins=["https://irl-svr.ee.yzu.edu.tw:5014", "http://localhost:3000", "http://localhost:9016", "https://irl-svr.ee.yzu.edu.tw:5016"])

# Auth and DB imports
from models import db, User, Page, OAConfig
from auth import generate_token, token_required, admin_required
import os
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

# Database configuration (Legacy)
DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

# New RDS Database URL
RDS_URL = "postgresql://u1kq1nhog5jq7b:pd1a6d947df93fb15d747bbadf399e84893f9fd5932782191f0b6ffa187c5ae18@c8lcd8bq1mia7p.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d1hr8bloo29pm6"

# Configuration for SQLAlchemy
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or 'dev_secret_key'
# RDS is the new Primary for Users, Pages, Permissions
app.config['SQLALCHEMY_DATABASE_URI'] = RDS_URL
# Legacy Bind for OA RULE BANKS (Not yet migrated)
app.config['SQLALCHEMY_BINDS'] = {
    'legacy': f"postgresql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
}
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

def get_main_db_connection():
    """Always connects to the RDS Main Database for business tables."""
    return psycopg2.connect(RDS_URL)

def get_suffixed_table(base_name):
    """Returns the double-quoted suffixed table name based on current OA app context."""
    app_name = getattr(g, 'current_app_name', 'default')
    # If app_name is None, use 'default'
    if not app_name:
        app_name = 'default'
    return f'"{base_name}:{app_name}"'

db.init_app(app)

# Register Admin Blueprint
from endpoints.admin import admin_bp
app.register_blueprint(admin_bp, url_prefix='/api/admin')

# Register Upload Blueprint
from endpoints.upload import upload_bp
app.register_blueprint(upload_bp, url_prefix='/api/upload')

# Register RichMenu Blueprint
from endpoints.richmenu import richmenu_bp
app.register_blueprint(richmenu_bp, url_prefix='/api/richmenu')

# Register Broadcast Blueprint
from endpoints.broadcast import broadcast_bp
app.register_blueprint(broadcast_bp, url_prefix='/api/broadcast')

# Register Questionnaire Blueprint
from endpoints.questionnaire import questionnaire_bp
app.register_blueprint(questionnaire_bp, url_prefix='/api/questionnaire')

# Register Rule Designer Blueprint
from endpoints.rule_designer import rule_designer_bp
app.register_blueprint(rule_designer_bp, url_prefix='/api/rule-designer')

# Register DB Viewer Blueprint
from endpoints.db_viewer import db_viewer_bp
app.register_blueprint(db_viewer_bp, url_prefix='/api/db')

# Register Test Runner Blueprint
from endpoints.test_runner import test_runner_bp
app.register_blueprint(test_runner_bp, url_prefix='/api/test-runner')

# Register Customers Blueprint
from endpoints.customers import customers_bp
app.register_blueprint(customers_bp, url_prefix='/api/customers')

with app.app_context():
    db.create_all()

    # Seeding Data
    # Seeding Data
    def seed_data():
        print("Seeding/Updating pages...")
        default_pages = [
            {'name': 'Statistics', 'description': '綜合數據'},
            {'name': 'MessageCenter', 'description': '訊息中心'},
            {'name': 'Projects', 'description': '自動旅程'},
            {'name': 'Broadcast', 'description': '群發訊息'},
            {'name': 'ScheduledEvents', 'description': '定時排程'},
            {'name': 'PrizeStatus', 'description': '抽獎管理'},
            {'name': 'RichMenu', 'description': '圖文選單'},
            {'name': 'Questionnaire', 'description': '問卷管理'},
            {'name': 'RuleDesigner', 'description': '法則表設計'},
            {'name': 'DatabaseViewer', 'description': '資料庫檢視'},
            {'name': 'TestRunner', 'description': '系統測試'},
            {'name': 'CustomerCenter', 'description': '客戶中心'}
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
        json.dumps(data, default=lambda x: float(x) if isinstance(x, Decimal) else (x.strftime('%Y-%m-%d %H:%M:%S') if isinstance(x, (datetime, date)) else str(x))),
        mimetype='application/json'
    )

import socketio



WS_URL = "https://irl-svr.ee.yzu.edu.tw:5013"
BOT_NAME = "websoc"

from utils.socket_utils import send_socket_event

def get_db_connection():
    # Check if a dynamic DB URL is set in the context
    if hasattr(g, 'current_db_url') and g.current_db_url:
        # Assuming g.current_db_url is a DSN string or suitable for psycopg2
        return psycopg2.connect(g.current_db_url)
    
    # Fallback to default DB
    conn = psycopg2.connect(**DB_CONFIG)
    return conn

def get_current_app_id():
    """Returns the current logical app name/id (e.g. '5013')."""
    if hasattr(g, 'current_app_name') and g.current_app_name:
        return g.current_app_name
    if hasattr(g, 'current_db_url') and g.current_db_url:
        path_part = g.current_db_url.split('/')[-1]
        return path_part.split('?')[0].strip()
    return '5013' # Default

def get_now_taiwan():
    """Returns current datetime in Asia/Taipei (GMT+8)."""
    return datetime.utcnow() + timedelta(hours=8)

def parse_local_naive(dt_str):
    """Parses an ISO string from frontend and returns a naive datetime (assuming it's already Taiwan time)."""
    if not dt_str: return None
    try:
        # Strip Z if present, but since user inputs local time, usually it's plain
        clean_str = dt_str.replace('Z', '').replace('T', ' ')
        # We handle both YYYY-MM-DD HH:mm:ss and YYYY-MM-DD HH:mm
        if len(clean_str) > 16:
            return datetime.strptime(clean_str[:19], '%Y-%m-%d %H:%M:%S')
        return datetime.strptime(clean_str[:16], '%Y-%m-%d %H:%M')
    except:
        return None

def get_current_oa_id():
    """Returns the numeric OA Config ID (from permission_settings)."""
    if hasattr(g, 'current_oa_id') and g.current_oa_id:
        return g.current_oa_id
    return None

def increment_project_stat(project_id, metric, oa_id, date_str=None):
    """
    Increments a project-specific metric in the Global_var table.
    Metrics: tc (Unique Triggers), ttc (Total Triggers), cc (Unique Completions), tcc (Total Completions), ms/mss/msf (Messages)
    """
    if not date_str:
        date_str = get_now_taiwan().strftime('%Y-%m-%d')
    variable_name = f"pj:{project_id}:stats:{date_str}:{metric}"
    
    try:
        # Determine correct DB for this OA
        db_url = None
        current_app_id = str(oa_id) # The ID in permission_settings (e.g., 1 or 3)
        
        # We need to query the main DB for the db_url of the oa_id
        # This is safe because Global_var follows the App context
        oa = OAConfig.query.get(oa_id)
        if oa:
            db_url = oa.db_url
            # Also get the logical app name (e.g., '5013') for the table prefix
            # If not in other_settings, fallback to db name
            logical_app_id = get_current_app_id() 
            if oa.other_settings and 'app_name' in oa.other_settings:
                if oa.other_settings['app_name']:
                    logical_app_id = str(oa.other_settings['app_name'])
        
        if db_url:
            print(f"DEBUG: increment_project_stat | Metric={metric} | OA_ID={oa_id} | Logical_App={logical_app_id} | DB={db_url.split('/')[-1].split('?')[0]}")
            target_conn = psycopg2.connect(db_url)
            cur = target_conn.cursor()
            table_name = f"Global_var:{logical_app_id}"
            
            # Upsert logic
            cur.execute(f"UPDATE \"{table_name}\" SET value = (COALESCE(value, '0')::int + 1)::text WHERE name = %s", (variable_name,))
            if cur.rowcount == 0:
                cur.execute(f"INSERT INTO \"{table_name}\" (name, value) VALUES (%s, '1')", (variable_name,))
            target_conn.commit()
            cur.close()
            target_conn.close()
        else:
            print(f"WARNING: increment_project_stat failed - No DB URL found for OA_ID: {oa_id}")
    except Exception as e:
        print(f"ERROR: increment_project_stat (PJ:{project_id}, Metric:{metric}, OA:{oa_id}): {e}")

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
                
                # Check for explicit App Name override
                if oa_config.other_settings and 'app_name' in oa_config.other_settings:
                    if oa_config.other_settings['app_name']:
                        g.current_app_name = str(oa_config.other_settings['app_name'])
        except Exception as e:
            print(f"Error loading OA context: {e}")

def init_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # projects table and others are assumed to exist or created via other migrations/scripts
        # scheduled_events is REMOVED
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error initializing database: {e}")

init_db()

# scheduled_event_processor REMOVED

def project_stats_processor():
    """
    Background thread to monitor history and update project-specific statistics.
    """
    while True:
        try:
            with app.app_context():
                # Get all OAs to poll their history
                oas = OAConfig.query.all()
                for oa in oas:
                    oa_id = oa.id
                    db_url = oa.db_url
                    if db_url:
                        try:
                            # 1. Access OA Database for History and Stats
                            conn_oa = psycopg2.connect(db_url)
                            cur_oa = conn_oa.cursor(cursor_factory=RealDictCursor)
                            
                            # Determine logical_app_id for OA DB tables (history, Global_var)
                            logical_app_id = str(oa_id)
                            if oa.other_settings and 'app_name' in oa.other_settings:
                                if oa.other_settings['app_name']:
                                    logical_app_id = str(oa.other_settings['app_name'])
                            
                            # 2. Access RDS Main Database for Business Tables (projects, schedules, etc.)
                            conn_rds = get_main_db_connection()
                            cur_rds = conn_rds.cursor(cursor_factory=RealDictCursor)
                            
                            def get_t(base):
                                # Helper for this loop
                                return f'"{base}:{logical_app_id}"'

                            # Get last processed time from Global_var (OA DB)
                            g_var_table = f"Global_var:{logical_app_id}"
                            
                            # Ensure table exists in OA DB
                            cur_oa.execute(f"""
                                CREATE TABLE IF NOT EXISTS "{g_var_table}" (
                                    name VARCHAR(255) PRIMARY KEY,
                                    value TEXT
                                )
                            """)

                            cur_oa.execute(f"SELECT value FROM \"{g_var_table}\" WHERE name = 'last_stats_process_time'")
                            row = cur_oa.fetchone()
                            last_time = row['value'] if row else '2000-01-01 00:00:00'
                            
                            # Fetch new history entries (OA DB)
                            history_table = f"history:{logical_app_id}"
                            cur_oa.execute(f"""
                                SELECT * FROM "{history_table}" 
                                WHERE timestamp > %s 
                                AND ((category = 'Message' OR category = 'Sensor') AND content LIKE '%%QA|cron_%%')
                                ORDER BY timestamp ASC
                            """, (last_time,))
                            entries = cur_oa.fetchall()
                            
                            max_timestamp = last_time
                            
                            for entry in entries:
                                max_timestamp = entry['timestamp']
                                content = entry['content']
                                try:
                                    parts = content.split('_')
                                    if len(parts) >= 3:
                                        pj_id = int(parts[1])
                                        step_id = int(parts[2])
                                        
                                        increment_project_stat(pj_id, 'ms', oa_id, entry['timestamp'].strftime('%Y-%m-%d'))
                                        increment_project_stat(pj_id, 'mss', oa_id, entry['timestamp'].strftime('%Y-%m-%d'))
                                        
                                        # Query RDS for business data
                                        t_schedules = get_t('project_schedules')
                                        cur_rds.execute(f"SELECT MAX(step_id) FROM {t_schedules} WHERE project_id = %s", (pj_id,))
                                        m_row = cur_rds.fetchone()
                                        if m_row and m_row['max'] == step_id:
                                            increment_project_stat(pj_id, 'cc', oa_id, entry['timestamp'].strftime('%Y-%m-%d'))
                                            increment_project_stat(pj_id, 'tcc', oa_id, entry['timestamp'].strftime('%Y-%m-%d'))
                                            
                                            t_projects = get_t('projects')
                                            cur_rds.execute(f"SELECT is_recurring FROM {t_projects} WHERE project_id = %s", (pj_id,))
                                            p_row = cur_rds.fetchone()
                                            is_recurring = p_row['is_recurring'] if p_row else False
                                            
                                            user_id = entry.get('user_id')
                                            if user_id:
                                                ups_status = 'active'
                                                t_cron = get_t('cron_table')
                                                if is_recurring:
                                                    cur_rds.execute(f"UPDATE {t_cron} SET step_id = 0, status = 'active' WHERE project_id = %s AND user_id = %s", (pj_id, user_id))
                                                    increment_project_stat(pj_id, 'ttc', oa_id, entry['timestamp'].strftime('%Y-%m-%d'))
                                                    ups_status = 'active'
                                                else:
                                                    cur_rds.execute(f"UPDATE {t_cron} SET status = 'completed' WHERE project_id = %s AND user_id = %s", (pj_id, user_id))
                                                    ups_status = 'completed'
                                                
                                                t_ups = get_t('user_project_status')
                                                try:
                                                    cur_rds.execute(f"""
                                                        INSERT INTO {t_ups} (user_id, project_id, status, updated_at) 
                                                        VALUES (%s, %s, %s, NOW())
                                                        ON CONFLICT (user_id, project_id) 
                                                        DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
                                                    """, (user_id, pj_id, ups_status))
                                                except Exception as upse:
                                                    print(f"Error syncing user_project_status: {upse}")
                                                    conn_rds.rollback()
                                            
                                    conn_rds.commit()
                                except Exception as pe:
                                    print(f"Error parsing history entry for stats: {pe}")
                                    conn_rds.rollback()
                                    conn_oa.rollback()
                            
                            # Update last processed time (OA DB)
                            cur_oa.execute(f"UPDATE \"{g_var_table}\" SET value = %s WHERE name = 'last_stats_process_time'", (str(max_timestamp),))
                            if cur_oa.rowcount == 0:
                                cur_oa.execute(f"INSERT INTO \"{g_var_table}\" (name, value) VALUES ('last_stats_process_time', %s)", (str(max_timestamp),))
                            
                            conn_oa.commit()
                            cur_oa.close()
                            conn_oa.close()
                            cur_rds.close()
                            conn_rds.close()
                        except Exception as db_err:
                            print(f"Error processing stats for app {logical_app_id}: {db_err}")
                        
        except Exception as e:
            print(f"Error in project_stats_processor: {e}")
        
        time.sleep(30) # Check every 30 seconds

threading.Thread(target=project_stats_processor, daemon=True).start()

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
            # Requirement: "??閮剖?憟賢隞交??€????google撣唾?敺?..?啣??嗡?鈭箇?撣唾?"
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
        if google_name and not user.name:
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

@app.route('/api/redirect', methods=['GET'])
def url_redirect():
    url = request.args.get('url')
    tags = request.args.get('tags')
    user_id = request.args.get('userId')
    oa_id = request.args.get('oaId') # New parameter to resolve context
    
    if not url:
        return "Missing URL parameter", 400
        
    if tags and user_id:
        if oa_id:
            g.current_oa_id = oa_id # Set context for send_socket_event fallback
            
        try:
            print(f"DEBUG /api/redirect: tags={tags}, userId={user_id}, url={url}, oaId={oa_id}")
            
            tag_list = tags.split(',')
            for tag in tag_list:
                tag = tag.strip()
                if not tag: continue
                
                payload = {
                    'user': user_id,
                    'message': f'set_tag|{tag}',
                    'type': 'Sensor',
                    'api_index': 0 
                }
                
                try:
                    # Forward the event using the internal helper function
                    send_socket_event(payload)
                    print(f"DEBUG /api/redirect: Forwarded tag {tag} via send_socket_event")
                    
                    # Rich Menu 自動分配
                    check_and_update_rich_menu(user_id, tag)
                except Exception as req_err:
                    print(f"DEBUG /api/redirect: Failed to trigger for tag {tag}: {req_err}")
                
        except Exception as e:
            print(f"Error handling redirect tags: {e}")
            
    return redirect(url, code=302)

@app.route('/api/my_oas', methods=['GET'])
@token_required
def get_my_oas():
    user = g.current_user
    try:
        if user.role == 'admin':
            configs = OAConfig.query.all()
        else:
            allowed = user.allowed_oa_configs or []
            print(f"DEBUG: User {user.id} allowed_oa_configs: {allowed} (type: {type(allowed)})")
            
            # Robust filtering: Handle string/int mismatch
            if not allowed:
                configs = []
            else:
                # Filter manually to be safe or use IN if Types match
                all_configs = OAConfig.query.all()
                configs = [c for c in all_configs if str(c.id) in [str(x) for x in allowed]]

        
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
            
            # Determine pages to show
            target_page_ids = c.page_ids
            
            # If no pages configured, default to ALL pages (Development convenience)
            # Or if admin
            if not target_page_ids or user.role == 'admin':
                target_page_ids = list(pages_map.keys())
            
            if target_page_ids:
                for pid in target_page_ids:
                    if pid in pages_map:
                        p = pages_map[pid]
                        # Sort by ID or some order if needed, currently arbitrary based on loop
                        oa_data['pages'].append({
                            'id': p.id,
                            'name': p.name,
                            'description': p.description,
                            'path': f"/oa/{c.id}/{p.name.lower()}" # Frontend can use this or build it
                        })
            
            # Sort pages by ID to keep consistent order
            oa_data['pages'].sort(key=lambda x: x['id'])
            
            oa_list.append(oa_data)
        
        return jsonify({
            'configs': oa_list
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Projects CRUD
@app.route('/api/projects', methods=['GET'])
@token_required
def get_projects():
    try:
        conn = get_main_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        t_projects = get_suffixed_table('projects')
        cur.execute(f"SELECT * FROM {t_projects} ORDER BY project_id")
        projects = cur.fetchall()
        
        # Calculate Status based on Taiwan time
        now_tw = get_now_taiwan().replace(second=0, microsecond=0)
        for p in projects:
            # DB stores naive Taiwan time, directly comparable with now_tw
            start = p['start_date'].replace(second=0, microsecond=0) if p['start_date'] else p['start_date']
            end = p['end_date'].replace(second=0, microsecond=0) if p['end_date'] else p['end_date']
            
            is_enabled = p['is_enabled']
            
            p['status'] = "未知"
            if not is_enabled:
                if now_tw < start:
                    p['status'] = "編輯中"
                elif now_tw > end:
                    p['status'] = "已結案"
                else:
                    p['status'] = "已暫停"
            else:
                if now_tw < start:
                    p['status'] = "已排程"
                elif now_tw > end:
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
@token_required
def create_project():
    data = request.json
    try:
        if not data.get('project_name') or not data['project_name'].strip():
            return jsonify({"status": "error", "message": "專案名稱不能為空"}), 400
            
        start_local = parse_local_naive(data.get('start_date'))
        end_local = parse_local_naive(data.get('end_date'))
        
        if not start_local or not end_local:
            return jsonify({"status": "error", "message": "請務必填寫日期或日期格式錯誤"}), 400
        
        if end_local <= start_local:
            return jsonify({"status": "error", "message": "結束時間必須晚於開始時間"}), 400

        import json
        anchor_config = json.dumps(data.get('anchor_config', {}))
        dormancy_config = json.dumps(data.get('dormancy_config', {}))

        conn = get_main_db_connection()
        cur = conn.cursor()
        t_projects = get_suffixed_table('projects')
        
        # Handle is_recurring, default False
        is_recurring = data.get('is_recurring', False)
        
        cur.execute(
            f"INSERT INTO {t_projects} (project_name, start_date, end_date, is_enabled, anchor_config, dormancy_config, is_recurring) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING project_id",
            (data['project_name'], start_local, end_local, data['is_enabled'], anchor_config, dormancy_config, is_recurring)
        )
        project_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success", "project_id": project_id})
    except Exception as e:
        print(f"Error in create_project: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/projects/<int:id>', methods=['PUT'])
@token_required
def update_project(id):
    data = request.json
    try:
        if not data.get('project_name') or not data['project_name'].strip():
            return jsonify({"status": "error", "message": "專案名稱不能為空"}), 400
            
        start_local = parse_local_naive(data.get('start_date'))
        end_local = parse_local_naive(data.get('end_date'))
        
        if not start_local or not end_local:
            return jsonify({"status": "error", "message": "請務必填寫日期或日期格式錯誤"}), 400
        
        if end_local <= start_local:
            return jsonify({"status": "error", "message": "結束時間必須晚於開始時間"}), 400

        import json
        anchor_config = json.dumps(data.get('anchor_config', {}))
        dormancy_config = json.dumps(data.get('dormancy_config', {}))

        conn = get_main_db_connection()
        cur = conn.cursor()
        t_projects = get_suffixed_table('projects')
        
        is_recurring = data.get('is_recurring', False)
        
        cur.execute(
            f"UPDATE {t_projects} SET project_name=%s, start_date=%s, end_date=%s, is_enabled=%s, anchor_config=%s, dormancy_config=%s, is_recurring=%s WHERE project_id=%s",
            (data['project_name'], start_local, end_local, data['is_enabled'], anchor_config, dormancy_config, is_recurring, id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"Error in update_project: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/projects/<int:id>', methods=['DELETE'])
@token_required
def delete_project(id):
    try:
        conn = get_main_db_connection()
        cur = conn.cursor()
        t_projects = get_suffixed_table('projects')
        t_schedules = get_suffixed_table('project_schedules')
        t_cron = get_suffixed_table('cron_table')
        
        # 1. Clean up QA_bank entries associated with this project's schedules
        app_id = get_current_app_id()
        cur_oa = get_db_connection().cursor()
        cur_oa.execute(f'DELETE FROM "QA_bank:{app_id}" WHERE tag LIKE %s', (f"cron_{id}_%",))
        cur_oa.connection.commit()
        cur_oa.close()
        cur_oa.connection.close()
        
        # 2. Delete project schedules
        cur.execute(f"DELETE FROM {t_schedules} WHERE project_id=%s", (id,))
        
        # 3. Delete from cron_table
        cur.execute(f"DELETE FROM {t_cron} WHERE project_id=%s", (id,))
        
        # 4. Delete the project itself
        cur.execute(f"DELETE FROM {t_projects} WHERE project_id=%s", (id,))
        
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/projects/<int:id>/stats', methods=['GET'])
def get_project_stats(id):
    try:
        start_date = request.args.get('start_date') # YYYY-MM-DD
        end_date = request.args.get('end_date')     # YYYY-MM-DD
        
        if not start_date or not end_date:
            return jsonify({"error": "Missing start_date or end_date"}), 400

        app_id = get_current_app_id()
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # We search for keys like "pj:{id}:stats:{YYYY-MM-DD}:{metric}"
        # Metrics: tc, cc, ms, mss, msf
        query = f"""
            SELECT name, value 
            FROM "Global_var:{app_id}" 
            WHERE name LIKE %s
        """
        prefix = f"pj:{id}:stats:"
        cur.execute(query, (f"{prefix}%",))
        rows = cur.fetchall()
        
        stats = {
            "tc": 0,    # Will be used for TOTAL Triggers (ttc from DB)
            "unique_users": 0, # Will be used for UNIQUE Triggers (tc from DB)
            "cc": 0,    # Unique Completions
            "tcc": 0,   # Total Completions
            "ms": 0,
            "mss": 0,
            "msf": 0,
            "ttc": 0 
        }
        
        # Parse and aggregate
        # name format: pj:{id}:stats:{YYYY-MM-DD}:{metric}
        for row in rows:
            parts = row['name'].split(':')
            if len(parts) == 5:
                date_str = parts[3]
                metric = parts[4]
                if start_date <= date_str <= end_date:
                    try:
                        val = int(row['value'])
                        if metric == 'tc':
                            stats['unique_users'] += val
                        elif metric == 'ttc':
                            stats['ttc'] += val
                        elif metric == 'tcc':
                            stats['tcc'] += val
                        elif metric in stats:
                            stats[metric] += val
                    except:
                        pass
        
        # Denominator Logic: Use ttc (Total Trigger Count) as primary.
        # During transition, we might have old users who only have 'tc' records.
        # But 'tc' was also used for 'Total Triggers' in some versions.
        # For Projects, we prioritize ttc. If ttc is 0 but tc is > 0, fallback to tc.
        # However, if we have BOTH, we should probably take the max or sum them carefully?
        # Usually ttc is the new accurate counter. 
        stats['tc'] = stats['ttc'] if stats['ttc'] > 0 else stats['unique_users']
        
        # Numerator Logic
        # cc: Unique Completions (daily), tcc: Total Completions
        numerator = stats['tcc'] if stats['tcc'] > 0 else stats['cc']
        
        # Safety: Total triggers should at least be equal to total completions
        if stats['tc'] < numerator:
            stats['tc'] = numerator
            
        # Calculate completion rate
        stats['completion_rate'] = 0
        if stats['tc'] > 0:
            stats['completion_rate'] = round((numerator / stats['tc']) * 100, 2)
            
        cur.close()
        conn.close()
        return jsonify(stats)
    except Exception as e:
        print(f"Error in get_project_stats: {e}")
        return jsonify({"error": str(e)}), 500
            
@app.route('/api/projects/<int:id>/schedules/reorder', methods=['POST'])
@token_required
def reorder_project_schedules(id):
    try:
        data = request.json
        schedule_ids = data.get('schedule_ids', [])
        if not schedule_ids:
            return jsonify({"status": "error", "message": "No schedules provided"}), 400
            
        conn = get_main_db_connection()
        cur = conn.cursor()
        t_schedules = get_suffixed_table('project_schedules')
        
        for index, schedule_id in enumerate(schedule_ids):
            new_step_id = index + 1
            cur.execute(
                f"UPDATE {t_schedules} SET step_id = %s WHERE schedule_id = %s AND project_id = %s",
                (new_step_id, schedule_id, id)
            )
            
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"Error in reorder_project_schedules: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/projects/<int:id>/schedules/export', methods=['GET'])
@token_required
def export_project_schedules(id):
    try:
        conn = get_main_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        t_schedules = get_suffixed_table('project_schedules')
        cur.execute(f"SELECT step_id, interval_hours, message_content FROM {t_schedules} WHERE project_id = %s ORDER BY step_id", (id,))
        schedules = cur.fetchall()
        cur.close()
        conn.close()
        return json_response(schedules)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/projects/<int:id>/schedules/import', methods=['POST'])
@token_required
def import_project_schedules(id):
    data = request.json # List of schedules
    try:
        conn = get_main_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        t_schedules = get_suffixed_table('project_schedules')
        
        # Delete existing
        cur.execute(f"DELETE FROM {t_schedules} WHERE project_id = %s", (id,))
        
        # Insert new
        app_id = get_current_app_id()
        
        for s in data:
            # Import Sync Logic: If message is a QA tag, clone it to completely decouple from original project
            content = s['message_content']
            if content and content.startswith('QA|'):
                try:
                    old_tag = content.split('|', 1)[1]
                    # Create New Tag immediately
                    new_tag = f"cron_{id}_{s['step_id']}"
                    
                    # Fetch existing from current app's QA bank
                    cur.execute(f'SELECT * FROM "QA_bank:{app_id}" WHERE tag = %s', (old_tag,))
                    qa_row = cur.fetchone()
                    
                    if qa_row:
                        # Prepare msg_rpy
                        raw_msg_rpy = qa_row.get('msg_rpy')
                        new_msg_rpy_strings = []
                        if raw_msg_rpy:
                            for item in raw_msg_rpy:
                                # Ensure it's a JSON string for the DB array
                                if isinstance(item, str):
                                    new_msg_rpy_strings.append(item)
                                else:
                                    new_msg_rpy_strings.append(json.dumps(item, ensure_ascii=False))
                        
                        # Upsert new tag
                        check_q = f'SELECT id FROM "QA_bank:{app_id}" WHERE tag = %s'
                        cur.execute(check_q, (new_tag,))
                        if cur.fetchone():
                             cur.execute(f'UPDATE "QA_bank:{app_id}" SET msg_rpy = %s::json[], "io" = \'Output\' WHERE tag = %s', (new_msg_rpy_strings, new_tag))
                        else:
                             cur.execute(f'INSERT INTO "QA_bank:{app_id}" (tag, msg_rpy, "io", "check", "function", ans) VALUES (%s, %s::json[], \'Output\', ARRAY[\'\'], \'\', ARRAY[\'\'])', (new_tag, new_msg_rpy_strings))
                        
                        # CRITICAL: Always update content to use the new unique tag for THIS project
                        content = f"QA|{new_tag}"
                        print(f"Cloned {old_tag} -> {new_tag} for project {id}")
                    else:
                        print(f"Warning: Source tag {old_tag} not found during import to project {id}")
                        
                except Exception as sync_err:
                    print(f"Error syncing imported message for step {s['step_id']} (Project {id}): {sync_err}")
            
        # 6. Insert schedules into RDS
        conn = get_main_db_connection()
        cur = conn.cursor()
        t_schedules = get_suffixed_table('project_schedules')
        
        for s in schedules_data:
            # ... Cloning logic already handled the 'content' string ...
            cur.execute(
                f"INSERT INTO {t_schedules} (project_id, step_id, interval_hours, message_content) VALUES (%s, %s, %s, %s)",
                (id, s['step_id'], s['interval_hours'], s['content'])
            )
            
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/projects/<int:id>/users', methods=['GET'])
@token_required
def get_project_users(id):
    try:
        app_id = get_current_app_id()
        conn = get_main_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        t_ups = get_suffixed_table('user_project_status')
        t_cron = get_suffixed_table('cron_table')
        
        # Use a subquery to get the minimum active step_id for each user to avoid duplicates
        cur.execute(f"""
            SELECT ups.user_id, LOWER(ups.status) as status, 
                   (SELECT MIN(step_id) FROM {t_cron} WHERE user_id = ups.user_id AND project_id = ups.project_id AND status = 'active') as step_id,
                   (SELECT push_time FROM {t_cron} WHERE user_id = ups.user_id AND project_id = ups.project_id AND status = 'active' ORDER BY step_id ASC LIMIT 1) as next_push_time,
                   ups.updated_at as joined_at,
                   NULL as user_name 
            FROM {t_ups} ups
            WHERE ups.project_id = %s
            ORDER BY ups.status DESC, step_id ASC
        """, (id,))
        users = cur.fetchall()
        
        # Enrich with name from OA DB (Private_var)
        try:
            conn_oa = get_db_connection()
            cur_oa = conn_oa.cursor()
            for u in users:
                cur_oa.execute(f'SELECT value FROM "Private_var:{app_id}" WHERE user_id = %s AND name = \'name\'', (u['user_id'],))
                res = cur_oa.fetchone()
                if res: u['user_name'] = res[0]
            cur_oa.close()
            conn_oa.close()
        except: pass
        
        cur.close()
        conn.close()
        return json_response(users)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/projects/<int:id>/users/<string:user_id>', methods=['DELETE'])
@token_required
def delete_project_user(id, user_id):
    try:
        conn = get_main_db_connection()
        cur = conn.cursor()
        t_cron = get_suffixed_table('cron_table')
        t_ups = get_suffixed_table('user_project_status')
        cur.execute(f"DELETE FROM {t_cron} WHERE project_id = %s AND user_id = %s", (id, user_id))
        cur.execute(f"DELETE FROM {t_ups} WHERE project_id = %s AND user_id = %s", (id, user_id))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/projects/<int:id>/users/<string:user_id>/restart', methods=['POST'])
@token_required
def restart_project_user(id, user_id):
    try:
        conn = get_main_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        t_projects = get_suffixed_table('projects')
        t_schedules = get_suffixed_table('project_schedules')
        t_cron = get_suffixed_table('cron_table')
        t_ups = get_suffixed_table('user_project_status')
        
        # 1. Fetch Project, start_date and Anchor Config
        cur.execute(f"SELECT anchor_config, start_date FROM {t_projects} WHERE project_id = %s", (id,))
        project = cur.fetchone()
        if not project:
            return jsonify({"status": "error", "message": "Project not found"}), 404
            
        anchor_conf = project['anchor_config']
        if isinstance(anchor_conf, str):
            try: anchor_conf = json.loads(anchor_conf)
            except: anchor_conf = {}

        project_start = project.get('start_date')
        
        # 2. Calculate Base Start Time
        now_tw = get_now_taiwan()
        reference_time = now_tw
        if project_start:
            ps_local = project_start.replace(tzinfo=None) if project_start.tzinfo else project_start
            reference_time = max(now_tw, ps_local)

        base_start_time = reference_time
        if anchor_conf and anchor_conf.get('time'):
            try:
                target_time = datetime.strptime(anchor_conf['time'], "%H:%M").time()
                a_type = anchor_conf.get('type', 'daily')
                day_param = anchor_conf.get('day', 1)
                ref_date = reference_time.date()
                if a_type == 'daily':
                    candidate = datetime.combine(ref_date, target_time)
                    if candidate <= reference_time: candidate += timedelta(days=1)
                    base_start_time = candidate
                elif a_type == 'weekly':
                    target_weekday = int(day_param) - 1
                    current_weekday = ref_date.weekday()
                    days_ahead = target_weekday - current_weekday
                    if days_ahead < 0: days_ahead += 7
                    candidate = datetime.combine(ref_date + timedelta(days=days_ahead), target_time)
                    if candidate <= reference_time: candidate += timedelta(days=7)
                    base_start_time = candidate
                elif a_type == 'monthly':
                    target_day = int(day_param)
                    try: candidate = datetime(ref_date.year, ref_date.month, target_day, target_time.hour, target_time.minute)
                    except: candidate = datetime(ref_date.year, ref_date.month, 1, target_time.hour, target_time.minute)
                    if candidate <= reference_time:
                        m_next = ref_date.month + 1 if ref_date.month < 12 else 1
                        y_next = ref_date.year if ref_date.month < 12 else ref_date.year + 1
                        try: candidate = datetime(y_next, m_next, target_day, target_time.hour, target_time.minute)
                        except: candidate = datetime(y_next, m_next, 1, target_time.hour, target_time.minute)
                    base_start_time = candidate
            except Exception as e:
                print(f"Anchor error in restart_project_user: {e}")

        # 3. Fetch All Steps
        cur.execute(f"SELECT step_id, interval_hours, message_content FROM {t_schedules} WHERE project_id = %s ORDER BY step_id ASC", (id,))
        steps = cur.fetchall()
        
        if steps:
            # 4. Clear existing tasks
            cur.execute(f"DELETE FROM {t_cron} WHERE project_id = %s AND user_id = %s", (id, user_id))
            
            # 5. Insert All Steps
            current_push_time = base_start_time
            for step in steps:
                s_id = step['step_id']
                interval = float(step['interval_hours']) if step['interval_hours'] else 0
                msg = step['message_content']
                current_push_time += timedelta(hours=interval)
                cur.execute(f"INSERT INTO {t_cron} (user_id, project_id, step_id, message_content, push_time, status) VALUES (%s, %s, %s, %s, %s, 'active')",
                            (user_id, id, s_id, msg, current_push_time))
            
            # 6. Update status
            cur.execute(f"INSERT INTO {t_ups} (user_id, project_id, status, updated_at) VALUES (%s, %s, 'active', NOW()) ON CONFLICT (user_id, project_id) DO UPDATE SET status = 'active', updated_at = NOW()",
                        (user_id, id))

            # 7. Update Stats
            try:
                oa_id = get_current_oa_id()
                if oa_id: increment_project_stat(id, 'ttc', oa_id)
            except: pass

            conn.commit()
            cur.close()
            conn.close()
            return jsonify({"status": "success", "message": f"Project restarted for user {user_id}."})
        else:
            cur.close()
            conn.close()
            return jsonify({"status": "error", "message": "No schedules found for this project"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/projects/<int:id>/users/batch-restart', methods=['POST'])
@token_required
def batch_restart_project_users(id):
    try:
        data = request.json
        user_ids = data.get('user_ids', [])
        if not user_ids:
            return jsonify({"status": "error", "message": "No users selected"}), 400

        conn = get_main_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        t_projects = get_suffixed_table('projects')
        t_schedules = get_suffixed_table('project_schedules')
        t_cron = get_suffixed_table('cron_table')
        t_ups = get_suffixed_table('user_project_status')

        # 1. Fetch Project, start_date and Anchor Config
        cur.execute(f"SELECT anchor_config, start_date FROM {t_projects} WHERE project_id = %s", (id,))
        project = cur.fetchone()
        if not project:
            return jsonify({"status": "error", "message": "Project not found"}), 404

        anchor_conf = project['anchor_config']
        if isinstance(anchor_conf, str):
            try: anchor_conf = json.loads(anchor_conf)
            except: anchor_conf = {}

        project_start = project.get('start_date')

        # 2. Calculate Base Start Time
        now_tw = get_now_taiwan()
        
        # Determine Reference Time: Use project_start if it's in the future
        reference_time = now_tw
        if project_start:
            ps_local = project_start.replace(tzinfo=None) if project_start.tzinfo else project_start
            reference_time = max(now_tw, ps_local)

        base_start_time = reference_time
        if anchor_conf and anchor_conf.get('time'):
            try:
                target_time = datetime.strptime(anchor_conf['time'], "%H:%M").time()
                a_type = anchor_conf.get('type', 'daily')
                day_param = anchor_conf.get('day', 1)
                ref_date = reference_time.date()
                if a_type == 'daily':
                    candidate = datetime.combine(ref_date, target_time)
                    if candidate <= reference_time: candidate += timedelta(days=1)
                    base_start_time = candidate
                elif a_type == 'weekly':
                    target_weekday = int(day_param) - 1
                    current_weekday = ref_date.weekday()
                    days_ahead = target_weekday - current_weekday
                    if days_ahead < 0: days_ahead += 7
                    candidate = datetime.combine(ref_date + timedelta(days=days_ahead), target_time)
                    if candidate <= reference_time: candidate += timedelta(days=7)
                    base_start_time = candidate
                elif a_type == 'monthly':
                    target_day = int(day_param)
                    try: candidate = datetime(ref_date.year, ref_date.month, target_day, target_time.hour, target_time.minute)
                    except: candidate = datetime(ref_date.year, ref_date.month, 1, target_time.hour, target_time.minute)
                    if candidate <= reference_time:
                        m_next = ref_date.month + 1 if ref_date.month < 12 else 1
                        y_next = ref_date.year if ref_date.month < 12 else ref_date.year + 1
                        try: candidate = datetime(y_next, m_next, target_day, target_time.hour, target_time.minute)
                        except: candidate = datetime(y_next, m_next, 1, target_time.hour, target_time.minute)
                    base_start_time = candidate
            except Exception as e:
                print(f"Anchor error in batch_restart: {e}")

        # 3. Fetch All Steps
        cur.execute(f"SELECT step_id, interval_hours, message_content FROM {t_schedules} WHERE project_id = %s ORDER BY step_id ASC", (id,))
        steps = cur.fetchall()
        if not steps:
            cur.close()
            conn.close()
            return jsonify({"status": "error", "message": "No schedules found for this project"}), 404

        # 4. Process each user
        oa_id = get_current_oa_id()
        for user_id in user_ids:
            cur.execute(f"DELETE FROM {t_cron} WHERE project_id = %s AND user_id = %s", (id, user_id))
            current_push_time = base_start_time
            for step in steps:
                s_id = step['step_id']
                interval = float(step['interval_hours']) if step['interval_hours'] else 0
                msg = step['message_content']
                current_push_time += timedelta(hours=interval)
                cur.execute(f"INSERT INTO {t_cron} (user_id, project_id, step_id, message_content, push_time, status) VALUES (%s, %s, %s, %s, %s, 'active')",
                            (user_id, id, s_id, msg, current_push_time))
            cur.execute(f"INSERT INTO {t_ups} (user_id, project_id, status, updated_at) VALUES (%s, %s, 'active', %s) ON CONFLICT (user_id, project_id) DO UPDATE SET status = 'active', updated_at = %s",
                        (user_id, id, now_tw, now_tw))
            if oa_id:
                try: increment_project_stat(id, 'ttc', oa_id)
                except: pass

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success", "message": f"Successfully added {len(user_ids)} users to project."})
    except Exception as e:
        print(f"Batch restart error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

def cron_scheduler_processor():
    """
    Background thread to execute project steps based on cron_table schedule.
    DISABLED: Logic moved to Line-Bot-Main/sensors/cronjobs.py
    """
    return


# Schedules CRUD
@app.route('/api/schedules', methods=['GET'])
@token_required
def get_schedules():
    try:
        project_id = request.args.get('project_id')
        print(f"Fetching schedules. project_id filter: {project_id}")
        
        conn = get_main_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        t_schedules = get_suffixed_table('project_schedules')
        
        if project_id and project_id != "":
            cur.execute(f"SELECT * FROM {t_schedules} WHERE project_id = %s ORDER BY schedule_id", (project_id,))
        else:
            cur.execute(f"SELECT * FROM {t_schedules} ORDER BY schedule_id")
            
        schedules = cur.fetchall()
        print(f"SQL found {len(schedules)} rows in project_schedules")
        
        # Enrich with message preview
        app_id = get_current_app_id()
        for s in schedules:
            content = s.get('message_content')
            s['message_preview'] = None
            if content and content.startswith('QA|'):
                try:
                    # Parse tag: "QA|tag_name" or "QA|123|tag_name"
                    parts = content.split('|')
                    tag = parts[-1]
                    
                    cur.execute(f'SELECT msg_rpy FROM "QA_bank:{app_id}" WHERE tag = %s', (tag,))
                    res = cur.fetchone()
                    if res and res.get('msg_rpy'):
                        msgs = res['msg_rpy']
                        if msgs and len(msgs) > 0:
                            s['is_multiple_messages'] = len(msgs) > 1
                            first_msg_obj = msgs[0]
                            # Handle if it's a JSON string
                            if isinstance(first_msg_obj, str):
                                try: first_msg_obj = json.loads(first_msg_obj)
                                except: pass
                            
                            # Handle "Line" unwrap
                            if isinstance(first_msg_obj, dict) and 'Line' in first_msg_obj:
                                first_msg_obj = first_msg_obj['Line']
                                
                            if isinstance(first_msg_obj, dict):
                                otype = first_msg_obj.get('OTYPE')
                                if otype == 'TextSendMessage':
                                    s['message_preview'] = first_msg_obj.get('text', '')
                                elif otype == 'FlexSendMessage':
                                    s['message_preview'] = f"[圖文] {first_msg_obj.get('alt_text', '圖文訊息')}"
                                elif otype == 'ImageSendMessage':
                                    s['message_preview'] = "[圖片]"
                                elif otype == 'VideoSendMessage':
                                    s['message_preview'] = "[影片]"
                                elif otype == 'AudioSendMessage':
                                    s['message_preview'] = "[語音]"
                                else:
                                    s['message_preview'] = f"[{otype}]"
                except Exception as e:
                    print(f"Error fetching preview for {content}: {e}")
                    s['message_preview'] = "[無法讀取內容]"
        
        cur.close()
        conn.close()
        return json_response(schedules)
    except Exception as e:
        print(f"CRITICAL Error in get_schedules: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/schedules', methods=['POST'])
@token_required
def create_schedule():
    data = request.json
    try:
        if float(data['interval_hours']) < 0:
            return jsonify({"status": "error", "message": "間隔時間必須大於或等於 0"}), 400

        conn = get_main_db_connection()
        cur = conn.cursor()
        t_schedules = get_suffixed_table('project_schedules')
        cur.execute(
            f"INSERT INTO {t_schedules} (project_id, step_id, interval_hours, message_content) VALUES (%s, %s, %s, %s) RETURNING schedule_id",
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
@token_required
def update_schedule(id):
    data = request.json
    try:
        if float(data['interval_hours']) < 0:
            return jsonify({"status": "error", "message": "間隔時間必須大於或等於 0"}), 400

        conn = get_main_db_connection()
        cur = conn.cursor()
        t_schedules = get_suffixed_table('project_schedules')
        cur.execute(
            f"UPDATE {t_schedules} SET project_id=%s, step_id=%s, interval_hours=%s, message_content=%s WHERE schedule_id=%s",
            (data['project_id'], data['step_id'], data['interval_hours'], data['message_content'], id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/schedules/<int:id>', methods=['DELETE'])
@token_required
def delete_schedule(id):
    try:
        conn = get_main_db_connection()
        cur = conn.cursor()
        t_schedules = get_suffixed_table('project_schedules')

        # Check for QA tag to delete
        cur.execute(f"SELECT message_content FROM {t_schedules} WHERE schedule_id=%s", (id,))
        row = cur.fetchone()
        if row and row[0] and row[0].startswith('QA|'):
            tag = row[0].split('|')[-1]
            # Only delete if it's a cloned tag for a project
            if tag.startswith('cron_'):
                app_id = get_current_app_id()
                cur_oa = get_db_connection().cursor()
                cur_oa.execute(f'DELETE FROM "QA_bank:{app_id}" WHERE tag = %s', (tag,))
                cur_oa.connection.commit()
                cur_oa.close()
                cur_oa.connection.close()

        cur.execute(f"DELETE FROM {t_schedules} WHERE schedule_id=%s", (id,))
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

        # Handle date-only strings from frontend (e.g. YYYY-MM-DD)
        if len(start_time) == 10:
            start_time += " 00:00:00"
        if len(end_time) == 10:
            end_time += " 23:59:59"

        conn = get_main_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        t_static = get_suffixed_table('ht_view')
        
        results = {}
        app_name = get_current_app_id()

        for category in ['follow', 'unfollow', 'user', 'message']:
            cur.execute(
                "SELECT * FROM get_events_count_by_category_and_tag(%s, %s, %s, %s, %s)",
                (start_time, end_time, category, group_unit, app_name)
            )
            results[category] = cur.fetchall()
        
        # Add a special 'totals' section for card display
        results['total_counts'] = {}
        for category in ['follow', 'unfollow', 'user', 'message']:
            if category == 'user':
                cur.execute(
                    f"SELECT COUNT(DISTINCT user_id) as total FROM {t_static} WHERE \"timestamp\" >= %s AND \"timestamp\" <= %s AND category IN ('Follow', 'Message')",
                    (start_time, end_time)
                )
                row = cur.fetchone()
                results['total_counts'][category] = row['total'] if row else 0
            elif category == 'follow':
                cur.execute(
                    f"SELECT COUNT(DISTINCT user_id) as total FROM {t_static} WHERE \"timestamp\" >= %s AND \"timestamp\" <= %s AND category = 'Follow'",
                    (start_time, end_time)
                )
                row = cur.fetchone()
                results['total_counts'][category] = row['total'] if row else 0
            elif category == 'unfollow':
                cur.execute(f"""
                    SELECT COUNT(*) as total 
                    FROM (
                        SELECT DISTINCT ON (user_id) category 
                        FROM {t_static} 
                        WHERE \"timestamp\" >= %s AND \"timestamp\" <= %s 
                          AND category IN ('Follow', 'Unfollow') 
                        ORDER BY user_id, \"timestamp\" DESC
                    ) as latest_status
                    WHERE category = 'Unfollow'
                """, (start_time, end_time))
                row = cur.fetchone()
                results['total_counts'][category] = row['total'] if row else 0
            else: # message
                cur.execute(
                    f"SELECT COUNT(*) as total FROM {t_static} WHERE \"timestamp\" >= %s AND \"timestamp\" <= %s AND category = 'Message'",
                    (start_time, end_time)
                )
                row = cur.fetchone()
                results['total_counts'][category] = row['total'] if row else 0
            
        # Fetch LINE Insight Data (Real-time followers and targeted reaches)
        results['line_insight'] = None
        if hasattr(g, 'current_oa_config') and g.current_oa_config.other_settings:
            line_token = g.current_oa_config.other_settings.get('line_token')
            if line_token:
                # LINE API provides statistics for specific dates, usually up to yesterday
                # Try yesterday first, if followers is 0 (or API error), try day before (LINE lag)
                for day_offset in [1, 2]:
                    target_date = (datetime.now() - timedelta(days=day_offset)).strftime('%Y%m%d')
                    try:
                        line_resp = requests.get(
                            f"https://api.line.me/v2/bot/insight/followers?date={target_date}",
                            headers={"Authorization": f"Bearer {line_token}"},
                            timeout=5
                        )
                        if line_resp.status_code == 200:
                            data = line_resp.json()
                            if data.get('status') == 'ready' and data.get('followers', 0) > 0:
                                results['line_insight'] = data
                                break # Success
                            elif data.get('status') == 'ready':
                                # If still 0, record it but try one more day
                                results['line_insight'] = data
                    except Exception as ex:
                        print(f"Error fetching LINE insight for OA {g.current_oa_id} on {target_date}: {ex}")

                # Fetch LINE Push Quota Consumption
                results['quota_consumption'] = None
                try:
                    quota_resp = requests.get(
                        "https://api.line.me/v2/bot/message/quota/consumption",
                        headers={"Authorization": f"Bearer {line_token}"},
                        timeout=5
                    )
                    if quota_resp.status_code == 200:
                        results['quota_consumption'] = quota_resp.json()
                except Exception as ex:
                    print(f"Error fetching LINE quota consumption for OA {g.current_oa_id}: {ex}")

        cur.close()
        conn.close()
        return json_response(results)
    except Exception as e:
        print(f"Error in get_statistics: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/statistics/keywords', methods=['GET'])
def get_statistics_keywords():
    try:
        start_time = request.args.get('start_time', (datetime.now().replace(hour=0, minute=0, second=0)).isoformat())
        end_time = request.args.get('end_time', datetime.now().isoformat())
        tag = request.args.get('tag', None)
        try:
            limit = int(request.args.get('limit', 150))
        except:
            limit = 150

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute(
            "SELECT * FROM get_keyword_ranking(%s, %s, %s, %s, %s)",
            (start_time, end_time, tag, limit, get_current_app_id())
        )
        results = cur.fetchall()
            
        cur.close()
        conn.close()
        return json_response(results)
    except Exception as e:
        print(f"Error in get_statistics_keywords: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/history/<user_id>', methods=['GET'])
def get_user_history(user_id):
    try:
        app_id = get_current_app_id()
        limit = request.args.get('limit', type=int)
        before = request.args.get('before')  # ISO timestamp cursor - load older messages
        after = request.args.get('after')    # ISO timestamp cursor - load newer messages (polling)
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        if after:
            # Incremental polling: only fetch messages newer than the given timestamp
            cur.execute(
                f'SELECT * FROM "history:{app_id}" WHERE user_id = %s AND timestamp > %s ORDER BY timestamp ASC',
                (user_id, after)
            )
            history = cur.fetchall()
        elif limit:
            if before:
                # Paginated load: fetch older messages before the given timestamp
                cur.execute(
                    f'SELECT * FROM "history:{app_id}" WHERE user_id = %s AND timestamp < %s ORDER BY timestamp DESC LIMIT %s',
                    (user_id, before, limit)
                )
                history = cur.fetchall()
                history.reverse()  # Return in chronological order
            else:
                # Initial load: fetch the latest N messages
                cur.execute(
                    f'SELECT * FROM "history:{app_id}" WHERE user_id = %s ORDER BY timestamp DESC LIMIT %s',
                    (user_id, limit)
                )
                history = cur.fetchall()
                history.reverse()
        else:
            cur.execute(
                f'SELECT * FROM "history:{app_id}" WHERE user_id = %s ORDER BY timestamp ASC',
                (user_id,)
            )
            history = cur.fetchall()
            
        cur.close()
        conn.close()
        return json_response(history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tags', methods=['GET'])
def get_tags():
    try:
        app_id = get_current_app_id()
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Fetch unique tags from Private_var
        cur.execute(f"""
            SELECT DISTINCT value 
            FROM "Private_var:{app_id}" 
            WHERE name = 'tag'
            ORDER BY value
        """)
        raw_tags = [row['value'] for row in cur.fetchall()]
        
        # Clean and split tags that might be stored as stringified arrays
        tags_set = set()
        for t in raw_tags:
            if not t: continue
            # Handle ['tag1', 'tag2']
            if t.startswith('[') and t.endswith(']'):
                try:
                    import ast
                    # Using literal_eval to safely parse ['a', 'b'] or ["a", "b"]
                    parsed = ast.literal_eval(t)
                    if isinstance(parsed, list):
                        for item in parsed:
                            if item: tags_set.add(str(item).strip())
                    else:
                        tags_set.add(str(parsed).strip())
                except:
                    # Fallback to simple split if eval fails
                    items = t[1:-1].split(',')
                    for item in items:
                        cleaned = item.strip().strip("'").strip('"')
                        if cleaned: tags_set.add(cleaned)
            elif '|' in t:
                for item in t.split('|'):
                    if item.strip(): tags_set.add(item.strip())
            elif ',' in t:
                for item in t.split(','):
                    if item.strip(): tags_set.add(item.strip())
            else:
                tags_set.add(t.strip())
        
        tags = sorted(list(tags_set))
        cur.close()
        conn.close()
        return json_response(tags)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/registered-users', methods=['GET'])
def get_registered_users():
    try:
        app_id = get_current_app_id()
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        source = request.args.get('source', 'private_var')
        
        if source == 'person_table':
            # Fetch users from person_table
            cur.execute("""
                SELECT user_id, name 
                FROM person_table 
                ORDER BY id::integer
            """)
        else:
            # Fetch users from Private_var with name, pic, and tags
            cur.execute(f"""
                SELECT t1.user_id, t1.value as name, t2.value as pic,
                    (SELECT string_agg(value, '|') FROM "Private_var:{app_id}" WHERE user_id = t1.user_id AND name = 'tag') as tags
                FROM "Private_var:{app_id}" t1
                LEFT JOIN "Private_var:{app_id}" t2 ON t1.user_id = t2.user_id AND t2.name = 'pic'
                WHERE t1.name = 'name'
                GROUP BY t1.user_id, t1.value, t2.value
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
        app_id = get_current_app_id()
        q = request.args.get('q', '').strip()
        tag_filters = request.args.getlist('tag')
        # Also support comma-separated list if provided as a single string
        if len(tag_filters) == 1 and ',' in tag_filters[0]:
            tag_filters = [t.strip() for t in tag_filters[0].split(',') if t.strip()]

        print(f"DEBUG: get_users_list | app_id={app_id} | q={q} | tags={tag_filters}")

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Build dynamic WHERE clauses
        where_clauses = []
        params = []

        if q:
            # Handle Unicode escapes for Chinese characters in JSON strings
            # e.g. "環境變數" -> "\u74b0\u5883\u8b8a\u6578"
            q_escaped = json.dumps(q).strip('"').replace('\\', '\\\\')
            
            where_clauses.append(
                f"(sub.user_id ILIKE %s"
                f" OR COALESCE((SELECT value FROM \"Private_var:{app_id}\" WHERE user_id = sub.user_id AND name = 'name' LIMIT 1), '') ILIKE %s"
                f" OR EXISTS ("
                f"    SELECT 1 FROM \"history:{app_id}\" h "
                f"    LEFT JOIN \"QA_bank:{app_id}\" qb ON ("
                f"        (h.content LIKE 'cron|QA|%%' AND qb.tag = split_part(h.content, '|', 3))"
                f"        OR (h.content LIKE 'QA|%%' AND qb.tag = split_part(h.content, '|', 2))"
                f"    )"
                f"    WHERE h.user_id = sub.user_id "
                f"    AND ("
                f"        h.content ILIKE %s OR h.content ILIKE %s"
                f"        OR qb.ans::text ILIKE %s OR qb.ans::text ILIKE %s"
                f"        OR qb.msg_rpy::text ILIKE %s OR qb.msg_rpy::text ILIKE %s"
                f"    )"
                f"))"
            )
            params.extend([f'%{q}%', f'%{q}%', f'%{q}%', f'%{q_escaped}%', f'%{q}%', f'%{q_escaped}%', f'%{q}%', f'%{q_escaped}%'])
        
        for t_filter in tag_filters:
            if t_filter.strip():
                where_clauses.append(
                    f"EXISTS (SELECT 1 FROM \"Private_var:{app_id}\" WHERE user_id = sub.user_id AND name = 'tag' AND value ILIKE %s)"
                )
                params.append(f'%{t_filter.strip()}%')

        where_sql = ('WHERE ' + ' AND '.join(where_clauses)) if where_clauses else ''

        query = f"""
            SELECT sub.user_id,
                   (
                       SELECT content 
                       FROM "history:{app_id}" 
                       WHERE user_id = sub.user_id 
                         AND (LOWER(category) NOT IN ('sensor', 'postback', 'follow', 'unfollow', 'beacon') OR category IS NULL)
                       ORDER BY timestamp DESC 
                       LIMIT 1
                   ) as last_message,
                   (
                       SELECT category 
                       FROM "history:{app_id}" 
                       WHERE user_id = sub.user_id 
                         AND (LOWER(category) NOT IN ('sensor', 'postback', 'follow', 'unfollow', 'beacon') OR category IS NULL)
                       ORDER BY timestamp DESC 
                       LIMIT 1
                   ) as last_message_category,
                   (
                       SELECT json_agg(msg_data)
                       FROM (
                           SELECT * 
                           FROM "history:{app_id}" 
                           WHERE user_id = sub.user_id 
                           ORDER BY timestamp DESC 
                           LIMIT 10
                       ) msg_data
                   ) as recent_messages,
                   sub.last_time,
                    (SELECT string_agg(value, '|') FROM "Private_var:{app_id}" WHERE user_id = sub.user_id AND name = 'tag') as tags,
                    (SELECT value FROM "Private_var:{app_id}" WHERE user_id = sub.user_id AND name = 'name' LIMIT 1) as name,
                    (SELECT value FROM "Private_var:{app_id}" WHERE user_id = sub.user_id AND name = 'unread_count' LIMIT 1) as unread_count
            FROM (
                SELECT user_id,
                       MAX(timestamp) as last_time
                FROM "history:{app_id}"
                GROUP BY user_id
            ) sub
            {where_sql}
            ORDER BY sub.last_time DESC NULLS LAST, sub.user_id ASC
            LIMIT 200
        """
        print(f"DEBUG SQL: {cur.mogrify(query, params).decode('utf-8')}")
        cur.execute(query, params)
        users = cur.fetchall()
        print(f"DEBUG: get_users_list found {len(users)} users for app_id {app_id}")

        cur.close()
        conn.close()
        return json_response(users)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Note: send_socket_event is imported from utils.socket_utils


def check_and_update_rich_menu(user_id, tag):
    """
    檢查標籤是否有對應的 Rich Menu，若有則呼叫 LINE API 切換。
    """
    from models import OAConfig
    current_oa_id = getattr(g, 'current_oa_id', None)
    if not current_oa_id:
        return

    try:
        oa = OAConfig.query.get(int(current_oa_id))
        if not oa or not oa.other_settings or not isinstance(oa.other_settings, dict):
            return
        
        mappings = oa.other_settings.get('rich_menu_mappings', [])
        if not mappings:
            return
        
        # 尋找對應此標籤的選單 (取最後一個匹配的)
        mapping = next((m for m in reversed(mappings) if m.get('tag') == tag), None)
        if not mapping:
            return
        
        rich_menu_id = mapping.get('richMenuId')
        if not rich_menu_id:
            return
            
        # 取得 Token
        from endpoints.richmenu import get_line_token
        token = get_line_token()
        if not token:
            print(f"DEBUG: check_and_update_rich_menu | Line token not configured for OA {current_oa_id}")
            return
            
        headers = {'Authorization': f'Bearer {token}'}
        url = f'https://api.line.me/v2/bot/user/{user_id}/richmenu/{rich_menu_id}'
        
        resp = requests.post(url, headers=headers)
        if resp.status_code == 200:
            print(f"DEBUG: check_and_update_rich_menu | Successfully linked rich menu {rich_menu_id} to user {user_id}")
        else:
            print(f"DEBUG: check_and_update_rich_menu | Failed to link rich menu: {resp.text}")
            
    except Exception as e:
        print(f"DEBUG: check_and_update_rich_menu | Error: {e}")


@app.route('/api/trigger', methods=['POST'])
def trigger_socket_event_route():
    data = request.json
    try:
        send_socket_event(data)
        
        # 檢查 Rich Menu 分配
        msg = data.get('message', '')
        if msg.startswith('set_tag|'):
            tag = msg.split('|', 1)[1]
            user_id = data.get('user')
            if user_id:
                check_and_update_rich_menu(user_id, tag)
                
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"Socket.IO Trigger Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Scheduled Events CRUD
@app.route('/api/scheduled-events', methods=['POST'])
@token_required
def create_scheduled_event():
    data = request.json
    try:
        user_id = data.get('target_user_id')
        message_content = data.get('message_content')
        interval_hours = data.get('interval_hours')
        
        if not user_id or not message_content or interval_hours is None or interval_hours == '':
            return jsonify({"status": "error", "message": "Missing required fields"}), 400

        conn = get_main_db_connection()
        cur = conn.cursor()
        t_cron = get_suffixed_table('cron_table')
        
        # Calculate initial push_time in UTC
        from datetime import timezone as tz_zone
        push_time = datetime.now(tz_zone.utc).replace(tzinfo=None) + timedelta(hours=float(interval_hours))
        
        cur.execute(
            f"INSERT INTO {t_cron} (user_id, message_content, repeat_interval, push_time, status) VALUES (%s, %s, %s, %s, 'active') RETURNING task_id",
            (user_id, message_content, str(interval_hours), push_time)
        )
        task_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success", "task_id": task_id})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Scheduled Events CRUD
@app.route('/api/scheduled-events', methods=['GET'])
@token_required
def get_scheduled_events():
    try:
        app_id = get_current_app_id()
        conn = get_main_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        t_cron = get_suffixed_table('cron_table')
        t_projects = get_suffixed_table('projects')
        
        # Join with projects and user info
        cur.execute(f"""
            SELECT c.task_id as event_id, c.project_id, c.step_id, c.push_time as scheduled_at, c.message_content, c.repeat_interval as interval_hours,
                   p.project_name,
                   NULL as user_name,
                   c.user_id as target_user_id,
                   true as is_enabled
            FROM {t_cron} c
            LEFT JOIN {t_projects} p ON c.project_id = p.project_id
            WHERE c.push_time IS NOT NULL
            ORDER BY c.push_time ASC
        """)
        events = cur.fetchall()
        
        # Enrich with user names from OA DB
        try:
            conn_oa = get_db_connection()
            cur_oa = conn_oa.cursor()
            for e in events:
                cur_oa.execute(f'SELECT value FROM "Private_var:{app_id}" WHERE user_id = %s AND name = \'name\'', (e['target_user_id'],))
                res = cur_oa.fetchone()
                if res: e['user_name'] = res[0]
            cur_oa.close()
            conn_oa.close()
        except: pass

        cur.close()
        conn.close()
        return json_response(events)
    except Exception as e:
        print(f"Error in get_scheduled_events: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/scheduled-events/<int:id>', methods=['DELETE'])
@token_required
def delete_scheduled_event(id):
    try:
        conn = get_main_db_connection()
        cur = conn.cursor()
        t_cron = get_suffixed_table('cron_table')
        cur.execute(f"DELETE FROM {t_cron} WHERE task_id = %s", (id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/qa-bank', methods=['POST'])
def create_qa_entry():
    try:
        data = request.json
        if not data or 'tag' not in data or 'msg_rpy' not in data:
             return jsonify({"error": "Missing tag or msg_rpy"}), 400
        
        tag = data['tag']
        msg_rpy = data['msg_rpy']
        
        import json
        # Since column is json[], we pass a list of JSON strings.
        # psycopg2 will turn a Python list of strings into a Postgres text array literal ['...','...'],
        # then we cast it to json[] in SQL.
        if isinstance(msg_rpy, list):
            msg_rpy_db = [json.dumps(m) for m in msg_rpy]
        else:
            msg_rpy_db = [json.dumps(msg_rpy)]
        
        app_id = get_current_app_id()
        table_name = f"QA_bank:{app_id}"
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check if exists to decide between INSERT or UPDATE
        cur.execute(f'SELECT 1 FROM "{table_name}" WHERE tag = %s', (tag,))
        if cur.fetchone():
            # Update msg_rpy and ensure io is set to Output
            sql = f'UPDATE "{table_name}" SET msg_rpy = %s::json[], "io" = \'Output\' WHERE tag = %s'
            cur.execute(sql, (msg_rpy_db, tag))
        else:
            # Insert new entry with io=Output, and empty check/function/ans
            sql = f'INSERT INTO "{table_name}" (tag, msg_rpy, "io", "check", "function", ans, type) VALUES (%s, %s::json[], \'Output\', ARRAY[\'\'], \'\', ARRAY[\'\'], \'Message\')'
            cur.execute(sql, (tag, msg_rpy_db))
            
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"QA Save Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/qa-bank/<string:tag>', methods=['GET'])
def get_qa_entry(tag):
    try:
        app_id = get_current_app_id()
        table_name = f"QA_bank:{app_id}"
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute(f'SELECT msg_rpy FROM "{table_name}" WHERE tag = %s', (tag,))
        row = cur.fetchone()
        
        cur.close()
        conn.close()
        
        if row:
            ms = row['msg_rpy']
            try:
                import json
                if isinstance(ms, str):
                    ms = json.loads(ms)
            except:
                pass
            return jsonify({"tag": tag, "msg_rpy": ms})
        else:
            return jsonify({"error": "Not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/users/<string:user_id>/read', methods=['POST'])
def mark_user_as_read(user_id):
    try:
        app_id = get_current_app_id()
        conn = get_db_connection()
        cur = conn.cursor()
        # Reset unread_count to 0
        cur.execute(f'UPDATE "Private_var:{app_id}" SET value = \'0\' WHERE user_id = %s AND name = \'unread_count\'', (user_id,))
        if cur.rowcount == 0:
            cur.execute(f'INSERT INTO "Private_var:{app_id}" (user_id, name, value) VALUES (%s, \'unread_count\', \'0\')', (user_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/line/content/<string:message_id>', methods=['GET'])
@token_required
def get_line_message_content(message_id):
    """Proxy route to fetch content (images/video/audio) from LINE API."""
    token = None
    if hasattr(g, 'current_oa_config') and g.current_oa_config.other_settings:
        token = g.current_oa_config.other_settings.get('line_token')
    
    if not token:
        return jsonify({"error": "Line token not configured"}), 400

    headers = {'Authorization': f'Bearer {token}'}
    try:
        # Use api-data.line.me for content retrieval
        url = f"https://api-data.line.me/v2/bot/message/{message_id}/content"
        resp = requests.get(url, headers=headers, stream=True)
        
        if resp.status_code == 200:
            from flask import Response
            return Response(resp.content, mimetype=resp.headers.get('Content-Type', 'image/jpeg'))
        
        return jsonify({"error": "Failed to fetch content", "details": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# DISABLE conflicting scheduler (Line-Bot-Main/sensors/cronjobs.py handles this)
# threading.Thread(target=cron_scheduler_processor, daemon=True).start()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
