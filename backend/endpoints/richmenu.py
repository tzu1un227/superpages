from flask import Blueprint, request, jsonify, g
import requests
import json
from auth import token_required
from datetime import datetime

richmenu_bp = Blueprint('richmenu', __name__)

# 全域記憶體圖片快取，避免重複向 LINE API 發起慢速的外部請求
_IMAGE_CACHE = {}  # { richMenuId: (content, mimetype) }

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
@richmenu_bp.route('/', methods=['GET'], strict_slashes=False)
@token_required
def list_rich_menus():
    token = get_line_token()
    if not token:
        return jsonify({'message': 'Line token not configured'}), 400
    
    headers = {'Authorization': f'Bearer {token}'}
    
    try:
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
        
        for menu in menus:
            menu['status'] = 'default' if menu['richMenuId'] == default_id else 'none'
            menu['aliases'] = [a['richMenuAliasId'] for a in aliases if a['richMenuId'] == menu['richMenuId']]
            
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

            for menu in menus:
                menu['status'] = 'default' if menu['richMenuId'] == default_id else 'none'
                menu['aliases'] = [a['richMenuAliasId'] for a in aliases if a['richMenuId'] == menu['richMenuId']]
                menu['oa_id'] = oa.id
                menu['oa_name'] = oa.oa_name
            
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
def delete_rich_menu(richMenuId):
    token = get_line_token()
    if not token:
        return jsonify({'message': 'Line token not configured'}), 400
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    try:
        # First, find and delete all associated aliases
        alias_resp = requests.get('https://api.line.me/v2/bot/richmenu/alias/list', headers=headers)
        if alias_resp.status_code == 200:
            aliases = alias_resp.json().get('aliases', [])
            for alias in aliases:
                if alias.get('richMenuId') == richMenuId:
                    alias_id = alias.get('richMenuAliasId')
                    print(f"Deleting associated alias: {alias_id}")
                    requests.delete(f'https://api.line.me/v2/bot/richmenu/alias/{alias_id}', headers=headers)
        
        # Then delete the rich menu
        resp = requests.delete(f'https://api.line.me/v2/bot/richmenu/{richMenuId}', headers=headers)
        if resp.status_code == 200:
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
def set_default_rich_menu(richMenuId):
    token = get_line_token()
    if not token:
        return jsonify({'message': 'Line token not configured'}), 400
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    try:
        from db_utils import get_main_db_connection
        from psycopg2.extras import RealDictCursor
        
        # 取消所有個別使用者的綁定，確保 default 選單能覆蓋所有用戶
        try:
            conn = get_main_db_connection()
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
                if app_name:
                    t_private = f'"Private_var:{app_name}"'
                    t_global = f'"Global_var:{app_name}"'
                    cur = conn.cursor(cursor_factory=RealDictCursor)
                    cur.execute(f"SELECT DISTINCT user_id FROM {t_private} WHERE user_id IS NOT NULL")
                    users = cur.fetchall()
                    user_ids = [u['user_id'] for u in users if u.get('user_id')]
                    
                    # 每次最多 500 筆，批次解除綁定
                    for i in range(0, len(user_ids), 500):
                        batch = user_ids[i:i+500]
                        requests.post('https://api.line.me/v2/bot/richmenu/bulk/unlink', headers=headers, json={'userIds': batch})
                    
                    # Cache synchronization: remove individual rich_menu for all users
                    if user_ids:
                        cur.execute(f"DELETE FROM {t_private} WHERE name = 'rich_menu'")
                    
                    # Update global default rich menu
                    cur.execute(f"DELETE FROM {t_global} WHERE name = 'default_rich_menu'")
                    cur.execute(f"INSERT INTO {t_global} (name, value) VALUES ('default_rich_menu', %s)", (richMenuId,))
                    conn.commit()
                    cur.close()
                conn.close()
        except Exception as e:
            print(f"Error unlinking bulk users or caching default menu: {e}")
            
        resp = requests.post(f'https://api.line.me/v2/bot/user/all/richmenu/{richMenuId}', headers=headers)
        if resp.status_code == 200:
            return jsonify({'status': 'success'})
        return jsonify({'message': 'Set default failed', 'line_error': resp.text}), resp.status_code
    except Exception as e:
        return jsonify({'message': 'Error', 'error': str(e)}), 500
