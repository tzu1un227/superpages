from utils.syslogger import syslog_action
from flask import Blueprint, request, jsonify, g
import requests
import json
from auth import token_required
from datetime import datetime

richmenu_bp = Blueprint('richmenu', __name__)

# 全域記憶體圖片快取，避免重複向 LINE API 發起慢速的外部請求
_IMAGE_CACHE = {}  # { richMenuId: (content, mimetype) }

# 記錄每個 app_name 上一次檢查時，有效的限制型選單狀態，避免每 60 秒執行全量比對
_LAST_ACTIVE_RESTRICTED_MENUS = {}

def get_line_token(app_name=None):
    """
    Get LINE token from current_oa_config or database.
    If app_name is provided, it fetches directly from the database (used in background threads).
    """
    if not app_name:
        if hasattr(g, 'current_oa_config') and g.current_oa_config.other_settings:
            return g.current_oa_config.other_settings.get('line_token')
        return None

    # Fallback to direct DB query if app_name is provided
    from db_utils import get_main_db_connection
    conn = get_main_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            # Search by oa_name OR by app_name inside other_settings
            cur.execute("""
                SELECT other_settings 
                FROM permission_settings 
                WHERE oa_name = %s OR (other_settings::jsonb ->> 'app_name') = %s
                LIMIT 1
            """, (app_name, app_name))
            row = cur.fetchone()
            if row and row[0]:
                settings = row[0]
                if isinstance(settings, str):
                    import json
                    settings = json.loads(settings)
                return settings.get('line_token')
        except Exception as e:
            print(f"Error getting line token by app_name: {e}")
        finally:
            conn.close()
    return None

def get_tenant_db_url(app_name=None, oa_id=None):
    """
    Get the tenant-specific db_url from permission_settings in the main DB.
    """
    if not app_name and not oa_id:
        if hasattr(g, 'current_oa_config') and g.current_oa_config and hasattr(g.current_oa_config, 'db_url') and g.current_oa_config.db_url:
            return g.current_oa_config.db_url
        oa_id = getattr(g, 'current_oa_id', None)
        if not oa_id and hasattr(g, 'current_oa_config') and g.current_oa_config and hasattr(g.current_oa_config, 'id'):
            oa_id = g.current_oa_config.id

    from db_utils import get_main_db_connection
    conn = get_main_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            if oa_id:
                try:
                    int_id = int(oa_id)
                    cur.execute("SELECT db_url FROM permission_settings WHERE id = %s", (int_id,))
                except (ValueError, TypeError):
                    cur.execute("SELECT db_url FROM permission_settings WHERE oa_name = %s", (str(oa_id),))
            elif app_name:
                cur.execute("SELECT db_url FROM permission_settings WHERE oa_name = %s OR (other_settings::jsonb ->> 'app_name') = %s LIMIT 1", (app_name, app_name))
            row = cur.fetchone()
            if row and row[0]:
                return row[0]
        except Exception as e:
            print(f"Error getting tenant db_url from main DB: {e}")
        finally:
            conn.close()
    return None

def get_tenant_conn(app_name=None, oa_id=None):
    from db_utils import get_db_connection, get_main_db_connection
    db_url = get_tenant_db_url(app_name=app_name, oa_id=oa_id)
    if db_url:
        return get_db_connection(db_url)
    return get_main_db_connection()

@richmenu_bp.route('/', methods=['GET'], strict_slashes=False)
@token_required
def list_rich_menus():
    token = get_line_token()
    if not token:
        return jsonify({'message': 'Line token not configured'}), 400
    
    headers = {'Authorization': f'Bearer {token}'}
    
    try:
        oa_id = getattr(g, 'current_oa_id', None) or session.get('oa_id')
        user = getattr(g, 'current_user', None)
        # Get rich menus
        resp = requests.get('https://api.line.me/v2/bot/richmenu/list', headers=headers)
        if resp.status_code != 200:
            return jsonify({'message': 'Failed to fetch rich menus', 'error': resp.text}), resp.status_code
        
        menus = resp.json().get('richmenus', [])
        
        # Get aliases
        alias_resp = requests.get('https://api.line.me/v2/bot/richmenu/alias/list', headers=headers)
        aliases = alias_resp.json().get('aliases', []) if alias_resp.status_code == 200 else []
        
        # Get default rich menu
        default_resp = requests.get('https://api.line.me/v2/bot/user/all/richmenu', headers=headers)
        default_id = default_resp.json().get('richMenuId') if default_resp.status_code == 200 else None
        
        # Get ui_uuid mappings and default count from metadata database
        metadata_map = {}
        db_has_default = False
        try:
            m_conn = get_tenant_conn(oa_id=oa_id)
            if m_conn:
                t_metadata = get_t('rich_menu_metadata')
                m_cur = m_conn.cursor()
                m_cur.execute(f"SELECT rich_menu_id, ui_uuid, end_time, status FROM {t_metadata} WHERE oa_id = %s AND rich_menu_id IS NOT NULL", (oa_id,))
                for r in m_cur.fetchall():
                    metadata_map[r[0]] = {
                        'ui_uuid': r[1],
                        'end_time': r[2].isoformat() if r[2] else None
                    }
                    if r[3] == 'default':
                        db_has_default = True
                m_cur.close()
                m_conn.close()
        except Exception as e:
            print(f"Error fetching metadata mapping in list_rich_menus: {e}")
            
        # If database has no default menu configured, automatically clear LINE global default
        if not db_has_default and default_id:
            try:
                requests.delete('https://api.line.me/v2/bot/user/all/richmenu', headers=headers)
                default_id = None
            except Exception as e:
                print(f"Error unsetting LINE default rich menu: {e}")
            
        for menu in menus:
            menu['status'] = 'default' if menu['richMenuId'] == default_id else 'none'
            menu['aliases'] = [a['richMenuAliasId'] for a in aliases if a['richMenuId'] == menu['richMenuId']]
            meta_info = metadata_map.get(menu['richMenuId'], {})
            menu['ui_uuid'] = meta_info.get('ui_uuid')
            menu['end_time'] = meta_info.get('end_time')
            
        return jsonify({
            'richmenus': menus,
            'default_rich_menu_id': default_id
        })
    except Exception as e:
        return jsonify({'message': 'Error', 'error': str(e)}), 500

@richmenu_bp.route('/all', methods=['GET'])
@token_required
def list_all_rich_menus():
    from models import OAConfig
    user = g.current_user
    
    # Determine which OAs the user can access
    if user.role == 'admin':
        configs = OAConfig.query.all()
    else:
        allowed = user.allowed_oa_configs or []
        configs = OAConfig.query.filter(OAConfig.id.in_([int(x) for x in allowed])).all()

    results = []
    for oa in configs:
        token = oa.other_settings.get('line_token') if (oa.other_settings and isinstance(oa.other_settings, dict)) else None
        if not token:
            continue
            
        headers = {'Authorization': f'Bearer {token}'}
        try:
            # Get rich menus
            resp = requests.get('https://api.line.me/v2/bot/richmenu/list', headers=headers, timeout=5)
            if resp.status_code != 200:
                continue
            
            menus = resp.json().get('richmenus', [])
            
            # Get default rich menu
            default_resp = requests.get('https://api.line.me/v2/bot/user/all/richmenu', headers=headers, timeout=5)
            default_id = default_resp.json().get('richMenuId') if default_resp.status_code == 200 else None
            
            # Get aliases
            alias_resp = requests.get('https://api.line.me/v2/bot/richmenu/alias/list', headers=headers, timeout=5)
            aliases = alias_resp.json().get('aliases', []) if alias_resp.status_code == 200 else []

            # Get ui_uuid mappings from metadata database for this OA
            metadata_map = {}
            try:
                m_conn = get_tenant_conn(oa_id=oa.id)
                if m_conn:
                    app_name = oa.other_settings.get('app_name')
                    if app_name:
                        t_metadata = f'"rich_menu_metadata:{app_name}"'
                        m_cur = m_conn.cursor()
                        m_cur.execute(f"SELECT rich_menu_id, ui_uuid, end_time FROM {t_metadata} WHERE oa_id = %s AND rich_menu_id IS NOT NULL", (oa.id,))
                        for r in m_cur.fetchall():
                            metadata_map[r[0]] = {
                                'ui_uuid': r[1],
                                'end_time': r[2].isoformat() if r[2] else None
                            }
                        m_cur.close()
                    m_conn.close()
            except Exception as e:
                print(f"Error fetching metadata mapping in list_all_rich_menus for OA {oa.id}: {e}")

            for menu in menus:
                menu['status'] = 'default' if menu['richMenuId'] == default_id else 'none'
                menu['aliases'] = [a['richMenuAliasId'] for a in aliases if a['richMenuId'] == menu['richMenuId']]
                menu['oa_id'] = oa.id
                menu['oa_name'] = oa.oa_name
                meta_info = metadata_map.get(menu['richMenuId'], {})
                menu['ui_uuid'] = meta_info.get('ui_uuid')
                menu['end_time'] = meta_info.get('end_time')
            
            results.extend(menus)
        except Exception as e:
            print(f"Error fetching menus for OA {oa.id}: {e}")
            continue
            
    return jsonify({'richmenus': results})

