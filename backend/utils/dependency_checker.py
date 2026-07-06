import re
import json
from flask import g

def get_current_app_id():
    """Returns the current logical app name/id (e.g. 'yzulabuse')."""
    if hasattr(g, 'current_app_name') and g.current_app_name:
        return g.current_app_name
    if hasattr(g, 'current_db_url') and g.current_db_url:
        path_part = g.current_db_url.split('/')[-1]
        return path_part.split('?')[0].strip()
    return '5013' # Default

def get_t(base):
    app_id = get_current_app_id()
    if app_id:
        return f'"{base}:{app_id}"'
    return f'"{base}"'

def clear_dependency_in_json_string(text, item_type, item_id, extra_ids=None):
    """
    Find and clear sys_bind references and URL references for item_id.
    item_type is 'journey' (index 3 in sys_bind) or 'menu' (index 4 in sys_bind).
    extra_ids: list of additional IDs to also clear (e.g. richMenuId alongside ui_uuid).
    """
    if not text:
        return text
    
    all_ids = [str(item_id)]
    if extra_ids:
        all_ids.extend([str(eid) for eid in extra_ids if eid])
    
    # sys_bind format: sys_bind|tags|journey_id|menu_id|value
    for sid in all_ids:
        def replace_sys_bind(match, _sid=sid):
            tags = match.group(1)
            journey = match.group(2)
            menu = match.group(3)
            val = match.group(4)
            
            if item_type == 'journey' and journey == _sid:
                journey = ''
            if item_type == 'menu' and menu == _sid:
                menu = ''
                
            return f"sys_bind|{tags}|{journey}|{menu}|{val}"
            
        text = re.sub(r'sys_bind\|([^|]*)\|([^|]*)\|([^|]*)\|(.*?(?="|\Z|\\n|\\r))', replace_sys_bind, text)
        
        # URL parameters and function calls
        if item_type == 'journey':
            text = re.sub(rf'journey={re.escape(sid)}(&|")', r'journey=\1', text)
            text = re.sub(rf'update\("iup\|{re.escape(sid)}"\);?', '', text)
            text = re.sub(rf"update\('iup\|{re.escape(sid)}'\);?", '', text)
        elif item_type == 'menu':
            text = re.sub(rf'menu={re.escape(sid)}(&|")', r'menu=\1', text)
            text = re.sub(rf'update\("rm\|{re.escape(sid)}"\);?', '', text)
            text = re.sub(rf"update\('rm\|{re.escape(sid)}'\);?", '', text)
            text = re.sub(rf'update\("switch_rm\|{re.escape(sid)}"\);?', '', text)
            text = re.sub(rf"update\('switch_rm\|{re.escape(sid)}'\);?", '', text)
        
    return text