@richmenu_bp.route('/set-default', methods=['DELETE'])
@token_required
def unset_default_rich_menu():
    token = get_line_token()
    if not token:
        return jsonify({'message': 'Line token not configured'}), 400
    
    headers = {'Authorization': f'Bearer {token}'}
    
    try:
        resp = requests.delete('https://api.line.me/v2/bot/user/all/richmenu', headers=headers)
        if resp.status_code == 200:
            try:
                from db_utils import get_main_db_connection
                conn = get_main_db_connection()
                if conn:
                    app_name = getattr(g, 'current_app_name', None)
                    if not app_name:
                        oa_id = getattr(g, 'current_oa_id', None)
                        if oa_id:
                            from models import OAConfig
                            oa = OAConfig.query.get(oa_id)
                            if oa and oa.other_settings and oa.other_settings.get('app_name'):
                                app_name = str(oa.other_settings['app_name'])
                    if app_name:
                        t_global = f'"Global_var:{app_name}"'
                        cur = conn.cursor()
                        cur.execute(f"DELETE FROM {t_global} WHERE name = 'default_rich_menu'")
                        conn.commit()
                        cur.close()
                    conn.close()
            except Exception as e:
                print(f"Error removing default rich menu cache: {e}")
            return jsonify({'status': 'success'})
        return jsonify({'message': 'Unset default failed', 'line_error': resp.text}), resp.status_code
    except Exception as e:
        return jsonify({'message': 'Error', 'error': str(e)}), 500

@richmenu_bp.route('/clear-all', methods=['POST'])
@token_required
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
        from db_utils import get_main_db_connection
        from psycopg2.extras import RealDictCursor
        from flask import g
        conn = get_main_db_connection()
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
        from db_utils import get_main_db_connection
        from psycopg2.extras import RealDictCursor
        from flask import g
        conn = get_main_db_connection()
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
    from db_utils import get_main_db_connection
    from psycopg2.extras import RealDictCursor
    oa_id = g.current_oa_id
    
    try:
        t_metadata = get_t('rich_menu_metadata')
        conn = get_main_db_connection()
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
def save_rich_menu_metadata():
    from db_utils import get_main_db_connection
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
    
    try:
        t_metadata = get_t('rich_menu_metadata')
        conn = get_main_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            if id:
                cur.execute(f"SELECT * FROM {t_metadata} WHERE id = %s", (id,))
                m = cur.fetchone()
                if not m: return jsonify({'error': 'Not found'}), 404
                if m['status'] == 'published' and status != 'published':
                    return jsonify({'error': '已發佈的選單不可編輯'}), 400
                
                cur.execute(f"""
                    UPDATE {t_metadata}
                    SET name=%s, chat_bar_text=%s, data=%s, status=%s, rich_menu_id=%s, start_time=%s, end_time=%s, permission_tags=%s, fallback_message=%s, updated_at=(NOW() AT TIME ZONE 'Asia/Taipei')
                    WHERE id=%s
                """, (name, chat_bar_text, data_json, status, rich_menu_id, start_time, end_time, permission_tags, fallback_message, id))
                conn.commit()
                return_id = id
            else:
                cur.execute(f"""
                    INSERT INTO {t_metadata} (oa_id, name, chat_bar_text, data, status, rich_menu_id, start_time, end_time, permission_tags, fallback_message, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, (NOW() AT TIME ZONE 'Asia/Taipei'), (NOW() AT TIME ZONE 'Asia/Taipei')) RETURNING id
                """, (oa_id, name, chat_bar_text, data_json, status, rich_menu_id, start_time, end_time, permission_tags, fallback_message))
                return_id = cur.fetchone()['id']
                conn.commit()

            # Async trigger for rich menu update
            if status in ['public', 'restricted']:
                import threading
                app_name = getattr(g, 'current_app_name', None)
                def trigger_update(app_name_val, stat, r_id):
                    import time
                    time.sleep(1.5)  # Wait for LINE server to process the newly uploaded image
                    try:
                        # Setup fake context
                        from flask import Flask, g
                        dummy_app = Flask(__name__)
                        with dummy_app.app_context():
                            g.current_app_name = app_name_val
                            from endpoints.richmenu import get_line_token, bulk_check_and_update_rich_menu
                            token = get_line_token(app_name=app_name_val)
                            g.current_line_token = token
                            if stat == 'public':
                                # bulk link to all users
                                headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
                                bulk_link_all_users(headers, r_id)
                            elif stat == 'restricted':
                                bulk_check_and_update_rich_menu(app_name_val)
                    except Exception as e:
                        print(f"Error in background rich menu update: {e}")
                
                if rich_menu_id:
                    threading.Thread(target=trigger_update, args=(app_name, status, rich_menu_id)).start()

            return jsonify({'status': 'success', 'id': return_id})
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@richmenu_bp.route('/metadata/<int:id>', methods=['DELETE'])
@token_required
def delete_rich_menu_metadata(id):
    from db_utils import get_main_db_connection
    try:
        t_metadata = get_t('rich_menu_metadata')
        conn = get_main_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(f"SELECT rich_menu_id FROM {t_metadata} WHERE id = %s", (id,))
            m = cur.fetchone()
            rich_menu_id = m[0] if m else None

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
def link_rich_menu_to_all(richMenuId):
    """將圖文選單個別綁定至全體用戶 (Individual Bulk Link to All) 或觸發限定標籤綁定"""
    token = get_line_token()
    if not token: return jsonify({'message': 'Line token not configured'}), 400
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    app_name = getattr(g, 'current_app_name', None)
    if app_name:
        from db_utils import get_main_db_connection
        conn = get_main_db_connection()
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