@richmenu_bp.route('/aliases', methods=['GET'])
@token_required
def list_rich_menu_aliases():
    token = get_line_token()
    if not token:
        return jsonify({'message': 'Line token not configured'}), 400
    
    headers = {'Authorization': f'Bearer {token}'}
    
    try:
        resp = requests.get('https://api.line.me/v2/bot/richmenu/alias/list', headers=headers)
        if resp.status_code != 200:
            return jsonify({'message': 'Failed to fetch aliases', 'error': resp.text}), resp.status_code
        
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({'message': 'Error', 'error': str(e)}), 500

@richmenu_bp.route('/', methods=['POST'], strict_slashes=False)
@token_required
@syslog_action('RICHMENU_CREATE')
def create_rich_menu():
    token = get_line_token()
    if not token:
        return jsonify({'message': 'Line token not configured'}), 400
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    try:
        data = request.json
        resp = requests.post('https://api.line.me/v2/bot/richmenu', headers=headers, data=json.dumps(data))
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        return jsonify({'message': 'Error', 'error': str(e)}), 500

@richmenu_bp.route('/<richMenuId>/image', methods=['GET'])
@token_required
def get_rich_menu_image(richMenuId):
    # 先從快取獲取，若存在則瞬間回傳
    if richMenuId in _IMAGE_CACHE:
        from flask import Response
        content, mimetype = _IMAGE_CACHE[richMenuId]
        return Response(content, mimetype=mimetype)

    token = get_line_token()
    if not token:
        return jsonify({'message': 'Line token not configured'}), 400
    
    headers = {'Authorization': f'Bearer {token}'}
    
    try:
        resp = requests.get(
            f'https://api-data.line.me/v2/bot/richmenu/{richMenuId}/content',
            headers=headers,
            stream=True
        )
        if resp.status_code == 200:
            from flask import Response
            mimetype = resp.headers.get('Content-Type', 'image/png')
            # 寫入全域快取
            _IMAGE_CACHE[richMenuId] = (resp.content, mimetype)
            return Response(resp.content, mimetype=mimetype)
        
        return jsonify({'message': 'Failed to fetch image', 'error': resp.text}), resp.status_code
    except Exception as e:
        return jsonify({'message': 'Error', 'error': str(e)}), 500

@richmenu_bp.route('/<richMenuId>/image', methods=['POST'])
@token_required
@syslog_action('RICHMENU_UPLOAD_IMAGE')
def upload_rich_menu_image(richMenuId):
    token = get_line_token()
    if not token:
        return jsonify({'message': 'Line token not configured'}), 400
    
    if 'image' not in request.files:
        return jsonify({'message': 'No image provided'}), 400
    
    file = request.files['image']
    # Line only supports image/jpeg and image/png
    content_type = file.content_type
    if content_type not in ['image/jpeg', 'image/png']:
        if file.filename.lower().endswith('.jpg') or file.filename.lower().endswith('.jpeg'):
            content_type = 'image/jpeg'
        else:
            content_type = 'image/png'
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': content_type
    }
    
    try:
        image_data = file.read()
        print(f"Uploading image to Line: {richMenuId}, Size: {len(image_data)} bytes, Content-Type: {content_type}")
        
        resp = requests.post(
            f'https://api-data.line.me/v2/bot/richmenu/{richMenuId}/content',
            headers=headers,
            data=image_data
        )
        if resp.status_code == 200:
            return jsonify({'status': 'success'})
        
        print(f"Line Image Upload Failed: {resp.status_code} - {resp.text}")
        return jsonify({'message': 'Upload failed', 'line_error': resp.json() if resp.text.startswith('{') else resp.text}), resp.status_code
    except Exception as e:
        print(f"Error in upload_rich_menu_image: {e}")
        return jsonify({'message': 'Error', 'error': str(e)}), 500

@richmenu_bp.route('/<richMenuId>', methods=['DELETE'])
@token_required
@syslog_action('RICHMENU_DELETE')
def delete_rich_menu(richMenuId):
    token = get_line_token()
    if not token:
        return jsonify({'message': 'Line token not configured'}), 400
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    try:
        from db_utils import get_db_connection, get_tenant_conn
        from utils.dependency_checker import check_and_clear_dependencies
        
        force = request.args.get('force', 'false').lower() == 'true'
        oa_conn = get_db_connection()
        main_conn = get_tenant_conn()
        try:
            main_cur = main_conn.cursor()
            app_id = g.current_app_name if hasattr(g, 'current_app_name') and g.current_app_name else '5013'
            t_metadata = f'"rich_menu_metadata:{app_id}"'
            main_cur.execute(f"SELECT ui_uuid FROM {t_metadata} WHERE rich_menu_id = %s", (richMenuId,))
            m = main_cur.fetchone()
            ui_uuid = m[0] if m else richMenuId
            main_cur.close()

            dep_res = check_and_clear_dependencies('menu', ui_uuid, force, oa_conn, main_conn, extra_ids=[richMenuId])
            if dep_res['has_dependencies'] and not force:
                return jsonify({
                    'status': 'warning',
                    'message': 'Cannot delete menu because it is currently in use.',
                    'dependencies': dep_res['dependencies'],
                    'needs_force': True,
                    'has_dependencies': True
                }), 409
        finally:
            if oa_conn: oa_conn.close()
            if main_conn: main_conn.close()

        # Check if this menu is currently set as global default on LINE; if so, clear it first
        default_resp = requests.get('https://api.line.me/v2/bot/user/all/richmenu', headers=headers)
        if default_resp.status_code == 200:
            current_default_id = default_resp.json().get('richMenuId')
            if current_default_id == richMenuId:
                print(f"Unlinking global default rich menu {richMenuId} before deletion...")
                requests.delete('https://api.line.me/v2/bot/user/all/richmenu', headers=headers)

        # First, find and delete all associated aliases
        alias_resp = requests.get('https://api.line.me/v2/bot/richmenu/alias/list', headers=headers)
        if alias_resp.status_code == 200:
            aliases = alias_resp.json().get('aliases', [])
            for alias in aliases:
                if alias.get('richMenuId') == richMenuId:
                    alias_id = alias.get('richMenuAliasId')
                    print(f"Deleting associated alias: {alias_id}")
                    requests.delete(f'https://api.line.me/v2/bot/richmenu/alias/{alias_id}', headers=headers)
        
        # Then delete the rich menu on LINE
        resp = requests.delete(f'https://api.line.me/v2/bot/richmenu/{richMenuId}', headers=headers)
        if resp.status_code == 200 or resp.status_code == 404:
            # 同步清除資料庫 metadata
            try:
                db_conn = get_tenant_conn()
                if db_conn:
                    db_cur = db_conn.cursor()
                    app_id = g.current_app_name if hasattr(g, 'current_app_name') and g.current_app_name else '5013'
                    db_cur.execute(f'DELETE FROM "rich_menu_metadata:{app_id}" WHERE rich_menu_id = %s', (richMenuId,))
                    db_conn.commit()
                    db_cur.close()
                    db_conn.close()
            except Exception as d_err:
                print(f"Warning: error deleting metadata for {richMenuId}: {d_err}")

            # 同步清除全域圖片快取
            if richMenuId in _IMAGE_CACHE:
                del _IMAGE_CACHE[richMenuId]
            return jsonify({'status': 'success'})
        return jsonify({'message': 'Delete failed', 'line_error': resp.text}), resp.status_code
    except Exception as e:
        return jsonify({'message': 'Error', 'error': str(e)}), 500

@richmenu_bp.route('/alias', methods=['POST'])
@token_required
def create_rich_menu_alias():
    token = get_line_token()
    if not token:
        return jsonify({'message': 'Line token not configured'}), 400
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    try:
        data = request.json # { "richMenuAliasId": "xxx", "richMenuId": "yyy" }
        resp = requests.post('https://api.line.me/v2/bot/richmenu/alias', headers=headers, data=json.dumps(data))
        if resp.status_code == 200:
            return jsonify({'status': 'success'})
        return jsonify({'message': 'Alias creation failed', 'error': resp.text}), resp.status_code
    except Exception as e:
        return jsonify({'message': 'Error', 'error': str(e)}), 500

@richmenu_bp.route('/alias/<aliasId>', methods=['DELETE'])
@token_required
def delete_rich_menu_alias(aliasId):
    token = get_line_token()
    if not token:
        return jsonify({'message': 'Line token not configured'}), 400
    
    headers = {'Authorization': f'Bearer {token}'}
    try:
        resp = requests.delete(f'https://api.line.me/v2/bot/richmenu/alias/{aliasId}', headers=headers)
        if resp.status_code == 200:
            return jsonify({'status': 'success'})
        return jsonify({'message': 'Alias deletion failed', 'error': resp.text}), resp.status_code
    except Exception as e:
        return jsonify({'message': 'Error', 'error': str(e)}), 500

