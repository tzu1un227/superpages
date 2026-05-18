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
RDS_URL = "postgresql://u1kq1nhog5jq7b:pd1a6d947df93fb15d747bbadf399e84893f9fd5932782191f0b6ffa187c5ae18@c8lcd8bq1mia7p.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d1hr8bloo29pm6"

# Cache to avoid redundant table checks
_ENSURED_TABLES = set()

def get_rds_connection():
    from db_utils import get_main_db_connection
    return get_main_db_connection()

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
                    updated_at TIMESTAMP,
                    send_type VARCHAR(50)
                )
            """)
        
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
                        if s_at <= now:
                            to_check.append(b)

                if to_check:
                    t_cron = get_t('cron_table')
                    
                    # Check if still in RDS cron_table
                    for bc in to_check:
                        cur_rds.execute(f"SELECT 1 FROM {t_cron} WHERE message_content = %s LIMIT 1", (f"QA|{bc['message_tag']}",))
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

            broadcast_list.append({
                'id': b['id'],
                'name': b['name'],
                'target_type': b['target_type'],
                'target_value': b['target_value'],
                'message_tag': b['message_tag'],
                'send_type': b['send_type'],
                'status': b['status'],
                'scheduled_at': b['scheduled_at'].isoformat() if b['scheduled_at'] else None,
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
def create_broadcast():
    data = request.json
    oa_id = g.current_oa_id
    
    name = data.get('name', '未命名廣播')
    target_type = data.get('target_type', 'all')
    target_value = data.get('target_value', '')
    message_tag = data.get('message_tag')
    send_type = data.get('send_type', 'immediate')
    status = data.get('status', 'draft')
    
    scheduled_at_raw = data.get('scheduled_at')
    scheduled_at = None
    if scheduled_at_raw:
        try:
            # Handle standard ISO and common variations (with space instead of T)
            iso_str = scheduled_at_raw.replace(' ', 'T')
            scheduled_at = datetime.fromisoformat(iso_str)
        except ValueError as ve:
            logger.error(f"Invalid date format: {scheduled_at_raw} - {ve}")
            return jsonify({'error': '無效的日期格式，請使用 ISO 格式'}), 400
    
    conn = None
    try:
        conn = get_rds_connection()
        cur = conn.cursor()
        t_broadcasts = get_t('broadcasts')
        
        cur.execute(
            f"INSERT INTO {t_broadcasts} (oa_id, name, target_type, target_value, message_tag, send_type, status, scheduled_at, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW()) RETURNING id",
            (oa_id, name, target_type, target_value, message_tag, send_type, status, scheduled_at)
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
        scheduled_at = datetime.fromisoformat(data['scheduled_at']) if data.get('scheduled_at') else bc['scheduled_at']
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
                msg_content = f"QA|{bc['message_tag']}"
                cur.execute(f"DELETE FROM {t_cron} WHERE message_content = %s", (msg_content,))
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
                
                cur_rds.execute(f"UPDATE {t_broadcasts} SET status = 'sent' WHERE id = %s", (id,))
                conn_rds.commit()
                return jsonify({'status': 'success', 'method': 'websocket', 'targets': len(user_ids)})

            # 2. Scheduled send via cron_table
            try:
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
                elif bc['target_type'] == 'ids':
                    user_ids = [i.strip() for i in bc['target_value'].split(',') if i.strip()]
                
                if not user_ids:
                    return jsonify({'status': 'success', 'targets': 0, 'message': '沒有找到符合條件的受眾'}), 200

                push_time = bc['scheduled_at'] if bc['scheduled_at'] else datetime.now(timezone.utc).replace(tzinfo=None)
                msg_content = f"QA|{bc['message_tag']}"
                
                insert_data = [(uid, msg_content, push_time, 'active') for uid in user_ids]
                
                sql = f"INSERT INTO {t_cron} (user_id, message_content, push_time, status) VALUES %s"
                execute_values(cur_rds, sql, insert_data)
                
                cur_rds.execute(f"UPDATE {t_broadcasts} SET status = 'scheduled' WHERE id = %s", (id,))
                conn_rds.commit()
                
                logger.info(f"Successfully scheduled broadcast {id} for {len(user_ids)} users using bulk insert.")
                
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