def check_and_clear_dependencies(item_type, item_id, force, oa_conn, main_conn=None, extra_ids=None):
    """
    item_type: 'journey' or 'menu'
    item_id: ID of the project or rich menu (ui_uuid for menus)
    force: boolean, if True, performs cascade clear
    oa_conn: db connection to OA database
    main_conn: db connection to Main database (for rich_menu_metadata if needed)
    extra_ids: list of additional IDs to search (e.g. LINE richMenuId)
    
    Returns: {"has_dependencies": True/False, "dependencies": list}
    """
    app_id = get_current_app_id()
    sid = str(item_id)
    # Build all IDs to search for
    all_ids = [sid]
    if extra_ids:
        all_ids.extend([str(eid) for eid in extra_ids if eid and str(eid) != sid])
    
    tables_to_check = [
        {"conn": main_conn, "table": f'"QA_bank:{app_id}"', "col": "msg_rpy", "name_col": "tag", "type_name": "關鍵字回覆"},
        {"conn": main_conn, "table": f'"QA_bank:{app_id}"', "col": "function", "name_col": "tag", "type_name": "關鍵字回覆"},
        {"conn": main_conn, "table": f'"Q_bank:{app_id}"', "col": "msg_rpy", "name_col": "note", "type_name": "關鍵字回覆"},
        {"conn": main_conn, "table": f'"Q_bank:{app_id}"', "col": "function", "name_col": "note", "type_name": "關鍵字回覆"},
        {"conn": main_conn, "table": f'"AD_bank:{app_id}"', "col": "msg_rpy", "name_col": "id::text", "type_name": "進階訊息"},
        {"conn": main_conn, "table": f'"AD_bank:{app_id}"', "col": "function", "name_col": "id::text", "type_name": "進階訊息"},
        {"conn": oa_conn, "table": f'"project_schedules:{app_id}"', "col": "message_content", "name_col": "project_name", "type_name": "自動旅程", "pk": "schedule_id"},
    ]
    
    if item_type != 'menu':
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
        pk = t_info.get('pk', 'id')
        
        try:
            cur = conn.cursor()
            # Build LIKE conditions for all IDs
            like_conditions = []
            like_params = []
            for search_id in all_ids:
                if table.startswith('"project_schedules'):
                    col_ref = 's.message_content::text'
                else:
                    col_ref = f'{col}::text'
                
                if item_type == 'journey':
                    like_conditions.extend([f"{col_ref} LIKE %s", f"{col_ref} LIKE %s", f"{col_ref} LIKE %s"])
                    like_params.extend([f"%|{search_id}|%", f"%journey={search_id}%", f"%iup|{search_id}%"])
                else:
                    like_conditions.extend([f"{col_ref} LIKE %s", f"{col_ref} LIKE %s", f"{col_ref} LIKE %s", f"{col_ref} LIKE %s"])
                    like_params.extend([f"%|{search_id}|%", f"%menu={search_id}%", f"%rm|{search_id}%", f"%switch_rm|{search_id}%"])
            
            where_clause = ' OR '.join(like_conditions)
            
            # Find any records containing the ID
            if table.startswith('"project_schedules'):
                t_projects = f'"projects:{app_id}"'
                query = f"SELECT s.schedule_id, s.message_content, p.project_name FROM {table} s JOIN {t_projects} p ON s.project_id = p.id WHERE {where_clause}"
                cur.execute(query, tuple(like_params))
            else:
                query = f"SELECT {pk}, {col}, {name_col} FROM {table} WHERE {where_clause}"
                cur.execute(query, tuple(like_params))
                
            rows = cur.fetchall()
            if rows:
                import re
                for row in rows:
                    content = str(row[1] if row[1] is not None else "")
                    found_exact = False
                    for search_id in all_ids:
                        sid_escaped = re.escape(str(search_id))
                        if item_type == 'journey':
                            patterns = [rf"\|{sid_escaped}\|", rf"journey={sid_escaped}\b", rf"iup\|{sid_escaped}\b"]
                        else:
                            patterns = [rf"\|{sid_escaped}\|", rf"menu={sid_escaped}\b", rf"rm\|{sid_escaped}\b", rf"switch_rm\|{sid_escaped}\b"]
                        
                        for p in patterns:
                            if re.search(p, content):
                                found_exact = True
                                break
                        if found_exact: break
                    
                    if found_exact:
                        has_dependencies = True
                        name = row[2] if row[2] else '未命名'
                        
                        item_name = str(name)
                        proj_id = None
                        if isinstance(item_name, str) and item_name.startswith("project_"):
                            parts = item_name.split("_")
                            if len(parts) >= 2:
                                proj_id = parts[1]
                        
                        real_name = item_name
                        if proj_id:
                            try:
                                main_cur = main_conn.cursor()
                                t_projects = f'"projects:{app_id}"'
                                main_cur.execute(f"SELECT project_name FROM {t_projects} WHERE project_id = %s", (proj_id,))
                                res = main_cur.fetchone()
                                if res and res[0]:
                                    real_name = res[0]
                                main_cur.close()
                            except:
                                pass
                                
                        if "|UPDATED:" in real_name:
                            real_name = real_name.split("|UPDATED:")[0]
                        if " - 關鍵字回覆" in real_name:
                            real_name = real_name.replace(" - 關鍵字回覆", "")
                        if " - 標準訊息" in real_name:
                            real_name = real_name.replace(" - 標準訊息", "")
                        if " - 進階訊息" in real_name:
                            real_name = real_name.replace(" - 進階訊息", "")

                        if ' - 自動旅程' in real_name:
                            journey_name = real_name.replace(' - 自動旅程', '').strip()
                            dependent_items.append(f"【自動旅程】{journey_name}")
                        elif proj_id:
                            # It's a project_ tag in QA_bank, meaning it's an automated journey
                            dependent_items.append(f"【自動旅程】{real_name}")
                        elif type_name == '自動旅程':
                            dependent_items.append(f"【自動旅程】{real_name}")
                        else:
                            dependent_items.append(f"【{type_name}】{real_name}")
                else:
                    # Cascade clear
                    for row in rows:
                        row_id = row[0]
                        col_data = row[1] 
                        if isinstance(col_data, dict) or isinstance(col_data, list):
                            text_data = json.dumps(col_data, ensure_ascii=False)
                        else:
                            text_data = str(col_data)
                            
                        new_text = clear_dependency_in_json_string(text_data, item_type, sid, extra_ids=extra_ids)
                        
                        if new_text != text_data:
                            update_query = f"UPDATE {table} SET {col} = %s::jsonb WHERE {pk} = %s"
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

    unique_deps = list(dict.fromkeys(dependent_items))
    return {
        "has_dependencies": has_dependencies,
        "dependencies": unique_deps
    }