@richmenu_bp.route('/set-default/<richMenuId>', methods=['POST'])
@token_required
@syslog_action('RICHMENU_SET_DEFAULT')
def set_default_rich_menu(richMenuId):
    token = get_line_token()
    if not token:
        return jsonify({'message': 'Line token not configured'}), 400
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    conn = get_tenant_conn()
    actual_rich_menu_id = richMenuId
    app_name = getattr(g, 'current_app_name', None) or '5013'
    oa_id = getattr(g, 'current_oa_id', None)

    try:
        if conn:
            t_metadata = f'"rich_menu_metadata:{app_name}"'
            cur = conn.cursor()
            cur.execute(f"SELECT rich_menu_id FROM {t_metadata} WHERE rich_menu_id = %s OR ui_uuid = %s", (richMenuId, richMenuId))
            m_row = cur.fetchone()
            if m_row and m_row[0]:
                actual_rich_menu_id = m_row[0]
            cur.close()

        # 1. 向 LINE API 設定該選單為全域預設選單
        resp = requests.post(f'https://api.line.me/v2/bot/user/all/richmenu/{actual_rich_menu_id}', headers=headers)
        if resp.status_code != 200:
            print(f"LINE API set default failed ({actual_rich_menu_id}): {resp.text}")
            return jsonify({'message': 'LINE API 預設選單設定失敗', 'error': resp.text}), resp.status_code

        # 2. 更新業務資料庫與 Global_var 預設選單紀錄
        if conn:
            try:
                t_metadata = f'"rich_menu_metadata:{app_name}"'
                t_global = f'"Global_var:{app_name}"'
                cur = conn.cursor()
                
                cur.execute(f"SELECT start_time, end_time FROM {t_metadata} WHERE rich_menu_id = %s OR ui_uuid = %s", (richMenuId, richMenuId))
                m = cur.fetchone()
                if m:
                    start_time, end_time = m[0], m[1]
                    if not start_time and not end_time:
                        cur.execute(f"UPDATE {t_metadata} SET status = 'published' WHERE status = 'default' AND start_time IS NULL AND end_time IS NULL")
                    else:
                        cur.execute(f"""
                            SELECT id FROM {t_metadata} 
                            WHERE status = 'default' AND rich_menu_id != %s 
                              AND start_time IS NOT NULL AND end_time IS NOT NULL
                              AND start_time < %s AND end_time > %s
                        """, (actual_rich_menu_id, end_time, start_time))
                        if cur.fetchone():
                            cur.close()
                            return jsonify({'message': 'Set default failed', 'line_error': '排程時間與現存的排程預設選單重疊。'}), 400

                cur.execute(f"UPDATE {t_metadata} SET status = 'default', updated_at = (NOW() AT TIME ZONE 'Asia/Taipei') WHERE rich_menu_id = %s OR ui_uuid = %s", (actual_rich_menu_id, richMenuId))
                
                # 同步寫入 Global_var 供全域 Bot Engine 直接取用
                cur.execute(f"DELETE FROM {t_global} WHERE name = 'default_rich_menu'")
                cur.execute(f"INSERT INTO {t_global} (name, value) VALUES ('default_rich_menu', %s)", (actual_rich_menu_id,))

                conn.commit()
                cur.close()
                
                import threading
                from endpoints.richmenu import check_and_apply_scheduled_rich_menus
                threading.Thread(target=check_and_apply_scheduled_rich_menus, args=(app_name,)).start()
            finally:
                conn.close()
            
        return jsonify({'status': 'success'})
    except Exception as e:
        print(f"Error in set_default_rich_menu: {e}")
        if conn: conn.close()
        return jsonify({'message': 'Error', 'error': str(e)}), 500

@richmenu_bp.route('/set-default', methods=['DELETE'])
@token_required
@syslog_action('RICHMENU_UNSET_DEFAULT')
def unset_default_rich_menu():
    token = get_line_token()
    if not token:
        return jsonify({'message': 'Line token not configured'}), 400
    
    headers = {'Authorization': f'Bearer {token}'}
    
    try:
        resp = requests.delete('https://api.line.me/v2/bot/user/all/richmenu', headers=headers)
        if resp.status_code == 200 or resp.status_code == 404:
            try:
                conn = get_tenant_conn()
                if conn:
                    app_name = getattr(g, 'current_app_name', None) or '5013'
                    t_global = f'"Global_var:{app_name}"'
                    t_metadata = f'"rich_menu_metadata:{app_name}"'
                    
                    cur = conn.cursor()
                    cur.execute(f"DELETE FROM {t_global} WHERE name = 'default_rich_menu'")
                    cur.execute(f"UPDATE {t_metadata} SET status = 'published' WHERE status = 'default'")
                    conn.commit()
                    cur.close()
                    conn.close()
            except Exception as db_err:
                print(f"Error in unset_default_rich_menu DB update: {db_err}")
                
            return jsonify({'status': 'success'})
        return jsonify({'message': 'Unset default failed', 'error': resp.text}), resp.status_code
    except Exception as e:
        return jsonify({'message': 'Error', 'error': str(e)}), 500

@richmenu_bp.route('/clear-all', methods=['POST'])
@token_required
@syslog_action('RICHMENU_CLEAR_ALL')
def clear_all_rich_menus():
    token = get_line_token()
    if not token:
        return jsonify({'message': 'Line token not configured'}), 400
    
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    try:
        # 1. Clear default rich menu
        requests.delete('https://api.line.me/v2/bot/user/all/richmenu', headers=headers)
        # 2. Unlink individual users
        bulk_unlink_all_users(headers)
        
        # 3. Update database status on tenant connection
        try:
            conn = get_tenant_conn()
            if conn:
                app_name = getattr(g, 'current_app_name', None) or '5013'
                oa_id = getattr(g, 'current_oa_id', None) or 5
                
                t_metadata = f'"rich_menu_metadata:{app_name}"'
                cur = conn.cursor()
                cur.execute(f"UPDATE {t_metadata} SET status = 'published' WHERE status IN ('default', 'link', 'restricted')")
                conn.commit()
                cur.close()

                t_global = f'"Global_var:{app_name}"'
                cur = conn.cursor()
                cur.execute(f"DELETE FROM {t_global} WHERE name = 'default_rich_menu'")
                conn.commit()
                cur.close()

                t_private = f'"Private_var:{app_name}"'
                cur = conn.cursor()
                cur.execute(f"DELETE FROM {t_private} WHERE name = 'rich_menu'")
                conn.commit()
                cur.close()

                conn.close()
        except Exception as db_err:
            print(f"Error updating DB statuses on clear-all: {db_err}")
            
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'message': 'Error', 'error': str(e)}), 500

@richmenu_bp.route('/permissions', methods=['GET'], strict_slashes=False)
@token_required
def get_rich_menu_permissions():
    oa_config = getattr(g, 'current_oa_config', None)
    if not oa_config:
        return jsonify({'error': 'OA config not found'}), 404
    
    mappings = oa_config.other_settings.get('rich_menu_mappings', []) if (oa_config.other_settings and isinstance(oa_config.other_settings, dict)) else []
    return jsonify({'mappings': mappings})

@richmenu_bp.route('/permissions', methods=['POST'], strict_slashes=False)
@token_required
@syslog_action('RICHMENU_SAVE_PERMISSION')
def save_rich_menu_permissions():
    from models import db, OAConfig
    oa_config = getattr(g, 'current_oa_config', None)
    if not oa_config:
        return jsonify({'error': 'OA config not found'}), 404
    
    data = request.json
    mappings = data.get('mappings', [])
    
    # 確保是字典
    if not oa_config.other_settings or not isinstance(oa_config.other_settings, dict):
        oa_config.other_settings = {}
    
    # 深拷貝以觸發 SQLAlchemy 變動偵測
    settings = dict(oa_config.other_settings)
    settings['rich_menu_mappings'] = mappings
    
    actual_oa = OAConfig.query.get(oa_config.id)
    actual_oa.other_settings = settings
    db.session.commit()
    
    return jsonify({'status': 'success'})

# --- Metadata and Scheduling ---

def bulk_unlink_all_users(headers):
    try:
        from psycopg2.extras import RealDictCursor
        from flask import g
        conn = get_tenant_conn()
        if conn:
            app_name = getattr(g, 'current_app_name', None)
            if not app_name:
                oa_id = getattr(g, 'current_oa_id', None)
                if oa_id:
                    from models import OAConfig
                    oa = OAConfig.query.get(oa_id)
                    if oa and oa.other_settings and oa.other_settings.get('app_name'):
                        app_name = str(oa.other_settings['app_name'])
                        g.current_app_name = app_name
            if not app_name: return
            
            t_private = f'"Private_var:{app_name}"'
            t_history = f'"history:{app_name}"'
            cur = conn.cursor(cursor_factory=RealDictCursor)
            try:
                cur.execute(f"""
                    SELECT DISTINCT user_id FROM {t_private} WHERE user_id IS NOT NULL
                    UNION
                    SELECT DISTINCT user_id FROM {t_history} WHERE user_id IS NOT NULL
                """)
                users = cur.fetchall()
            except Exception:
                conn.rollback()
                cur.execute(f"SELECT DISTINCT user_id FROM {t_private} WHERE user_id IS NOT NULL")
                users = cur.fetchall()
                
            # 過濾出有效的 LINE User ID (必須是字串，且長度為33，且以 'U' 開頭)
            user_ids = [u['user_id'] for u in users if u.get('user_id') and isinstance(u['user_id'], str) and u['user_id'].startswith('U') and len(u['user_id']) == 33]
            
            import requests
            for i in range(0, len(user_ids), 500):
                batch = user_ids[i:i+500]
                requests.post('https://api.line.me/v2/bot/richmenu/bulk/unlink', headers=headers, json={'userIds': batch})
            
            # Cache synchronization
            if user_ids:
                cur.execute(f"DELETE FROM {t_private} WHERE name = 'rich_menu'")
                conn.commit()
                
            cur.close()
            conn.close()
    except Exception as e:
        print(f"Error unlinking bulk users: {e}")


