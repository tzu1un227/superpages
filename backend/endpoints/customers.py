from utils.syslogger import syslog_action
from flask import Blueprint, jsonify, request, g
from auth import token_required
import psycopg2
from psycopg2.extras import RealDictCursor

customers_bp = Blueprint('customers', __name__)

from db_utils import get_db_connection

def get_current_app_id():
    from app import get_current_app_id as app_get_app_id
    return app_get_app_id()

@customers_bp.route('/', methods=['GET'], strict_slashes=False)
@token_required
def get_customers():
    print("DEBUG: get_customers called")
    
    from flask import request
    limit = request.args.get('limit', type=int) or 200
    offset = request.args.get('offset', type=int) or 0
    limit_clause = f"LIMIT {limit}"
    offset_clause = f"OFFSET {offset}"
    
    conn = None
    try:
        app_id = get_current_app_id()
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        pv_table = f'"Private_var:{app_id}"'
        history_table = f'"history:{app_id}"'
        ups_table = f'"user_project_status:{app_id}"'
        projects_table = f'"projects:{app_id}"'
        t_metadata = f'"rich_menu_metadata:{app_id}"'
        gv_table = f'"Global_var:{app_id}"'

        # Fetch global default rich menu
        cur.execute(f"SELECT value FROM {gv_table} WHERE name = 'default_rich_menu'")
        default_rm_row = cur.fetchone()
        default_rich_menu_id = default_rm_row['value'] if default_rm_row else None
        
        # Optimized query: Fetch users first, then join with limited history stats and projects
        query = f"""
            WITH filtered_users AS (
                SELECT 
                    user_id,
                    MAX(CASE WHEN name = 'name' THEN value END) as name,
                    MAX(CASE WHEN name = 'pic' THEN value END) as pic,
                    MAX(CASE WHEN name = 'tag' THEN value END) as tag,
                    MAX(CASE WHEN name = 'g_group' THEN value END) as group_name,
                    MAX(CASE WHEN name = 'phone' THEN value END) as phone,
                    MAX(CASE WHEN name = 'email' THEN value END) as email,
                    MAX(CASE WHEN name = 'rich_menu' THEN value END) as individual_rich_menu_id
                FROM {pv_table}
                GROUP BY user_id
                HAVING MAX(CASE WHEN name = 'name' THEN value END) IS NOT NULL 
                   AND MAX(CASE WHEN name = 'name' THEN value END) NOT IN ('', 'None', '未命名用戶')
                ORDER BY user_id
                {limit_clause}
                {offset_clause}
            )
            SELECT u.*, 
                   (SELECT MAX(timestamp) FROM {history_table} h WHERE h.user_id = u.user_id) as last_interaction,
                   (SELECT MIN(timestamp) FROM {history_table} h WHERE h.user_id = u.user_id AND h.category = 'follow') as join_time,
                   (
                       SELECT json_agg(json_build_object('project_id', p.project_id, 'project_name', p.project_name, 'status', LOWER(ups.status)))
                       FROM {ups_table} ups
                       JOIN {projects_table} p ON ups.project_id = p.project_id
                       WHERE ups.user_id = u.user_id
                   ) as active_projects,
                   COALESCE(
                       (SELECT name FROM {t_metadata} WHERE rich_menu_id = COALESCE(u.individual_rich_menu_id, %s) LIMIT 1),
                       '未知圖文選單'
                   ) as rich_menu_name,
                   COALESCE(u.individual_rich_menu_id, %s) as final_rich_menu_id
            FROM filtered_users u
            ORDER BY last_interaction DESC NULLS LAST
        """
        
        print(f"DEBUG: Executing optimized customer query for {app_id}")
        cur.execute(query, (default_rich_menu_id, default_rich_menu_id))
        rows = cur.fetchall()
        
        import ast
        results = []
        for r in rows:
            # Format times
            dt = r['last_interaction']
            jt = r['join_time']
            r['last_interaction'] = dt.strftime('%Y-%m-%d %H:%M:%S') if dt else None
            r['join_time'] = jt.strftime('%Y-%m-%d %H:%M:%S') if jt else None
            
            # Form rich_menu object similar to old API call result
            rm_id = r.pop('final_rich_menu_id', None)
            rm_name = r.pop('rich_menu_name', None)
            r.pop('individual_rich_menu_id', None)
            
            if rm_id:
                r['rich_menu'] = {"id": rm_id, "name": rm_name}
            else:
                r['rich_menu'] = None
                
            # Parse active projects
            r['projects'] = r.get('active_projects') or []
            r.pop('active_projects', None)
            
            # Efficiently parse tag list
            tag_val = r.get('tag')
            if tag_val:
                if isinstance(tag_val, str) and tag_val.startswith('['):
                    try:
                        parsed = ast.literal_eval(tag_val)
                        r['tag'] = parsed if isinstance(parsed, list) else [str(parsed)]
                    except:
                        r['tag'] = [tag_val]
                else:
                    r['tag'] = [tag_val]
            else:
                r['tag'] = []

            # Efficiently parse group list
            group_val = r.get('group_name')
            if group_val:
                if isinstance(group_val, str) and group_val.startswith('['):
                    try:
                        parsed = ast.literal_eval(group_val)
                        r['group_name'] = parsed if isinstance(parsed, list) else [str(parsed)]
                    except:
                        r['group_name'] = [group_val]
                else:
                    r['group_name'] = [group_val]
            else:
                r['group_name'] = []
            
            r['api_index'] = 0
            results.append(r)
            
        cur.close()
        print(f"DEBUG: get_customers finished, returning {len(results)} users")
        return jsonify(results)
    except Exception as e:
        print(f"Error in get_customers: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

@customers_bp.route('/groups', methods=['GET'])
@token_required
def get_groups():
    print("DEBUG: get_groups called")
    conn = None
    try:
        app_id = get_current_app_id()
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        pv_table = f'"Private_var:{app_id}"'
        gv_table = f'"Global_var:{app_id}"'
        
        # Get descriptions from Global_var
        cur.execute(f"SELECT value FROM {gv_table} WHERE name = 'group_descriptions'")
        desc_row = cur.fetchone()
        descriptions = {}
        if desc_row and desc_row['value']:
            import json
            try:
                descriptions = json.loads(desc_row['value'])
            except:
                pass
        
        # fetch distinct group names
        cur.execute(f"SELECT value FROM {pv_table} WHERE name = 'g_group'")
        rows = cur.fetchall()
        
        group_counts = {}
        import ast
        for r in rows:
            val = r['value']
            if not val: continue
            try:
                parsed = ast.literal_eval(val)
                parsed = parsed if isinstance(parsed, list) else [str(parsed)]
            except:
                parsed = [val]
            for g in parsed:
                group_counts[g] = group_counts.get(g, 0) + 1
        
        for g_name in descriptions.keys():
            if g_name not in group_counts:
                group_counts[g_name] = 0

        groups = [{'group_name': k, 'member_count': v, 'description': descriptions.get(k, '')} for k, v in group_counts.items()]
        
        cur.close()
        return jsonify(groups)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

@customers_bp.route('/groups', methods=['POST'])
@token_required
@syslog_action('CUSTOMER_CREATE_GROUP')
def create_group():
    data = request.json
    group_name = data.get('group_name')
    description = data.get('description', '')
    user_ids = data.get('user_ids', [])
    
    if not group_name:
        return jsonify({"error": "Missing group_name"}), 400

    app_id = get_current_app_id()
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Update Global_var group_descriptions
        gv_table = f'"Global_var:{app_id}"'
        cur.execute(f"SELECT value FROM {gv_table} WHERE name = 'group_descriptions'")
        row = cur.fetchone()
        
        import json
        if row and row[0]:
            try:
                descriptions = json.loads(row[0])
            except:
                descriptions = {}
            descriptions[group_name] = description
            cur.execute(f"UPDATE {gv_table} SET value = %s WHERE name = 'group_descriptions'", (json.dumps(descriptions, ensure_ascii=False),))
        else:
            descriptions = {group_name: description}
            cur.execute(f"INSERT INTO {gv_table} (name, value) VALUES ('group_descriptions', %s)", (json.dumps(descriptions, ensure_ascii=False),))

        # Update Private_var
        pv_table = f'"Private_var:{app_id}"'
        if user_ids:
            cur.execute(f"SELECT user_id, value FROM {pv_table} WHERE name = 'g_group' AND user_id = ANY(%s)", (user_ids,))
            existing_rows = cur.fetchall()
            existing_map = {r[0]: r[1] for r in existing_rows}
            
            cur.execute(f"DELETE FROM {pv_table} WHERE name = 'g_group' AND user_id = ANY(%s)", (user_ids,))
            
            import ast
            insert_args = []
            for uid in user_ids:
                val = existing_map.get(uid, "[]")
                try:
                    parsed = ast.literal_eval(val)
                    parsed = parsed if isinstance(parsed, list) else [str(parsed)]
                except:
                    parsed = [val] if val else []
                    
                if group_name not in parsed:
                    parsed.append(group_name)
                    
                insert_args.append((uid, 'g_group', str(parsed)))
                
            if insert_args:
                from psycopg2.extras import execute_values
                execute_values(cur, f"INSERT INTO {pv_table} (user_id, name, value) VALUES %s", insert_args)

        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

@customers_bp.route('/groups/<group_name>', methods=['DELETE'])
@token_required
@syslog_action('CUSTOMER_DELETE_GROUP')
def delete_group(group_name):
    app_id = get_current_app_id()
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Update Global_var group_descriptions
        gv_table = f'"Global_var:{app_id}"'
        cur.execute(f"SELECT value FROM {gv_table} WHERE name = 'group_descriptions'")
        row = cur.fetchone()
        
        import json
        if row and row[0]:
            try:
                descriptions = json.loads(row[0])
                if group_name in descriptions:
                    del descriptions[group_name]
                    cur.execute(f"UPDATE {gv_table} SET value = %s WHERE name = 'group_descriptions'", (json.dumps(descriptions, ensure_ascii=False),))
            except Exception as ex:
                print("Error parsing group_descriptions for deletion:", ex)

        # Delete from Private_var
        pv_table = f'"Private_var:{app_id}"'
        cur.execute(f"SELECT user_id, value FROM {pv_table} WHERE name = 'g_group'")
        all_groups = cur.fetchall()
        
        import ast
        updates = []
        for row in all_groups:
            uid = row[0]
            val = row[1]
            try:
                parsed = ast.literal_eval(val)
                parsed = parsed if isinstance(parsed, list) else [str(parsed)]
            except:
                parsed = [val] if val else []
                
            if group_name in parsed:
                parsed.remove(group_name)
                updates.append((str(parsed), uid))
                
        if updates:
            affected_uids = [u[1] for u in updates]
            cur.execute(f"DELETE FROM {pv_table} WHERE name = 'g_group' AND user_id = ANY(%s)", (affected_uids,))
            
            insert_args = [(uid, 'g_group', val) for val, uid in updates]
            if insert_args:
                from psycopg2.extras import execute_values
                execute_values(cur, f"INSERT INTO {pv_table} (user_id, name, value) VALUES %s", insert_args)
        
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()


@customers_bp.route('/tags', methods=['GET'])
@token_required
def get_tags():
    print("DEBUG: get_tags called")
    conn = None
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
        return jsonify(tags)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

@customers_bp.route('/tags/<tag_name>', methods=['DELETE'])
@token_required
@syslog_action('CUSTOMER_DELETE_TAG')
def delete_tag(tag_name):
    app_id = get_current_app_id()
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        from psycopg2.extras import execute_values
        pv_table = f'"Private_var:{app_id}"'
        cur.execute(f"SELECT user_id, value FROM {pv_table} WHERE name = 'tag'")
        rows = cur.fetchall()
        
        import ast
        updates = []
        for r in rows:
            uid = r[0]
            val = r[1]
            if not val: continue
            try:
                parsed = ast.literal_eval(val)
                if isinstance(parsed, list):
                    if tag_name in parsed:
                        parsed.remove(tag_name)
                        updates.append((uid, str(parsed)))
                elif parsed == tag_name:
                    updates.append((uid, "[]"))
            except:
                if val == tag_name:
                    updates.append((uid, "[]"))
                    
        if updates:
            affected_uids = [u[0] for u in updates]
            cur.execute(f"DELETE FROM {pv_table} WHERE name = 'tag' AND user_id = ANY(%s)", (affected_uids,))
            execute_values(cur, f"INSERT INTO {pv_table} (user_id, name, value) VALUES %s", [(uid, 'tag', val) for uid, val in updates])
            
            # Send WebSocket events in background
            from utils.socket_utils import send_socket_events_batch
            import threading
            
            # Capture config before entering thread
            settings = getattr(g, 'current_oa_config', None).other_settings if getattr(g, 'current_oa_config', None) else {}
            s_url = settings.get('socket_url')
            app_name = settings.get('app_name') or settings.get('socket_name')
            
            def notify_socket():
                events = [{
                    "user": uid, 
                    "message": f"del_tag|{tag_name}", 
                    "type": "Sensor",
                    "api_index": 0
                } for uid in affected_uids]
                target_ns = f"/{app_name}" if app_name else None
                print(f"DEBUG: notify_socket (del_tag) | URL: {s_url} | NS: {target_ns} | Count: {len(events)}")
                send_socket_events_batch(events, socket_url=s_url, bot_name=app_name, namespace=target_ns)
            threading.Thread(target=notify_socket).start()

            from endpoints.richmenu import bulk_check_and_update_rich_menu
            g_context = g._get_current_object()
            def update_menus():
                try:
                    from flask import Flask, g
                    dummy_app = Flask(__name__)
                    with dummy_app.app_context():
                        g.current_app_name = getattr(g_context, 'current_app_name', app_id)
                        bulk_check_and_update_rich_menu(affected_uids)
                except Exception as ex:
                    print("Error updating menus async:", ex)
            threading.Thread(target=update_menus).start()

        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        if conn: conn.rollback()
        print(f"Error in delete_tag: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

@customers_bp.route('/tags/batch', methods=['POST'])
@token_required
@syslog_action('CUSTOMER_ADD_TAG')
def add_tag_batch():
    app_id = get_current_app_id()
    conn = None
    cur = None
    data = request.json
    tag_names = data.get('tag_names', [])
    if not tag_names and data.get('tag_name'):
        tag_names = [data.get('tag_name')]
    user_ids = data.get('user_ids', [])
    
    if not tag_names or not user_ids:
        return jsonify({"error": "Missing tag_names or user_ids"}), 400
        
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        from psycopg2.extras import execute_values
        pv_table = f'"Private_var:{app_id}"'
        
        # Get existing tags for these users
        cur.execute(f"SELECT user_id, value FROM {pv_table} WHERE name = 'tag' AND user_id = ANY(%s)", (user_ids,))
        rows = cur.fetchall()
        user_tags = {r[0]: r[1] for r in rows}
        
        import ast
        updates = []
        for uid in user_ids:
            val = user_tags.get(uid)
            try:
                parsed = ast.literal_eval(val) if val else []
                parsed = parsed if isinstance(parsed, list) else [str(parsed)]
            except:
                parsed = [val] if val else []
            
            new_tags = parsed.copy()
            for t in tag_names:
                if t not in new_tags:
                    new_tags.append(t)
            
            if new_tags != parsed:
                updates.append((uid, str(new_tags)))
        
        if updates:
            affected_uids = [u[0] for u in updates]
            cur.execute(f"DELETE FROM {pv_table} WHERE name = 'tag' AND user_id = ANY(%s)", (affected_uids,))
            execute_values(cur, f"INSERT INTO {pv_table} (user_id, name, value) VALUES %s", [(uid, 'tag', val) for uid, val in updates])
            
            # Send WebSocket events in background
            from utils.socket_utils import send_socket_events_batch
            import threading
            
            # Capture config before entering thread
            settings = getattr(g, 'current_oa_config', None).other_settings if getattr(g, 'current_oa_config', None) else {}
            s_url = settings.get('socket_url')
            app_name = settings.get('app_name') or settings.get('socket_name')
            
            tags_str = str(tag_names) # List to string representation like "['A', 'B']"

            def notify_socket():
                events = [{
                    "user": uid, 
                    "message": f"set_tag|{tags_str}", 
                    "type": "Sensor",
                    "api_index": 0
                } for uid in affected_uids]
                target_ns = f"/{app_name}" if app_name else None
                print(f"DEBUG: notify_socket (set_tag) | URL: {s_url} | NS: {target_ns} | Count: {len(events)}")
                send_socket_events_batch(events, socket_url=s_url, bot_name=app_name, namespace=target_ns)
            threading.Thread(target=notify_socket).start()

            from endpoints.richmenu import bulk_check_and_update_rich_menu
            g_context = g._get_current_object()
            def update_menus():
                try:
                    from flask import Flask, g
                    dummy_app = Flask(__name__)
                    with dummy_app.app_context():
                        g.current_app_name = getattr(g_context, 'current_app_name', app_id)
                        bulk_check_and_update_rich_menu(affected_uids)
                except Exception as ex:
                    print("Error updating menus async:", ex)
            threading.Thread(target=update_menus).start()
            
        conn.commit()
        return jsonify({"success": True, "count": len(updates)})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()


@customers_bp.route('/<user_id>', methods=['PUT'])
@token_required
@syslog_action('CUSTOMER_UPDATE_INFO')
def update_customer(user_id):
    data = request.json
    name = data.get('name')
    phone = data.get('phone')
    email = data.get('email')
    
    app_id = get_current_app_id()
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        pv_table = f'"Private_var:{app_id}"'
        
        fields = {
            'name': name,
            'phone': phone,
            'email': email
        }
        
        for k, v in fields.items():
            if v is not None:
                cur.execute(f"UPDATE {pv_table} SET value = %s WHERE user_id = %s AND name = %s", (str(v), user_id, k))
                if cur.rowcount == 0:
                    cur.execute(f"INSERT INTO {pv_table} (user_id, name, value) VALUES (%s, %s, %s)", (user_id, k, str(v)))
        
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        if conn: conn.rollback()
        print(f"Error in update_customer: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()


@customers_bp.route('/<user_id>/details', methods=['GET'])
@token_required
def get_customer_details(user_id):
    app_id = get_current_app_id()
    conn = None
    cur = None
    details = {
        "projects": [],
        "rich_menu": None
    }
    try:
        # Get active & completed projects
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        t_ups = f'"user_project_status:{app_id}"'
        t_projects = f'"projects:{app_id}"'
        cur.execute(f"""
            SELECT p.project_id as id, p.project_name as name, LOWER(ups.status) as status
            FROM {t_ups} ups
            JOIN {t_projects} p ON ups.project_id = p.project_id
            WHERE ups.user_id = %s
        """, (user_id,))
        details["projects"] = cur.fetchall()
        cur.close()
        conn.close()
        conn = None
        
        # Get Rich Menu from LINE API
        from endpoints.richmenu import get_line_token
        token = get_line_token()
        if token:
            import requests
            headers = {'Authorization': f'Bearer {token}'}
            resp = requests.get(f'https://api.line.me/v2/bot/user/{user_id}/richmenu', headers=headers)
            if resp.status_code == 200:
                rich_menu_id = resp.json().get('richMenuId')
                if rich_menu_id:
                    # Query metadata for name
                    from db_utils import get_main_db_connection
                    m_conn = get_main_db_connection()
                    m_cur = m_conn.cursor()
                    t_metadata = f'"rich_menu_metadata:{app_id}"'
                    try:
                        m_cur.execute(f"SELECT name FROM {t_metadata} WHERE rich_menu_id = %s", (rich_menu_id,))
                        row = m_cur.fetchone()
                        if row:
                            details["rich_menu"] = {"id": rich_menu_id, "name": row[0]}
                        else:
                            details["rich_menu"] = {"id": rich_menu_id, "name": "未知圖文選單"}
                            
                        # Sync to Private_var
                        pv_table = f'"Private_var:{app_id}"'
                        m_cur.execute(f"UPDATE {pv_table} SET value = %s WHERE user_id = %s AND name = 'rich_menu'", (rich_menu_id, user_id))
                        if m_cur.rowcount == 0:
                            m_cur.execute(f"INSERT INTO {pv_table} (user_id, name, value) VALUES (%s, 'rich_menu', %s)", (user_id, rich_menu_id))
                        m_conn.commit()
                        
                    except Exception as e:
                        print("Error querying rich menu metadata or syncing:", e)
                    finally:
                        m_cur.close()
                        m_conn.close()
            elif resp.status_code == 404:
                # User has no rich menu linked, sync to DB by deleting the Private_var entry
                from db_utils import get_main_db_connection
                try:
                    m_conn = get_main_db_connection()
                    m_cur = m_conn.cursor()
                    pv_table = f'"Private_var:{app_id}"'
                    m_cur.execute(f"DELETE FROM {pv_table} WHERE user_id = %s AND name = 'rich_menu'", (user_id,))
                    m_conn.commit()
                except Exception as e:
                    print("Error syncing missing rich menu:", e)
                finally:
                    m_cur.close()
                    m_conn.close()
                        
        return jsonify(details)
    except Exception as e:
        if conn: conn.rollback()
        print(f"Error in get_customer_details: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

@customers_bp.route('/<user_id>/richmenu', methods=['DELETE'])
@token_required
def delete_customer_richmenu(user_id):
    from endpoints.richmenu import get_line_token
    import requests
    
    token = get_line_token()
    if not token:
        return jsonify({'message': 'Line token not configured'}), 400
        
    headers = {'Authorization': f'Bearer {token}'}
    try:
        resp = requests.delete(f'https://api.line.me/v2/bot/user/{user_id}/richmenu', headers=headers)
        if resp.status_code == 200:
            app_id = get_current_app_id()
            from db_utils import get_main_db_connection
            try:
                m_conn = get_main_db_connection()
                m_cur = m_conn.cursor()
                pv_table = f'"Private_var:{app_id}"'
                m_cur.execute(f"DELETE FROM {pv_table} WHERE user_id = %s AND name = 'rich_menu'", (user_id,))
                m_conn.commit()
                m_cur.close()
                m_conn.close()
            except Exception as e:
                print("Error syncing deleted rich menu:", e)
                
            return jsonify({'status': 'success'})
        return jsonify({'message': 'Delete failed', 'line_error': resp.text}), resp.status_code
    except Exception as e:
        print(f"Error in delete_customer_richmenu: {e}")
        return jsonify({'message': 'Error', 'error': str(e)}), 500


@customers_bp.route('/groups/<path:group_name>/users', methods=['GET'])
@token_required
def get_group_users(group_name):
    app_id = get_current_app_id()
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        pv_table = f'"Private_var:{app_id}"'
        active_user_subquery = f"""
            SELECT p.user_id FROM {pv_table} p
            WHERE p.name = 'name'
            AND (
                SELECT h.category FROM "history:{app_id}" h
                WHERE h.user_id = p.user_id 
                AND h.category IN ('Follow', 'Unfollow')
                ORDER BY h.timestamp DESC LIMIT 1
            ) IS DISTINCT FROM 'Unfollow'
            AND length(p.user_id) = 33 AND p.user_id LIKE 'U%%'
        """
        cur.execute(f"""
            SELECT DISTINCT user_id FROM {pv_table}
            WHERE name = 'g_group' AND value LIKE %s
            AND user_id IN ({active_user_subquery})
        """, (f'%{group_name}%',))
        uids = [r[0] for r in cur.fetchall()]
        return jsonify({"group_name": group_name, "count": len(uids), "user_ids": uids})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

@customers_bp.route('/count-by-tags', methods=['POST'])
@token_required
def count_by_tags():
    data = request.json or {}
    tags = data.get('tags', [])
    group = data.get('group', None)
    app_id = get_current_app_id()
    from db_utils import get_db_connection
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Calculate total count of active users
        active_user_subquery = f"""
            SELECT p.user_id FROM "Private_var:{app_id}" p
            WHERE p.name = 'name'
            AND (
                SELECT h.category FROM "history:{app_id}" h
                WHERE h.user_id = p.user_id 
                AND h.category IN ('Follow', 'Unfollow')
                ORDER BY h.timestamp DESC LIMIT 1
            ) IS DISTINCT FROM 'Unfollow'
            AND length(p.user_id) = 33 AND p.user_id LIKE 'U%%'
        """
        cur.execute(f"SELECT COUNT(*) FROM ({active_user_subquery}) AS active_users")
        total_count = cur.fetchone()[0]

        if group:
            pv_table = f'"Private_var:{app_id}"'
            cur.execute(f"""
                SELECT COUNT(DISTINCT user_id) FROM {pv_table}
                WHERE name = 'g_group' AND value LIKE %s
                AND user_id IN ({active_user_subquery})
            """, (f'%{group}%',))
            cnt = cur.fetchone()[0]
            return jsonify({"count": cnt, "totalCount": total_count})

        if not tags:
            return jsonify({"count": total_count, "totalCount": total_count})
            
        pv_table = f'"Private_var:{app_id}"'
        
        conditions = []
        params = []
        for tg in tags:
            # Match JSON list: ["tag"]
            conditions.append("value ILIKE %s")
            params.append(f'%"{tg}"%')
            # Match Python list string: ['tag']
            conditions.append("value ILIKE %s")
            params.append(f"%'\"{tg}\"'%")
            conditions.append("value ILIKE %s")
            params.append(f"%'\'{tg}\"'%")
            conditions.append("value ILIKE %s")
            params.append(f"%'{tg}'%")
            # Exact match
            conditions.append("value ILIKE %s")
            params.append(tg)
            # Match comma separated without quotes
            conditions.append("value ILIKE %s")
            params.append(f"%{tg}%")
            
        where_clause = " OR ".join(conditions)
        query = f"""
            SELECT COUNT(DISTINCT user_id) 
            FROM {pv_table} 
            WHERE name = 'tag' AND ({where_clause}) AND user_id IN ({active_user_subquery})
        """
        cur.execute(query, params)
        count = cur.fetchone()[0]
        cur.close()
        return jsonify({"count": count, "totalCount": total_count})
    except Exception as e:
        print(f"Error in count_by_tags: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

@customers_bp.route('/<user_id>/refresh-profile', methods=['POST'])
@token_required
def refresh_customer_profile(user_id):
    import requests
    from endpoints.richmenu import get_line_token
    
    app_id = get_current_app_id()
    token = get_line_token()
    if not token:
        return jsonify({"error": "LINE token not configured"}), 500
        
    headers = {'Authorization': f'Bearer {token}'}
    conn = None
    cur = None
    try:
        resp = requests.get(f'https://api.line.me/v2/bot/profile/{user_id}', headers=headers)
        if resp.status_code != 200:
            if resp.status_code == 404:
                return jsonify({
                    "picture_url": None,
                    "display_name": None,
                    "status": "unfollowed"
                }), 200
            return jsonify({"error": f"Failed to get LINE profile: {resp.text}"}), resp.status_code
            
        profile = resp.json()
        display_name = profile.get('displayName')
        picture_url = profile.get('pictureUrl')
        
        conn = get_db_connection()
        cur = conn.cursor()
        pv_table = f'"Private_var:{app_id}"'
        
        if display_name:
            cur.execute(f"UPDATE {pv_table} SET value = %s WHERE user_id = %s AND name = 'name'", (display_name, user_id))
            if cur.rowcount == 0:
                cur.execute(f"INSERT INTO {pv_table} (user_id, name, value) VALUES (%s, 'name', %s)", (user_id, display_name))
                
        if picture_url:
            cur.execute(f"UPDATE {pv_table} SET value = %s WHERE user_id = %s AND name = 'pic'", (picture_url, user_id))
            if cur.rowcount == 0:
                cur.execute(f"INSERT INTO {pv_table} (user_id, name, value) VALUES (%s, 'pic', %s)", (user_id, picture_url))
                
        conn.commit()
        
        return jsonify({
            "picture_url": picture_url,
            "display_name": display_name,
            "status": "active"
        }), 200
    except Exception as e:
        print(f"Error in refresh_customer_profile: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@customers_bp.route('/batch-operation', methods=['POST'])
@token_required
@syslog_action('CUSTOMER_BATCH_OPERATION')
def batch_operation():
    data = request.json or {}
    action_type = data.get('action_type')
    user_ids = data.get('user_ids', [])
    payload = data.get('payload', {})

    if not action_type or not user_ids:
        return jsonify({"error": "Missing action_type or user_ids"}), 400

    app_id = get_current_app_id()
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        from psycopg2.extras import RealDictCursor, execute_values
        import json
        import ast

        pv_table = f'"Private_var:{app_id}"'

        results = [] # list of dicts: {"user_id": uid, "status": status, "reason": reason}
        success_count = 0
        skipped_count = 0
        failed_count = 0

        # Helper to parse python/json list strings safely
        def parse_list(val):
            if not val: return []
            try:
                parsed = ast.literal_eval(val)
                return parsed if isinstance(parsed, list) else [str(parsed)]
            except:
                return [val]

        if action_type == 'add_tags':
            tag_names = payload.get('tag_names', [])
            if not tag_names and payload.get('tag_name'):
                tag_names = [payload.get('tag_name')]
            
            cur.execute(f"SELECT user_id, value FROM {pv_table} WHERE name = 'tag' AND user_id = ANY(%s)", (user_ids,))
            rows = cur.fetchall()
            existing_map = {r[0]: r[1] for r in rows}

            updates = []
            affected_uids = []
            for uid in user_ids:
                curr_tags = parse_list(existing_map.get(uid))
                new_tags = curr_tags.copy()
                added_any = False
                for t in tag_names:
                    if t not in new_tags:
                        new_tags.append(t)
                        added_any = True
                
                if added_any:
                    updates.append((uid, str(new_tags)))
                    affected_uids.append(uid)
                    results.append({"user_id": uid, "status": "success", "reason": None})
                    success_count += 1
                else:
                    results.append({"user_id": uid, "status": "skipped", "reason": "使用者已持有該標籤"})
                    skipped_count += 1

            if updates:
                cur.execute(f"DELETE FROM {pv_table} WHERE name = 'tag' AND user_id = ANY(%s)", (affected_uids,))
                execute_values(cur, f"INSERT INTO {pv_table} (user_id, name, value) VALUES %s", [(uid, 'tag', val) for uid, val in updates])
                
                # Background Sensor Event & Richmenu Update
                from utils.socket_utils import send_socket_events_batch
                import threading
                settings = getattr(g, 'current_oa_config', None).other_settings if getattr(g, 'current_oa_config', None) else {}
                s_url = settings.get('socket_url')
                app_name = settings.get('app_name') or settings.get('socket_name')
                tags_str = str(tag_names)
                def notify_socket():
                    events = [{"user": uid, "message": f"set_tag|{tags_str}", "type": "Sensor", "api_index": 0} for uid in affected_uids]
                    send_socket_events_batch(events, socket_url=s_url, bot_name=app_name, namespace=f"/{app_name}" if app_name else None)
                threading.Thread(target=notify_socket).start()

                from endpoints.richmenu import bulk_check_and_update_rich_menu
                g_context = g._get_current_object()
                def update_menus():
                    try:
                        from flask import Flask, g
                        dummy_app = Flask(__name__)
                        with dummy_app.app_context():
                            g.current_app_name = getattr(g_context, 'current_app_name', app_id)
                            bulk_check_and_update_rich_menu(affected_uids)
                    except Exception as ex:
                        print("Error updating menus async:", ex)
                threading.Thread(target=update_menus).start()

        elif action_type == 'remove_tags':
            tag_names = payload.get('tag_names', [])
            if not tag_names and payload.get('tag_name'):
                tag_names = [payload.get('tag_name')]

            cur.execute(f"SELECT user_id, value FROM {pv_table} WHERE name = 'tag' AND user_id = ANY(%s)", (user_ids,))
            rows = cur.fetchall()
            existing_map = {r[0]: r[1] for r in rows}

            updates = []
            affected_uids = []
            for uid in user_ids:
                curr_tags = parse_list(existing_map.get(uid))
                new_tags = [t for t in curr_tags if t not in tag_names]
                if len(new_tags) < len(curr_tags):
                    updates.append((uid, str(new_tags)))
                    affected_uids.append(uid)
                    results.append({"user_id": uid, "status": "success", "reason": None})
                    success_count += 1
                else:
                    results.append({"user_id": uid, "status": "skipped", "reason": "使用者原本沒有該標籤"})
                    skipped_count += 1

            if updates:
                cur.execute(f"DELETE FROM {pv_table} WHERE name = 'tag' AND user_id = ANY(%s)", (affected_uids,))
                execute_values(cur, f"INSERT INTO {pv_table} (user_id, name, value) VALUES %s", [(uid, 'tag', val) for uid, val in updates])

                # Background Sensor Event & Richmenu Update
                from utils.socket_utils import send_socket_events_batch
                import threading
                settings = getattr(g, 'current_oa_config', None).other_settings if getattr(g, 'current_oa_config', None) else {}
                s_url = settings.get('socket_url')
                app_name = settings.get('app_name') or settings.get('socket_name')
                def notify_socket():
                    events = [{"user": uid, "message": f"del_tag|{tag_names[0] if tag_names else ''}", "type": "Sensor", "api_index": 0} for uid in affected_uids]
                    send_socket_events_batch(events, socket_url=s_url, bot_name=app_name, namespace=f"/{app_name}" if app_name else None)
                threading.Thread(target=notify_socket).start()

                from endpoints.richmenu import bulk_check_and_update_rich_menu
                g_context = g._get_current_object()
                def update_menus():
                    try:
                        from flask import Flask, g
                        dummy_app = Flask(__name__)
                        with dummy_app.app_context():
                            g.current_app_name = getattr(g_context, 'current_app_name', app_id)
                            bulk_check_and_update_rich_menu(affected_uids)
                    except Exception as ex:
                        print("Error updating menus async:", ex)
                threading.Thread(target=update_menus).start()

        elif action_type == 'apply_richmenu':
            target_rm_id = payload.get('rich_menu_id')
            if not target_rm_id:
                return jsonify({"error": "Missing rich_menu_id in payload"}), 400

            cur.execute(f"SELECT user_id, value FROM {pv_table} WHERE name = 'rich_menu' AND user_id = ANY(%s)", (user_ids,))
            existing_map = {r[0]: r[1] for r in cur.fetchall()}

            to_link_uids = []
            for uid in user_ids:
                curr_rm = existing_map.get(uid)
                if curr_rm == target_rm_id:
                    results.append({"user_id": uid, "status": "skipped", "reason": "目前個人圖文選單已是指定選單"})
                    skipped_count += 1
                else:
                    to_link_uids.append(uid)

            if to_link_uids:
                from endpoints.richmenu import get_line_token
                token = get_line_token()
                import requests
                headers = {'Authorization': f'Bearer {token}'} if token else {}

                # Bulk Link via LINE API
                line_success = True
                if token:
                    for i in range(0, len(to_link_uids), 500):
                        batch = to_link_uids[i:i+500]
                        resp = requests.post('https://api.line.me/v2/bot/richmenu/bulk/link', headers=headers, json={'userIds': batch, 'richMenuId': target_rm_id})
                        if resp.status_code != 200:
                            line_success = False
                            break

                if line_success:
                    cur.execute(f"DELETE FROM {pv_table} WHERE name = 'rich_menu' AND user_id = ANY(%s)", (to_link_uids,))
                    execute_values(cur, f"INSERT INTO {pv_table} (user_id, name, value) VALUES %s", [(uid, 'rich_menu', target_rm_id) for uid in to_link_uids])
                    for uid in to_link_uids:
                        results.append({"user_id": uid, "status": "success", "reason": None})
                        success_count += 1
                else:
                    for uid in to_link_uids:
                        results.append({"user_id": uid, "status": "failed", "reason": "LINE API 套用圖文選單失敗"})
                        failed_count += 1

        elif action_type == 'unlink_richmenu':
            cur.execute(f"SELECT user_id, value FROM {pv_table} WHERE name = 'rich_menu' AND user_id = ANY(%s)", (user_ids,))
            existing_map = {r[0]: r[1] for r in cur.fetchall()}

            to_unlink_uids = []
            for uid in user_ids:
                if uid in existing_map and existing_map[uid]:
                    to_unlink_uids.append(uid)
                else:
                    results.append({"user_id": uid, "status": "skipped", "reason": "原本沒有個人圖文選單連結"})
                    skipped_count += 1

            if to_unlink_uids:
                from endpoints.richmenu import get_line_token
                token = get_line_token()
                import requests
                headers = {'Authorization': f'Bearer {token}'} if token else {}

                line_success = True
                if token:
                    for i in range(0, len(to_unlink_uids), 500):
                        batch = to_unlink_uids[i:i+500]
                        resp = requests.post('https://api.line.me/v2/bot/richmenu/bulk/unlink', headers=headers, json={'userIds': batch})
                        if resp.status_code != 200:
                            line_success = False
                            break

                if line_success:
                    cur.execute(f"DELETE FROM {pv_table} WHERE name = 'rich_menu' AND user_id = ANY(%s)", (to_unlink_uids,))
                    for uid in to_unlink_uids:
                        results.append({"user_id": uid, "status": "success", "reason": None})
                        success_count += 1
                else:
                    for uid in to_unlink_uids:
                        results.append({"user_id": uid, "status": "failed", "reason": "LINE API 解除圖文選單失敗"})
                        failed_count += 1

        elif action_type == 'enroll_journey':
            project_id = payload.get('project_id')
            if not project_id:
                return jsonify({"error": "Missing project_id in payload"}), 400

            t_ups = f'"user_project_status:{app_id}"'
            cur.execute(f"SELECT user_id, status FROM {t_ups} WHERE project_id = %s AND user_id = ANY(%s)", (project_id, user_ids))
            existing_ups = {r[0]: str(r[1]).lower() for r in cur.fetchall()}

            to_enroll_uids = []
            for uid in user_ids:
                if existing_ups.get(uid) == 'active':
                    results.append({"user_id": uid, "status": "skipped", "reason": "使用者目前已在該旅程進行中"})
                    skipped_count += 1
                else:
                    to_enroll_uids.append(uid)

            if to_enroll_uids:
                from app import batch_enroll_journey_users_internal
                ok, err_msg = batch_enroll_journey_users_internal(project_id, to_enroll_uids, app_id)
                if ok:
                    for uid in to_enroll_uids:
                        results.append({"user_id": uid, "status": "success", "reason": None})
                        success_count += 1
                else:
                    for uid in to_enroll_uids:
                        results.append({"user_id": uid, "status": "failed", "reason": f"加入自動旅程失敗: {err_msg}"})
                        failed_count += 1

        elif action_type == 'stop_journey':
            project_id = payload.get('project_id')
            stop_reason = payload.get('stop_reason', '')
            if not project_id:
                return jsonify({"error": "Missing project_id in payload"}), 400

            t_ups = f'"user_project_status:{app_id}"'
            t_cron = f'"cron_table:{app_id}"'
            cur.execute(f"SELECT user_id, status FROM {t_ups} WHERE project_id = %s AND user_id = ANY(%s)", (project_id, user_ids))
            existing_ups = {r[0]: str(r[1]).lower() for r in cur.fetchall()}

            to_stop_uids = []
            for uid in user_ids:
                if existing_ups.get(uid) == 'active':
                    to_stop_uids.append(uid)
                else:
                    results.append({"user_id": uid, "status": "skipped", "reason": "未加入、已完成或已停止"})
                    skipped_count += 1

            if to_stop_uids:
                cur.execute(f"DELETE FROM {t_cron} WHERE project_id = %s AND user_id = ANY(%s)", (project_id, to_stop_uids))
                cur.execute(f"UPDATE {t_ups} SET status = 'stopped', updated_at = NOW() WHERE project_id = %s AND user_id = ANY(%s)", (project_id, to_stop_uids))
                for uid in to_stop_uids:
                    results.append({"user_id": uid, "status": "success", "reason": None})
                    success_count += 1

        conn.commit()

        return jsonify({
            "success": True,
            "action_type": action_type,
            "selected_count": len(user_ids),
            "success_count": success_count,
            "skipped_count": skipped_count,
            "failed_count": failed_count,
            "results": results
        })

    except Exception as e:
        if conn: conn.rollback()
        print(f"Error in batch_operation: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()


