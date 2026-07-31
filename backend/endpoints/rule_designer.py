from utils.syslogger import syslog_action
from flask import Blueprint, request, jsonify, g
from psycopg2.extras import RealDictCursor
import psycopg2
import json
import ast
import re

rule_designer_bp = Blueprint('rule_designer', __name__)

from db_utils import get_db_connection

def get_app_id():
    if hasattr(g, 'current_app_name') and g.current_app_name:
        return g.current_app_name
    if hasattr(g, 'current_db_url') and g.current_db_url:
        path_part = g.current_db_url.split('/')[-1]
        return path_part.split('?')[0].strip()
    return '5013'

def trigger_sql_reload():
    """
    Send SQL|True Sensor event to the Line Bot server so it reloads Q_bank
    rule_table from DB at runtime. Pattern follows questionnaire.py.
    """
    try:
        from utils.socket_utils import send_socket_event
        oa_id = getattr(g, 'current_oa_id', None)
        socket_url = None
        
        if oa_id:
            from models import OAConfig
            oa = OAConfig.query.get(int(oa_id))
            if oa and oa.other_settings:
                socket_url = oa.other_settings.get('socket_url')
        
        data = {
            'user': 'yzuadmin',
            'type': 'Sensor',
            'message': 'SQL|True',
        }
        if socket_url:
            data['target_ws_url'] = socket_url
        
        print(f"[RULE_DESIGNER] Triggering SQL reload: {data}")
        send_socket_event(data)
        print(f"[RULE_DESIGNER] SQL reload triggered successfully")
    except Exception as e:
        print(f"[RULE_DESIGNER] SQL reload trigger failed: {e}")

def validate_python_syntax(code_str, field_name):
    """
    Validate a Python expression/statement string using ast.parse.
    Returns None if valid, or a list of error messages if invalid.
    """
    if not code_str or not code_str.strip():
        return None
    
    # Skip validation if it's purely a template expression
    if code_str.strip().startswith('<%') and code_str.strip().endswith('%>'):
        return None

    try:
        # mode='exec' allows multiple statements/expressions
        ast.parse(code_str, mode='exec')
        return None
    except SyntaxError as e:
        # Some legacy formats might use commas to separate expressions in 'check'
        # which Python 'exec' treats as a single tuple. This is fine.
        # But if it's really a syntax error, we report it.
        field_names_cn = {
            'check': '檢查條件',
            'function': '執行動作'
        }
        cn_field = field_names_cn.get(field_name, field_name)
        return [f"{cn_field} 語法錯誤 '{code_str}': {e.msg} (第 {e.lineno} 行)"]

def validate_rule_fields(rule_data, bank_type, design_mode='engineering'):
    """
    Validate rule fields before saving.
    Returns a list of error messages, or empty list if all valid.
    """
    errors = []
    
    # 1. state_in validation (required for q_bank / ad_bank)
    if bank_type in ('q_bank', 'ad_bank'):
        state_in = rule_data.get('state_in')
        if not state_in or (isinstance(state_in, list) and all(not s.strip() for s in state_in)):
            msg = 'state_in 不能為空：請設定至少一個輸入狀態（例如 * 代表任意狀態）' if design_mode == 'engineering' else '標籤狀態不能為空'
            errors.append(msg)
    
    # 2. msg_rpy validation (warn if empty — rule has no response)
    msg_rpy = rule_data.get('msg_rpy')
    function_val = rule_data.get('function', '')
    if (not msg_rpy or (isinstance(msg_rpy, list) and len(msg_rpy) == 0)) and not function_val:
        msg = '回覆訊息與執行動作皆為空：此規則觸發後既不會回覆訊息，也不會執行動作' if design_mode == 'engineering' else '請設定至少一則回覆訊息，讓機器人知道該回覆什麼內容唷！'
        errors.append(msg)
    
    # 3. check field Python syntax validation
    check_val = rule_data.get('check')
    if isinstance(check_val, list):
        for item in check_val:
            if item and item.strip():
                syntax_errors = validate_python_syntax(item, 'check')
                if syntax_errors:
                    errors.extend(syntax_errors)
    elif isinstance(check_val, str) and check_val.strip():
        syntax_errors = validate_python_syntax(check_val, 'check')
        if syntax_errors:
            errors.extend(syntax_errors)
    
    # 4. function field Python syntax validation
    if isinstance(function_val, str) and function_val.strip():
        syntax_errors = validate_python_syntax(function_val, 'function')
        if syntax_errors:
            errors.extend(syntax_errors)
    
    # 5. content validation (should not be empty for Message type)
    if bank_type in ('q_bank', 'ad_bank'):
        rule_type = rule_data.get('type', '')
        content = rule_data.get('content')
        if rule_type and rule_type.lower() == 'message':
            if not content or (isinstance(content, list) and all(not c.strip() for c in content)):
                msg = '關鍵字內容不能為空：文字訊息類型的規則必須設定觸發內容' if design_mode == 'engineering' else '關鍵字內容不能為空'
                errors.append(msg)
    
    # 6. tag validation (required for qa_bank)
    if bank_type == 'qa_bank':
        tag = rule_data.get('tag', '')
        if not tag or not tag.strip():
            msg = 'tag 不能為空：QA 規則必須設定標籤以配對 Input/Output' if design_mode == 'engineering' else '標籤不能為空'
            errors.append(msg)
    
    return errors