def bulk_link_all_users(headers, richMenuId):
    try:
        from psycopg2.extras import RealDictCursor
        from flask import g
        conn = get_tenant_conn()
        if conn:
            app_name = getattr(g, 'current_app_name', None)
            if not app_name:
                oa_id = getattr(g, 'current_oa_id', None)
                if oa_id:
                    from models import OAConfig
                    oa = OAConfig.query.get(oa_id)
                    if oa and oa.other_settings and oa.other_settings.get('app_name'):
                        app_name = str(oa.other_settings['app_name'])
                        g.current_app_name = app_name
            if not app_name: return
            
            t_private = f'"Private_var:{app_name}"'
            t_history = f'"history:{app_name}"'
            cur = conn.cursor(cursor_factory=RealDictCursor)
            try:
                cur.execute(f"""
                    SELECT DISTINCT user_id FROM {t_private} WHERE user_id IS NOT NULL
                    UNION
                    SELECT DISTINCT user_id FROM {t_history} WHERE user_id IS NOT NULL
                """)
                users = cur.fetchall()
            except Exception:
                conn.rollback()
                cur.execute(f"SELECT DISTINCT user_id FROM {t_private} WHERE user_id IS NOT NULL")
                users = cur.fetchall()
                
            # 過濾出有效的 LINE User ID (必須是字串，且長度為33，且以 'U' 開頭)
            user_ids = [u['user_id'] for u in users if u.get('user_id') and isinstance(u['user_id'], str) and u['user_id'].startswith('U') and len(u['user_id']) == 33]
            
            import requests
            for i in range(0, len(user_ids), 500):
                batch = user_ids[i:i+500]
                requests.post('https://api.line.me/v2/bot/richmenu/bulk/link', headers=headers, json={'userIds': batch, 'richMenuId': richMenuId})
            
            # Cache synchronization
            if user_ids:
                from psycopg2.extras import execute_values
                cur.execute(f"DELETE FROM {t_private} WHERE name = 'rich_menu' AND user_id = ANY(%s)", (user_ids,))
                values = [(uid, 'rich_menu', richMenuId) for uid in user_ids]
                execute_values(cur, f"INSERT INTO {t_private} (user_id, name, value) VALUES %s", values)
                conn.commit()
                
            cur.close()
            conn.close()
    except Exception as e:
        print(f"Error linking bulk users: {e}")

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
            from models import OAConfig
            oa = OAConfig.query.get(oa_id)
            if oa and oa.other_settings and oa.other_settings.get('app_name'):
                app_name = str(oa.other_settings['app_name'])
                g.current_app_name = app_name
    
    if not app_name:
        raise Exception("無法讀取平台名稱 (App Name)，請在帳號管理中確認設定。")
    
    # 自動檢查並建立表格
    from endpoints.broadcast import ensure_rds_tables
    ensure_rds_tables(app_name)
        
    return f'"{base}:{app_name}"'

def parse_local_naive(dt_str):
    if not dt_str: return None
    try:
        from datetime import timezone, timedelta
        # 若為 Z 結尾，替換成 +00:00 以利 Python 進行 timezone-aware 解析
        clean_str = dt_str
        if clean_str.endswith('Z'):
            clean_str = clean_str[:-1] + '+00:00'
        dt = datetime.fromisoformat(clean_str)
        
        # 若含有時區資訊，則轉換為台灣時間 (UTC+8) 後移除時區資訊
        if dt.tzinfo is not None:
            tw_tz = timezone(timedelta(hours=8))
            dt_tw = dt.astimezone(tw_tz)
            return dt_tw.replace(tzinfo=None)
        return dt
    except Exception as e:
        print(f"Error parsing date {dt_str}: {e}")
        return None