def bulk_check_and_update_rich_menu(app_name, user_ids=None):
    """
    Recalculates and updates the rich menu for specified users (or all users) 
    based on their current tags and the existing restricted rich menus.
    """
    from db_utils import get_main_db_connection
    from psycopg2.extras import RealDictCursor, execute_values
    from flask import g
    import ast
    
    conn = get_main_db_connection()
    if not conn: return
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        t_private = f'"Private_var:{app_name}"'
        
        # 1. Fetch user tags
        user_tags = {}
        conditions = ["name = 'tag'"]
        params = []
        if user_ids:
            conditions.append("user_id = ANY(%s)")
            params.append(user_ids)
            
        where_clause = " AND ".join(conditions)
        cur.execute(f"SELECT user_id, value FROM {t_private} WHERE {where_clause}", params)
        for r in cur.fetchall():
            val = r['value']
            if isinstance(val, str) and val.startswith('['):
                try:
                    parsed = ast.literal_eval(val)
                    user_tags[r['user_id']] = set(parsed) if isinstance(parsed, list) else {str(parsed)}
                except:
                    user_tags[r['user_id']] = {val}
            else:
                # If it's comma separated, we can split it. Or just use as is.
                user_tags[r['user_id']] = set(val.split(',')) if ',' in val else {val}
                
        # 2. Get all restricted rich menus ordered by updated_at DESC (highest priority first)
        t_metadata = f'"rich_menu_metadata:{app_name}"'
        cur.execute(f"SELECT rich_menu_id, data FROM {t_metadata} WHERE status = 'restricted' ORDER BY updated_at DESC")
        restricted_menus = cur.fetchall()
        
        menu_tag_map = []
        for menu in restricted_menus:
            data = menu['data'] or {}
            if isinstance(data, str):
                import json
                try:
                    data = json.loads(data)
                except Exception:
                    data = {}
            tags = set(data.get('targetTags', []))
            if tags and menu.get('rich_menu_id'):
                menu_tag_map.append({
                    'rich_menu_id': menu['rich_menu_id'],
                    'tags': tags
                })
        print(f"DEBUG: bulk_check_and_update_rich_menu | menu_tag_map: {menu_tag_map}")
        
        # Determine all user IDs to process (if not provided, fetch all users from `users` table)
        if not user_ids:
            t_users = f'"users:{app_name}"'
            try:
                cur.execute(f"SELECT user_id FROM {t_users}")
                user_ids = [r['user_id'] for r in cur.fetchall()]
            except:
                conn.rollback()
                user_ids = list(user_tags.keys())
        print(f"DEBUG: bulk_check_and_update_rich_menu | processing {len(user_ids)} users. user_tags size: {len(user_tags)}")
                
        # 3. Determine target rich menu for each user
        user_to_menu = {}
        users_to_unlink = []
        
        for uid in user_ids:
            tags = user_tags.get(uid, set())
            assigned = False
            if tags:
                for menu in menu_tag_map:
                    if menu['tags'].intersection(tags):
                        user_to_menu[uid] = menu['rich_menu_id']
                        assigned = True
                        break
            if not assigned:
                users_to_unlink.append(uid)
                
        # Group users by target menu
        menu_to_users = {}
        for uid, menu_id in user_to_menu.items():
            menu_to_users.setdefault(menu_id, []).append(uid)
            
        print(f"DEBUG: bulk_check_and_update_rich_menu | menu_to_users: {menu_to_users}")
            
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
                if resp.status_code != 202:
                    print(f"Error unlinking users: {resp.status_code} {resp.text}")
                
            # Bulk Link
            for menu_id, uids in menu_to_users.items():
                for i in range(0, len(uids), 500):
                    batch = uids[i:i+500]
                    resp = requests.post('https://api.line.me/v2/bot/richmenu/bulk/link', headers=headers, json={'userIds': batch, 'richMenuId': menu_id})
                    if resp.status_code != 202:
                        print(f"Error linking menu {menu_id}: {resp.status_code} {resp.text}")
                    
        # 5. Sync to Private_var
        if user_ids:
            cur.execute(f"DELETE FROM {t_private} WHERE name = 'rich_menu' AND user_id = ANY(%s)", (user_ids,))
            
        values = [(uid, 'rich_menu', menu_id) for uid, menu_id in user_to_menu.items()]
        if values:
            execute_values(cur, f"INSERT INTO {t_private} (user_id, name, value) VALUES %s", values)
            
        conn.commit()
    except Exception as e:
        print(f"Error in bulk_check_and_update_rich_menu: {e}")
        if conn: conn.rollback()
    finally:
        if conn: conn.close()