@rule_designer_bp.route('/validate-syntax', methods=['POST'])
def validate_syntax():
    """Validate Python syntax for check/function fields."""
    data = request.json
    code = data.get('code', '')
    field_name = data.get('field', 'check')
    
    errors = validate_python_syntax(code, field_name)
    if errors:
        return jsonify({'valid': False, 'errors': errors})
    return jsonify({'valid': True, 'errors': []})

@rule_designer_bp.route('/rules', methods=['GET'])
def list_rules():
    """List rules from both Q_bank and QA_bank."""
    bank_type = request.args.get('type', 'q_bank') # 'q_bank' or 'qa_bank'
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        app_id = get_app_id()
        
        if bank_type == 'q_bank':
            table_name = f"Q_bank:{app_id}"
        elif bank_type == 'ad_bank':
            table_name = f"AD_bank:{app_id}"
        else:
            table_name = f"QA_bank:{app_id}"
        
        # Check if table exists
        cur.execute("SELECT 1 FROM information_schema.tables WHERE table_name = %s", (table_name,))
        if not cur.fetchone():
            cur.close()
            return jsonify({'rules': []})
            
        cur.execute(f'SELECT * FROM "{table_name}" ORDER BY id ASC')
        rules = cur.fetchall()
        
        # Filter out paired Sensor rules for the frontend
        def get_key(r):
            return f"{r.get('content')}|{r.get('state_in')}"
            
        message_keys = {get_key(r) for r in rules if r.get('type') == 'Message'}
        filtered_rules = [r for r in rules if not (r.get('type') == 'Sensor' and get_key(r) in message_keys)]
        
        cur.close()
        return jsonify({'rules': filtered_rules})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

