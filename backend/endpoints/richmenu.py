from flask import Blueprint, request, jsonify, g
import requests
import json
from auth import token_required
from datetime import datetime

richmenu_bp = Blueprint('richmenu', __name__)

def get_line_token():
    if hasattr(g, 'current_oa_config') and g.current_oa_config.other_settings:
        return g.current_oa_config.other_settings.get('line_token')
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
            return Response(resp.content, mimetype=resp.headers.get('Content-Type', 'image/png'))
        
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
            return jsonify({'status': 'success'})
        return jsonify({'message': 'Unset default failed', 'line_error': resp.text}), resp.status_code
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

def parse_local_naive(dt_str):
    if not dt_str: return None
    try:
        # ISO format
        return datetime.fromisoformat(dt_str.replace('Z', '')).replace(tzinfo=None)
    except:
        return None

@richmenu_bp.route('/metadata', methods=['GET'], strict_slashes=False)
@token_required
def get_rich_menu_metadata():
    from models import RichMenuMetadata
    oa_id = g.current_oa_id
    metadata = RichMenuMetadata.query.filter_by(oa_id=oa_id).order_by(RichMenuMetadata.created_at.desc()).all()
    
    return jsonify([{
        'id': m.id,
        'oa_id': m.oa_id,
        'rich_menu_id': m.rich_menu_id,
        'name': m.name,
        'chat_bar_text': m.chat_bar_text,
        'status': m.status,
        'start_time': m.start_time.isoformat() if m.start_time else None,
        'end_time': m.end_time.isoformat() if m.end_time else None,
        'created_at': m.created_at.isoformat(),
        'data': m.data
    } for m in metadata])

@richmenu_bp.route('/metadata', methods=['POST'], strict_slashes=False)
@token_required
def save_rich_menu_metadata():
    from models import db, RichMenuMetadata
    oa_id = g.current_oa_id
    data = request.json
    
    id = data.get('id')
    if id:
        m = RichMenuMetadata.query.get(id)
        if not m: return jsonify({'error': 'Not found'}), 404
        # Allow editing if draft or if explicitly requested (e.g. for timer changes)
        # But user said: "如果還沒發布給line api的圖文選單設定可以編輯，但已經發布出去的就不能編輯"
        if m.status == 'published' and data.get('status') != 'published':
             return jsonify({'error': '已發佈的選單不可編輯'}), 400
    else:
        m = RichMenuMetadata(oa_id=oa_id)
        db.session.add(m)
        
    m.name = data.get('name')
    m.chat_bar_text = data.get('chat_bar_text')
    m.data = data.get('data') # The JSON for LINE
    m.status = data.get('status', 'draft')
    m.rich_menu_id = data.get('rich_menu_id')
    m.start_time = parse_local_naive(data.get('start_time'))
    m.end_time = parse_local_naive(data.get('end_time'))
    
    db.session.commit()
    return jsonify({'status': 'success', 'id': m.id})

@richmenu_bp.route('/metadata/<int:id>', methods=['DELETE'])
@token_required
def delete_rich_menu_metadata(id):
    from models import db, RichMenuMetadata
    m = RichMenuMetadata.query.get(id)
    if not m: return jsonify({'error': 'Not found'}), 404
    
    db.session.delete(m)
    db.session.commit()
    return jsonify({'status': 'success'})

@richmenu_bp.route('/link/<richMenuId>', methods=['POST'])
@token_required
def link_rich_menu_to_all(richMenuId):
    """將圖文選單設為全域預設 (Link to All)"""
    token = get_line_token()
    if not token: return jsonify({'message': 'Line token not configured'}), 400
    headers = {'Authorization': f'Bearer {token}'}
    
    resp = requests.post(f'https://api.line.me/v2/bot/user/all/richmenu/{richMenuId}', headers=headers)
    if resp.status_code == 200:
        return jsonify({'status': 'success'})
    return jsonify({'message': 'Link failed', 'error': resp.text}), resp.status_code

@richmenu_bp.route('/unlink', methods=['POST'])
@token_required
def unlink_rich_menu_from_all():
    """解除全域預設圖文選單 (Unlink from All)"""
    token = get_line_token()
    if not token: return jsonify({'message': 'Line token not configured'}), 400
    headers = {'Authorization': f'Bearer {token}'}
    
    resp = requests.delete('https://api.line.me/v2/bot/user/all/richmenu', headers=headers)
    if resp.status_code == 200:
        return jsonify({'status': 'success'})
    return jsonify({'message': 'Unlink failed', 'error': resp.text}), resp.status_code
