from flask import Blueprint, request, jsonify
from models import db, User, Page, OAConfig
from auth import token_required, admin_required

admin_bp = Blueprint('admin', __name__)

# --- User Management ---

@admin_bp.route('/users', methods=['GET'])
@token_required
@admin_required
def get_users():
    try:
        users = User.query.all()
        user_list = []
        for user in users:
            user_list.append({
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'role': user.role,
                'allowed_oa_configs': user.allowed_oa_configs,
                'created_at': user.created_at.isoformat() if user.created_at else None
            })
        return jsonify(user_list)
    except Exception as e:
        print(f"Error in get_users: {e}")
        return jsonify({'message': 'Error fetching users', 'error': str(e)}), 500

@admin_bp.route('/users', methods=['POST'])
@token_required
@admin_required
def create_user():
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'message': 'Email is required'}), 400
        
    if User.query.filter_by(email=email).first():
        return jsonify({'message': 'User already exists'}), 400
        
    new_user = User(
        email=email,
        name=data.get('name'),
        role=data.get('role', 'user'),
        allowed_oa_configs=data.get('allowed_oa_configs', [])
    )
    
    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'message': 'User created successfully', 'id': new_user.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Error creating user', 'error': str(e)}), 500

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
        
    try:
        db.session.delete(user)
        db.session.commit()
        return jsonify({'message': 'User deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Error deleting user', 'error': str(e)}), 500
        
@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@token_required
@admin_required
def update_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
    
    data = request.get_json()
    if 'name' in data:
        user.name = data['name']
    if 'role' in data:
        user.role = data['role']
    if 'allowed_oa_configs' in data:
        user.allowed_oa_configs = data['allowed_oa_configs']
        
    try:
        db.session.commit()
        return jsonify({'message': 'User updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Error updating user', 'error': str(e)}), 500

@admin_bp.route('/pages', methods=['GET'])
@token_required
@admin_required
def get_pages():
    pages = Page.query.all()
    page_list = []
    for page in pages:
        page_list.append({
            'id': page.id,
            'name': page.name,
            'description': page.description
        })
    return jsonify(page_list)

# --- OA Config Management ---

@admin_bp.route('/oa_configs', methods=['GET'])
@token_required
@admin_required
def get_oa_configs():
    configs = OAConfig.query.all()
    config_list = []
    for config in configs:
        config_list.append({
            'id': config.id,
            'page_id': config.page_id,
            'oa_name': config.oa_name,
            'db_url': config.db_url,
            'other_settings': config.other_settings
        })
    return jsonify(config_list)

@admin_bp.route('/oa_configs', methods=['POST'])
@token_required
@admin_required
def create_oa_config():
    data = request.get_json()
    # Basic validation
    if not data.get('oa_name') or not data.get('db_url'):
        return jsonify({'message': 'OA Name and DB URL are required'}), 400
        
    # Valid page_id required
    page_id = data.get('page_id')
    if not page_id:
        return jsonify({'message': 'Page ID is required'}), 400 
    
    new_config = OAConfig(
        page_id=page_id,
        oa_name=data.get('oa_name'),
        db_url=data.get('db_url'),
        other_settings=data.get('other_settings', {})
    )
    
    try:
        db.session.add(new_config)
        db.session.commit()
        return jsonify({'message': 'OA Config created successfully', 'id': new_config.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Error creating OA Config', 'error': str(e)}), 500

@admin_bp.route('/oa_configs/<int:config_id>', methods=['PUT'])
@token_required
@admin_required
def update_oa_config(config_id):
    config = OAConfig.query.get(config_id)
    if not config:
        return jsonify({'message': 'OA Config not found'}), 404
        
    data = request.get_json()
    if 'page_id' in data:
        config.page_id = data['page_id']
    if 'oa_name' in data:
        config.oa_name = data['oa_name']
    if 'db_url' in data:
        config.db_url = data['db_url']
    if 'other_settings' in data:
        config.other_settings = data['other_settings']
        
    try:
        db.session.commit()
        return jsonify({'message': 'OA Config updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Error updating OA Config', 'error': str(e)}), 500

@admin_bp.route('/oa_configs/<int:config_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_oa_config(config_id):
    config = OAConfig.query.get(config_id)
    if not config:
        return jsonify({'message': 'OA Config not found'}), 404
        
    try:
        db.session.delete(config)
        db.session.commit()
        return jsonify({'message': 'OA Config deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Error deleting OA Config', 'error': str(e)}), 500