@rule_designer_bp.route('/rules', methods=['POST'])
@syslog_action('RULE_CREATE')
def create_rule():
    data = request.json
    bank_type = data.get('bank_type', 'q_bank')
    design_mode = data.get('design_mode', 'engineering')
    rule_data = data.get('rule')
    
    if not rule_data:
        return jsonify({'error': 'Rule data is required'}), 400
    
    # Validate fields before saving
    validation_errors = validate_rule_fields(rule_data, bank_type, design_mode)
    if validation_errors:
        return jsonify({'status': 'validation_error', 'errors': validation_errors}), 400
        
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        app_id = get_app_id()
        if bank_type == 'q_bank':
            table_name = f"Q_bank:{app_id}"
        elif bank_type == 'ad_bank':
            table_name = f"AD_bank:{app_id}"
        else:
            table_name = f"QA_bank:{app_id}"
        
        # Get actual columns to filter out invalid fields (like 'note' if missing)
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = %s", (table_name,))
        existing_cols = [r['column_name'] for r in cur.fetchall()]
        
        fields = []
        placeholders = []
        values = []
        
        # Mapping frontend rule object to DB columns
        for key, value in rule_data.items():
            if key == 'id': continue
            if key not in existing_cols:
                print(f"[RULE_DESIGNER] Skipping non-existent column: {key}")
                continue
            
            fields.append(f"\"{key}\"")
            
            # Special handling for arrays and JSON
            if isinstance(value, list):
                if key == 'msg_rpy':
                    placeholders.append("%s::json[]")
                    values.append([json.dumps(m, ensure_ascii=False) if not isinstance(m, str) else m for m in value])
                else:
                    placeholders.append("%s")
                    values.append(value)
            else:
                placeholders.append("%s")
                values.append(value)
        
        sql = f"INSERT INTO \"{table_name}\" ({', '.join(fields)}) VALUES ({', '.join(placeholders)}) RETURNING id"
        cur.execute(sql, values)
        new_id = cur.fetchone()['id']
        
        # Dual-rule logic: create a corresponding 'sensor' rule for 'message' rules
        if rule_data.get('type') == 'Message':
            sensor_rule_data = rule_data.copy()
            sensor_rule_data['type'] = 'Sensor'
            sensor_fields = []
            sensor_placeholders = []
            sensor_values = []
            for key, value in sensor_rule_data.items():
                if key == 'id': continue
                if key not in existing_cols: continue
                sensor_fields.append(f"\"{key}\"")
                if isinstance(value, list):
                    if key == 'msg_rpy':
                        sensor_placeholders.append("%s::json[]")
                        sensor_values.append([json.dumps(m, ensure_ascii=False) if not isinstance(m, str) else m for m in value])
                    else:
                        sensor_placeholders.append("%s")
                        sensor_values.append(value)
                else:
                    sensor_placeholders.append("%s")
                    sensor_values.append(value)
            sensor_sql = f"INSERT INTO \"{table_name}\" ({', '.join(sensor_fields)}) VALUES ({', '.join(sensor_placeholders)})"
            cur.execute(sensor_sql, sensor_values)
            
        conn.commit()
        cur.close()

        # Notify via WebSocket
        trigger_sql_reload()

        return jsonify({'status': 'success', 'id': new_id})
    except Exception as e:
        print(f"[RULE_DESIGNER] Create error: {str(e)}")
        if conn: conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@rule_designer_bp.route('/rules/<int:rule_id>', methods=['PUT', 'POST']) # POST for compatibility with some clients
@syslog_action('RULE_UPDATE')
def update_rule(rule_id):
    data = request.json
    bank_type = data.get('bank_type', 'q_bank')
    rule_data = data.get('rule')
    
    print(f"[RULE_DESIGNER] Updating rule {rule_id} in {bank_type}")
    
    if not rule_data:
        return jsonify({'error': 'Rule data is required'}), 400
    
    # Validate fields before saving
    validation_errors = validate_rule_fields(rule_data, bank_type)
    if validation_errors:
        return jsonify({'status': 'validation_error', 'errors': validation_errors}), 400
        
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        app_id = get_app_id()
        if bank_type == 'q_bank':
            table_name = f"Q_bank:{app_id}"
        elif bank_type == 'ad_bank':
            table_name = f"AD_bank:{app_id}"
        else:
            table_name = f"QA_bank:{app_id}"
        
        # Get actual columns
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = %s", (table_name,))
        existing_cols = [r['column_name'] for r in cur.fetchall()]
        
        updates = []
        values = []
        
        for key, value in rule_data.items():
            if key == 'id': continue
            if key not in existing_cols:
                print(f"[RULE_DESIGNER] Skipping non-existent column: {key}")
                continue
            
            if isinstance(value, list):
                if key == 'msg_rpy':
                    updates.append(f"\"{key}\" = %s::json[]")
                    values.append([json.dumps(m, ensure_ascii=False) if not isinstance(m, str) else m for m in value])
                else:
                    updates.append(f"\"{key}\" = %s")
                    values.append(value)
            else:
                updates.append(f"\"{key}\" = %s")
                values.append(value)
        
        # Fetch old rule to find corresponding sensor rule
        cur.execute(f'SELECT type, content, state_in FROM "{table_name}" WHERE id = %s', (rule_id,))
        old_rule = cur.fetchone()

        values.append(rule_id)
        sql = f"UPDATE \"{table_name}\" SET {', '.join(updates)} WHERE id = %s"
        cur.execute(sql, values)
        
        # Dual-rule logic: sync update to the corresponding 'sensor' rule
        if old_rule and old_rule['type'] == 'Message':
            sensor_updates = []
            sensor_values = []
            for key, value in rule_data.items():
                if key == 'id': continue
                if key not in existing_cols: continue
                if key == 'type': continue # Keep 'Sensor'
                
                if isinstance(value, list):
                    if key == 'msg_rpy':
                        sensor_updates.append(f"\"{key}\" = %s::json[]")
                        sensor_values.append([json.dumps(m, ensure_ascii=False) if not isinstance(m, str) else m for m in value])
                    else:
                        sensor_updates.append(f"\"{key}\" = %s")
                        sensor_values.append(value)
                else:
                    sensor_updates.append(f"\"{key}\" = %s")
                    sensor_values.append(value)
                    
            sensor_values.append('Sensor')
            sensor_values.append(old_rule['content'])
            sensor_values.append(old_rule['state_in'])
            
            sensor_sql = f"UPDATE \"{table_name}\" SET {', '.join(sensor_updates)} WHERE type = %s AND content = %s AND state_in = %s"
            cur.execute(sensor_sql, sensor_values)

        conn.commit()
        cur.close()

        # Notify via WebSocket
        trigger_sql_reload()

        return jsonify({'status': 'success'})
    except Exception as e:
        print(f"[RULE_DESIGNER] Update error: {str(e)}")
        if conn: conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@rule_designer_bp.route('/rules/<int:rule_id>', methods=['DELETE'])