@richmenu_bp.route('/metadata', methods=['GET'], strict_slashes=False)
@token_required
def get_rich_menu_metadata():
    from psycopg2.extras import RealDictCursor
    oa_id = g.current_oa_id
    
    try:
        t_metadata = get_t('rich_menu_metadata')
        conn = get_tenant_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cur.execute(f"SELECT * FROM {t_metadata} WHERE oa_id = %s ORDER BY created_at DESC", (oa_id,))
            metadata = cur.fetchall()
            return jsonify([{
                'id': m['id'],
                'oa_id': m['oa_id'],
                'rich_menu_id': m['rich_menu_id'],
                'name': m['name'],
                'chat_bar_text': m['chat_bar_text'],
                'ui_uuid': m.get('ui_uuid'),
                'group_id': m.get('group_id'),
                'status': m['status'],
                'start_time': m['start_time'].isoformat() if m['start_time'] else None,
                'end_time': m['end_time'].isoformat() if m['end_time'] else None,
                'permission_tags': m.get('permission_tags', []),
                'fallback_message': m.get('fallback_message', ''),
                'created_at': m['created_at'].isoformat(),
                'data': m['data']
            } for m in metadata])
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@richmenu_bp.route('/metadata', methods=['POST'], strict_slashes=False)
@token_required
@syslog_action('RICHMENU_CREATE_DRAFT')
def save_rich_menu_metadata():
    from psycopg2.extras import RealDictCursor
    oa_id = g.current_oa_id
    data = request.json
    
    id = data.get('id')
    name = data.get('name')
    chat_bar_text = data.get('chat_bar_text')
    data_json = json.dumps(data.get('data'))
    status = data.get('status', 'draft')
    rich_menu_id = data.get('rich_menu_id')
    start_time = parse_local_naive(data.get('start_time'))
    end_time = parse_local_naive(data.get('end_time'))
    permission_tags = json.dumps(data.get('permission_tags', []))
    fallback_message = data.get('fallback_message', '')
    ui_uuid = data.get('ui_uuid')
    group_id = data.get('group_id')
    
    try:
        t_metadata = get_t('rich_menu_metadata')
        conn = get_tenant_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            if id:
                cur.execute(f"SELECT * FROM {t_metadata} WHERE id = %s", (id,))
                m = cur.fetchone()
                if not m: return jsonify({'error': 'Not found'}), 404
                if m['status'] == 'published' and status == 'draft':
                    return jsonify({'error': '已發佈的選單不可編輯'}), 400
                
                publish_strategy = data.get('data', {}).get('publishStrategy')
                is_scheduled = (status == 'restricted' or publish_strategy == 'restricted')

                if status == 'default' and start_time and end_time:
                    cur.execute(f"""
                        SELECT id FROM {t_metadata} 
                        WHERE oa_id = %s AND status = 'default' AND id != %s 
                          AND start_time IS NOT NULL AND end_time IS NOT NULL
                          AND start_time < %s AND end_time > %s
                    """, (oa_id, id, end_time, start_time))
                    if cur.fetchone():
                        return jsonify({'error': '排程時間與現存的排程預設選單重疊，請重新選擇時間。'}), 400
                elif is_scheduled and start_time and end_time:
                    cur.execute(f"""
                        SELECT id FROM {t_metadata} 
                        WHERE oa_id = %s AND id != %s 
                          AND (status = 'restricted' OR (status = 'draft' AND data->>'publishStrategy' = 'restricted'))
                          AND start_time IS NOT NULL AND end_time IS NOT NULL
                          AND start_time < %s AND end_time > %s
                    """, (oa_id, id, end_time, start_time))
                    if cur.fetchone():
                        return jsonify({'error': '排程時間與現存的有排程圖文選單重疊，請重新選擇時間。'}), 400

                cur.execute(f"""
                    UPDATE {t_metadata}
                    SET name=%s, chat_bar_text=%s, data=%s, status=%s, rich_menu_id=%s, start_time=%s, end_time=%s, permission_tags=%s, fallback_message=%s, ui_uuid=%s, group_id=%s, updated_at=(NOW() AT TIME ZONE 'Asia/Taipei')
                    WHERE id=%s
                """, (name, chat_bar_text, data_json, status, rich_menu_id, start_time, end_time, permission_tags, fallback_message, ui_uuid, group_id, id))
                return_id = id
            else:
                publish_strategy = data.get('data', {}).get('publishStrategy')
                is_scheduled = (status == 'restricted' or publish_strategy == 'restricted')

                if status == 'default' and start_time and end_time:
                    cur.execute(f"""
                        SELECT id FROM {t_metadata} 
                        WHERE oa_id = %s AND status = 'default'
                          AND start_time IS NOT NULL AND end_time IS NOT NULL
                          AND start_time < %s AND end_time > %s
                    """, (oa_id, end_time, start_time))
                    if cur.fetchone():
                        return jsonify({'error': '排程時間與現存的排程預設選單重疊，請重新選擇時間。'}), 400
                elif is_scheduled and start_time and end_time:
                    cur.execute(f"""
                        SELECT id FROM {t_metadata} 
                        WHERE oa_id = %s 
                          AND (status = 'restricted' OR (status = 'draft' AND data->>'publishStrategy' = 'restricted'))
                          AND start_time IS NOT NULL AND end_time IS NOT NULL
                          AND start_time < %s AND end_time > %s
                    """, (oa_id, end_time, start_time))
                    if cur.fetchone():
                        return jsonify({'error': '排程時間與現存的有排程圖文選單重疊，請重新選擇時間。'}), 400

                cur.execute(f"""
                    INSERT INTO {t_metadata} (oa_id, name, chat_bar_text, data, status, rich_menu_id, start_time, end_time, permission_tags, fallback_message, ui_uuid, group_id, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, (NOW() AT TIME ZONE 'Asia/Taipei'), (NOW() AT TIME ZONE 'Asia/Taipei')) RETURNING id
                """, (oa_id, name, chat_bar_text, data_json, status, rich_menu_id, start_time, end_time, permission_tags, fallback_message, ui_uuid, group_id))
                return_id = cur.fetchone()['id']

            if status == 'default':
                if not start_time and not end_time:
                    cur.execute(f"UPDATE {t_metadata} SET status = 'published' WHERE oa_id = %s AND status = 'default' AND id != %s AND start_time IS NULL AND end_time IS NULL", (oa_id, return_id))

            conn.commit()

            if status in ['default', 'restricted']:
                import threading
                app_name_val = getattr(g, 'current_app_name', None)
                if not app_name_val:
                    oa_id_val = getattr(g, 'current_oa_id', None) or oa_id
                    if oa_id_val:
                        from models import OAConfig
                        oa_cfg = OAConfig.query.get(oa_id_val)
                        if oa_cfg and oa_cfg.other_settings and oa_cfg.other_settings.get('app_name'):
                            app_name_val = str(oa_cfg.other_settings['app_name'])
                            
                def trigger_update(app_name_val, stat):
                    import time
                    time.sleep(1.5)  # Wait for LINE server to process the newly uploaded image
                    try:
                        if stat == 'default':
                            from endpoints.richmenu import check_and_apply_scheduled_rich_menus
                            check_and_apply_scheduled_rich_menus(app_name_val)
                        elif stat == 'restricted':
                            from flask import Flask, g
                            dummy_app = Flask(__name__)
                            with dummy_app.app_context():
                                g.current_app_name = app_name_val
                                from endpoints.richmenu import get_line_token, bulk_check_and_update_rich_menu
                                token = get_line_token(app_name=app_name_val)
                                g.current_line_token = token
                                bulk_check_and_update_rich_menu(app_name_val)
                    except Exception as e:
                        print(f"Error in background rich menu update: {e}")
                
                if app_name_val:
                    threading.Thread(target=trigger_update, args=(app_name_val, status)).start()

            return jsonify({'status': 'success', 'id': return_id})
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@richmenu_bp.route('/metadata/<int:id>', methods=['DELETE'])
@token_required
@syslog_action('RICHMENU_DELETE_DRAFT')
def delete_rich_menu_metadata(id):
    try:
        force = request.args.get('force', 'false').lower() == 'true'
        from utils.dependency_checker import check_and_clear_dependencies

        t_metadata = get_t('rich_menu_metadata')
        conn = get_tenant_conn()
        cur = conn.cursor()
        try:
            cur.execute(f"SELECT rich_menu_id, ui_uuid FROM {t_metadata} WHERE id = %s", (id,))
            m = cur.fetchone()
            rich_menu_id = m[0] if m else None
            ui_uuid = m[1] if m and m[1] else id

            oa_conn = None
            try:
                oa_conn = get_db_connection()
                dep_result = check_and_clear_dependencies('menu', ui_uuid, force, oa_conn, conn, extra_ids=[rich_menu_id] if rich_menu_id else None)
                if dep_result.get('has_dependencies') and not force:
                    deps = dep_result.get('dependencies', [])
                    return jsonify({
                        "status": "warning", 
                        "message": "目前有 Flex 訊息或其他圖文選單正在綁定此選單，確定要解除所有綁定並強制刪除嗎？", 
                        "has_dependencies": True,
                        "needs_force": True,
                        "dependencies": deps
                    }), 409
            finally:
                if oa_conn:
                    oa_conn.close()

            cur.execute(f"DELETE FROM {t_metadata} WHERE id = %s", (id,))
            conn.commit()

            if rich_menu_id:
                token = get_line_token()
                if token:
                    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
                    import requests
                    # First, find and delete all associated aliases
                    alias_resp = requests.get('https://api.line.me/v2/bot/richmenu/alias/list', headers=headers)
                    if alias_resp.status_code == 200:
                        aliases = alias_resp.json().get('aliases', [])
                        for alias in aliases:
                            if alias.get('richMenuId') == rich_menu_id:
                                alias_id = alias.get('richMenuAliasId')
                                requests.delete(f'https://api.line.me/v2/bot/richmenu/alias/{alias_id}', headers=headers)
                    
                    # Then delete the rich menu from LINE
                    requests.delete(f'https://api.line.me/v2/bot/richmenu/{rich_menu_id}', headers=headers)
                    
                    # 同步清除全域圖片快取
                    if rich_menu_id in _IMAGE_CACHE:
                        del _IMAGE_CACHE[rich_menu_id]

            return jsonify({'status': 'success'})
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@richmenu_bp.route('/link/<richMenuId>', methods=['POST'])
@token_required
@syslog_action('RICHMENU_LINK_ALL')
def link_rich_menu_to_all(richMenuId):
    """將圖文選單個別綁定至全體用戶 (Individual Bulk Link to All) 或觸發限定標籤綁定"""
    token = get_line_token()
    if not token: return jsonify({'message': 'Line token not configured'}), 400
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    app_name = getattr(g, 'current_app_name', None)
    if app_name:
        conn = get_tenant_conn()
        if conn:
            try:
                cur = conn.cursor()
                t_metadata = f'"rich_menu_metadata:{app_name}"'
                cur.execute(f"SELECT status FROM {t_metadata} WHERE rich_menu_id = %s", (richMenuId,))
                m = cur.fetchone()
                if m and m[0] == 'restricted':
                    import threading
                    def bg_update(app_name_val, token_val):
                        from flask import Flask, g
                        dummy = Flask(__name__)
                        with dummy.app_context():
                            g.current_app_name = app_name_val
                            g.current_line_token = token_val
                            bulk_check_and_update_rich_menu(app_name_val)
                    threading.Thread(target=bg_update, args=(app_name, token)).start()
                    return jsonify({'status': 'success', 'message': 'restricted_sync'})
            finally:
                conn.close()
                
    bulk_link_all_users(headers, richMenuId)
    return jsonify({'status': 'success'})

