from flask import Blueprint, jsonify, request, g
from auth import token_required
import psycopg2
from psycopg2.extras import RealDictCursor

customers_bp = Blueprint('customers', __name__)

def get_db_connection():
    # Helper to avoid circular import if needed, but we can import from app.
    # Actually, it's better to import from app inside functions to avoid circular imports.
    from app import get_db_connection as app_get_db_connection
    return app_get_db_connection()

def get_current_app_id():
    from app import get_current_app_id as app_get_app_id
    return app_get_app_id()

@customers_bp.route('', methods=['GET'])
@token_required
def get_customers():
    try:
        app_id = get_current_app_id()
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        pv_table = f'"Private_var:{app_id}"'
        history_table = f'"history:{app_id}"'
        
        # We need to query unique user_id from private_var and aggregate their data
        query = f"""
            SELECT 
                user_id,
                MAX(CASE WHEN name = 'name' THEN value END) as name,
                MAX(CASE WHEN name = 'pic' THEN value END) as pic,
                MAX(CASE WHEN name = 'tag' THEN value END) as tag,
                MAX(CASE WHEN name = 'g_group' THEN value END) as group_name,
                MAX(CASE WHEN name = 'phone' THEN value END) as phone,
                MAX(CASE WHEN name = 'email' THEN value END) as email
            FROM {pv_table}
            GROUP BY user_id
        """
        cur.execute(query)
        users = cur.fetchall()
        
        # Also get latest history timestamp
        query_history = f"""
            SELECT user_id, 
                   MAX(timestamp) as last_interaction,
                   MIN(CASE WHEN category = 'follow' THEN timestamp END) as join_time
            FROM {history_table}
            GROUP BY user_id
        """
        cur.execute(query_history)
        history_rows = cur.fetchall()
        history_dict = {r['user_id']: r for r in history_rows}
        
        import ast
        
        filtered_users = []
        for u in users:
            # strict filter for name existence
            name_val = u.get('name')
            if not name_val or str(name_val).strip() == '' or str(name_val) == 'None' or str(name_val) == '未命名用戶':
                continue
                
            h_data = history_dict.get(u['user_id'], {})
            dt = h_data.get('last_interaction')
            jt = h_data.get('join_time')
            u['last_interaction'] = dt.strftime('%Y-%m-%d %H:%M:%S') if dt else None
            u['join_time'] = jt.strftime('%Y-%m-%d %H:%M:%S') if jt else None
            
            # Parse tag list
            if u['tag']:
                try:
                    parsed = ast.literal_eval(u['tag'])
                    u['tag'] = parsed if isinstance(parsed, list) else [str(parsed)]
                except:
                    u['tag'] = [u['tag']]
            else:
                u['tag'] = []
                
            filtered_users.append(u)
            
        cur.close()
        conn.close()
        return jsonify(filtered_users)
    except Exception as e:
        print(f"Error in get_customers: {e}")
        return jsonify({"error": str(e)}), 500

@customers_bp.route('/groups', methods=['GET'])
@token_required
def get_groups():
    try:
        app_id = get_current_app_id()
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        pv_table = f'"Private_var:{app_id}"'
        
        # fetch distinct group names (based on sensors/group.py logic where name='g_group')
        query = f"""
            SELECT value as group_name, COUNT(user_id) as member_count
            FROM {pv_table}
            WHERE name = 'g_group'
            GROUP BY value
        """
        cur.execute(query)
        groups = cur.fetchall()
        
        cur.close()
        conn.close()
        return jsonify(groups)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@customers_bp.route('/tags', methods=['GET'])
@token_required
def get_tags():
    try:
        app_id = get_current_app_id()
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        pv_table = f'"Private_var:{app_id}"'
        
        import ast
        from collections import Counter
        
        query = f"""
            SELECT value as tag_string
            FROM {pv_table}
            WHERE name = 'tag'
        """
        cur.execute(query)
        rows = cur.fetchall()
        
        tag_counts = Counter()
        for r in rows:
            val = r['tag_string']
            if val:
                try:
                    parsed = ast.literal_eval(val)
                    if isinstance(parsed, list):
                        tag_counts.update(parsed)
                    else:
                        tag_counts.update([str(parsed)])
                except:
                    if str(val).strip() != '[]':
                        tag_counts.update([val])
                        
        tags = [{"tag_name": k, "member_count": v} for k, v in tag_counts.items() if k]
        tags.sort(key=lambda x: x['member_count'], reverse=True)
        
        cur.close()
        conn.close()
        return jsonify(tags)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