@syslog_action('RULE_DELETE')
def delete_rule(rule_id):
    bank_type = request.args.get('type', 'q_bank')
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        app_id = get_app_id()
        if bank_type == 'q_bank':
            table_name = f"Q_bank:{app_id}"
        elif bank_type == 'ad_bank':
            table_name = f"AD_bank:{app_id}"
        else:
            table_name = f"QA_bank:{app_id}"
        
        # Dual-rule logic: sync delete the corresponding 'sensor' rule
        cur.execute(f'SELECT type, content, state_in FROM "{table_name}" WHERE id = %s', (rule_id,))
        old_rule = cur.fetchone()
        
        cur.execute(f'DELETE FROM "{table_name}" WHERE id = %s', (rule_id,))
        
        if old_rule and old_rule['type'] == 'Message':
            cur.execute(f'DELETE FROM "{table_name}" WHERE type = %s AND content = %s AND state_in = %s', 
                       ('Sensor', old_rule['content'], old_rule['state_in']))
                       
        conn.commit()
        cur.close()

        # Notify via WebSocket
        trigger_sql_reload()

        return jsonify({'status': 'success'})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()


# ==========================================
# Follow Rules (加入好友訊息設定) Special Endpoints
# ==========================================

DEFAULT_FOLLOW_FUNCTION = 'pri_set("name",sys.name(m)),pri_set("pic",sys.picture(m))'
BASE_FOLLOW_FUNCTION = 'pri_set("name",sys.name(m)),pri_set("pic",sys.picture(m))'

def ensure_base_follow_function(func_str):
    """Ensures function field contains pri_set("name",sys.name(m)),pri_set("pic",sys.picture(m))."""
    if not func_str or not func_str.strip():
        return BASE_FOLLOW_FUNCTION
    if 'pri_set("name",sys.name(m))' not in func_str or 'pri_set("pic",sys.picture(m))' not in func_str:
        return f"{BASE_FOLLOW_FUNCTION},{func_str.strip()}"
    return func_str.strip()

def is_content_active(content_val):
    """Check if content represents an active rule (* or ['*'])."""
    if not content_val: return False
    if isinstance(content_val, list):
        return '*' in content_val or "['*']" in [str(c) for c in content_val]
    return content_val == '*' or content_val == "['*']"

