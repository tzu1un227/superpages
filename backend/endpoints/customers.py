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
    print("DEBUG: get_customers called")
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

            # Parse group list
            if u['group_name']:
                try:
                    parsed = ast.literal_eval(u['group_name'])
                    u['group_name'] = parsed if isinstance(parsed, list) else [str(parsed)]
                except:
                    u['group_name'] = [u['group_name']]
            else:
                u['group_name'] = []
            
            u['api_index'] = 0
                
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
    print("DEBUG: get_groups called")
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
        conn.close()
        return jsonify(groups)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@customers_bp.route('/groups', methods=['POST'])
@token_required
def create_group():
    data = request.json
    group_name = data.get('group_name')
    description = data.get('description', '')
    user_ids = data.get('user_ids', [])
    
    if not group_name:
        return jsonify({"error": "Missing group_name"}), 400

    app_id = get_current_app_id()
    conn = get_db_connection()
    cur = conn.cursor()

    try:
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
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@customers_bp.route('/groups/<group_name>', methods=['DELETE'])
@token_required
def delete_group(group_name):
    app_id = get_current_app_id()
    conn = get_db_connection()
    cur = conn.cursor()

    try:
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
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@customers_bp.route('/tags', methods=['GET'])
@token_required
def get_tags():
    print("DEBUG: get_tags called")
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

@customers_bp.route('/tags/<tag_name>', methods=['DELETE'])
@token_required
def delete_tag(tag_name):
    app_id = get_current_app_id()
    conn = get_db_connection()
    cur = conn.cursor()

    try:
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
            s_name = settings.get('socket_name')
            
            def notify_socket():
                events = [{
                    "user": uid, 
                    "message": f"del_tag|{tag_name}", 
                    "type": "Sensor",
                    "api_index": 0
                } for uid in affected_uids]
                target_ns = f"/{s_name}" if s_name else "/websoc"
                print(f"DEBUG: notify_socket (del_tag) | URL: {s_url} | NS: {target_ns} | Count: {len(events)}")
                send_socket_events_batch(events, socket_url=s_url, bot_name=s_name, namespace=target_ns)
            threading.Thread(target=notify_socket).start()




        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
        print(f"Error in delete_tag: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@customers_bp.route('/tags/batch', methods=['POST'])
@token_required
def add_tag_batch():
    app_id = get_current_app_id()
    conn = get_db_connection()
    cur = conn.cursor()
    data = request.json
    tag_name = data.get('tag_name')
    user_ids = data.get('user_ids', [])
    
    if not tag_name or not user_ids:
        return jsonify({"error": "Missing tag_name or user_ids"}), 400
        
    try:
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
            
            if tag_name not in parsed:
                parsed.append(tag_name)
                updates.append((uid, str(parsed)))
        
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
            s_name = settings.get('socket_name')

            def notify_socket():
                events = [{
                    "user": uid, 
                    "message": f"set_tag|{tag_name}", 
                    "type": "Sensor",
                    "api_index": 0
                } for uid in affected_uids]
                target_ns = f"/{s_name}" if s_name else "/websoc"
                print(f"DEBUG: notify_socket (set_tag) | URL: {s_url} | NS: {target_ns} | Count: {len(events)}")
                send_socket_events_batch(events, socket_url=s_url, bot_name=s_name, namespace=target_ns)
            threading.Thread(target=notify_socket).start()



            
        conn.commit()
        return jsonify({"success": True, "count": len(updates)})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