@richmenu_bp.route('/unlink/<richMenuId>', methods=['POST'])
@token_required
@syslog_action('RICHMENU_UNLINK_ALL')
def unlink_rich_menu_from_all(richMenuId):
    """解除全體用戶的個別圖文選單綁定，並在預設為該選單時清除預設 (Bulk Unlink from All + Clear Default)"""
    token = get_line_token()
    if not token: return jsonify({'message': 'Line token not configured'}), 400
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    # 1. 解除所有個別綁定
    bulk_unlink_all_users(headers)
    
    # 2. 檢查目前的全域預設是否為此選單，若是則一併清除
    import requests
    resp = requests.get('https://api.line.me/v2/bot/user/all/richmenu', headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        if data.get('richMenuId') == richMenuId:
            requests.delete('https://api.line.me/v2/bot/user/all/richmenu', headers=headers)
            
    return jsonify({'status': 'success'})

@richmenu_bp.route('/<rich_menu_id>/apply-sources', methods=['GET'])
@token_required
def get_richmenu_apply_sources(rich_menu_id):
    from psycopg2.extras import RealDictCursor
    conn = None
    try:
        conn = get_tenant_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        pv_table = get_t('Private_var')
        t_history = get_t('history')
        t_metadata = get_t('rich_menu_metadata')
        gv_table = get_t('Global_var')
        t_qbank = get_t('Q_bank')
        t_qabank = get_t('QA_bank')
        t_schedules = get_t('project_schedules')
        t_projects = get_t('projects')

        # Resolve all possible identifiers for this rich menu (rich_menu_id, ui_uuid) - DO NOT use numeric id
        all_menu_ids = []
        if rich_menu_id and str(rich_menu_id).strip():
            all_menu_ids.append(str(rich_menu_id).strip())

        try:
            cur.execute(f"SELECT rich_menu_id, ui_uuid FROM {t_metadata} WHERE rich_menu_id = %s OR ui_uuid = %s OR id::text = %s", (str(rich_menu_id), str(rich_menu_id), str(rich_menu_id)))
            m_rows = cur.fetchall()
            for mr in m_rows:
                for k in ['rich_menu_id', 'ui_uuid']:
                    val = mr.get(k)
                    if val and str(val).strip() and len(str(val).strip()) >= 6 and str(val).strip() not in all_menu_ids:
                        all_menu_ids.append(str(val).strip())
        except Exception as e:
            print("Error resolving all_menu_ids:", e)

        # Filter all_menu_ids to only valid string IDs (length >= 6)
        all_menu_ids = [mid for mid in all_menu_ids if mid and len(mid) >= 6]

        # Check if this menu is the Global default rich menu
        is_default = False
        try:
            cur.execute(f"SELECT value FROM {gv_table} WHERE name = 'default_rich_menu'")
            gv_row = cur.fetchone()
            if gv_row and str(gv_row.get('value')).strip() in all_menu_ids:
                is_default = True
        except Exception:
            pass

        sources_map = {}

        # 1. 如果此選單是全域預設選單，加入系統預設入口
        if is_default:
            sources_map[("default", "系統預設", "全域預設圖文選單", "/richmenu")] = {"current_count": 0, "last_applied_at": None}

        def clean_rule_title(note_str, fallback="關鍵字法則"):
            if not note_str:
                return fallback
            base = str(note_str).split('|UPDATED:')[0].strip()
            clean = base.replace('關鍵字回覆 - ', '').replace(' - 關鍵字回覆', '').replace('問卷管理 - ', '').replace(' - 問卷管理', '').replace(' - 工程用法則', '').replace('工程用法則', '').strip()
            return clean if clean else (base if base else fallback)

        def format_kw_display(content_val):
            if not content_val:
                return "*"
            if isinstance(content_val, list):
                items = [str(c).strip() for c in content_val if str(c).strip()]
                return ", ".join(items) if items else "*"
            s = str(content_val).strip()
            return s.replace("['", "").replace("']", "").replace('["', '').replace('"]', '')

        def is_menu_matched(text_to_search):
            if not text_to_search or not all_menu_ids:
                return False
            t = str(text_to_search)
            return any(mid in t for mid in all_menu_ids)

        matching_sched_rows = []
        matching_q_rows = []
        journey_sched_tags = set()
        sched_lookup_by_content = []

        # 2. 深度掃描 project_schedules (自動旅程排程表)
        try:
            cur.execute(f"""
                SELECT s.schedule_id, s.project_id, s.step_id, s.message_content, p.project_name
                FROM {t_schedules} s
                LEFT JOIN {t_projects} p ON s.project_id = p.project_id
            """)
            all_sched_rows = cur.fetchall()

            for s in all_sched_rows:
                s_pid = str(s.get('project_id') or '')
                p_name = s.get('project_name') or f"旅程 #{s_pid}"
                step_idx = s.get('step_id') or 1
                raw_mc = str(s.get('message_content') or '')
                
                tag_name = None
                q_msg_text = ""
                q_fn_text = ""
                q_check_text = ""

                if raw_mc.startswith('QA|'):
                    parts = raw_mc.split('|')
                    tag_name = parts[-1]
                    journey_sched_tags.add(tag_name)
                    try:
                        cur.execute(f'SELECT msg_rpy, function, "check", state_out FROM {t_qabank} WHERE tag = %s', (tag_name,))
                        q_row = cur.fetchone()
                        if q_row:
                            q_msg_text = str(q_row.get('msg_rpy') or '')
                            q_fn_text = str(q_row.get('function') or '')
                            q_check_text = str(q_row.get('check') or '') + " " + str(q_row.get('state_out') or '')
                    except Exception:
                        pass

                item = {
                    "project_id": s_pid,
                    "project_name": p_name,
                    "step_id": step_idx,
                    "tag": tag_name,
                    "raw_mc": raw_mc,
                    "q_msg_text": q_msg_text,
                    "q_fn_text": q_fn_text,
                    "q_check_text": q_check_text
                }
                sched_lookup_by_content.append(item)

                if is_menu_matched(raw_mc) or is_menu_matched(q_msg_text) or is_menu_matched(q_fn_text) or is_menu_matched(q_check_text):
                    matching_sched_rows.append(item)
                    k = ("journey", p_name, f"步驟 {step_idx} 訊息按鈕切換", f"/projects?projectId={s_pid}")
                    if k not in sources_map:
                        sources_map[k] = {"current_count": 0, "last_applied_at": None}
        except Exception as e:
            print("Error scanning project_schedules for rich menu:", e)

        matching_q_rows = []
        # 3. 主動掃描 Q_bank (關鍵字法則表)
        try:
            cur.execute(f"SELECT * FROM {t_qbank}")
            q_rows = cur.fetchall()
            for r in q_rows:
                r_text = f"{r.get('msg_rpy')} {r.get('function')} {r.get('check')} {r.get('state_out')}"
                if is_menu_matched(r_text):
                    matching_q_rows.append(r)
                    kw_raw = r.get('content')
                    kw_disp = format_kw_display(kw_raw)
                    kw_clean = clean_rule_title(r.get('note'), kw_disp)
                    k = ("keyword", kw_clean, f"觸發關鍵字: {kw_disp}", "/ruledesigner")
                    if k not in sources_map:
                        sources_map[k] = {"current_count": 0, "last_applied_at": None}
        except Exception as e:
            print("Error scanning Q_bank for rich menu:", e)

        # 4. 主動掃描 QA_bank (問答知識庫表，自動排除旅程自帶排程標籤)
        try:
            cur.execute(f"SELECT * FROM {t_qabank}")
            qa_rows = cur.fetchall()
            for r in qa_rows:
                qa_tag = r.get('tag') or f"問答庫 #{r.get('id')}"
                if qa_tag in journey_sched_tags:
                    continue  # 已歸入自動旅程排程
                r_text = f"{r.get('msg_rpy')} {r.get('function')} {r.get('check')} {r.get('state_out')}"
                if is_menu_matched(r_text):
                    matching_q_rows.append(r)
                    qa_clean = clean_rule_title(r.get('note'), qa_tag)
                    k = ("keyword", qa_clean, f"觸發標籤: {qa_tag}", "/ruledesigner")
                    if k not in sources_map:
                        sources_map[k] = {"current_count": 0, "last_applied_at": None}
        except Exception as e:
            print("Error scanning QA_bank for rich menu:", e)

        # 5. 主動掃描 rich_menu_metadata (其他圖文選單按鈕切換)
        try:
            cur.execute(f"SELECT rich_menu_id, ui_uuid, name, data FROM {t_metadata}")
            rm_rows = cur.fetchall()
            for r in rm_rows:
                r_mid = str(r.get('rich_menu_id') or '').strip()
                r_uuid = str(r.get('ui_uuid') or '').strip()
                if (r_mid and r_mid in all_menu_ids) or (r_uuid and r_uuid in all_menu_ids):
                    continue
                data_str = str(r.get('data') or '')
                if is_menu_matched(data_str):
                    rm_name = r.get('name') or "其他圖文選單"
                    k = ("richmenu", rm_name, "選單按鈕切換", "/richmenu")
                    if k not in sources_map:
                        sources_map[k] = {"current_count": 0, "last_applied_at": None}
        except Exception as e:
            print("Error scanning other rich menus:", e)

        # 6. 統計現有用戶套用歸因
        cur.execute(f"SELECT DISTINCT user_id FROM {pv_table} WHERE name = 'rich_menu' AND value = ANY(%s)", (all_menu_ids,))
        explicit_uids = [r['user_id'] for r in cur.fetchall()]

        default_uids = []
        if is_default:
            try:
                cur.execute(f"""
                    SELECT DISTINCT user_id FROM {pv_table}
                    WHERE user_id NOT IN (
                        SELECT user_id FROM {pv_table} WHERE name = 'rich_menu' AND value IS NOT NULL AND value != ''
                    )
                """)
                default_uids = [r['user_id'] for r in cur.fetchall()]
            except Exception:
                pass

        total_uids = list(set(explicit_uids + default_uids))

        meta_rows = {}
        if explicit_uids:
            cur.execute(f"SELECT user_id, value FROM {pv_table} WHERE name = 'rich_menu_meta' AND user_id = ANY(%s)", (explicit_uids,))
            meta_rows = {r['user_id']: r['value'] for r in cur.fetchall()}

        import json
        for uid in total_uids:
            if uid in default_uids and uid not in explicit_uids:
                meta = {
                    "source_type": "default",
                    "source_name": "系統預設",
                    "trigger_display": "全域預設圖文選單",
                    "occurred_at": None,
                    "setting_url": "/richmenu"
                }
            else:
                meta_str = meta_rows.get(uid)
                meta = None
                if meta_str:
                    try: meta = json.loads(meta_str)
                    except: pass

                # 若沒有 meta 或 meta 為 manual（可能是過去舊資料），強制重新檢驗是否符合關鍵字或自動旅程設定
                if not meta or meta.get('source_type') == 'manual':
                    try:
                        cur.execute(f"""
                            SELECT category, content, "timestamp" FROM {t_history}
                            WHERE user_id = %s
                            ORDER BY "timestamp" DESC LIMIT 20
                        """, (uid,))
                        h_rows = cur.fetchall()

                        found_meta = None

                        # A. 優先比對歷程中是否有按鈕或指令切換
                        for h in h_rows:
                            h_content = str(h.get('content') or '')
                            for item in matching_sched_rows:
                                if (item['raw_mc'] and item['raw_mc'] in h_content) or \
                                   (item['tag'] and item['tag'] in h_content) or \
                                   any(mid in h_content for mid in all_menu_ids):
                                    found_meta = {
                                        "source_type": "journey",
                                        "source_name": item['project_name'],
                                        "trigger_display": f"步驟 {item['step_id']} 訊息按鈕切換",
                                        "occurred_at": str(h['timestamp'])[:19] if h.get('timestamp') else None,
                                        "setting_url": f"/projects?projectId={item['project_id']}"
                                    }
                                    break
                            if found_meta: break

                        # B. 比對歷程中的使用者訊息 (Message) 與設定了該選單的關鍵字規則
                        if not found_meta:
                            for h in h_rows:
                                if h.get('category') == 'Message':
                                    msg_text = str(h.get('content') or '').strip()
                                    for r in matching_q_rows:
                                        kw_raw = r.get('content')
                                        if kw_raw:
                                            is_kw_match = False
                                            if isinstance(kw_raw, list):
                                                is_kw_match = any(str(k).strip() and (str(k).strip() == msg_text or str(k).strip() in msg_text or msg_text in str(k).strip()) for k in kw_raw)
                                            else:
                                                s_kw = str(kw_raw).strip()
                                                is_kw_match = s_kw and (s_kw == msg_text or s_kw in msg_text or msg_text in s_kw)
                                            if is_kw_match:
                                                clean_t = clean_rule_title(r.get('note'), format_kw_display(kw_raw))
                                                found_meta = {
                                                    "source_type": "keyword",
                                                    "source_name": clean_t,
                                                    "trigger_display": f"觸發關鍵字: {format_kw_display(kw_raw)}",
                                                    "occurred_at": str(h['timestamp'])[:19] if h.get('timestamp') else None,
                                                    "setting_url": "/ruledesigner"
                                                }
                                                break
                                if found_meta: break

                        # C. 若歷程無直接比對，但系統有明確探測出單一關鍵字/旅程設定，自動歸屬至設定源
                        if not found_meta:
                            if matching_q_rows:
                                r = matching_q_rows[0]
                                kw_raw = r.get('content')
                                clean_t = clean_rule_title(r.get('note'), format_kw_display(kw_raw))
                                found_meta = {
                                    "source_type": "keyword",
                                    "source_name": clean_t,
                                    "trigger_display": f"觸發關鍵字: {format_kw_display(kw_raw)}",
                                    "occurred_at": str(h_rows[0]['timestamp'])[:19] if h_rows and h_rows[0].get('timestamp') else None,
                                    "setting_url": "/ruledesigner"
                                }
                            elif matching_sched_rows:
                                item = matching_sched_rows[0]
                                found_meta = {
                                    "source_type": "journey",
                                    "source_name": item['project_name'],
                                    "trigger_display": f"步驟 {item['step_id']} 訊息按鈕切換",
                                    "occurred_at": str(h_rows[0]['timestamp'])[:19] if h_rows and h_rows[0].get('timestamp') else None,
                                    "setting_url": f"/projects?projectId={item['project_id']}"
                                }

                        if found_meta:
                            meta = found_meta
                    except Exception as e:
                        print("Error resolving user rich menu source:", e)

                if not meta:
                    meta = {
                        "source_type": "manual",
                        "source_name": "人工操作",
                        "trigger_display": "管理後台手動套用",
                        "occurred_at": None,
                        "setting_url": None
                    }

            matched_key = None
            m_type = meta.get('source_type', 'manual')
            m_name = clean_rule_title(meta.get('source_name', '人工操作'))
            m_trig = meta.get('trigger_display', '手動套用')
            m_url = meta.get('setting_url')

            for sk in sources_map.keys():
                if sk[0] == m_type:
                    if (m_name in sk[1] or sk[1] in m_name or m_trig in sk[2] or sk[2] in m_trig):
                        matched_key = sk
                        break

            if not matched_key and m_type == 'keyword':
                kw_keys = [sk for sk in sources_map.keys() if sk[0] == 'keyword']
                if kw_keys:
                    matched_key = kw_keys[0]

            if not matched_key and m_type == 'journey':
                j_keys = [sk for sk in sources_map.keys() if sk[0] == 'journey']
                if j_keys:
                    matched_key = j_keys[0]

            target_key = matched_key if matched_key else (m_type, m_name, m_trig, m_url)
            if target_key not in sources_map:
                sources_map[target_key] = {"current_count": 0, "last_applied_at": meta.get('occurred_at')}
            
            sources_map[target_key]["current_count"] += 1
            if meta.get('occurred_at') and (not sources_map[target_key]["last_applied_at"] or meta.get('occurred_at') > sources_map[target_key]["last_applied_at"]):
                sources_map[target_key]["last_applied_at"] = meta.get('occurred_at')

        # 整理輸出清單：若已有設定的來源，且人工操作為 0 人，則不必顯示空白的人工操作列
        has_config_sources = any(k[0] in ('keyword', 'journey', 'richmenu', 'broadcast', 'form') for k in sources_map.keys())
        manual_key = ("manual", "人工操作", "管理後台手動套用", None)
        if has_config_sources and manual_key in sources_map and sources_map[manual_key]["current_count"] == 0:
            del sources_map[manual_key]

        if not sources_map:
            sources_map[manual_key] = {"current_count": 0, "last_applied_at": None}

        source_list = [
            {
                "source_type": k[0], "source_name": k[1], "trigger_display": k[2], "setting_url": k[3],
                "current_count": v["current_count"], "last_applied_at": v["last_applied_at"]
            } for k, v in sources_map.items()
        ]
        cur.close()
        return jsonify({
            "rich_menu_id": rich_menu_id,
            "total_users": len(total_uids),
            "sources": source_list
        })
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

def bulk_check_and_update_rich_menu(app_name, user_ids=None):
    """
    Recalculates and updates the rich menu for specified users (or all users) 
    based on their current tags and the existing restricted rich menus.
    """
    from psycopg2.extras import RealDictCursor
    conn = get_tenant_conn(app_name=app_name) if app_name else get_tenant_conn()
    tenant_conn = conn
    if not conn: return
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        tenant_cur = cur
        t_private = f'"Private_var:{app_name}"'
        
        # 1. First get ACTIVE restricted menus to know which tags to look for
        t_metadata = f'"rich_menu_metadata:{app_name}"'
        
        cur.execute(f"SELECT rich_menu_id FROM {t_metadata} WHERE status = 'restricted'")
        all_restricted_menu_ids = {r['rich_menu_id'] for r in cur.fetchall()}
        
        cur.execute(f"SELECT rich_menu_id FROM {t_metadata} WHERE rich_menu_id IS NOT NULL")
        all_existing_menu_ids = {r['rich_menu_id'] for r in cur.fetchall()}
        
        cur.execute(f"""
            SELECT rich_menu_id, data FROM {t_metadata} 
            WHERE status = 'restricted' 
              AND (start_time IS NULL OR start_time <= (NOW() AT TIME ZONE 'Asia/Taipei'))
              AND (end_time IS NULL OR end_time > (NOW() AT TIME ZONE 'Asia/Taipei'))
            ORDER BY updated_at DESC
        """)
        active_restricted_menus = cur.fetchall()
        
        menu_tag_map = []
        all_target_tags = set()
        for menu in active_restricted_menus:
            data = menu['data'] or {}
            if isinstance(data, str):
                import json
                try: data = json.loads(data)
                except: data = {}
            tags = set(data.get('targetTags', []))
            if tags and menu.get('rich_menu_id'):
                menu_tag_map.append({
                    'rich_menu_id': menu['rich_menu_id'],
                    'tags': tags,
                    'is_all': 'ALL_USERS' in tags
                })
                all_target_tags.update(tags)

        # 2. Fetch user tags
        user_tags = {}
        tag_hex_to_str = {t.encode('utf-8').hex(): t for t in all_target_tags if t != 'ALL_USERS'}
        query_names = ['tag'] + list(tag_hex_to_str.keys())
        
        conditions = ["name = ANY(%s)"]
        params = [query_names]
        
        if user_ids:
            conditions.append("user_id = ANY(%s)")
            params.append(user_ids)
            
        where_clause = " AND ".join(conditions)
        tenant_cur.execute(f"SELECT user_id, name, value FROM {t_private} WHERE {where_clause}", params)
        for r in tenant_cur.fetchall():
            uid = r['user_id']
            name = r['name']
            val = r['value']
            
            if uid not in user_tags:
                user_tags[uid] = set()
                
            if name == 'tag':
                if isinstance(val, str) and val.startswith('['):
                    import ast
                    try:
                        parsed = ast.literal_eval(val)
                        if isinstance(parsed, list):
                            user_tags[uid].update(parsed)
                        else:
                            user_tags[uid].add(str(parsed))
                    except:
                        user_tags[uid].add(val)
                else:
                    user_tags[uid].update(val.split(',') if ',' in val else [val])
            else:
                # Hex encoded tag
                if val == '1':
                    tag_str = tag_hex_to_str.get(name)
                    if tag_str:
                        user_tags[uid].add(tag_str)

        
        import re
        valid_uid_pattern = re.compile(r'^U[0-9a-fA-F]{32}$')
        def is_valid_uid(uid):
            return uid and isinstance(uid, str) and valid_uid_pattern.match(uid)

        if not user_ids:
            t_users = f'"users:{app_name}"'
            try:
                tenant_cur.execute(f"SELECT user_id FROM {t_users}")
                user_ids = [r['user_id'] for r in tenant_cur.fetchall() if is_valid_uid(r['user_id'])]
            except:
                tenant_conn.rollback()
                # Fallback to Private_var to get all known users in the app
                try:
                    tenant_cur.execute(f"SELECT DISTINCT user_id FROM {t_private}")
                    user_ids = [r['user_id'] for r in tenant_cur.fetchall() if is_valid_uid(r['user_id'])]
                except:
                    tenant_conn.rollback()
                    user_ids = [uid for uid in user_tags.keys() if is_valid_uid(uid)]
        else:
            user_ids = [uid for uid in user_ids if is_valid_uid(uid)]

        # Fetch current user rich_menu
        user_current_menu = {}
        if user_ids:
            tenant_cur.execute(f"SELECT user_id, value FROM {t_private} WHERE name = 'rich_menu' AND user_id = ANY(%s)", (user_ids,))
            for r in tenant_cur.fetchall():
                user_current_menu[r['user_id']] = r['value']
                
        # 3. Determine target rich menu and see if it changed
        user_to_menu = {}
        users_to_unlink = []
        
        for uid in user_ids:
            curr = user_current_menu.get(uid)
            if curr and curr not in all_restricted_menu_ids:
                # Menu no longer exists in database or is not restricted, treat as if user is unassigned
                curr = None
                
            tags = user_tags.get(uid, set())
            assigned_menu = None
            if tags:
                for menu in menu_tag_map:
                    if menu['is_all'] or menu['tags'].intersection(tags):
                        assigned_menu = menu['rich_menu_id']
                        break
            if not assigned_menu:
                for menu in menu_tag_map:
                    if menu['is_all']:
                        assigned_menu = menu['rich_menu_id']
                        break
                        
            # Only perform updates if the assigned menu is different from the current menu
            if assigned_menu != curr:
                if assigned_menu:
                    user_to_menu[uid] = assigned_menu
                elif curr:
                    users_to_unlink.append(uid)
                
        # Group users by target menu
        menu_to_users = {}
        for uid, menu_id in user_to_menu.items():
            menu_to_users.setdefault(menu_id, []).append(uid)
            
        # If no changes are needed, we can exit early!
        if not users_to_unlink and not user_to_menu:
            return
            
        # 4. Perform LINE API bulk link/unlink
        token = getattr(g, 'current_line_token', None)
        if not token:
            from endpoints.richmenu import get_line_token
            token = get_line_token(app_name=app_name)
            
        if token:
            import requests
            headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
            
            # Bulk Unlink
            for i in range(0, len(users_to_unlink), 500):
                batch = users_to_unlink[i:i+500]
                resp = requests.post('https://api.line.me/v2/bot/richmenu/bulk/unlink', headers=headers, json={'userIds': batch})
                
            # Bulk Link
            for menu_id, uids in menu_to_users.items():
                for i in range(0, len(uids), 500):
                    batch = uids[i:i+500]
                    resp = requests.post('https://api.line.me/v2/bot/richmenu/bulk/link', headers=headers, json={'userIds': batch, 'richMenuId': menu_id})
                    
        # 5. Update Database cache
        if users_to_unlink:
            tenant_cur.execute(f"DELETE FROM {t_private} WHERE name = 'rich_menu' AND user_id = ANY(%s)", (users_to_unlink,))
            
        if user_to_menu:
            users_to_link = list(user_to_menu.keys())
            tenant_cur.execute(f"DELETE FROM {t_private} WHERE name = 'rich_menu' AND user_id = ANY(%s)", (users_to_link,))
            
        values = [(uid, 'rich_menu', menu_id) for uid, menu_id in user_to_menu.items()]
        if values:
            execute_values(tenant_cur, f"INSERT INTO {t_private} (user_id, name, value) VALUES %s", values)
            
        if tenant_conn != conn:
            tenant_conn.commit()
        conn.commit()
    except Exception as e:
        print(f"Error in bulk_check_and_update_rich_menu: {e}")
        if tenant_conn: tenant_conn.rollback()
        if conn: conn.rollback()
    finally:
        if tenant_conn and tenant_conn != conn: tenant_conn.close()
        if conn: conn.close()

def check_and_apply_scheduled_rich_menus(app_name):
    from db_utils import get_main_db_connection
    from psycopg2.extras import RealDictCursor
    from endpoints.richmenu import get_line_token, bulk_link_all_users, bulk_check_and_update_rich_menu
    from datetime import datetime
    import requests
    from flask import Flask, g
    
    dummy = Flask(__name__)
    with dummy.app_context():
        g.current_app_name = app_name
        conn = get_tenant_conn(app_name=app_name)
        tenant_conn = conn
        if not conn: return
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            tenant_cur = cur
            
            t_metadata = f'"rich_menu_metadata:{app_name}"'
            
            # 0. Expire old scheduled defaults
            cur.execute(f"""
                UPDATE {t_metadata}
                SET status = 'published'
                WHERE status = 'default'
                  AND end_time IS NOT NULL 
                  AND end_time <= (NOW() AT TIME ZONE 'Asia/Taipei')
            """)
            
            # 1. Check Default Menu
            t_global = f'"Global_var:{app_name}"'
            tenant_cur.execute(f"SELECT value FROM {t_global} WHERE name = 'default_rich_menu'")
            global_var = tenant_cur.fetchone()
            current_default_id = global_var['value'] if global_var else None
            
            cur.execute(f"""
                SELECT rich_menu_id, id FROM {t_metadata}
                WHERE status = 'default'
                  AND (start_time IS NULL OR start_time <= (NOW() AT TIME ZONE 'Asia/Taipei'))
                  AND (end_time IS NULL OR end_time > (NOW() AT TIME ZONE 'Asia/Taipei'))
                ORDER BY start_time DESC NULLS LAST, updated_at DESC
                LIMIT 1
            """)
            active_default = cur.fetchone()
            
            new_default_id = active_default['rich_menu_id'] if active_default else None
            
            if new_default_id != current_default_id:
                # We need to change the default menu
                g.current_line_token = get_line_token(app_name=app_name)
                token = g.current_line_token
                
                if new_default_id:
                    # Link new default to all users using LINE Set default API only (no bulk link to avoid overwriting individual links)
                    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
                    requests.post(f'https://api.line.me/v2/bot/user/all/richmenu/{new_default_id}', headers=headers)
                else:
                    # Unlink default from all users (if there is no active default menu)
                    headers = {'Authorization': f'Bearer {token}'}
                    requests.delete('https://api.line.me/v2/bot/user/all/richmenu', headers=headers)
                
                # Update Global_var
                tenant_cur.execute(f"DELETE FROM {t_global} WHERE name = 'default_rich_menu'")
                if new_default_id:
                    tenant_cur.execute(f"INSERT INTO {t_global} (name, value) VALUES ('default_rich_menu', %s)", (new_default_id,))
                    
            # 2. Check Restricted Menus
            # Query the currently active restricted menus to detect time-based changes
            cur.execute(f"""
                SELECT id, updated_at FROM {t_metadata} 
                WHERE status = 'restricted' 
                  AND (start_time IS NULL OR start_time <= (NOW() AT TIME ZONE 'Asia/Taipei'))
                  AND (end_time IS NULL OR end_time > (NOW() AT TIME ZONE 'Asia/Taipei'))
                ORDER BY updated_at DESC, id DESC
            """)
            active_restricted = cur.fetchall()
            current_state = str([(r['id'], str(r['updated_at'])) for r in active_restricted])
            
            global _LAST_ACTIVE_RESTRICTED_MENUS
            if _LAST_ACTIVE_RESTRICTED_MENUS.get(app_name) != current_state:
                # State has changed (a schedule just started/ended, or a menu was updated)
                g.current_line_token = get_line_token(app_name=app_name)
                bulk_check_and_update_rich_menu(app_name)
                _LAST_ACTIVE_RESTRICTED_MENUS[app_name] = current_state
            
            if tenant_conn != conn:
                tenant_conn.commit()
            conn.commit()
        except Exception as e:
            print(f"Error in check_and_apply_scheduled_rich_menus for {app_name}: {e}")
            if tenant_conn: tenant_conn.rollback()
            if conn: conn.rollback()
        finally:
            if tenant_conn and tenant_conn != conn: tenant_conn.close()
            if conn: conn.close()