@rule_designer_bp.route('/follow-rules', methods=['GET'])
def get_follow_rules():
    """Get all follow rules for current app and auto-initialize default rule if none are active."""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        app_id = get_app_id()
        table_name = f"Q_bank:{app_id}"

        # Check if table exists
        cur.execute("SELECT 1 FROM information_schema.tables WHERE table_name = %s", (table_name,))
        if not cur.fetchone():
            cur.close()
            return jsonify({'rules': [], 'has_active': False})

        cur.execute(f'SELECT * FROM "{table_name}" WHERE type = %s ORDER BY id ASC', ('Follow',))
        rules = cur.fetchall()

        has_active = any(is_content_active(r.get('content')) for r in rules)

        # If no active follow rules exist, auto create / enable default follow rule
        if not has_active:
            print(f"[FOLLOW_RULES] No active follow rule found in {table_name}, initializing default rule...")
            default_note = "加入好友訊息 - 預設歡迎訊息"
            
            # Check content column type in DB
            cur.execute("SELECT data_type FROM information_schema.columns WHERE table_name = %s AND column_name = 'content'", (table_name,))
            col_type = (cur.fetchone() or {}).get('data_type', 'character varying')
            default_content = ['*'] if ('ARRAY' in col_type.upper() or col_type == 'ARRAY') else '*'

            cur.execute(f'SELECT id FROM "{table_name}" WHERE type = %s AND note LIKE %s LIMIT 1', ('Follow', '%預設歡迎訊息%'))
            existing_default = cur.fetchone()
            
            if existing_default:
                rule_id = existing_default['id']
                cur.execute(f'UPDATE "{table_name}" SET content = %s, function = %s WHERE id = %s', 
                            (default_content, DEFAULT_FOLLOW_FUNCTION, rule_id))
            else:
                cur.execute(f'SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM "{table_name}"')
                next_id = cur.fetchone()['next_id']
                insert_sql = f'''
                    INSERT INTO "{table_name}" ("id", "state_in", "type", "content", "msg_rpy", "function", "state_out", "note")
                    VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s)
                '''
                cur.execute(insert_sql, (
                    next_id,
                    ['*'],
                    'Follow',
                    default_content,
                    [json.dumps("感謝您加入我們的官方帳號！", ensure_ascii=False)],
                    DEFAULT_FOLLOW_FUNCTION,
                    '*',
                    default_note
                ))
            conn.commit()
            trigger_sql_reload()

            cur.execute(f'SELECT * FROM "{table_name}" WHERE type = %s ORDER BY id ASC', ('Follow',))
            rules = cur.fetchall()
            has_active = True

        cur.close()
        return jsonify({'rules': rules, 'has_active': has_active})
    except Exception as e:
        print(f"[FOLLOW_RULES] get_follow_rules error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@rule_designer_bp.route('/follow-rules', methods=['POST'])
@syslog_action('FOLLOW_RULE_CREATE')
def create_follow_rule():
    """Create a new follow rule with single-active check and note tagging."""
    data = request.json
    rule_data = data.get('rule') if data else None
    if not rule_data:
        return jsonify({'error': 'Rule data is required'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        app_id = get_app_id()
        table_name = f"Q_bank:{app_id}"

        # Single active enforcement: Check if another active follow rule exists
        raw_content = rule_data.get('content', '*')
        is_activating = is_content_active(raw_content)

        cur.execute(f'SELECT id, content FROM "{table_name}" WHERE type = %s', ('Follow',))
        all_follow_rules = cur.fetchall()
        
        if is_activating:
            has_other_active = any(is_content_active(r['content']) for r in all_follow_rules)
            if has_other_active:
                cur.close()
                return jsonify({'error': '已有被啟用的加入好友訊息設定，請先停用該設定後再嘗試啟用此設定。'}), 400

        # Check content column type in DB
        cur.execute("SELECT data_type FROM information_schema.columns WHERE table_name = %s AND column_name = 'content'", (table_name,))
        col_type = (cur.fetchone() or {}).get('data_type', 'character varying')
        if 'ARRAY' in col_type.upper() or col_type == 'ARRAY':
            db_content = ['*'] if is_activating else ['OFF']
        else:
            db_content = '*' if is_activating else 'OFF'

        note = rule_data.get('note', '').strip()
        if not note:
            note = '加入好友訊息'
        elif '加入好友訊息' not in note:
            note = f'加入好友訊息 - {note}'

        raw_func = rule_data.get('function', '')
        func_val = ensure_base_follow_function(raw_func)

        msg_rpy = rule_data.get('msg_rpy', [])
        formatted_msg_rpy = [json.dumps(m, ensure_ascii=False) if not isinstance(m, str) else m for m in msg_rpy] if isinstance(msg_rpy, list) else []

        cur.execute(f'SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM "{table_name}"')
        next_id = cur.fetchone()['next_id']

        insert_sql = f'''
            INSERT INTO "{table_name}" ("id", "state_in", "type", "content", "msg_rpy", "function", "state_out", "note")
            VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s) RETURNING id
        '''
        cur.execute(insert_sql, (
            next_id,
            ['*'],
            'Follow',
            db_content,
            formatted_msg_rpy,
            func_val,
            '*',
            note
        ))
        new_id = cur.fetchone()['id']
        conn.commit()
        cur.close()

        trigger_sql_reload()
        return jsonify({'status': 'success', 'id': new_id})
    except Exception as e:
        print(f"[FOLLOW_RULES] create_follow_rule error: {e}")
        if conn: conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@rule_designer_bp.route('/follow-rules/<int:rule_id>', methods=['PUT', 'POST'])
@syslog_action('FOLLOW_RULE_UPDATE')
def update_follow_rule(rule_id):
    """Update an existing follow rule with single-active check and note tagging."""
    data = request.json
    rule_data = data.get('rule') if data else None
    if not rule_data:
        return jsonify({'error': 'Rule data is required'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        app_id = get_app_id()
        table_name = f"Q_bank:{app_id}"

        raw_content = rule_data.get('content', '*')
        is_activating = is_content_active(raw_content)

        cur.execute(f'SELECT id, content FROM "{table_name}" WHERE type = %s AND id != %s', ('Follow', rule_id))
        other_rules = cur.fetchall()

        if is_activating:
            has_other_active = any(is_content_active(r['content']) for r in other_rules)
            if has_other_active:
                cur.close()
                return jsonify({'error': '已有被啟用的加入好友訊息設定，請先停用該設定後再嘗試啟用此設定。'}), 400

        cur.execute("SELECT data_type FROM information_schema.columns WHERE table_name = %s AND column_name = 'content'", (table_name,))
        col_type = (cur.fetchone() or {}).get('data_type', 'character varying')
        if 'ARRAY' in col_type.upper() or col_type == 'ARRAY':
            db_content = ['*'] if is_activating else ['OFF']
        else:
            db_content = '*' if is_activating else 'OFF'

        note = rule_data.get('note', '').strip()
        if not note:
            note = '加入好友訊息'
        elif '加入好友訊息' not in note:
            note = f'加入好友訊息 - {note}'

        raw_func = rule_data.get('function', '')
        func_val = ensure_base_follow_function(raw_func)

        msg_rpy = rule_data.get('msg_rpy', [])
        formatted_msg_rpy = [json.dumps(m, ensure_ascii=False) if not isinstance(m, str) else m for m in msg_rpy] if isinstance(msg_rpy, list) else []

        update_sql = f'''
            UPDATE "{table_name}"
            SET "content" = %s, "msg_rpy" = %s::json[], "function" = %s, "note" = %s
            WHERE id = %s AND type = 'Follow'
        '''
        cur.execute(update_sql, (db_content, formatted_msg_rpy, func_val, note, rule_id))
        conn.commit()
        cur.close()

        trigger_sql_reload()
        return jsonify({'status': 'success'})
    except Exception as e:
        print(f"[FOLLOW_RULES] update_follow_rule error: {e}")
        if conn: conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@rule_designer_bp.route('/follow-rules/<int:rule_id>/toggle', methods=['POST'])
@syslog_action('FOLLOW_RULE_TOGGLE')
def toggle_follow_rule(rule_id):
    """Toggle follow rule enabled/disabled state (content='*' or 'OFF')."""
    data = request.json or {}
    target_state = data.get('content') # '*' or 'OFF'

    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        app_id = get_app_id()
        table_name = f"Q_bank:{app_id}"

        cur.execute(f'SELECT content FROM "{table_name}" WHERE id = %s AND type = %s', (rule_id, 'Follow'))
        current_rule = cur.fetchone()
        if not current_rule:
            cur.close()
            return jsonify({'error': 'Rule not found'}), 404

        if target_state is None:
            is_activating = not is_content_active(current_rule['content'])
        else:
            is_activating = is_content_active(target_state)

        if is_activating:
            cur.execute(f'SELECT id, content FROM "{table_name}" WHERE type = %s AND id != %s', ('Follow', rule_id))
            other_rules = cur.fetchall()
            if any(is_content_active(r['content']) for r in other_rules):
                cur.close()
                return jsonify({'error': '已有被啟用的加入好友訊息設定，請先停用該設定後再嘗試啟用此設定。'}), 400

        cur.execute("SELECT data_type FROM information_schema.columns WHERE table_name = %s AND column_name = 'content'", (table_name,))
        col_type = (cur.fetchone() or {}).get('data_type', 'character varying')
        if 'ARRAY' in col_type.upper() or col_type == 'ARRAY':
            db_content = ['*'] if is_activating else ['OFF']
        else:
            db_content = '*' if is_activating else 'OFF'

        cur.execute(f'UPDATE "{table_name}" SET content = %s WHERE id = %s AND type = %s', (db_content, rule_id, 'Follow'))
        conn.commit()
        cur.close()

        trigger_sql_reload()
        return jsonify({'status': 'success', 'content': db_content})
    except Exception as e:
        print(f"[FOLLOW_RULES] toggle_follow_rule error: {e}")
        if conn: conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()


