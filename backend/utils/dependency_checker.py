import re
import json
from flask import g

def get_current_app_id():
    app_id = getattr(g, 'current_app_id', None)
    if not app_id and hasattr(g, 'current_oa_config'):
        app_id = g.current_oa_config.oa_name
    return app_id

def get_t(base):
    app_id = get_current_app_id()
    if app_id:
        return f'"{base}:{app_id}"'
    return f'"{base}"'

def clear_dependency_in_json_string(text, item_type, item_id):
    """
    Find and clear sys_bind references and URL references for item_id.
    item_type is 'journey' (index 3 in sys_bind) or 'menu' (index 4 in sys_bind).
    """
    if not text:
        return text
    
    sid = str(item_id)
    # sys_bind format: sys_bind|tags|journey_id|menu_id|value
    
    def replace_sys_bind(match):
        tags = match.group(1)
        journey = match.group(2)
        menu = match.group(3)
        val = match.group(4)
        
        if item_type == 'journey' and journey == sid:
            journey = ''
        if item_type == 'menu' and menu == sid:
            menu = ''
            
        return f"sys_bind|{tags}|{journey}|{menu}|{val}"
        
    text = re.sub(r'sys_bind\|([^|]*)\|([^|]*)\|([^|]*)\|(.*?(?="|\Z|\\n|\\r))', replace_sys_bind, text)
    
    # URL parameters
    if item_type == 'journey':
        text = re.sub(rf'journey={sid}(&|")', r'journey=\1', text)
    elif item_type == 'menu':
        text = re.sub(rf'menu={sid}(&|")', r'menu=\1', text)
        
    return text

def check_and_clear_dependencies(item_type, item_id, force, oa_conn, main_conn=None):
    """
    item_type: 'journey' or 'menu'
    item_id: ID of the project or rich menu
    force: boolean, if True, performs cascade clear
    oa_conn: db connection to OA database
    main_conn: db connection to Main database (for rich_menu_metadata if needed)
    
    Returns: {"has_dependencies": True/False, "dependencies": list}
    """
    app_id = get_current_app_id()
    sid = str(item_id)
    
    tables_to_check = [
        {"conn": oa_conn, "table": f'"Q_bank:{app_id}"', "col": "msg_rpy", "name_col": "note", "type_name": "標準訊息"},
        {"conn": oa_conn, "table": f'"AD_bank:{app_id}"', "col": "msg_rpy", "name_col": "note", "type_name": "進階訊息"},
        {"conn": oa_conn, "table": f'"QA_bank:{app_id}"', "col": "msg_rpy", "name_col": "tag", "type_name": "關鍵字回覆"},
    ]
    
    if main_conn:
        t_metadata = get_t("rich_menu_metadata")
        tables_to_check.append({"conn": main_conn, "table": t_metadata, "col": "data", "name_col": "name", "type_name": "圖文選單"})
    else:
        tables_to_check.append({"conn": oa_conn, "table": get_t("rich_menu_metadata"), "col": "data", "name_col": "name", "type_name": "圖文選單"})
        
    has_dependencies = False
    dependent_items = []
    
    for t_info in tables_to_check:
        conn = t_info['conn']
        table = t_info['table']
        col = t_info['col']
        name_col = t_info['name_col']
        type_name = t_info['type_name']
        
        try:
            cur = conn.cursor()
            # Find any records containing the ID
            if item_type == 'journey':
                query = f"SELECT id, {col}, {name_col} FROM {table} WHERE {col}::text LIKE %s OR {col}::text LIKE %s"
                cur.execute(query, (f"%|{sid}|%", f"%journey={sid}%"))
            else:
                query = f"SELECT id, {col}, {name_col} FROM {table} WHERE {col}::text LIKE %s OR {col}::text LIKE %s"
                cur.execute(query, (f"%|{sid}|%", f"%menu={sid}%"))
                
            rows = cur.fetchall()
            if rows:
                has_dependencies = True
                
                if not force:
                    for row in rows:
                        item_name = row[2] if row[2] else '未命名'
                        dependent_items.append(f"【{type_name}】{item_name}")
                else:
                    # Cascade clear
                    for row in rows:
                        row_id = row[0]
                        col_data = row[1] 
                        if isinstance(col_data, dict) or isinstance(col_data, list):
                            text_data = json.dumps(col_data, ensure_ascii=False)
                        else:
                            text_data = str(col_data)
                            
                        new_text = clear_dependency_in_json_string(text_data, item_type, sid)
                        
                        if new_text != text_data:
                            update_query = f"UPDATE {table} SET {col} = %s::jsonb WHERE id = %s"
                            cur.execute(update_query, (new_text, row_id))
                    
                    # Use ._conn.commit() if it's PooledConnectionWrapper, else .commit()
                    if hasattr(conn, '_conn'):
                        conn._conn.commit()
                    else:
                        conn.commit()
            cur.close()
        except Exception as e:
            if conn:
                try:
                    if hasattr(conn, '_conn'):
                        conn._conn.rollback()
                    else:
                        conn.rollback()
                except:
                    pass

    return {
        "has_dependencies": has_dependencies,
        "dependencies": dependent_items
    }
