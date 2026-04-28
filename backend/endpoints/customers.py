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
        h_query = f"""
            SELECT user_id, MAX(timestamp) as last_interaction
            FROM {history_table}
            GROUP BY user_id
        """
        try:
            cur.execute(h_query)
            histories = cur.fetchall()
            history_dict = {h['user_id']: h['last_interaction'] for h in histories}
        except Exception as e:
            print(f"Error fetching history: {e}")
            history_dict = {}
        
        for u in users:
            dt = history_dict.get(u['user_id'])
            u['last_interaction'] = dt.strftime('%Y-%m-%d %H:%M:%S') if dt else None
            
        cur.close()
        conn.close()
        return jsonify(users)
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
