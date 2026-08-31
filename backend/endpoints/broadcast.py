from utils.syslogger import syslog_action
from flask import Blueprint, request, jsonify, g
from models import db, OAConfig
from auth import token_required
from datetime import datetime, timezone, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values
import json
import os
import logging

logger = logging.getLogger(__name__)

# Database details matching app.py
RDS_URL = os.environ.get('DATABASE_URL', "postgresql://postgres:0000@140.138.176.197:5432/superpages")
if RDS_URL.startswith("postgres://"):
    RDS_URL = RDS_URL.replace("postgres://", "postgresql://", 1)

# Cache to avoid redundant table checks
_ENSURED_TABLES = set()

def get_rds_connection(db_url=None):
    from db_utils import get_db_connection
    return get_db_connection(db_url)

def ensure_rds_tables(app_name):
    """確保該平台在 RDS 中擁有必要的資料表"""
    if app_name in _ENSURED_TABLES:
        return
        
    conn = None
    try:
        conn = get_rds_connection()
        cur = conn.cursor()
        
        # broadcasts 表格
        t_broadcasts = f"broadcasts:{app_name}"
        cur.execute(f"SELECT 1 FROM information_schema.tables WHERE table_name = %s", (t_broadcasts,))
        if not cur.fetchone():
            logger.info(f"Creating table {t_broadcasts}...")
            cur.execute(f"""
                CREATE TABLE "{t_broadcasts}" (
                    id SERIAL PRIMARY KEY,
                    oa_id INTEGER,
                    name VARCHAR(255),
                    target_type VARCHAR(50),
                    target_value TEXT,
                    message_tag VARCHAR(100),
                    status VARCHAR(50),
                    scheduled_at TIMESTAMP,
                    created_at TIMESTAMP,
                    send_type VARCHAR(50),
                    audience_mode VARCHAR(20) DEFAULT 'recalculate',
                    locked_recipients JSONB
                )
            """)
        else:
            # Migration for audience_mode and locked_recipients
            try:
                cur.execute(f"SELECT audience_mode FROM \"{t_broadcasts}\" LIMIT 0")
            except psycopg2.Error:
                conn.rollback()
                cur = conn.cursor()
                logger.info(f"Adding audience_mode and locked_recipients to {t_broadcasts}...")
                cur.execute(f"ALTER TABLE \"{t_broadcasts}\" ADD COLUMN audience_mode VARCHAR(20) DEFAULT 'recalculate', ADD COLUMN locked_recipients JSONB")
                conn.commit()
                cur = conn.cursor()
        
        # cron_table 表格
        t_cron = f"cron_table:{app_name}"
        cur.execute(f"SELECT 1 FROM information_schema.tables WHERE table_name = %s", (t_cron,))
        if not cur.fetchone():
            logger.info(f"Creating table {t_cron}...")
            cur.execute(f"""
                CREATE TABLE "{t_cron}" (
                    task_id SERIAL PRIMARY KEY,
                    project_id INTEGER,
                    step_id INTEGER,
                    user_id VARCHAR(255),
                    push_time TIMESTAMP,
                    message_content TEXT,
                    status VARCHAR(50),
                    scheduled_at TIMESTAMP,
                    repeat_interval VARCHAR(100)
                )
            """)

        # project_schedules 表格
        t_schedules = f"project_schedules:{app_name}"
        cur.execute(f"SELECT 1 FROM information_schema.tables WHERE table_name = %s", (t_schedules,))
        if not cur.fetchone():
            logger.info(f"Creating table {t_schedules}...")
            cur.execute(f"""
                CREATE TABLE "{t_schedules}" (
                    schedule_id SERIAL PRIMARY KEY,
                    project_id INTEGER,
                    step_id INTEGER,
                    interval_hours FLOAT,
                    interval_unit VARCHAR(20) DEFAULT 'hours',
                    message_content TEXT
                )
            """)
        else:
            # Ensure interval_unit column exists (Migration)
            # Use a more direct check that handles quotes better
            try:
                cur.execute(f"SELECT interval_unit FROM \"{t_schedules}\" LIMIT 0")
            except psycopg2.Error:
                conn.rollback() # Rollback the failed SELECT
                cur = conn.cursor() # Get a fresh cursor
                logger.info(f"Adding interval_unit to {t_schedules}...")
                cur.execute(f"ALTER TABLE \"{t_schedules}\" ADD COLUMN interval_unit VARCHAR(20) DEFAULT 'hours'")
                conn.commit()
                cur = conn.cursor() # Reset cursor for subsequent calls

        # rich_menu_metadata 表格
        t_rich_menu = f"rich_menu_metadata:{app_name}"
        cur.execute(f"SELECT 1 FROM information_schema.tables WHERE table_name = %s", (t_rich_menu,))
        if not cur.fetchone():
            logger.info(f"Creating table {t_rich_menu}...")
            cur.execute(f"""
                CREATE TABLE "{t_rich_menu}" (
                    id SERIAL PRIMARY KEY,
                    oa_id INTEGER,
                    rich_menu_id VARCHAR(100),
                    name VARCHAR(255) NOT NULL,
                    chat_bar_text VARCHAR(100),
                    data JSONB NOT NULL,
                    status VARCHAR(20) DEFAULT 'draft',
                    start_time TIMESTAMP,
                    end_time TIMESTAMP,
                    permission_tags JSONB DEFAULT '[]'::jsonb,
                    fallback_message VARCHAR(500) DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
        else:
            # Ensure new columns exist (Migration)
            try:
                cur.execute(f"SELECT permission_tags, fallback_message FROM \"{t_rich_menu}\" LIMIT 0")
            except psycopg2.Error:
                conn.rollback()
                cur = conn.cursor()
                logger.info(f"Adding new columns to {t_rich_menu}...")
                try:
                    cur.execute(f"ALTER TABLE \"{t_rich_menu}\" ADD COLUMN permission_tags JSONB DEFAULT '[]'::jsonb")
                except psycopg2.Error:
                    conn.rollback()
                    cur = conn.cursor()
                try:
                    cur.execute(f"ALTER TABLE \"{t_rich_menu}\" ADD COLUMN fallback_message VARCHAR(500) DEFAULT ''")
                except psycopg2.Error:
                    conn.rollback()
                    cur = conn.cursor()
                except psycopg2.Error:
                    conn.rollback()
                    cur = conn.cursor()
        # broadcasts 表格欄位擴充檢查
        try:
            cur.execute(f"SELECT request_id FROM \"{t_broadcasts}\" LIMIT 0")
        except psycopg2.Error:
            conn.rollback()
            cur = conn.cursor()
            try: cur.execute(f"ALTER TABLE \"{t_broadcasts}\" ADD COLUMN request_id VARCHAR(100)")
            except: conn.rollback(); cur = conn.cursor()
            try: cur.execute(f"ALTER TABLE \"{t_broadcasts}\" ADD COLUMN custom_aggregation_unit VARCHAR(100)")
            except: conn.rollback(); cur = conn.cursor()
            try: cur.execute(f"ALTER TABLE \"{t_broadcasts}\" ADD COLUMN sent_recipient_count INT DEFAULT 0")
            except: conn.rollback(); cur = conn.cursor()
            try: cur.execute(f"ALTER TABLE \"{t_broadcasts}\" ADD COLUMN statistics_updated_at TIMESTAMP")
            except: conn.rollback(); cur = conn.cursor()
            conn.commit()
            cur = conn.cursor()

        # broadcast_recipients 表格
        t_recipients = f"broadcast_recipients:{app_name}"
        cur.execute(f"SELECT 1 FROM information_schema.tables WHERE table_name = %s", (t_recipients,))
        if not cur.fetchone():
            logger.info(f"Creating table {t_recipients}...")
            cur.execute(f"""
                CREATE TABLE "{t_recipients}" (
                    id SERIAL PRIMARY KEY,
                    broadcast_id INTEGER,
                    user_id VARCHAR(255),
                    send_status VARCHAR(50) DEFAULT 'sent',
                    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

        # broadcast_line_stats 表格
        t_line_stats = f"broadcast_line_stats:{app_name}"
        cur.execute(f"SELECT 1 FROM information_schema.tables WHERE table_name = %s", (t_line_stats,))
        if not cur.fetchone():
            logger.info(f"Creating table {t_line_stats}...")
            cur.execute(f"""
                CREATE TABLE "{t_line_stats}" (
                    broadcast_id INTEGER PRIMARY KEY,
                    delivered INTEGER,
                    unique_impression INTEGER,
                    unique_click INTEGER,
                    unique_media_played INTEGER,
                    unique_media_played_100_percent INTEGER,
                    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

        conn.commit()
        _ENSURED_TABLES.add(app_name)
    except Exception as e:
        logger.error(f"Failed to ensure RDS tables for {app_name}: {e}")
        if conn: conn.rollback()
    finally:
        if conn:
            try:
                cur.close()
                conn.close()
            except: pass

def get_t(base):
    """
    Returns the table name with the appropriate suffix for multi-tenancy.
    Uses g.current_app_name set in before_request or resolves it from the database.
    """
    app_name = getattr(g, 'current_app_name', None)
    
    # Fallback: if g.current_app_name is missing, try to get it from OA ID
    if not app_name:
        oa_id = getattr(g, 'current_oa_id', None)
        if oa_id:
            oa = OAConfig.query.get(oa_id)
            if oa and oa.other_settings and oa.other_settings.get('app_name'):
                app_name = str(oa.other_settings['app_name'])
                g.current_app_name = app_name
    
    if not app_name:
        # If still no app_name, we cannot determine the table. 
        # In this RDS architecture, suffix is mandatory.
        raise Exception("無法讀取平台名稱 (App Name)，請在帳號管理中確認設定。")
    
    # 自動檢查並建立表格
    ensure_rds_tables(app_name)
        
    return f'"{base}:{app_name}"'

broadcast_bp = Blueprint('broadcast', __name__)

def get_db_connection(db_url):
    from db_utils import get_db_connection as app_get_db_connection
    return app_get_db_connection(db_url)

def get_logical_app_id(oa):
    if oa.other_settings and 'app_name' in oa.other_settings:
        if oa.other_settings['app_name']:
            return str(oa.other_settings['app_name'])
    return oa.db_url.split('/')[-1].split('?')[0].strip()

@broadcast_bp.route('/audience-count', methods=['POST'])
@token_required
def get_audience_count():
    data = request.json
    target_type = data.get('target_type', 'all')
    target_value = data.get('target_value', '')
    
    oa_id = g.current_oa_id
    oa = OAConfig.query.get(oa_id)
    if not oa or not oa.db_url:
        return jsonify({'error': 'OA configuration error'}), 400
    
    conn = None
    try:
        conn = get_db_connection(oa.db_url)
        cur = conn.cursor()
        
        app_id = get_logical_app_id(oa)
        
        # Subquery to identify active users (Latest status in Follow/Unfollow is not Unfollow)
        active_user_subquery = f"""
            SELECT p.user_id FROM "Private_var:{app_id}" p
            WHERE p.name = 'name'
            AND (
                SELECT h.category FROM "history:{app_id}" h
                WHERE h.user_id = p.user_id 
                AND h.category IN ('Follow', 'Unfollow')
                ORDER BY h.timestamp DESC LIMIT 1
            ) IS DISTINCT FROM 'Unfollow'
        """

        # Count target users
        count = 0
        if target_type == 'all':
            cur.execute(f"SELECT count(*) FROM ({active_user_subquery}) AS active_users")
            count = cur.fetchone()[0]
        elif target_type == 'tag':
            cur.execute(f"""
                SELECT count(*) FROM "Private_var:{app_id}" p
                WHERE p.name = 'tag' AND p.value LIKE %s
                AND p.user_id IN ({active_user_subquery})
            """, (f'%{target_value}%',))
            count = cur.fetchone()[0]
        elif target_type == 'group':
            cur.execute(f"""
                SELECT count(*) FROM "Private_var:{app_id}" p
                WHERE p.name = 'g_group' AND p.value LIKE %s
                AND p.user_id IN ({active_user_subquery})
            """, (f'%{target_value}%',))
            count = cur.fetchone()[0]
        elif target_type == 'ids':
            ids = [i.strip() for i in target_value.split(',') if i.strip()]
            count = len(ids)
            
        # Get total users (Active friends count)
        cur.execute(f"SELECT count(*) FROM ({active_user_subquery}) AS active_users")
        total = cur.fetchone()[0]
        
        cur.close()
        
        return jsonify({
            'count': count,
            'total': total,
            'ratio': round(count / total * 100, 2) if total > 0 else 0
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

@broadcast_bp.route('/', methods=['GET'])
@token_required
def list_broadcasts():
    oa_id = g.current_oa_id
    status = request.args.get('status')
    
    conn_rds = None
    shared_conn = None
    try:
        conn_rds = get_rds_connection()
        cur_rds = conn_rds.cursor(cursor_factory=RealDictCursor)
        t_broadcasts = get_t('broadcasts')
        
        where_clause = "WHERE oa_id = %s"
        params = [oa_id]
        if status and status != 'all':
            where_clause += " AND status = %s"
            params.append(status)
            
        cur_rds.execute(f"SELECT * FROM {t_broadcasts} {where_clause} ORDER BY created_at DESC", params)
        broadcasts = cur_rds.fetchall()
        
        # --- Status Reconciliation ---
        now = datetime.now()
        oa = OAConfig.query.get(oa_id)
        if oa and oa.db_url:
            try:
                # Fix: Ensure comparison is done either on naive or aware datetimes.
                # Since RDS timestamp without time zone is naive, we convert scheduled_at to naive if needed.
                to_check = []
                for b in broadcasts:
                    if b['status'] == 'scheduled' and b['scheduled_at']:
                        s_at = b['scheduled_at']
                        if s_at.tzinfo is not None:
                            s_at = s_at.replace(tzinfo=None)
                        if s_at <= datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None):
                            to_check.append(b)

                if to_check:
                    t_cron = get_t('cron_table')
                    
                    # Check if still in RDS cron_table
                    for bc in to_check:
                        cur_rds.execute(
                            f"SELECT 1 FROM {t_cron} WHERE ((user_id = 'yzuadmin' AND message_content LIKE %s) OR message_content = %s) LIMIT 1",
                            (f"%qa('{bc['message_tag']}')%", f"QA|{bc['message_tag']}")
                        )
                        if not cur_rds.fetchone():
                            cur_rds.execute(f"UPDATE {t_broadcasts} SET status = 'sent' WHERE id = %s", (bc['id'],))
                            bc['status'] = 'sent'
                    
                    conn_rds.commit()
            except Exception as e:
                print(f"Reconciliation error: {e}")
        # --- End Status Reconciliation ---
        
        # Fetch message summaries for preview
        broadcast_list = []
        
        # Open connection once for all QA_bank queries
        if broadcasts and oa and oa.db_url:
            try:
                shared_conn = get_db_connection(oa.db_url)
            except Exception as e:
                print(f"Failed to open shared DB connection: {e}")

        app_id = get_logical_app_id(oa) if oa else None
                
        for b in broadcasts:
            summary = []
            if b['message_tag'] and shared_conn and app_id:
                try:
                    with shared_conn.cursor(cursor_factory=RealDictCursor) as cur:
                        cur.execute(f'SELECT msg_rpy FROM "QA_bank:{app_id}" WHERE tag = %s', (b['message_tag'],))
                        row = cur.fetchone()
                        if row and row['msg_rpy']:
                            msgs = row['msg_rpy']
                            if isinstance(msgs, str):
                                msgs = json.loads(msgs)
                            
                            for m in msgs[:3]: # Return up to 3 for preview
                                msg_obj = m
                                if isinstance(m, str):
                                    try: msg_obj = json.loads(m)
                                    except: msg_obj = {"OTYPE": "TextSendMessage", "text": m}
                                
                                if "Line" in msg_obj: msg_obj = msg_obj["Line"]
                                
                                summary.append({
                                    "OTYPE": msg_obj.get("OTYPE", "TextSendMessage"),
                                    "text": msg_obj.get("text", "")[:50] if msg_obj.get("text") else "",
                                    "contents": msg_obj.get("contents")
                                })
                except Exception as e:
                    print(f"Error fetching summary for {b['message_tag']}: {e}")

            b_scheduled_at = None
            if b['scheduled_at']:
                b_scheduled_at = b['scheduled_at'].isoformat()[:16]

            broadcast_list.append({
                'id': b['id'],
                'name': b['name'],
                'target_type': b['target_type'],
                'target_value': b['target_value'],
                'message_tag': b['message_tag'],
                'send_type': b['send_type'],
                'status': b['status'],
                'scheduled_at': b_scheduled_at,
                'created_at': b['created_at'].isoformat(),
                'messages': summary
            })
            
        cur_rds.close()

        return jsonify({
            'broadcasts': broadcast_list
        })
    finally:
        if shared_conn:
            shared_conn.close()
        if conn_rds:
            conn_rds.close()

@broadcast_bp.route('/', methods=['POST'])
@token_required
@syslog_action('BROADCAST_CREATE_DRAFT')
def create_broadcast():
    data = request.json
    oa_id = g.current_oa_id
    
    name = data.get('name', '未命名廣播')
    target_type = data.get('target_type', 'all')
    target_value = data.get('target_value', '')
    send_type = data.get('send_type', 'immediate')
    scheduled_at_raw = data.get('scheduled_at')
    message_tag = data.get('message_tag')
    audience_mode = data.get('audience_mode', 'recalculate')
    locked_recipients = data.get('locked_recipients', None)
    
    if not name or not message_tag:
        return jsonify({'error': '名稱與訊息 Tag 為必填'}), 400
        
    status = 'draft'
    scheduled_at = None
    if send_type == 'scheduled':
        status = 'scheduled'
        if not scheduled_at_raw:
            return jsonify({'error': '排程發送需要提供 scheduled_at'}), 400
        try:
            iso_str = scheduled_at_raw.replace(' ', 'T')
            naive_dt = datetime.fromisoformat(iso_str)
            tw_tz = timezone(timedelta(hours=8))
            tw_dt = naive_dt.replace(tzinfo=tw_tz)
            scheduled_at = tw_dt.replace(tzinfo=None)
        except ValueError as ve:
            logger.error(f"Invalid date format: {scheduled_at_raw} - {ve}")
            return jsonify({'error': '無效的日期格式，請使用 ISO 格式'}), 400
    
    conn = None
    try:
        conn = get_rds_connection()
        cur = conn.cursor()
        t_broadcasts = get_t('broadcasts')
        
        cur.execute(
            f"INSERT INTO {t_broadcasts} (oa_id, name, target_type, target_value, message_tag, send_type, status, scheduled_at, audience_mode, locked_recipients, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()) RETURNING id",
            (oa_id, name, target_type, target_value, message_tag, send_type, status, scheduled_at, audience_mode, json.dumps(locked_recipients) if locked_recipients else None)
        )
        bid = cur.fetchone()[0]
        conn.commit()
        cur.close()
        
        return jsonify({'id': bid, 'status': 'success'})
    finally:
        if conn:
            conn.close()

@broadcast_bp.route('/<int:id>', methods=['PUT'])
@token_required
@syslog_action('BROADCAST_UPDATE')
def update_broadcast(id):
    data = request.json
    conn = None
    try:
        conn = get_rds_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        t_broadcasts = get_t('broadcasts')
        
        cur.execute(f"SELECT * FROM {t_broadcasts} WHERE id = %s", (id,))
        bc = cur.fetchone()
        if not bc:
            return jsonify({'error': 'Not found'}), 404
        if bc['status'] == 'sent':
            return jsonify({'error': 'Cannot update sent broadcast'}), 400
            
        name = data.get('name', bc['name'])
        target_type = data.get('target_type', bc['target_type'])
        target_value = data.get('target_value', bc['target_value'])
        send_type = data.get('send_type', bc['send_type'])
        status = data.get('status', bc['status'])
        if data.get('scheduled_at'):
            iso_str = data['scheduled_at'].replace(' ', 'T')
            naive_dt = datetime.fromisoformat(iso_str)
            tw_tz = timezone(timedelta(hours=8))
            tw_dt = naive_dt.replace(tzinfo=tw_tz)
            scheduled_at = tw_dt.replace(tzinfo=None)
        else:
            scheduled_at = bc['scheduled_at']
        message_tag = data.get('message_tag', bc['message_tag'])
        
        cur.execute(
            f"UPDATE {t_broadcasts} SET name=%s, target_type=%s, target_value=%s, send_type=%s, status=%s, scheduled_at=%s, message_tag=%s WHERE id=%s",
            (name, target_type, target_value, send_type, status, scheduled_at, message_tag, id)
        )
        conn.commit()
        cur.close()
        return jsonify({'status': 'success'})
    finally:
        if conn:
            conn.close()

@broadcast_bp.route('/<int:id>', methods=['DELETE'])
@token_required
@syslog_action('BROADCAST_DELETE')
def delete_broadcast(id):
    conn = None
    try:
        conn = get_rds_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        t_broadcasts = get_t('broadcasts')
        t_cron = get_t('cron_table')
        
        cur.execute(f"SELECT * FROM {t_broadcasts} WHERE id = %s", (id,))
        bc = cur.fetchone()
        if not bc:
            return jsonify({'error': 'Not found'}), 404
        
        # 1. If scheduled, remove from cron_table
        if bc['status'] == 'scheduled' or bc['status'] == 'active':
            try:
                cur.execute(
                    f"DELETE FROM {t_cron} WHERE (user_id = 'yzuadmin' AND message_content LIKE %s) OR message_content = %s",
                    (f"%qa('{bc['message_tag']}')%", f"QA|{bc['message_tag']}")
                )
            except Exception as e:
                print(f"Error deleting from cron_table: {e}")

        cur.execute(f"DELETE FROM {t_broadcasts} WHERE id = %s", (id,))
        conn.commit()
        cur.close()
        return jsonify({'status': 'success'})
    finally:
        if conn:
            conn.close()

@broadcast_bp.route('/<int:id>/execute', methods=['POST'])
@token_required
@syslog_action('BROADCAST_EXECUTE')
def execute_broadcast(id):
    conn_rds = None
    conn_oa = None
    try:
        conn_rds = get_rds_connection()
        cur_rds = conn_rds.cursor(cursor_factory=RealDictCursor)
        t_broadcasts = get_t('broadcasts')
        t_cron = get_t('cron_table')
        
        cur_rds.execute(f"SELECT * FROM {t_broadcasts} WHERE id = %s", (id,))
        bc = cur_rds.fetchone()
        if not bc:
            return jsonify({'error': 'Not found'}), 404
            
        if bc['status'] == 'sent':
            return jsonify({'error': 'Broadcast already sent'}), 400
            
        oa = OAConfig.query.get(bc['oa_id'])
        if not oa or not oa.db_url:
            return jsonify({'error': 'OA configuration error (missing db_url)'}), 400
            
        app_id = get_logical_app_id(oa)
        
        try:
            from utils.socket_utils import send_socket_event
            conn_oa = get_db_connection(oa.db_url)
            cur_oa = conn_oa.cursor()
            
            # Subquery to identify active users (Latest status in Follow/Unfollow is not Unfollow)
            active_user_subquery = f"""
                SELECT p.user_id FROM "Private_var:{app_id}" p
                WHERE p.name = 'name'
                AND (
                    SELECT h.category FROM "history:{app_id}" h
                    WHERE h.user_id = p.user_id 
                    AND h.category IN ('Follow', 'Unfollow')
                    ORDER BY h.timestamp DESC LIMIT 1
                ) IS DISTINCT FROM 'Unfollow'
            """

            # 1. Immediate send via WebSocket
            if bc['send_type'] == 'immediate':
                user_ids = []
                if bc['target_type'] == 'all':
                    cur_oa.execute(f'SELECT user_id FROM ({active_user_subquery}) AS active_users')
                    user_ids = [r[0] for r in cur_oa.fetchall()]
                elif bc['target_type'] == 'tag':
                    cur_oa.execute(f"""
                        SELECT DISTINCT user_id FROM "Private_var:{app_id}" 
                        WHERE name = 'tag' AND value LIKE %s
                        AND user_id IN ({active_user_subquery})
                    """, (f"%{bc['target_value']}%",))
                    user_ids = [r[0] for r in cur_oa.fetchall()]
                elif bc['target_type'] == 'group':
                    cur_oa.execute(f"""
                        SELECT DISTINCT user_id FROM "Private_var:{app_id}" 
                        WHERE name = 'g_group' AND value LIKE %s
                        AND user_id IN ({active_user_subquery})
                    """, (f"%{bc['target_value']}%",))
                    user_ids = [r[0] for r in cur_oa.fetchall()]
                elif bc['target_type'] == 'ids':
                    user_ids = [i.strip() for i in bc['target_value'].split(',') if i.strip()]
                
                if not user_ids:
                    return jsonify({'status': 'success', 'targets': 0, 'message': '沒有找到符合條件的受眾'}), 200

                ids_str = str(user_ids)
                data = {
                    "user": "system", 
                    "type": "Sensor",
                    "message": f"bmcast|{ids_str}|{bc['message_tag']}"
                }
                
                print(f"Triggering immediate broadcast (Format: {bc['target_type']}) via WebSocket: {data['message']}")
                send_socket_event(data)
                
                # 寫入受眾快照
                try:
                    t_recipients = get_t('broadcast_recipients')
                    rec_insert_data = [(id, uid, 'sent') for uid in user_ids]
                    execute_values(cur_rds, f"INSERT INTO {t_recipients} (broadcast_id, user_id, send_status) VALUES %s", rec_insert_data)
                except Exception as rec_e:
                    logger.error(f"Failed to record recipient snapshot for broadcast {id}: {rec_e}")

                cur_rds.execute(f"UPDATE {t_broadcasts} SET status = 'sent', sent_recipient_count = %s WHERE id = %s", (len(user_ids), id))
                conn_rds.commit()
                return jsonify({'status': 'success', 'method': 'websocket', 'targets': len(user_ids)})

            # 2. Scheduled send via cron_table (以 yzuadmin 寫入單一推播 Function，於推播當下動態取名單)
            try:
                # 評估預估受眾名單（用於寫入快照與前端統計）
                user_ids = []
                if bc.get('audience_mode') == 'lock' and bc.get('locked_recipients'):
                    try:
                        locked = json.loads(bc['locked_recipients']) if isinstance(bc['locked_recipients'], str) else bc['locked_recipients']
                        if isinstance(locked, list): user_ids = locked
                    except: pass

                if not user_ids:
                    if bc['target_type'] == 'all':
                        cur_oa.execute(f'SELECT user_id FROM ({active_user_subquery}) AS active_users')
                        user_ids = [r[0] for r in cur_oa.fetchall()]
                    elif bc['target_type'] == 'tag':
                        cur_oa.execute(f"""
                            SELECT DISTINCT user_id FROM "Private_var:{app_id}" 
                            WHERE name = 'tag' AND value LIKE %s
                            AND user_id IN ({active_user_subquery})
                        """, (f"%{bc['target_value']}%",))
                        user_ids = [r[0] for r in cur_oa.fetchall()]
                    elif bc['target_type'] == 'group':
                        cur_oa.execute(f"""
                            SELECT DISTINCT user_id FROM "Private_var:{app_id}" 
                            WHERE name = 'g_group' AND value LIKE %s
                            AND user_id IN ({active_user_subquery})
                        """, (f"%{bc['target_value']}%",))
                        user_ids = [r[0] for r in cur_oa.fetchall()]
                    elif bc['target_type'] == 'ids':
                        user_ids = [i.strip() for i in bc['target_value'].split(',') if i.strip()]
                
                # 組裝 message_content 的 Python Function 語法
                msg_tag = bc['message_tag']
                if bc.get('audience_mode') == 'lock' and user_ids:
                    func_content = f"sys.bmcast(m, qa('{msg_tag}'), {json.dumps(user_ids)})"
                elif bc['target_type'] == 'all':
                    func_content = f"sys.bmcast(m, qa('{msg_tag}'))"
                elif bc['target_type'] == 'tag':
                    t_val = bc['target_value']
                    func_content = f"sys.bmcast(m, qa('{msg_tag}'), dboperation.g_opr(m, [('name', 'tag', 'like'), ('value', '%\\'{t_val}\\'%', 'like')], use_db=True))"
                elif bc['target_type'] == 'group':
                    g_val = bc['target_value']
                    func_content = f"sys.bmcast(m, qa('{msg_tag}'), dboperation.g_opr(m, [('name', 'g_group', 'like'), ('value', '%\\'{g_val}\\'%', 'like')], use_db=True))"
                elif bc['target_type'] == 'ids':
                    func_content = f"sys.bmcast(m, qa('{msg_tag}'), {json.dumps(user_ids)})"
                else:
                    func_content = f"sys.bmcast(m, qa('{msg_tag}'))"

                push_time = bc['scheduled_at'] if bc['scheduled_at'] else datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)
                
                # 刪除既有同 tag 的未執行排程任務（防止重複排程）
                cur_rds.execute(
                    f"DELETE FROM {t_cron} WHERE (user_id = 'yzuadmin' AND message_content LIKE %s) OR message_content = %s",
                    (f"%qa('{msg_tag}')%", f"QA|{msg_tag}")
                )
                
                # 插入單筆 yzuadmin 排程任務
                sql = f"INSERT INTO {t_cron} (user_id, message_content, push_time, status) VALUES (%s, %s, %s, 'active')"
                cur_rds.execute(sql, ('yzuadmin', func_content, push_time))
                
                # 寫入受眾快照
                try:
                    t_recipients = get_t('broadcast_recipients')
                    if user_ids:
                        rec_insert_data = [(id, uid, 'scheduled') for uid in user_ids]
                        execute_values(cur_rds, f"INSERT INTO {t_recipients} (broadcast_id, user_id, send_status) VALUES %s", rec_insert_data)
                except Exception as rec_e:
                    logger.error(f"Failed to record recipient snapshot for broadcast {id}: {rec_e}")

                cur_rds.execute(f"UPDATE {t_broadcasts} SET status = 'scheduled', sent_recipient_count = %s WHERE id = %s", (len(user_ids), id))
                conn_rds.commit()
                
                logger.info(f"Successfully scheduled broadcast {id} for yzuadmin: {func_content} (estimated {len(user_ids)} targets).")
                
                return jsonify({'status': 'success', 'targets': len(user_ids), 'method': 'cron'})
            except Exception as ex:
                conn_rds.rollback()
                logger.exception("Error during scheduled broadcast insertion")
                return jsonify({'error': f"排程寫入失敗: {str(ex)}"}), 500
            finally:
                cur_oa.close()
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    finally:
        if conn_oa:
            conn_oa.close()
        if conn_rds:
            conn_rds.close()

@broadcast_bp.route('/<int:id>/stats', methods=['GET'])
@token_required
def get_broadcast_stats(id):
    period = request.args.get('period', '7d')
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    conn_rds = None
    conn_oa = None
    try:
        conn_rds = get_rds_connection()
        cur_rds = conn_rds.cursor(cursor_factory=RealDictCursor)
        t_broadcasts = get_t('broadcasts')
        t_recipients = get_t('broadcast_recipients')
        t_line_stats = get_t('broadcast_line_stats')
        
        cur_rds.execute(f"SELECT * FROM {t_broadcasts} WHERE id = %s", (id,))
        bc = cur_rds.fetchone()
        if not bc:
            return jsonify({'error': 'Broadcast not found'}), 404
            
        oa = OAConfig.query.get(bc['oa_id'])
        if not oa:
            return jsonify({'error': 'OA configuration not found'}), 400
            
        app_id = get_logical_app_id(oa)
        
        # 1. Recipient count N
        cur_rds.execute(f"SELECT COUNT(DISTINCT user_id) as count FROM {t_recipients} WHERE broadcast_id = %s", (id,))
        rec_row = cur_rds.fetchone()
        target_n = rec_row['count'] if (rec_row and rec_row['count'] > 0) else (bc.get('sent_recipient_count') or 0)
        
        # 2. LINE Stats Fetch / Cache (15 min TTL)
        line_stats_data = {}
        cur_rds.execute(f"SELECT * FROM {t_line_stats} WHERE broadcast_id = %s", (id,))
        cached_line = cur_rds.fetchone()
        
        now_dt = datetime.now()
        cache_valid = False
        if cached_line and cached_line['fetched_at'] and not force_refresh:
            fetched_at = cached_line['fetched_at']
            if fetched_at.tzinfo is not None:
                fetched_at = fetched_at.replace(tzinfo=None)
        # Safe extract channel access token from oa.other_settings
        channel_access_token = None
        if oa and oa.other_settings:
            other = oa.other_settings
            if isinstance(other, str):
                try: other = json.loads(other)
                except: other = {}
            if isinstance(other, dict):
                channel_access_token = (
                    other.get('channel_access_token') or 
                    other.get('line_token') or 
                    other.get('token') or 
                    other.get('channel_token')
                )

        if not cache_valid and channel_access_token:
            import requests
            headers = {"Authorization": f"Bearer {channel_access_token}"}
            request_id = bc.get('request_id')
            custom_unit = bc.get('custom_aggregation_unit')
            
            line_api_res = None
            if request_id:
                try:
                    res = requests.get(f"https://api.line.me/v2/bot/insight/message/event?requestId={request_id}", headers=headers, timeout=5)
                    if res.status_code == 200:
                        line_api_res = res.json()
                except Exception as e:
                    logger.error(f"LINE Insight API request failed: {e}")
            elif custom_unit:
                try:
                    today_str = datetime.now().strftime('%Y%m%d')
                    res = requests.get(f"https://api.line.me/v2/bot/insight/message/event/aggregation?customAggregationUnit={custom_unit}&from={today_str}&to={today_str}", headers=headers, timeout=5)
                    if res.status_code == 200:
                        line_api_res = res.json()
                except Exception as e:
                    logger.error(f"LINE Unit API request failed: {e}")
                    
            if line_api_res and 'overview' in line_api_res:
                ov = line_api_res['overview']
                delivered = ov.get('delivered')
                unique_impression = ov.get('uniqueImpression')
                unique_click = ov.get('uniqueClick')
                unique_media_played = ov.get('uniqueMediaPlayed')
                unique_media_played_100 = ov.get('uniqueMediaPlayed100Percent')
                
                cur_rds.execute(f"""
                    INSERT INTO {t_line_stats} (broadcast_id, delivered, unique_impression, unique_click, unique_media_played, unique_media_played_100_percent, fetched_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (broadcast_id) DO UPDATE SET
                    delivered = EXCLUDED.delivered,
                    unique_impression = EXCLUDED.unique_impression,
                    unique_click = EXCLUDED.unique_click,
                    unique_media_played = EXCLUDED.unique_media_played,
                    unique_media_played_100_percent = EXCLUDED.unique_media_played_100_percent,
                    fetched_at = NOW()
                """, (id, delivered, unique_impression, unique_click, unique_media_played, unique_media_played_100))
                conn_rds.commit()
                
                line_stats_data = {
                    'delivered': delivered,
                    'unique_impression': unique_impression,
                    'unique_click': unique_click,
                    'unique_media_played': unique_media_played,
                    'unique_media_played_100_percent': unique_media_played_100
                }

        deliv = line_stats_data.get('delivered')
        u_imp = line_stats_data.get('unique_impression')
        u_clk = line_stats_data.get('unique_click')
        u_med = line_stats_data.get('unique_media_played')
        u_med100 = line_stats_data.get('unique_media_played_100_percent')
        
        is_unit_api = not bc.get('request_id') and bool(bc.get('custom_aggregation_unit'))
        denom_rate = deliv if (deliv and not is_unit_api) else target_n
        
        impression_rate = round((u_imp / denom_rate) * 100, 2) if (u_imp is not None and denom_rate and denom_rate > 0) else None
        click_rate = round((u_clk / denom_rate) * 100, 2) if (u_clk is not None and denom_rate and denom_rate > 0) else None
        ctor = round((u_clk / u_imp) * 100, 2) if (u_clk is not None and u_imp and u_imp > 0) else None
        media_comp_rate = round((u_med100 / u_med) * 100, 2) if (u_med100 is not None and u_med and u_med > 0) else None

        line_metrics = {
            "api_type": "unit" if is_unit_api else "request_id",
            "estimated_send": target_n,
            "delivered": deliv,
            "unique_impression": u_imp,
            "impression_rate": impression_rate,
            "unique_click": u_clk,
            "click_rate": click_rate,
            "click_through_open_rate": ctor,
            "unique_media_played": u_med,
            "unique_media_played_100_percent": u_med100,
            "media_completion_rate": media_comp_rate,
            "block_change": None
        }
        
        # 3. CRM Follow-up Behaviors from ht_view
        sent_at = bc.get('created_at') or datetime.now()
        if sent_at.tzinfo is not None:
            sent_at = sent_at.replace(tzinfo=None)
            
        days_map = {'1d': 1, '3d': 3, '7d': 7, '30d': 30}
        days = days_map.get(period, 7)
        end_at = sent_at + timedelta(days=days)
        
        custom_end = request.args.get('end_at')
        if custom_end:
            try: end_at = datetime.fromisoformat(custom_end.replace(' ', 'T')).replace(tzinfo=None)
            except: pass
            
        crm_metrics = {
            "target_n": target_n,
            "tag_any_count": 0,
            "tag_breakdown": [],
            "journey_any_count": 0,
            "journey_breakdown": [],
            "has_behavior_count": 0,
            "behavior_rate": 0
        }
        
        if oa.db_url:
            try:
                conn_oa = get_db_connection(oa.db_url)
                cur_oa = conn_oa.cursor(cursor_factory=RealDictCursor)
                t_ht_view = f'"ht_view:{app_id}"'
                
                cur_rds.execute(f"SELECT user_id FROM {t_recipients} WHERE broadcast_id = %s", (id,))
                recipient_uids = [r['user_id'] for r in cur_rds.fetchall()]
                
                if recipient_uids:
                    uids_tuple = tuple(recipient_uids)
                    
                    # 1. Tag breakdown
                    try:
                        cur_oa.execute(f"""
                            SELECT content as tag_name, COUNT(DISTINCT user_id) as count 
                            FROM {t_ht_view}
                            WHERE user_id IN %s 
                              AND LOWER(category) = 'tag' 
                              AND content NOT IN ('manual', 'unknown', '')
                              AND "timestamp" >= %s AND "timestamp" <= %s
                            GROUP BY content
                            ORDER BY count DESC
                        """, (uids_tuple, sent_at, end_at))
                        tag_rows = cur_oa.fetchall()
                        crm_metrics['tag_breakdown'] = [{'tag_name': r['tag_name'], 'count': r['count']} for r in tag_rows]
                        
                        cur_oa.execute(f"""
                            SELECT COUNT(DISTINCT user_id) as total 
                            FROM {t_ht_view}
                            WHERE user_id IN %s 
                              AND LOWER(category) = 'tag' 
                              AND content NOT IN ('manual', 'unknown', '')
                              AND "timestamp" >= %s AND "timestamp" <= %s
                        """, (uids_tuple, sent_at, end_at))
                        tag_total_row = cur_oa.fetchone()
                        crm_metrics['tag_any_count'] = tag_total_row['total'] if tag_total_row else 0
                    except Exception as tag_err:
                        logger.error(f"Error querying tag stats from ht_view: {tag_err}")

                    # 2. Journey breakdown
                    try:
                        cur_oa.execute(f"""
                            SELECT COALESCE(content, '未知旅程') as journey_name, COUNT(DISTINCT user_id) as count 
                            FROM {t_ht_view}
                            WHERE user_id IN %s 
                              AND LOWER(category) IN ('journey', 'project')
                              AND "timestamp" >= %s AND "timestamp" <= %s
                            GROUP BY COALESCE(content, '未知旅程')
                            ORDER BY count DESC
                        """, (uids_tuple, sent_at, end_at))
                        journey_rows = cur_oa.fetchall()
                        crm_metrics['journey_breakdown'] = [{'journey_name': r['journey_name'], 'count': r['count']} for r in journey_rows]
                        
                        cur_oa.execute(f"""
                            SELECT COUNT(DISTINCT user_id) as total 
                            FROM {t_ht_view}
                            WHERE user_id IN %s 
                              AND LOWER(category) IN ('journey', 'project')
                              AND "timestamp" >= %s AND "timestamp" <= %s
                        """, (uids_tuple, sent_at, end_at))
                        journey_total_row = cur_oa.fetchone()
                        crm_metrics['journey_any_count'] = journey_total_row['total'] if journey_total_row else 0
                    except Exception as j_err:
                        logger.error(f"Error querying journey stats from ht_view: {j_err}")

                    # 3. Union Count
                    try:
                        cur_oa.execute(f"""
                            SELECT COUNT(DISTINCT user_id) as union_total
                            FROM {t_ht_view}
                            WHERE user_id IN %s 
                              AND "timestamp" >= %s AND "timestamp" <= %s
                              AND (
                                (LOWER(category) = 'tag' AND content NOT IN ('manual', 'unknown', '')) OR
                                (LOWER(category) IN ('journey', 'project'))
                              )
                        """, (uids_tuple, sent_at, end_at))
                        union_row = cur_oa.fetchone()
                        union_count = union_row['union_total'] if union_row else 0
                        crm_metrics['has_behavior_count'] = union_count
                        crm_metrics['behavior_rate'] = round((union_count / target_n * 100), 2) if target_n > 0 else 0
                    except Exception as u_err:
                        logger.error(f"Error querying union stats from ht_view: {u_err}")
            except Exception as oa_db_e:
                logger.error(f"Error connecting or querying OA DB stats: {oa_db_e}")
                
        return jsonify({
            'broadcast_id': id,
            'broadcast_name': bc['name'],
            'sent_at': sent_at.isoformat(),
            'period': period,
            'line_stats': line_metrics,
            'crm_stats': crm_metrics
        })
    except Exception as e:
        logger.exception(f"Error fetching stats for broadcast {id}")
        return jsonify({'error': str(e)}), 500
    finally:
        if conn_oa: conn_oa.close()
        if conn_rds: conn_rds.close()

